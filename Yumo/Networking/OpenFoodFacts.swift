import Foundation

/// Open Food Facts (ODbL) lookups. Our own catalogue (SwiftData) is checked first by the caller; every hit is cached there.
enum OpenFoodFacts {
    struct Product { var name: String; var brand: String?; var barcode: String?; var kcal100: Double; var p100: Double; var c100: Double; var f100: Double; var servings: [Serving]
        var fibre: Double?; var sugar: Double?; var salt: Double?; var satFat: Double?
        var sourceRef: String? = nil; var micros: [String: Double] = [:]
        var quantity: String? = nil      // pack size as printed ("2kg", "300 g") — what tells two bags of the same name apart
        /// Sold by volume ("1 L", "6 x 330 ml"): the label's values are per 100 ml, so amounts are in ml (20 Oct).
        var isDrink: Bool { quantity?.range(of: #"\d\s*(ml|cl|L)\b"#, options: .regularExpression) != nil }
        var per100: String { isDrink ? "100 ml" : "100 g" }
        /// Atwater check: 4P + 4C + 9F within 30 % of the stated kcal (alcohol-free foods). A potato at "79 kcal, C 1" fails and is not shown.
        var plausible: Bool { let a = 4 * p100 + 4 * c100 + 9 * f100; return abs(a - kcal100) <= max(25, kcal100 * 0.30) }
        func makeFood() -> Food {
            let f = Food(name: name, brand: brand, barcode: barcode, source: sourceRef?.hasPrefix("USDA") == true ? .usdaBranded : .off, servings: servings, kcal100: kcal100, p100: p100, c100: c100, f100: f100)
            f.fibre100 = fibre; f.sugar100 = sugar; f.salt100 = salt; f.satFat100 = satFat; f.tier = .branded; f.micros = micros
            f.state = quantity   // shows as the detail line: "Potatoes · 2 kg"
            if isDrink { f.mlDensity = 1 }   // values per 100 ml, so 100 ml counts as the "100" every macro is per
            let df = DateFormatter(); df.locale = Locale(identifier: "en_GB"); df.dateFormat = "d MMM"
            f.sourceRef = sourceRef ?? "Open Food Facts · updated \(df.string(from: Date()))"; return f
        }
    }
    private static let ua = "Yumo/1.0 (iOS; siddhardhnerusu@gmail.com)"
    /// Last time a lookup came back as something other than JSON (rate limit, 503) — the UI says "didn't answer" instead of "no match".
    nonisolated(unsafe) static var lastFailure: Date? = nil
    nonisolated(unsafe) private static var cache: [String: (Date, [Product])] = [:]
    private static let cacheLock = NSLock()
    private static func get(_ url: URL) async throws -> [String: Any] {
        var r = URLRequest(url: url); r.setValue(ua, forHTTPHeaderField: "User-Agent"); r.timeoutInterval = 12
        let (data, resp) = try await URLSession.shared.data(for: r)
        if let http = resp as? HTTPURLResponse, http.statusCode != 200 { lastFailure = Date(); throw URLError(.badServerResponse) }
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { lastFailure = Date(); throw URLError(.cannotParseResponse) }
        return json
    }
    static func barcode(_ ean: String) async -> Product? {
        guard let url = URL(string: "https://world.openfoodfacts.org/api/v2/product/\(ean).json?fields=product_name,brands,nutriments,serving_size,serving_quantity,code,quantity") else { return nil }
        guard let json = try? await get(url), (json["status"] as? Int) == 1, let p = json["product"] as? [String: Any] else { return nil }
        return parse(p)
    }
    /// Name search on search.openfoodfacts.org (search-a-licious). The legacy cgi/search.pl endpoint answers 503 most of the time, so it is not used.
    static func search(_ q: String, limit: Int = 20) async -> [Product] {
        var c = URLComponents(string: "https://search.openfoodfacts.org/search")!
        // UK first (the product rule): products sold in the UK, English names. Barcode lookups are not filtered.
        c.queryItems = [.init(name: "q", value: q + " countries_tags:\"en:united-kingdom\""), .init(name: "langs", value: "en"), .init(name: "page_size", value: String(limit)), .init(name: "fields", value: "product_name,brands,code,nutriments,serving_size,serving_quantity,quantity")]
        let key = q.lowercased() + "|\(limit)"
        cacheLock.lock(); let hit = cache[key]; cacheLock.unlock()
        if let hit, Date().timeIntervalSince(hit.0) < 600 { return hit.1 }   // retyping the same word within 10 min costs no request (search is rate-limited)
        guard let url = c.url, let json = try? await get(url), let items = json["hits"] as? [[String: Any]] else { return [] }
        let out = items.compactMap(parse).filter(\.plausible)   // crowd-sourced rows whose macros can't add up to their calories are left out (never a wrong macro)
        cacheLock.lock(); cache[key] = (Date(), out); cacheLock.unlock()
        return out
    }
    /// The full line plus one lookup per word the catalogue can't cover ("albert", "rooster"), concurrently, merged by barcode. Open Food Facts'
    /// own ranking of a long or paired query buries the bag you mean ("rooster albert" → Roosters chicken); each word alone surfaces it.
    static func searchMerged(_ q: String, terms: [String], limit: Int = 12) async -> [Product] {
        let extra = terms.filter { $0.lowercased() != q.lowercased() }.prefix(3)
        return await withTaskGroup(of: (Int, [Product]).self) { group in
            group.addTask { (0, await search(q, limit: limit)) }
            for (i, t) in extra.enumerated() { group.addTask { (i + 1, await search(t, limit: limit)) } }
            var parts: [(Int, [Product])] = []
            for await part in group { parts.append(part) }
            var seen = Set<String>(), out: [Product] = []
            for (_, list) in parts.sorted(by: { $0.0 < $1.0 }) { for p in list { if let b = p.barcode { guard seen.insert(b).inserted else { continue } }; out.append(p) } }
            return out
        }
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
        if let q = (p["quantity"] as? String)?.trimmingCharacters(in: .whitespaces), q.contains(where: \.isNumber), q.contains(where: \.isLetter) {   // "395g" yes, a bare "2" no
            prod.quantity = tidyQuantity(q)
        }
        if prod.isDrink { prod.servings = prod.servings.map { $0.label == "100 g" ? Serving(label: "100 ml", grams: 100) : $0 } }
        // a protein powder with no label serving opens on 30 g, not 100 g; scoops differ by brand, so the number is plain and the first
        // amount you type is remembered for that tub (21 Oct)
        else if prod.servings.count == 1, (name + " " + (brand ?? "")).range(of: #"(?i)whey|casein|protein (powder|isolate|blend|shake)|mass gainer"#, options: .regularExpression) != nil { prod.servings.insert(Serving(label: "30 g", grams: 30), at: 0) }
        return prod
    }
    /// One way to write a pack size, so two bags compare at a glance: "2kg" → "2 kg", "400 grams" / "400G" → "400 g", "1 litre" → "1 L".
    /// Unknown words ("x", "pack") stay as printed.
    static func tidyQuantity(_ q: String) -> String {
        let units = ["g": "g", "gr": "g", "grs": "g", "gm": "g", "gms": "g", "gram": "g", "grams": "g", "gramme": "g", "grammes": "g",
                     "kg": "kg", "kgs": "kg", "kilo": "kg", "kilos": "kg", "kilogram": "kg", "kilograms": "kg", "kilogramme": "kg", "kilogrammes": "kg",
                     "ml": "ml", "mls": "ml", "millilitre": "ml", "millilitres": "ml", "milliliter": "ml", "milliliters": "ml", "cl": "cl",
                     "l": "L", "lt": "L", "ltr": "L", "ltrs": "L", "litre": "L", "litres": "L", "liter": "L", "liters": "L"]
        guard let re = try? NSRegularExpression(pattern: #"(\d)\s*([A-Za-z]+)\b"#) else { return q }
        var out = q
        for m in re.matches(in: q, range: NSRange(q.startIndex..., in: q)).reversed() {   // back to front, so earlier ranges stay valid
            guard let whole = Range(m.range, in: out), let d = Range(m.range(at: 1), in: q), let u = Range(m.range(at: 2), in: q) else { continue }
            let unit = String(q[u])
            out.replaceSubrange(whole, with: q[d] + " " + (units[unit.lowercased()] ?? unit))
        }
        return out
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
