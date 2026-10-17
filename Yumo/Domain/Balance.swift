import Foundation
import SwiftData

/// Balance the day (README §1a, PRODUCT_BRIEF §12). Deterministic fill-the-gap solver.
enum Balance {
    enum Kind { case veg, protein, fat, carb }
    enum Mode: String { case prepped, eaten }
    /// veg: < 50 kcal/100 g · protein: P-kcal share ≥ 30 % or ≥ 15 g/100 g · fat: F-kcal share ≥ 60 % · else carb.
    static func classify(_ f: Food) -> Kind {
        if f.kcal100 < 50 { return .veg }
        let k = max(1, f.kcal100)
        if f.p100 * 4 / k >= 0.30 || f.p100 >= 15 { return .protein }
        if f.f100 * 9 / k >= 0.60 { return .fat }
        return .carb
    }
    enum Fixed: String { case prepped, veg, kept }
    struct PlanItem: Identifiable { var id: String { food.id + "|" + meal.rawValue }; var food: Food; var meal: Meal; var usualGrams: Double; var newGrams: Double; var fixed: Fixed?; var note: String?; var maxG: Double? = nil
        var atMax: Bool { maxG.map { newGrams >= $0 } ?? false }
        var cap: Double { maxG ?? (usualGrams * 3 + 100) } }
    struct Result { var items: [PlanItem]; var projected: DayTotals; var leftKcal: Double; var emptyMeals: [Meal]; var ok: Bool; var status: String; var statusDanger: Bool; var fromStaples: Bool }
    /// Staples carry no amounts; the solver starts every class from a fixed usual (protein 300 · carb 200 · fat 10 · veg 150) and sizes from there.
    static func stapleUsual(_ k: Kind) -> Double { switch k { case .protein: 300; case .carb: 200; case .fat: 10; case .veg: 150 } }
    static func className(_ k: Kind) -> String { switch k { case .protein: "Protein"; case .veg: "Veg"; default: "Flexible" } }

    /// Usual pattern for the empty meals: the most recent day that has entries for them.
    @MainActor static func usualPattern(for meals: [Meal], today: String, store: Store) -> [(Food, Meal, Double)] {
        var out: [(Food, Meal, Double)] = []
        for m in meals {
            var d = Date.fromKey(today)
            for _ in 0..<60 {
                d = d.adding(days: -1)
                let es = store.entries(d.dayKey).filter { $0.meal == m && $0.food != nil }
                if !es.isEmpty { out += es.map { ($0.food!, m, $0.grams) }; break }
            }
        }
        return out
    }
    @MainActor static func anotherWay(_ items: [PlanItem], store: Store, swaps: Int) -> [PlanItem] {
        // swap the main carb for the user's next most-logged carb
        guard let main = items.filter({ $0.fixed == nil && classify($0.food) == .carb }).max(by: { $0.usualGrams < $1.usualGrams }) else { return items }
        let carbs = store.foods().filter { $0.useCount > 0 && classify($0) == .carb && $0.id != main.food.id }.sorted { $0.useCount > $1.useCount }
        guard !carbs.isEmpty else { return items }
        let alt = carbs[swaps % carbs.count]
        return items.map { $0.food.id == main.food.id && $0.meal == main.meal ? PlanItem(food: alt, meal: $0.meal, usualGrams: $0.usualGrams, newGrams: $0.usualGrams, fixed: nil, note: nil) : $0 }
    }

    @MainActor static func solve(dayKey: String, mode: Mode, prepped: [PrepItem], keep: Set<String>, swaps: Int, store: Store) -> Result {
        let p = store.profile(); let t = store.targets()
        let targetKcal = Double(t.kcal(training: store.isTraining(dayKey), profile: p)); let targetP = Double(t.protein)
        let logged = store.entries(dayKey); let eaten = DayTotals(logged)
        let empty = Meal.allCases.filter { m in !logged.contains { $0.meal == m } }
        var items: [PlanItem] = []
        // rev 5: staples replace the usual pattern — one row per staple at the class usual, in the empty meal it is usually eaten at (else Dinner, else the first empty meal)
        let staples = store.staples(); let fromStaples = !staples.isEmpty
        if fromStaples {
            for st in staples { guard let f = store.food(id: st.foodId) else { continue }
                let k = classify(f); let m = mealFor(f, word: "", empty: empty, store: store)
                items.append(PlanItem(food: f, meal: m, usualGrams: stapleUsual(k), newGrams: stapleUsual(k), fixed: nil, note: nil, maxG: st.maxG)) }
        } else {
            var usual = usualPattern(for: empty, today: dayKey, store: store)
            if usual.isEmpty { usual = defaultPattern(for: empty, store: store) }
            for (f, m, g) in usual { items.append(PlanItem(food: f, meal: m, usualGrams: g, newGrams: g, fixed: nil, note: nil)) }
        }
        // the plan always has something to move on each side: a carb and a fat (the user's most-logged, else the catalogue staples)
        let firstEmpty = empty.first ?? .dinner
        if !items.contains(where: { classify($0.food) == .carb }), let c = fallback(.carb, store: store) { items.append(PlanItem(food: c, meal: firstEmpty, usualGrams: 150, newGrams: 150, fixed: nil, note: nil)) }
        if !items.contains(where: { classify($0.food) == .fat }), let o = fallback(.fat, store: store) { items.append(PlanItem(food: o, meal: firstEmpty, usualGrams: 10, newGrams: 10, fixed: nil, note: nil)) }
        // prepped proteins: fixed, netted off what is already logged today
        if mode == .prepped {
            let all = store.foods()
            for it in prepped where it.grams > 0 {
                guard let f = TypeToLog.candidates(for: it.text, store: store, all: all).first?.food else { continue }
                let already = logged.filter { $0.food?.id == f.id }.reduce(0) { $0 + $1.grams }
                let g = max(0, it.grams - already)
                let meal = mealFor(f, word: it.text, empty: empty, store: store)
                items.removeAll { $0.food.id == f.id }                       // a prepped food replaces its flexible usual row wherever it was
                if g > 0 { items.append(PlanItem(food: f, meal: meal, usualGrams: g, newGrams: g, fixed: .prepped, note: already > 0 ? "\(Fmt.g(it.grams)) g prepped, \(Fmt.g(already)) g eaten" : nil)) }
            }
        }
        if swaps > 0 { items = anotherWay(items, store: store, swaps: swaps) }
        for i in items.indices where items[i].fixed == nil {
            if classify(items[i].food) == .veg { items[i].fixed = .veg } else if keep.contains(items[i].id) { items[i].fixed = .kept }
            else if mode == .prepped && classify(items[i].food) == .protein && prepped.contains(where: { !$0.text.isEmpty }) == false { /* proteins flexible when nothing prepped */ }
        }
        // in prepped mode usual proteins stay fixed at usual only if the user prepped something; otherwise they are flexible (eaten mode semantics)
        let fixedKcal = eaten.kcal + items.filter { $0.fixed != nil }.reduce(0) { $0 + $1.food.kcal100 * $1.newGrams / 100 }
        let fixedP = eaten.p + items.filter { $0.fixed != nil }.reduce(0) { $0 + $1.food.p100 * $1.newGrams / 100 }
        let fixedC = eaten.c + items.filter { $0.fixed != nil }.reduce(0) { $0 + $1.food.c100 * $1.newGrams / 100 }
        let fixedF = eaten.f + items.filter { $0.fixed != nil }.reduce(0) { $0 + $1.food.f100 * $1.newGrams / 100 }
        var remP = targetP - fixedP, remF = Double(t.fat) - fixedF, remC = Double(t.carbs) - fixedC
        // flexible foods in order protein → fat → carb: grams = remaining dominant macro ÷ per-gram, round 5, cap 3× usual + 100
        for kind in [Kind.protein, .fat, .carb] {
            for i in items.indices where items[i].fixed == nil && classify(items[i].food) == kind {
                let f = items[i].food
                let perGram: Double, rem: Double
                switch kind { case .protein: perGram = f.p100 / 100; rem = remP; case .fat: perGram = f.f100 / 100; rem = remF; default: perGram = f.c100 / 100; rem = remC }
                var g = perGram > 0 ? max(0, rem) / perGram : items[i].usualGrams
                g = min((g / 5).rounded() * 5, items[i].cap)   // cap: the staple's Max, else 3× usual + 100
                items[i].newGrams = g
                remP -= f.p100 * g / 100; remF -= f.f100 * g / 100; remC -= f.c100 * g / 100
            }
        }
        // absorber: largest-usual carb, else fat, never protein — re-solved so kcal land exactly
        func total() -> DayTotals { var d = eaten; for it in items { d.kcal += it.food.kcal100 * it.newGrams / 100; d.p += it.food.p100 * it.newGrams / 100; d.c += it.food.c100 * it.newGrams / 100; d.f += it.food.f100 * it.newGrams / 100 }; return d }
        let flexible = items.indices.filter { items[$0].fixed == nil }
        if let a = flexible.filter({ classify(items[$0].food) == .carb }).max(by: { items[$0].usualGrams < items[$1].usualGrams }) ?? flexible.first(where: { classify(items[$0].food) == .fat }) {
            let f = items[a].food
            let without = total().kcal - f.kcal100 * items[a].newGrams / 100
            // the absorber lands kcal exactly, but never past its own cap (3× usual + 100) — if that is not enough the status says so
            if f.kcal100 > 0 { items[a].newGrams = min(items[a].cap, max(0, ((targetKcal - without) / f.kcal100 * 100 / 5).rounded() * 5)) }
        }
        let proj = total()
        let dk = proj.kcal - targetKcal
        let ok = abs(dk) <= 40 && proj.p >= targetP - 5
        let status = ok ? "Lands on target" : (abs(dk) > 40 ? (dk > 0 ? "Over by \(Fmt.k(dk)) kcal" : "Short by \(Fmt.k(-dk)) kcal") : "Protein short by \(Fmt.g(targetP - proj.p)) g")
        _ = fixedKcal
        return Result(items: items.sorted { Meal.allCases.firstIndex(of: $0.meal)! < Meal.allCases.firstIndex(of: $1.meal)! }, projected: proj, leftKcal: targetKcal - eaten.kcal, emptyMeals: empty, ok: ok, status: status, statusDanger: !ok, fromStaples: fromStaples)
    }
    /// Prepped proteins go to the meal the pattern says — learned {word, meal}, else where the user usually logs that food — but only an
    /// empty meal can take the remainder; otherwise the first empty meal.
    @MainActor static func mealFor(_ f: Food, word: String, empty: [Meal], store: Store) -> Meal {
        if !word.isEmpty { for m in empty { if let l = TypeToLog.learned(word, meal: m, store: store), l.foodId == f.id, l.n >= 1 { return m } } }
        var d = FetchDescriptor<FoodEntry>(sortBy: [SortDescriptor(\.loggedAt, order: .reverse)]); d.fetchLimit = 300
        let es = (try? store.ctx.fetch(d))?.filter { $0.food?.id == f.id && empty.contains($0.meal) } ?? []
        var counts: [Meal: Int] = [:]; for e in es { counts[e.meal, default: 0] += 1 }
        if let m = counts.max(by: { $0.value < $1.value })?.key { return m }
        return empty.contains(.dinner) ? .dinner : (empty.first ?? .dinner)
    }
    /// The user's most-logged food of a class, else the catalogue's plain staple for it.
    @MainActor static func fallback(_ k: Kind, store: Store) -> Food? {
        if let f = store.foods().first(where: { $0.useCount > 0 && !$0.macrosUnknown && classify($0) == k }) { return f }
        let q = k == .carb ? "rice white basmati boiled" : "oil olive"
        return store.groupedSearch(q).generic.first
    }
    /// Fallback when there is no history: the user's most-logged protein, carb, fat and veg for the first empty meal (usual 150 / 200 / 10 / 150 g).
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
}
