import Foundation
import SwiftData

/// Tier 1 generic catalogue: canonical foods bundled as Resources/Catalogue/generic.json (USDA FDC Foundation Foods, public domain).
/// One row per generic food; raw and cooked are separate entries; no user edits. Re-synced when the bundled version changes.
enum Catalogue {
    struct Row: Codable { var id: String; var name: String; var state: String?; var aliases: String?; var source: String; var source_ref: String; var kcal: Double; var p: Double; var c: Double; var f: Double; var servings: [Serving]?; var micros: [String: Double] }
    struct ChainRow: Codable { var id: String; var chain: String; var category: String?; var name: String; var serving_label: String; var serving_grams: Double?; var kcal: Double; var p: Double?; var c: Double?; var f: Double?; var micros: [String: Double]?; var source_ref: String }
    struct ChainFile: Codable { var version: String; var items: [ChainRow] }
    struct File: Codable { var version: String; var foods: [Row] }
    static let versionKey = "yumo.catalogueVersion"
    @MainActor static func sync(_ store: Store) {
        syncChains(store)
        guard let url = Bundle.main.url(forResource: "generic", withExtension: "json"), let data = try? Data(contentsOf: url), let file = try? JSONDecoder().decode(File.self, from: data) else { return }
        guard UserDefaults.standard.string(forKey: versionKey) != file.version else { return }
        let existing = Dictionary(store.foods().filter { $0.tier == .generic }.compactMap { f in f.canonicalId.map { ($0, f) } }, uniquingKeysWith: { a, _ in a })
        var kept = Set<String>()
        for r in file.foods {
            kept.insert(r.id)
            var servings = r.servings ?? []; if servings.isEmpty { servings = defaultServings(for: r.name) }
            if !servings.contains(where: { $0.grams == 100 }) { servings.append(Serving(label: "100 g", grams: 100)) }
            let src: FoodSource = r.source == "cofid" ? .cofid : .usda
            if let f = existing[r.id] {
                f.name = r.name; f.state = r.state; f.aliases = r.aliases ?? ""; f.sourceRef = r.source_ref; f.source = src; f.kcal100 = r.kcal; f.p100 = r.p; f.c100 = r.c; f.f100 = r.f; f.micros = r.micros; f.servings = servings
            } else {
                let f = Food(name: r.name, brand: nil, barcode: nil, source: src, servings: servings, kcal100: r.kcal, p100: r.p, c100: r.c, f100: r.f)
                f.tier = .generic; f.canonicalId = r.id; f.state = r.state; f.aliases = r.aliases ?? ""; f.sourceRef = r.source_ref; f.micros = r.micros
                store.ctx.insert(f)
            }
        }
        // rows that left the canonical set go too, unless the user logged them
        for (id, f) in existing where !kept.contains(id) && !id.hasPrefix("seed:") && f.useCount == 0 { store.ctx.delete(f) }
        syncChains(store)
        // Seeded staples not covered by Foundation Foods stay as generics too; stale seeds from earlier builds go unless they were logged.
        let keep = Set(SeedFoods.items.map { "seed:" + $0.0.lowercased() })
        for f in store.foods() where f.tier == .user && f.source == .usda { f.tier = .generic; f.sourceRef = f.sourceRef ?? "USDA SR Legacy"; f.canonicalId = f.canonicalId ?? "seed:\(f.name.lowercased())" }
        for f in store.foods() where f.tier == .generic && (f.canonicalId ?? "").hasPrefix("seed:") && !keep.contains(f.canonicalId ?? "") && f.useCount == 0 { store.ctx.delete(f) }
        store.save()
        UserDefaults.standard.set(file.version, forKey: versionKey)
    }
    static let chainsVersionKey = "yumo.chainsVersion"
    /// Tier 2a — chain and restaurant items from each chain's published nutrition data (Resources/Catalogue/chains.json).
    @MainActor static func syncChains(_ store: Store) {
        guard let url = Bundle.main.url(forResource: "chains", withExtension: "json"), let data = try? Data(contentsOf: url), let file = try? JSONDecoder().decode(ChainFile.self, from: data) else { return }
        guard UserDefaults.standard.string(forKey: chainsVersionKey) != file.version else { return }
        defer { store.save(); UserDefaults.standard.set(file.version, forKey: chainsVersionKey) }
        let existing = Dictionary(store.foods().filter { $0.tier == .chain }.compactMap { f in f.canonicalId.map { ($0, f) } }, uniquingKeysWith: { a, _ in a })
        for r in file.items {
            let grams = r.serving_grams ?? 100
            // chain data is per item; store per 100 g of the item's serving so the rest of the app works unchanged
            let factor = 100 / grams
            let servings = [Serving(label: r.serving_label, grams: grams)]
            let known = r.p != nil && r.c != nil && r.f != nil
            let aliases = [r.chain.lowercased().replacingOccurrences(of: "'", with: ""), r.chain.lowercased(), r.category?.lowercased() ?? ""].joined(separator: " ")
            if let f = existing[r.id] { f.name = r.name; f.brand = r.chain; f.kcal100 = r.kcal * factor; f.p100 = (r.p ?? 0) * factor; f.c100 = (r.c ?? 0) * factor; f.f100 = (r.f ?? 0) * factor; f.macrosUnknown = !known; f.servings = servings; f.sourceRef = r.source_ref; f.aliases = aliases; f.micros = (r.micros ?? [:]).mapValues { $0 * factor } }
            else { let f = Food(name: r.name, brand: r.chain, barcode: nil, source: .user, servings: servings, kcal100: r.kcal * factor, p100: (r.p ?? 0) * factor, c100: (r.c ?? 0) * factor, f100: (r.f ?? 0) * factor); f.tier = .chain; f.canonicalId = r.id; f.sourceRef = r.source_ref; f.macrosUnknown = !known; f.aliases = aliases; f.micros = (r.micros ?? [:]).mapValues { $0 * factor }; store.ctx.insert(f) }
        }
    }
    static func defaultServings(for name: String) -> [Serving] {
        let n = name.lowercased()
        var s = [Serving(label: "100 g", grams: 100)]
        if n.contains("egg, whole") { s.insert(Serving(label: "1 large · 50 g", grams: 50), at: 0) }
        else if n.contains("banana") { s.insert(Serving(label: "1 medium · 118 g", grams: 118), at: 0) }
        else if n.contains("chicken, breast") || n.contains("breast, skinless") { s.append(Serving(label: "1 breast · 174 g", grams: 174)) }
        else if n.contains("oats") { s.insert(Serving(label: "80 g", grams: 80), at: 0) }
        else if n.contains("milk") && !n.contains("cheese") { s = [Serving(label: "250 ml", grams: 250), Serving(label: "100 ml", grams: 100)] }
        else if n.hasPrefix("oil") || n.contains(", oil") { s.insert(Serving(label: "1 tbsp · 14 g", grams: 14), at: 0) }
        else if n.contains("apple") && !n.contains("juice") { s.insert(Serving(label: "1 medium · 182 g", grams: 182), at: 0) }
        return s
    }
    /// Brand tokens that expand the Branded group automatically (PRODUCT_BRIEF §2).
    static let brandTokens: Set<String> = ["fage", "lindahls", "lindahl", "arla", "skyr", "yeo", "activia", "onken", "muller", "müller", "cathedral", "pilgrims", "philadelphia", "babybel", "dairylea", "lurpak", "flora", "clover", "anchor", "cravendale", "alpro", "oatly", "minor", "quorn", "linda", "richmond", "heck", "birds", "aunt", "mccain", "uncle", "tilda", "ben's", "bens", "dolmio", "lloyd", "warburtons", "hovis", "kingsmill", "allinson", "jacobs", "ryvita", "nairns", "weetabix", "alpen", "jordans", "dorset", "quaker", "kelloggs", "nestle", "cadbury", "galaxy", "mars", "snickers", "kitkat", "twix", "bounty", "maltesers", "haribo", "walkers", "pringles", "doritos", "kettle", "tyrrells", "popchips", "hula", "mcvities", "digestive", "hobnobs", "oreo", "belvita", "nature", "nakd", "trek", "grenade", "fulfil", "barebells", "myprotein", "bulk", "optimum", "phd", "huel", "yfood", "graze", "kind", "eat", "tesco", "sainsbury", "sainsburys", "asda", "morrisons", "aldi", "lidl", "waitrose", "m&s", "marks", "coop", "co-op", "iceland", "ocado", "costco", "boots", "holland", "innocent", "tropicana", "robinsons", "ribena", "lucozade", "monster", "red", "prime", "pepsi", "coca", "coke", "fanta", "sprite", "irn", "volvic", "evian", "highland", "starbucks", "costa", "nescafe", "kenco", "pg", "tetley", "twinings", "yorkshire", "heinz", "hellmanns", "hellmann's", "branston", "colmans", "nandos", "nando's", "greggs", "pret", "mcdonalds", "kfc", "subway", "burger", "dominos", "domino's", "wagamama", "itsu", "leon", "wasabi", "pizza", "tesco", "sainsbury", "sainsburys", "aldi", "lidl", "asda", "morrisons", "waitrose", "m&s", "myprotein", "optimum", "quest", "huel", "kellogg", "kelloggs", "nestle", "cadbury", "danone", "muller", "müller", "arla", "alpro", "oatly", "graze", "chobani"]
    static func hasBrandToken(_ q: String) -> Bool { q.lowercased().split(separator: " ").contains { brandTokens.contains(String($0)) } }
}

/// USDA Branded Foods: barcode fallback for US products (PRODUCT_BRIEF §2). Needs a free api.data.gov key; empty = skipped.
enum USDABranded {
    static let apiKey = ""   // get one at https://api.data.gov/signup, paste here
    static func barcode(_ gtin: String) async -> OpenFoodFacts.Product? {
        guard !apiKey.isEmpty, var c = URLComponents(string: "https://api.nal.usda.gov/fdc/v1/foods/search") else { return nil }
        c.queryItems = [.init(name: "api_key", value: apiKey), .init(name: "query", value: gtin), .init(name: "dataType", value: "Branded"), .init(name: "pageSize", value: "1")]
        guard let url = c.url, let (data, _) = try? await URLSession.shared.data(from: url), let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let item = (json["foods"] as? [[String: Any]])?.first, (item["gtinUpc"] as? String)?.hasSuffix(gtin) == true else { return nil }
        func n(_ num: String) -> Double? { (item["foodNutrients"] as? [[String: Any]])?.first { "\($0["nutrientNumber"] ?? "")" == num }?["value"] as? Double }
        guard let kcal = n("208"), let name = item["description"] as? String else { return nil }
        var servings = [Serving(label: "100 g", grams: 100)]
        if let sz = item["servingSize"] as? Double, sz > 0 { servings.insert(Serving(label: "1 serving · \(Int(sz)) \(item["servingSizeUnit"] as? String ?? "g")", grams: sz), at: 0) }
        var p = OpenFoodFacts.Product(name: name.capitalized, brand: item["brandOwner"] as? String, barcode: gtin, kcal100: kcal, p100: n("203") ?? 0, c100: n("205") ?? 0, f100: n("204") ?? 0, servings: servings, fibre: n("291"), sugar: n("269"), salt: n("307").map { $0 / 400 }, satFat: n("606"))
        p.sourceRef = "USDA Branded · \(item["fdcId"] ?? "")"; return p
    }
}
