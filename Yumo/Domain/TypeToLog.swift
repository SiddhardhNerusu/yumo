import Foundation
import SwiftData

/// Type-to-log (README §4a, PRODUCT_BRIEF §11). Deterministic client-side parser + resolver with learned {word, meal} patterns.
enum TypeToLog {
    // MARK: Parser
    enum Unit { case grams, servings }
    struct Group: Identifiable, Hashable { var id = UUID(); var words: String; var amount: Double?; var unit: Unit = .grams; var unitWord: String? }

    /// Seeded shorthand table; user additions come from UserAlias. Values are canonical search queries.
    /// Seeded shorthand table; values are search phrases that hit the canonical rows (name + state words). User additions come from UserAlias.
    static let aliases: [String: String] = [
        "pb": "peanut butter smooth", "shake": "whey protein", "protein": "whey protein", "whey": "whey protein", "egg": "egg white raw", "eggs": "egg white raw",
        "yoghurt": "yogurt greek", "yogurt": "yogurt greek", "greek": "yogurt greek", "potato": "sweet potato", "oil": "oil olive", "chicken": "chicken breast skinless boneless",
        "breast": "chicken breast skinless boneless", "thigh": "chicken thigh skinless boneless", "rice": "rice white basmati boiled", "oats": "oats rolled", "nana": "banana",
        "banana": "bananas raw", "avo": "avocado", "broc": "broccoli", "mince": "beef mince", "steak": "beef steak", "salmon": "salmon flesh only", "tuna": "tuna canned",
        "milk": "milk skimmed", "bread": "bread wholemeal", "toast": "bread wholemeal toasted", "cheese": "cheddar", "skyr": "skyr",
    ]
    static let unitWords: Set<String> = ["g", "gr", "gram", "grams", "ml", "scoop", "scoops", "pot", "pots", "tbsp", "tsp", "slice", "slices", "x", "piece", "pieces", "cup", "cups"]
    static func hasNumbers(_ line: String) -> Bool { line.range(of: #"\d"#, options: .regularExpression) != nil }

    /// "chicken 180 rice 150 oil 10" → [chicken 180 g] [rice 150 g] [oil 10 g]; "2 scoop whey 300ml oat milk" → [whey 2 scoops] [oat milk 300 g];
    /// "3 eggs, pb 20" → [eggs 3] [pb 20 g]. An amount attaches to the preceding word-group unless that group already has one; then it
    /// splits off the group's last word, or waits for the following group. A comma always closes a group.
    static func parse(_ line: String) -> [Group] {
        let tokens = line.lowercased().replacingOccurrences(of: ",", with: " , ").split(whereSeparator: { $0 == " " || $0 == "\n" }).map(String.init)
        var groups: [Group] = []; var pendingAmount: (Double, Unit, String?)? = nil; var words: [String] = []
        func flushWords() {
            guard !words.isEmpty else { return }
            var g = Group(words: words.joined(separator: " "))
            if let a = pendingAmount { g.amount = a.0; g.unit = a.1; g.unitWord = a.2; pendingAmount = nil }
            groups.append(g); words = []
        }
        var i = 0
        while i < tokens.count {
            let t = tokens[i]
            if t == "," { flushWords(); i += 1; continue }
            if let m = t.range(of: #"^\d+(\.\d+)?"#, options: .regularExpression) {
                let num = Double(t[m]) ?? 0
                var suffix = String(t[m.upperBound...])
                if suffix.isEmpty, i + 1 < tokens.count, unitWords.contains(tokens[i + 1]) { suffix = tokens[i + 1]; i += 1 }
                let unit: Unit = ["scoop", "scoops", "pot", "pots", "tbsp", "tsp", "slice", "slices", "x", "piece", "pieces", "cup", "cups"].contains(suffix) ? .servings : .grams
                let amt = (num, unit, suffix.isEmpty ? nil : suffix)
                if !words.isEmpty {
                    flushWords()
                    let last = groups.count - 1
                    if groups[last].amount == nil { groups[last].amount = amt.0; groups[last].unit = amt.1; groups[last].unitWord = amt.2 }
                    else {
                        // the group already carries a leading amount: split its last word off for this one, else hand it to the next group
                        var ws = groups[last].words.split(separator: " ").map(String.init)
                        if ws.count >= 2, let w = ws.popLast() { groups[last].words = ws.joined(separator: " "); groups.append(Group(words: w, amount: amt.0, unit: amt.1, unitWord: amt.2)) }
                        else { pendingAmount = amt }
                    }
                } else { pendingAmount = amt }
            } else if !unitWords.contains(t) && !["and", "with", "of", "a", "an", "the", "&", "+"].contains(t) {
                words.append(t)
            }
            i += 1
        }
        flushWords()
        return groups
    }

    // MARK: Resolver
    struct Candidate: Identifiable, Hashable { var food: Food; var count: Int; var id: String { food.id } }
    struct Resolution: Identifiable {
        var id: UUID; var group: Group; var food: Food?; var reason: String?; var ask: Bool; var candidates: [Candidate]; var notFound: Bool
        /// bare number → grams, unless the food's default serving is a piece (not a weight) and n ≤ 5 → servings
        var unit: Unit { guard let f = food, group.unit == .grams, group.unitWord == nil, let a = group.amount, a <= 5 else { return group.unit }
            let l = f.defaultServing.label.lowercased(); return l.range(of: #"^\d+(\.\d+)?\s?(g|ml)$"#, options: .regularExpression) != nil ? .grams : .servings }
        var grams: Double { guard let f = food else { return 0 }; let amt = group.amount ?? 1
            switch unit { case .grams: return group.amount ?? f.defaultServing.grams; case .servings: return amt * servingGrams(f) } }
        func servingGrams(_ f: Food) -> Double { if let w = group.unitWord, let s = f.servings.first(where: { $0.label.lowercased().contains(w.hasSuffix("s") ? String(w.dropLast()) : w) }) { return s.grams }; return f.defaultServing.grams }
        var serving: Serving { guard let f = food else { return Serving(label: "100 g", grams: 100) }; switch unit { case .grams: return Serving(label: "100 g", grams: 100); case .servings: let g = servingGrams(f); return f.servings.first { $0.grams == g } ?? f.defaultServing } }
        var quantity: Double { switch unit { case .grams: return grams / 100; case .servings: return group.amount ?? 1 } }
        var amountLabel: String { guard let f = food else { return group.amount.map { "\(Fmt.g($0)) g" } ?? "" }
            let st = f.state.map { " · " + $0.replacingOccurrences(of: " in unsalted water", with: "").replacingOccurrences(of: " in salted water", with: "").replacingOccurrences(of: "cooked (", with: "").replacingOccurrences(of: ")", with: "") } ?? ""
            switch unit { case .grams: return "\(Fmt.g(grams)) g" + st; case .servings: return "\(Fmt.g(group.amount ?? 1)) \(group.unitWord ?? f.defaultServing.label.components(separatedBy: " · ").first ?? "") · \(Fmt.g(grams)) g" + st } }
        var kcal: Double { (food?.kcal100 ?? 0) * grams / 100 }
    }

    @MainActor static func canonicalQuery(_ words: String, store: Store) -> String {
        let w = words.trimmingCharacters(in: .whitespaces)
        if let u = try? store.ctx.fetch(FetchDescriptor<UserAlias>(predicate: #Predicate { $0.shorthand == w })).first { return u.canonical }
        return aliases[w] ?? w
    }
    /// Ranked candidates for a word: the user's logged foods matching it first (by use count), then catalogue matches.
    @MainActor static func candidates(for words: String, store: Store, all: [Food]? = nil) -> [Candidate] {
        let q = canonicalQuery(words, store: store); let all = all ?? store.foods()
        func pool(_ s: String) -> [Food] { let g = store.groupedSearch(s, in: all); return g.your + g.generic + g.chain + g.branded }
        let aliasHits = pool(q)                                             // the alias phrase first (e.g. "rice white basmati boiled")
        var broad = q != words ? pool(words) : []                           // then everything the raw word matches ("rice")
        if aliasHits.isEmpty && broad.isEmpty, let first = words.split(separator: " ").first { broad = pool(String(first)) }
        var seen = Set<String>(); var out: [(Candidate, Int)] = []
        for (rank, list) in [aliasHits, broad].enumerated() { for f in list where !seen.contains(f.id) { seen.insert(f.id); out.append((Candidate(food: f, count: f.useCount), rank)) } }
        // most-logged first; then alias hits before the broad pool; then the plainest row
        return out.sorted { a, b in a.0.count != b.0.count ? a.0.count > b.0.count : (a.1 != b.1 ? a.1 < b.1 : plainness(a.0.food) > plainness(b.0.food)) }.map(\.0)
    }
    /// With no history, rank the plain row first: raw / boiled / grilled before fried, battered or processed variants; shorter names first.
    static func plainness(_ f: Food) -> Int {
        let n = f.name.lowercased(), st = (f.state ?? "").lowercased(); var s = 0
        if f.tier == .user { s += 40 } else if f.tier == .generic { s += 20 }
        if st == "raw" || st.hasPrefix("raw") { s += 12 } else if st.contains("boiled") || st.contains("grilled") || st.contains("baked") || st.contains("steamed") || st.contains("poached") { s += 10 } else if st.contains("roast") { s += 6 }
        for bad in ["fried", "batter", "industrial", "substitute", "powder", "dried", "flakes", "fat-free", "flavor", "sliced", "roll", "canned", "frozen", "stuffed", "with added", "shake", "fu yung", "drink"] where n.contains(bad) || st.contains(bad) { s -= 8 }
        if f.macrosUnknown { s -= 30 }
        return s - n.count / 6
    }
    @MainActor static func learned(_ word: String, meal: Meal?, store: Store) -> LearnedPattern? {
        let key = word + "|" + (meal?.rawValue ?? "*")
        return try? store.ctx.fetch(FetchDescriptor<LearnedPattern>(predicate: #Predicate { $0.key == key })).first
    }
    /// (1) exactly one match → use; (2) learned for this meal n ≥ 3; (3) learned for any meal n ≥ 3; (4) ask.
    @MainActor static func resolve(_ groups: [Group], meal: Meal, store: Store) -> [Resolution] {
        let all = store.foods()
        return groups.map { g in
            let cands = candidates(for: g.words, store: store, all: all)
            if cands.isEmpty { return Resolution(id: g.id, group: g, food: nil, reason: nil, ask: false, candidates: [], notFound: true) }
            if cands.count == 1 { return Resolution(id: g.id, group: g, food: cands[0].food, reason: nil, ask: false, candidates: cands, notFound: false) }
            if let l = learned(g.words, meal: meal, store: store), l.n >= 3, let f = store.food(id: l.foodId) { return Resolution(id: g.id, group: g, food: f, reason: "\(shortName(f)) at \(meal.rawValue.lowercased()) — your pattern", ask: false, candidates: cands, notFound: false) }
            if let l = learned(g.words, meal: nil, store: store), l.n >= 3, let f = store.food(id: l.foodId) { return Resolution(id: g.id, group: g, food: f, reason: "Your most-logged \(g.words)", ask: false, candidates: cands, notFound: false) }
            // never silently choose between two branded products
            return Resolution(id: g.id, group: g, food: nil, reason: nil, ask: true, candidates: cands, notFound: false)
        }
    }
    /// +1 for the same pick, reset to 1 on a different pick; both the meal key and the any-meal key.
    @MainActor static func confirm(word: String, meal: Meal, food: Food, store: Store) {
        for key in [word + "|" + meal.rawValue, word + "|*"] {
            if let l = try? store.ctx.fetch(FetchDescriptor<LearnedPattern>(predicate: #Predicate { $0.key == key })).first {
                if l.foodId == food.id { l.n += 1 } else { l.foodId = food.id; l.n = 1 }
                l.updatedAt = Date()
            } else { store.ctx.insert(LearnedPattern(key: key, foodId: food.id, n: 1)) }
        }
        store.save()
    }
    @MainActor static func remaining(word: String, meal: Meal, food: Food, store: Store) -> Int {
        guard let l = learned(word, meal: meal, store: store), l.foodId == food.id else { return 2 }
        return max(0, 3 - l.n - 1)
    }
    /// Row name: the first two comma parts ("Chicken breast, skinless" / "Oil, olive" / "Rice white, basmati").
    static func shortName(_ f: Food) -> String {
        let parts = f.name.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        let n = parts.prefix(parts.first.map { $0.split(separator: " ").count } ?? 1 <= 1 ? 2 : (parts.count > 1 && parts[1].count <= 12 ? 2 : 1)).joined(separator: ", ")
        return n.replacingOccurrences(of: "Chicken breast", with: "Breast").replacingOccurrences(of: "Chicken thigh", with: "Thigh")
    }
}
