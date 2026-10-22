#if DEBUG
import Foundation

/// Debug builds only (Settings › Help › Fill with test data): three days of logged meals and a handful of staples, so Recent, the staples
/// shortcuts and the planner have something to work with. Every food comes from the planner pool (Resources/Catalogue/planner.csv) — no food
/// list in code — and every amount is that food's portion. Today is left empty so "Plan it all for me" starts from a blank day.
enum TestData {
    @MainActor static func fill(_ store: Store) -> (logged: Int, staples: Int) {
        let picks = Planner.picks(all: store.foods())
        func pool(_ k: Balance.Kind, _ meal: String) -> [Planner.Pick] { picks.filter { $0.candidate.kind == k && ($0.candidate.meal == meal || $0.candidate.meal == "any") } }
        // a different food per day: day i takes the i-th of each list
        let plan: [(Meal, Balance.Kind, String)] = [
            (.breakfast, .protein, "breakfast"), (.breakfast, .carb, "breakfast"),
            (.lunch, .protein, "main"), (.lunch, .carb, "main"), (.lunch, .veg, "main"),
            (.dinner, .protein, "main"), (.dinner, .carb, "main"), (.dinner, .fat, "main"), (.dinner, .veg, "main"),
            (.snacks, .fat, "snack"), (.snacks, .carb, "snack"),
        ]
        var logged = 0
        for day in 1...3 {
            let key = Date().adding(days: -day).dayKey
            for (i, (meal, kind, hint)) in plan.enumerated() {
                let list = pool(kind, hint); guard !list.isEmpty else { continue }
                let p = list[(day * 3 + i) % list.count]   // lunch and dinner land on different foods
                _ = store.log(food: p.food, meal: meal, dayKey: key, quantity: p.candidate.portion / 100, serving: Serving(label: "100 g", grams: 100))
                logged += 1
            }
        }
        // staples: one of each kind the planner sizes, so "Balance my day" has something to balance
        var added = 0
        for (kind, hint) in [(Balance.Kind.carb, "main"), (.fat, "main"), (.protein, "breakfast"), (.veg, "main")] {
            if let p = pool(kind, hint).first, !store.staples().contains(where: { $0.foodId == p.food.id }) { store.addStaple(p.food); added += 1 }
        }
        store.save()
        return (logged, added)
    }
}
#endif
