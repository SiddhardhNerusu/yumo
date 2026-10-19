import Foundation

/// Open Food Facts (ODbL) lookups. Our own catalogue (SwiftData) is checked first by the caller; every hit is cached there.
enum OpenFoodFacts {
    struct Product { var name: String; var brand: String?; var barcode: String?; var kcal100: Double; var p100: Double; var c100: Double; var f100: Double; var servings: [Serving]
        var fibre: Double?; var sugar: Double?; var salt: Double?; var satFat: Double?
        var sourceRef: String? = nil; var micros: [String: Double] = [:]
        func makeFood() -> Food {
            let f = Food(name: name, brand: brand, barcode: barcode, source: sourceRef?.hasPrefix("USDA") == true ? .usdaBranded : .off, servings: servings, kcal100: kcal100, p100: p100, c100: c100, f100: f100)
            f.fibre100 = fibre; f.sugar100 = sugar; f.salt100 = salt; f.satFat100 = satFat; f.tier = .branded; f.micros = micros
            let df = DateFormatter(); df.locale = Locale(identifier: "en_GB"); df.dateFormat = "d MMM"
            f.sourceRef = sourceRef ?? "Open Food Facts · updated \(df.string(from: Date()))"; return f
        }
    }
    private static let ua = "Yumo/1.0 (iOS; siddhardhnerusu@gmail.com)"
    private static func get(_ url: URL) async throws -> [String: Any] {
        var r = URLRequest(url: url); r.setValue(ua, forHTTPHeaderField: "User-Agent"); r.timeoutInterval = 12
        let (data, _) = try await URLSession.shared.data(for: r)
        return (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }
    static func barcode(_ ean: String) async -> Product? {
        guard let url = URL(string: "https://world.openfoodfacts.org/api/v2/product/\(ean).json?fields=product_name,brands,nutriments,serving_size,serving_quantity,code") else { return nil }
        guard let json = try? await get(url), (json["status"] as? Int) == 1, let p = json["product"] as? [String: Any] else { return nil }
        return parse(p)
    }
    /// Name search on search.openfoodfacts.org (search-a-licious). The legacy cgi/search.pl endpoint answers 503 most of the time, so it is not used.
    static func search(_ q: String, limit: Int = 20) async -> [Product] {
        var c = URLComponents(string: "https://search.openfoodfacts.org/search")!
        // UK first (the product rule): products sold in the UK, English names. Barcode lookups are not filtered.
        c.queryItems = [.init(name: "q", value: q + " countries_tags:\"en:united-kingdom\""), .init(name: "langs", value: "en"), .init(name: "page_size", value: String(limit)), .init(name: "fields", value: "product_name,brands,code,nutriments,serving_size,serving_quantity")]
        guard let url = c.url, let json = try? await get(url), let items = json["hits"] as? [[String: Any]] else { return [] }
        return items.compactMap(parse)
    }
    private static func parse(_ p: [String: Any]) -> Product? {
        guard let name = (p["product_name"] as? String)?.trimmingCharacters(in: .whitespaces), !name.isEmpty, let n = p["nutriments"] as? [String: Any] else { return nil }
        func d(_ k: String) -> Double? { (n[k] as? Double) ?? (n[k] as? Int).map(Double.init) ?? (n[k] as? String).flatMap(Double.init) }
        let kcal = d("energy-kcal_100g") ?? (d("energy_100g").map { $0 / 4.184 }) ?? 0
        guard kcal > 0 else { return nil }
        var servings = [Serving(label: "100 g", grams: 100)]
        if let sq = d("serving_quantity"), sq > 0 { let label = (p["serving_size"] as? String) ?? "1 serving (\(Int(sq)) g)"; servings.insert(Serving(label: "1 × \(label)", grams: sq), at: 0) }
        let brandRaw = (p["brands"] as? String) ?? (p["brands"] as? [String])?.joined(separator: ",")   // a string on the legacy API, an array on search-a-licious
        let brand = brandRaw?.split(separator: ",").first.map { String($0).trimmingCharacters(in: .whitespaces) }
        var prod = Product(name: name, brand: brand, barcode: p["code"] as? String, kcal100: kcal, p100: d("proteins_100g") ?? 0, c100: d("carbohydrates_100g") ?? 0, f100: d("fat_100g") ?? 0, servings: servings, fibre: d("fiber_100g"), sugar: d("sugars_100g"), salt: d("salt_100g"), satFat: d("saturated-fat_100g"))
        let map: [(String, String, Double)] = [("fiber_100g", "fibre", 1), ("sugars_100g", "sugars", 1), ("saturated-fat_100g", "sat_fat", 1), ("monounsaturated-fat_100g", "mono", 1), ("polyunsaturated-fat_100g", "poly", 1), ("trans-fat_100g", "trans", 1), ("cholesterol_100g", "cholesterol_mg", 1000), ("sodium_100g", "sodium_mg", 1000), ("potassium_100g", "potassium_mg", 1000), ("calcium_100g", "calcium_mg", 1000), ("iron_100g", "iron_mg", 1000), ("magnesium_100g", "magnesium_mg", 1000), ("zinc_100g", "zinc_mg", 1000), ("phosphorus_100g", "phosphorus_mg", 1000), ("selenium_100g", "selenium_ug", 1_000_000), ("vitamin-a_100g", "vit_a_ug", 1_000_000), ("vitamin-c_100g", "vit_c_mg", 1000), ("vitamin-d_100g", "vit_d_ug", 1_000_000), ("vitamin-e_100g", "vit_e_mg", 1000), ("vitamin-k_100g", "vit_k_ug", 1_000_000), ("vitamin-b1_100g", "b1_mg", 1000), ("vitamin-b2_100g", "b2_mg", 1000), ("vitamin-pp_100g", "b3_mg", 1000), ("vitamin-b6_100g", "b6_mg", 1000), ("vitamin-b9_100g", "folate_ug", 1_000_000), ("vitamin-b12_100g", "b12_ug", 1_000_000), ("choline_100g", "choline_mg", 1000), ("caffeine_100g", "caffeine_mg", 1000), ("alcohol_100g", "alcohol_g", 1)]
        for (src, key, mult) in map { if let v = d(src) { prod.micros[key] = v * mult } }
        return prod
    }
}

/// Generic staples Foundation Foods lacks (cooked rice/pasta, whey, UK items); per 100 g, USDA SR Legacy / CoFID values.
enum SeedFoods {
    static let items: [(String, String?, Double, Double, Double, Double, [Serving])] = [
        ("Whey protein isolate", "unflavoured", 400, 90, 1, 1, [Serving(label: "1 scoop · 30 g", grams: 30)]),
        ("Lean beef mince 5%", "raw", 137, 21.4, 0, 5, [Serving(label: "100 g", grams: 100)]),
    ]
    @MainActor static func seed(_ store: Store) {
        guard store.foods().isEmpty else { return }
        for i in items { let f = Food(name: i.0, brand: i.1, source: .usda, servings: i.6, kcal100: i.2, p100: i.3, c100: i.4, f100: i.5); f.tier = .generic; f.sourceRef = "USDA SR Legacy"; f.canonicalId = "seed:" + i.0.lowercased(); f.state = i.1?.contains("raw") == true ? "raw" : (i.0.lowercased().contains("cooked") ? "cooked" : nil); _ = store.upsert(f) }
    }
}

/// Barcodes that could not be looked up (offline or OFF down). Retried when the app becomes active.
enum PendingLookups {
    private static let key = "yumo.pendingBarcodes"
    static var all: [String] { get { UserDefaults.standard.stringArray(forKey: key) ?? [] } set { UserDefaults.standard.set(Array(Set(newValue)), forKey: key) } }
    static func add(_ code: String) { all = all + [code] }
    @MainActor static func retry(_ store: Store) async -> Int {
        var done = 0
        for code in all {
            if store.food(barcode: code) != nil { all.removeAll { $0 == code }; continue }
            if let p = await OpenFoodFacts.barcode(code) { _ = store.upsert(p.makeFood()); all.removeAll { $0 == code }; done += 1 }
        }
        return done
    }
}
