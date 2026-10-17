import Foundation
import SwiftData

/// I prepped… solver (README §1a, rev 6). Deterministic: weighed foods are fixed, every other staple is sized so the day lands on the targets.
enum Balance {
    enum Kind { case veg, protein, fat, carb }
    /// Classify by the per-100 g profile, fat first: < 50 kcal → veg; fat share ≥ 60 % → fat; protein share ≥ 30 % or (≥ 15 g P and fat share < 50 %) → protein; else carb.
    static func classify(_ f: Food) -> Kind {
        if f.kcal100 < 50 { return .veg }
        let k = max(1, f.kcal100), fs = f.f100 * 9 / k, ps = f.p100 * 4 / k
        if fs >= 0.60 { return .fat }
        if ps >= 0.30 || (f.p100 >= 15 && fs < 0.50) { return .protein }
        return .carb
    }
    static func seed(_ k: Kind) -> Double { switch k { case .protein: 300; case .carb: 200; case .fat: 10; case .veg: 150 } }
    static func className(_ k: Kind) -> String { switch k { case .protein: "Protein"; case .veg: "Veg"; case .fat: "Fat"; case .carb: "Carb" } }
    static func macroKey(_ k: Kind) -> KeyPath<Food, Double> { switch k { case .protein: \.p100; case .fat: \.f100; default: \.c100 } }

    struct PlanItem: Identifiable { var id: String { food.id + "|" + meal.rawValue }; var food: Food; var meal: Meal; var grams: Double; var weighed: Bool; var atMax: Bool; var note: String? }
    struct Result { var items: [PlanItem]; var projected: DayTotals; var leftKcal: Double; var emptyMeals: [Meal]; var ok: Bool; var status: String; var statusDanger: Bool; var fromStaples: Bool; var weighedCount: Int }
    private struct Flex { var food: Food; var kind: Kind; var seed: Double; var meal: Meal; var maxG: Double?; var grams: Double = 0; var split: [Meal]? = nil
        var cap: Double { maxG ?? (seed * 3 + 100) } }

    /// Breakfast / Snacks guesses by name; else nil (then the class alternates across the empty mains).
    static func guessMeal(_ f: Food, empty: [Meal]) -> Meal? {
        let n = f.name.lowercased()
        let bf = n.range(of: #"oat|granola|cornflake|weetabix|cereal|egg|yogurt|yoghurt|skyr|milk|banana|berr|honey|bread|bagel|toast"#, options: .regularExpression) != nil
        let sn = n.range(of: #"yogurt|yoghurt|skyr|whey|protein|nut|almond|walnut|cashew|peanut|pistachio|bar|rice cake|apple|dates|chocolate|fruit"#, options: .regularExpression) != nil
        if bf { if sn && empty.contains(.snacks) && !n.contains("egg") { return .snacks }; return empty.contains(.breakfast) ? .breakfast : nil }
        if sn { return empty.contains(.snacks) ? .snacks : nil }
        return nil
    }

    @MainActor static func solve(dayKey: String, weighed: [PrepItem], store: Store) -> Result {
        let p = store.profile(); let t = store.targets()
        let target = (kcal: Double(t.kcal(training: store.isTraining(dayKey), profile: p)), p: Double(t.protein), c: Double(t.carbs), f: Double(t.fat))
        let logged = store.entries(dayKey); let eaten = DayTotals(logged)
        let empty = Meal.allCases.filter { m in !logged.contains { $0.meal == m } }
        let mains = empty.filter { $0 == .lunch || $0 == .dinner }
        let staples = store.staples(); let fromStaples = !staples.isEmpty
        let all = store.foods()
        // --- resolve the weighed foods (any food), netting off what is already logged today
        var W: [(Food, Double)] = []
        for it in weighed where it.grams > 0 {
            let f = it.foodId.flatMap { store.food(id: $0) } ?? TypeToLog.candidates(for: it.text, store: store, all: all).first?.food
            guard let f else { continue }
            let already = logged.filter { $0.food?.id == f.id }.reduce(0) { $0 + $1.grams }
            let g = max(0, it.grams - already); if g > 0 { W.append((f, g)) }
        }
        let weighedIds = Set(W.map(\.0.id))
        // --- meal for every food: learned pattern → name guess → alternation per class across the empty mains
        var counters: [Kind: Int] = [:]
        func mealFor(_ f: Food) -> Meal {
            let word = f.shortName.lowercased()
            for m in empty { if let l = TypeToLog.learned(word, meal: m, store: store), l.foodId == f.id { return m } }
            if let g = guessMeal(f, empty: empty) { return g }
            let k = classify(f)
            if mains.isEmpty { return empty.first ?? .dinner }
            let m = mains[(counters[k] ?? 0) % mains.count]; counters[k, default: 0] += 1; return m
        }
        // --- flexible foods: the staples that were not weighed (else the history pattern when there are no staples)
        var flex: [Flex] = []
        if fromStaples {
            for st in staples { guard let f = store.food(id: st.foodId) else { continue }
                let k = classify(f); let m = mealFor(f)
                if !weighedIds.contains(f.id) { flex.append(Flex(food: f, kind: k, seed: seed(k), meal: m, maxG: st.maxG)) } }
        } else {
            var usual = usualPattern(for: empty, today: dayKey, store: store)
            if usual.isEmpty { usual = defaultPattern(for: empty, store: store) }
            for (f, m, g) in usual where !weighedIds.contains(f.id) { flex.append(Flex(food: f, kind: classify(f), seed: g, meal: m, maxG: nil)) }
            if !flex.contains(where: { $0.kind == .carb }), let c = fallback(.carb, store: store) { flex.append(Flex(food: c, kind: .carb, seed: 150, meal: empty.first ?? .dinner, maxG: nil)) }
            if !flex.contains(where: { $0.kind == .fat }), let o = fallback(.fat, store: store) { flex.append(Flex(food: o, kind: .fat, seed: 10, meal: empty.first ?? .dinner, maxG: nil)) }
        }
        // --- a single carb / fat / veg for two empty mains is solved once and split across both
        if mains.count == 2 { for k in [Kind.fat, .veg, .carb] { let idx = flex.indices.filter { flex[$0].kind == k && mains.contains(flex[$0].meal) }; if idx.count == 1 { flex[idx[0]].split = mains } } }
        // --- fixed: weighed + veg at its seed
        var locked = (kcal: 0.0, p: 0.0, c: 0.0, f: 0.0)
        for (f, g) in W { locked.kcal += f.kcal100 * g / 100; locked.p += f.p100 * g / 100; locked.c += f.c100 * g / 100; locked.f += f.f100 * g / 100 }
        for i in flex.indices where flex[i].kind == .veg { flex[i].grams = flex[i].seed; let f = flex[i].food, g = flex[i].seed; locked.kcal += f.kcal100 * g / 100; locked.p += f.p100 * g / 100; locked.c += f.c100 * g / 100; locked.f += f.f100 * g / 100 }
        let moving = flex.indices.filter { flex[$0].kind != .veg }
        func rem(_ key: KeyPath<Food, Double>, lockedV: Double, targetV: Double, eatenV: Double) -> Double {
            targetV - eatenV - lockedV - moving.reduce(0) { $0 + flex[$1].grams * flex[$1].food[keyPath: key] / 100 }
        }
        func remaining(_ k: Kind) -> Double { switch k { case .protein: rem(\.p100, lockedV: locked.p, targetV: target.p, eatenV: eaten.p); case .fat: rem(\.f100, lockedV: locked.f, targetV: target.f, eatenV: eaten.f); default: rem(\.c100, lockedV: locked.c, targetV: target.c, eatenV: eaten.c) } }
        func r5(_ v: Double) -> Double { max(0, (v / 5).rounded() * 5) }
        // --- sizing: 3 passes so cross-contributions count; capped foods first get an equal share, uncapped split the rest, then top up
        for _ in 0..<3 {
            for k in [Kind.protein, .fat, .carb] {
                let group = moving.filter { flex[$0].kind == k }; guard !group.isEmpty else { continue }
                for i in group { flex[i].grams = 0 }
                let key = macroKey(k)
                let need = max(0, remaining(k)); let share = need / Double(group.count)
                let capped = group.filter { flex[$0].maxG != nil }, open = group.filter { flex[$0].maxG == nil }
                for i in capped { let per = flex[i].food[keyPath: key] / 100; flex[i].grams = per > 0 ? min(flex[i].maxG!, r5(share / per)) : 0 }
                let remOpen = max(0, remaining(k))
                for i in open { let per = flex[i].food[keyPath: key] / 100; flex[i].grams = per > 0 ? min(flex[i].cap, r5(remOpen / Double(open.count) / per)) : 0 }
                var left = max(0, remaining(k))
                for i in group.sorted(by: { (flex[$0].maxG ?? 1e9) > (flex[$1].maxG ?? 1e9) }) {
                    guard left > 0 else { break }
                    let per = flex[i].food[keyPath: key] / 100; guard per > 0 else { continue }
                    let room = flex[i].cap - flex[i].grams
                    flex[i].grams += min(room, r5(left / per)); left = max(0, remaining(k))
                }
            }
        }
        // --- absorber: the largest flexible carb (else the fat, never a protein) lands kcal exactly, within its Max
        let remKcal = { () -> Double in target.kcal - eaten.kcal - locked.kcal - moving.reduce(0) { $0 + flex[$1].grams * flex[$1].food.kcal100 / 100 } }
        if let a = moving.filter({ flex[$0].kind == .carb }).max(by: { flex[$0].seed < flex[$1].seed }) ?? moving.first(where: { flex[$0].kind == .fat }) {
            flex[a].grams = 0
            let kpg = flex[a].food.kcal100 / 100; if kpg > 0 { flex[a].grams = min(flex[a].cap, r5(max(0, remKcal()) / kpg)) }
        }
        // --- plan rows
        var items: [PlanItem] = []
        for (f, g) in W { items.append(PlanItem(food: f, meal: mealFor(f), grams: g, weighed: true, atMax: false, note: nil)) }
        for fx in flex {
            let atMax = fx.maxG.map { fx.grams >= $0 } ?? false
            if let sm = fx.split, fx.grams >= 10 { let a = (fx.grams / 2 / 5).rounded() * 5; items.append(PlanItem(food: fx.food, meal: sm[0], grams: a, weighed: false, atMax: atMax, note: nil)); items.append(PlanItem(food: fx.food, meal: sm[1], grams: fx.grams - a, weighed: false, atMax: atMax, note: nil)) }
            else { items.append(PlanItem(food: fx.food, meal: fx.meal, grams: fx.grams, weighed: false, atMax: atMax, note: nil)) }
        }
        var proj = eaten; for it in items { proj.kcal += it.food.kcal100 * it.grams / 100; proj.p += it.food.p100 * it.grams / 100; proj.c += it.food.c100 * it.grams / 100; proj.f += it.food.f100 * it.grams / 100 }
        let dk = proj.kcal - target.kcal
        let ok = abs(dk) <= 40 && proj.p >= target.p - 5
        var status = ok ? "Lands on target" : (dk > 40 ? "Over by \(Fmt.k(dk)) kcal" : proj.p < target.p - 5 ? "Protein short by \(Fmt.g(target.p - proj.p)) g" : "Short by \(Fmt.k(-dk)) kcal")
        if !ok, dk < -40, fromStaples, !flex.contains(where: { ($0.kind == .carb || $0.kind == .fat) }) || flex.filter({ $0.kind != .veg }).allSatisfy({ $0.maxG != nil && $0.grams >= $0.maxG! }) { status = "Short by \(Fmt.k(-dk)) kcal · add a carb or fat staple" }
        let order = Meal.allCases
        return Result(items: items.sorted { order.firstIndex(of: $0.meal)! < order.firstIndex(of: $1.meal)! }, projected: proj, leftKcal: target.kcal - eaten.kcal, emptyMeals: empty, ok: ok, status: status, statusDanger: !ok, fromStaples: fromStaples, weighedCount: W.count)
    }

    /// Usual pattern for the empty meals when there are no staples: the most recent day that has entries for them.
    @MainActor static func usualPattern(for meals: [Meal], today: String, store: Store) -> [(Food, Meal, Double)] {
        var out: [(Food, Meal, Double)] = []
        for m in meals { var d = Date.fromKey(today); for _ in 0..<60 { d = d.adding(days: -1); let es = store.entries(d.dayKey).filter { $0.meal == m && $0.food != nil }; if !es.isEmpty { out += es.map { ($0.food!, m, $0.grams) }; break } } }
        return out
    }
    @MainActor static func fallback(_ k: Kind, store: Store) -> Food? {
        if let f = store.foods().first(where: { $0.useCount > 0 && !$0.macrosUnknown && classify($0) == k }) { return f }
        return store.groupedSearch(k == .carb ? "rice white basmati boiled" : "oil olive").generic.first
    }
    @MainActor static func defaultPattern(for empty: [Meal], store: Store) -> [(Food, Meal, Double)] {
        guard let m = empty.first else { return [] }
        let used = store.foods().filter { $0.useCount > 0 && !$0.macrosUnknown }
        var out: [(Food, Meal, Double)] = []
        if let p = used.first(where: { classify($0) == .protein }) { out.append((p, m, 150)) }
        if let c = used.first(where: { classify($0) == .carb }) { out.append((c, m, 200)) }
        if let f = used.first(where: { classify($0) == .fat }) { out.append((f, m, 10)) }
        if let v = used.first(where: { classify($0) == .veg }) { out.append((v, m, 150)) }
        return out
    }
    @MainActor static func prep(_ dayKey: String, store: Store) -> PrepDay {
        if let p = try? store.ctx.fetch(FetchDescriptor<PrepDay>(predicate: #Predicate { $0.dayKey == dayKey })).first { return p }
        let p = PrepDay(dayKey: dayKey); store.ctx.insert(p); return p
    }
    /// The most recent weigh-in list (carry-over, README §1a): today's, else the latest within 14 days.
    @MainActor static func carriedItems(today: String, store: Store) -> (items: [PrepItem], carried: Bool) {
        if let p = try? store.ctx.fetch(FetchDescriptor<PrepDay>(predicate: #Predicate { $0.dayKey == today })).first, !p.items.isEmpty { return (p.items, false) }
        let from = Date.fromKey(today).adding(days: -14).dayKey
        let days = (try? store.ctx.fetch(FetchDescriptor<PrepDay>(predicate: #Predicate { $0.dayKey >= from && $0.dayKey < today }, sortBy: [SortDescriptor(\.dayKey, order: .reverse)]))) ?? []
        if let d = days.first(where: { !$0.items.isEmpty }) { return (d.items.filter { $0.grams > 0 }.map { var i = $0; i.carried = true; return i }, true) }
        return ([], false)
    }
}
