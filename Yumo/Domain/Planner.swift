import Foundation
import SwiftData

/// The planner (21 Oct): when the staples don't cover a class — no carb, no fat, protein that can't reach the target — it fills the gap from a
/// candidate pool and sizes the pick like any staple. The pool is data, not code: Resources/Catalogue/planner.csv, ~36 everyday UK foods by
/// class with a portion and a meal hint, each resolved to a catalogue row by name. What the user says sticks: "never again" removes a food
/// for good, "more like this" pins it; logging a plan is a soft like. Days rotate through the pool unless something is pinned.
enum Planner {
    struct Candidate { let kind: Balance.Kind; let label: String; let match: String; let state: String; let portion: Double; let meal: String; let dense: Bool; let tags: Set<String> }
    /// What a person can say they don't eat (22 Oct): the planner never suggests a food carrying one of these tags (planner.csv › tags).
    static let exclusions: [(tag: String, label: String)] = [("meat", "Meat"), ("fish", "Fish"), ("dairy", "Dairy"), ("egg", "Eggs"), ("nuts", "Nuts"), ("gluten", "Gluten")]
    /// A candidate resolved to the catalogue row it names.
    struct Pick { let food: Food; let candidate: Candidate }

    static let pool: [Candidate] = {
        guard let url = Bundle.main.url(forResource: "planner", withExtension: "csv"), let text = try? String(contentsOf: url, encoding: .utf8) else { return [] }
        var out: [Candidate] = []
        for line in text.split(separator: "\n").dropFirst() {
            let cols = csvColumns(String(line)); guard cols.count >= 7 else { continue }
            let kind: Balance.Kind = cols[0] == "protein" ? .protein : cols[0] == "carb" ? .carb : cols[0] == "fat" ? .fat : .veg
            let tags = cols.count > 8 ? Set(cols[8].split(whereSeparator: { $0 == " " || $0 == "|" }).map(String.init)) : []
            out.append(Candidate(kind: kind, label: cols[1], match: cols[2], state: cols[3], portion: Double(cols[4]) ?? 100, meal: cols[5], dense: cols[6] == "1", tags: tags))
        }
        return out
    }()
    private static func csvColumns(_ line: String) -> [String] {
        var out: [String] = [], cur = "", q = false
        for ch in line { if ch == "\"" { q.toggle() } else if ch == "," && !q { out.append(cur); cur = "" } else { cur.append(ch) } }
        out.append(cur); return out
    }

    // resolved picks, cached per food count (the catalogue doesn't change while the sheet is open)
    private static var cache: (count: Int, picks: [Pick])? = nil
    @MainActor static func picks(all: [Food]) -> [Pick] {
        if let c = cache, c.count == all.count { return c.picks }
        let generic = all.filter { $0.tier == .generic && !$0.macrosUnknown }
        var picks: [Pick] = []
        for c in pool {
            let hits = generic.filter { f in
                f.name.lowercased().range(of: c.match, options: .regularExpression) != nil && (c.state.isEmpty || (f.state ?? "").lowercased().range(of: c.state, options: .regularExpression) != nil)
            }.sorted { a, b in
                let ua = a.source == .cofid ? 0 : 1, ub = b.source == .cofid ? 0 : 1   // UK first, then the plainest name
                return ua != ub ? ua < ub : a.name.count < b.name.count
            }
            if let f = hits.first { picks.append(Pick(food: f, candidate: c)) }
        }
        cache = (all.count, picks); return picks
    }

    /// Stable day-to-day rotation: the same food gets the same jitter on the same day on every device, a different one tomorrow.
    static func jitter(_ dayKey: String, _ id: String) -> Double {
        var h: UInt32 = 5381; for b in (dayKey + id).utf8 { h = h &* 33 &+ UInt32(b) }
        return Double(h % 1000) / 1000 * 0.8
    }

    /// Candidates of a class, best first. `needDense`: protein per calorie matters (the day is short on protein, not on food).
    /// `exclude`: foods already in the plan (staples, weighed, other picks). `chosen`: a swap the user made this session, which wins outright.
    @MainActor static func ranked(_ kind: Balance.Kind, needDense: Bool, needEnergy: Bool = false, exclude: Set<String>, chosen: String?, dayKey: String, store: Store, all: [Food]) -> [Pick] {
        let prefs = store.preferences()
        let never = Set(prefs.filter { $0.verdict == .never }.map(\.foodId)), liked = Set(prefs.filter { $0.verdict == .liked }.map(\.foodId))
        let excluded = Set(store.profile().plannerExclude)
        let cands = picks(all: all).filter { $0.candidate.kind == kind && !exclude.contains($0.food.id) && !never.contains($0.food.id) && $0.candidate.tags.isDisjoint(with: excluded) }
        // "more like this": liked foods of this class pull up the candidates closest to them in protein / carb / fat balance
        let likedProfiles = all.filter { liked.contains($0.id) && Balance.classify($0) == kind }.map(profile)
        func score(_ p: Pick) -> Double {
            if p.food.id == chosen { return 100 }
            var s = jitter(dayKey, p.food.id)
            if liked.contains(p.food.id) { s += 3 }                    // pinned: liked foods come back every day
            else if let near = likedProfiles.map({ similarity($0, profile(p.food)) }).max() { s += near * 1.2 }
            s += log(1 + Double(p.food.useCount)) * 0.5                 // what you already log is familiar
            if needDense { s += p.food.p100 / 10 }                      // protein is short: protein per 100 g decides (whey 9, tuna 2.5, cottage cheese 0.9)
            if needEnergy { s += p.food.kcal100 / 100 + (p.candidate.meal == "main" ? 1 : 0) }   // the day is short on food: a main-meal carb with calories (rice 3.5, apples 0.5)
            return s
        }
        return cands.sorted { score($0) > score($1) }
    }
    /// Where a food's calories come from: (protein, carb, fat) shares, summing to ~1.
    static func profile(_ f: Food) -> (Double, Double, Double) {
        let p = f.p100 * 4, c = f.c100 * 3.75, fat = f.f100 * 9, t = max(1, p + c + fat)
        return (p / t, c / t, fat / t)
    }
    /// 1 for the same balance, 0 at a distance of 0.5 or more (Greek yogurt 0 % ~ cottage cheese 0.9; ~ rice 0).
    static func similarity(_ a: (Double, Double, Double), _ b: (Double, Double, Double)) -> Double {
        let d = ((a.0 - b.0) * (a.0 - b.0) + (a.1 - b.1) * (a.1 - b.1) + (a.2 - b.2) * (a.2 - b.2)).squareRoot()
        return max(0, 1 - d / 0.5)
    }
    /// The next-best foods of the same class, for the swap sheet.
    /// Alternatives that fit the meal the row sits in: a breakfast egg swaps for yogurt or cottage cheese before tuna; a main-meal carb
    /// for rice or pasta before an apple. Foods for other meals follow, so the list is never empty.
    @MainActor static func alternatives(to food: Food, kind: Balance.Kind, meal: Meal, inPlan: Set<String>, dayKey: String, store: Store, all: [Food], count: Int = 4) -> [Pick] {
        let main = meal == .lunch || meal == .dinner
        let hint = meal == .breakfast ? "breakfast" : meal == .snacks ? "snack" : "main"
        let ranked = ranked(kind, needDense: kind == .protein, needEnergy: main && kind != .veg, exclude: inPlan.union([food.id]), chosen: nil, dayKey: dayKey, store: store, all: all)
        let fits = ranked.filter { $0.candidate.meal == hint || $0.candidate.meal == "any" }
        return Array((fits + ranked.filter { p in !fits.contains { $0.food.id == p.food.id } }).prefix(count))
    }
    /// Which empty meal a candidate goes to: its hint when that meal is empty, else the solver's usual rule.
    static func meal(for c: Candidate, empty: [Meal], fallback: Meal) -> Meal {
        switch c.meal {
        case "breakfast": return empty.contains(.breakfast) ? .breakfast : fallback
        case "snack": return empty.contains(.snacks) ? .snacks : fallback
        default: return fallback
        }
    }
}
