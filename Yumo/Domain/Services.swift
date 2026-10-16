import Foundation
import UserNotifications
import HealthKit
import SwiftData

/// Local notifications only. Two reminders: Log weight, Log dinner.
enum Reminders {
    static func reschedule(_ p: UserProfile) {
        let c = UNUserNotificationCenter.current()
        c.removePendingNotificationRequests(withIdentifiers: ["weight", "dinner"])
        guard p.reminderWeightOn || p.reminderDinnerOn else { return }
        c.requestAuthorization(options: [.alert, .sound]) { ok, _ in
            guard ok else { return }
            func add(_ id: String, _ minutes: Int, _ body: String) {
                var dc = DateComponents(); dc.hour = minutes / 60; dc.minute = minutes % 60
                let content = UNMutableNotificationContent(); content.title = "Yumo"; content.body = body; content.sound = .default
                c.add(UNNotificationRequest(identifier: id, content: content, trigger: UNCalendarNotificationTrigger(dateMatching: dc, repeats: true)))
            }
            if p.reminderWeightOn { add("weight", p.reminderWeightMinutes, "Log your weight.") }
            if p.reminderDinnerOn { add("dinner", p.reminderDinnerMinutes, "Log dinner.") }
        }
    }
    static func time(_ minutes: Int) -> String { String(format: "%d:%02d", minutes / 60, minutes % 60) }
}

/// Apple Health: write body mass + dietary energy/protein/carbs/fat; read body mass.
enum HealthSync {
    static let store = HKHealthStore()
    static var available: Bool { HKHealthStore.isHealthDataAvailable() }
    static func types() -> (Set<HKSampleType>, Set<HKObjectType>) {
        let mass = HKQuantityType(.bodyMass)
        let write: Set<HKSampleType> = [mass, HKQuantityType(.dietaryEnergyConsumed), HKQuantityType(.dietaryProtein), HKQuantityType(.dietaryCarbohydrates), HKQuantityType(.dietaryFatTotal)]
        return (write, [mass])
    }
    static func request() async -> Bool {
        guard available else { return false }
        let (w, r) = types()
        return (try? await store.requestAuthorization(toShare: w, read: r)) != nil
    }
    static func writeWeight(kg: Double, date: Date) async {
        guard available, store.authorizationStatus(for: HKQuantityType(.bodyMass)) == .sharingAuthorized else { return }
        let s = HKQuantitySample(type: HKQuantityType(.bodyMass), quantity: HKQuantity(unit: .gramUnit(with: .kilo), doubleValue: kg), start: date, end: date)
        try? await store.save(s)
    }
    /// Replaces Yumo's own samples for that day with the day's totals (so re-logging never duplicates).
    static func writeDay(_ totals: DayTotals, date: Date) async {
        guard available else { return }
        let start = date.startOfDay, end = start.adding(days: 1)
        let pairs: [(HKQuantityTypeIdentifier, HKUnit, Double)] = [(.dietaryEnergyConsumed, .kilocalorie(), totals.kcal), (.dietaryProtein, .gram(), totals.p), (.dietaryCarbohydrates, .gram(), totals.c), (.dietaryFatTotal, .gram(), totals.f)]
        for (id, unit, v) in pairs where store.authorizationStatus(for: HKQuantityType(id)) == .sharingAuthorized {
            let type = HKQuantityType(id)
            let mine = NSCompoundPredicate(andPredicateWithSubpredicates: [HKQuery.predicateForObjects(from: HKSource.default()), HKQuery.predicateForSamples(withStart: start, end: end)])
            _ = try? await store.deleteObjects(of: type, predicate: mine)
            if v > 0 { try? await store.save(HKQuantitySample(type: type, quantity: HKQuantity(unit: unit, doubleValue: v), start: start.addingTimeInterval(12 * 3600), end: start.addingTimeInterval(12 * 3600))) }
        }
    }
    static func readLatestWeight() async -> (Double, Date)? {
        guard available else { return nil }
        return await withCheckedContinuation { cont in
            let q = HKSampleQuery(sampleType: HKQuantityType(.bodyMass), predicate: nil, limit: 1, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]) { _, r, _ in
                if let s = r?.first as? HKQuantitySample { cont.resume(returning: (s.quantity.doubleValue(for: .gramUnit(with: .kilo)), s.startDate)) } else { cont.resume(returning: nil) }
            }
            store.execute(q)
        }
    }
}

/// Export: days.csv, entries.csv, weights.csv (three files for the share sheet).
enum CSVExport {
    @MainActor static func files(_ store: Store) -> [URL] {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("yumo-export", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let all = (try? store.ctx.fetch(FetchDescriptor<FoodEntry>(sortBy: [SortDescriptor(\.dayKey), SortDescriptor(\.loggedAt)]))) ?? []
        var entries = "date,meal,food,brand,quantity,serving,grams,kcal,protein_g,carbs_g,fat_g,logged_at\n"
        for e in all { entries += [e.dayKey, e.meal.rawValue, q(e.foodName), q(e.food?.brand ?? ""), "\(e.quantity)", q(e.servingLabel), "\(e.grams)", "\(e.kcal)", "\(e.p)", "\(e.c)", "\(e.f)", ISO8601DateFormatter().string(from: e.loggedAt)].joined(separator: ",") + "\n" }
        var days = "date,kcal,protein_g,carbs_g,fat_g,weight_kg\n"
        let weights = store.weights(); let byDay = Dictionary(grouping: all, by: \.dayKey)
        let keys = Set(byDay.keys).union(weights.map(\.dayKey)).sorted()
        for k in keys { let t = DayTotals(byDay[k] ?? []); let w = weights.first { $0.dayKey == k }?.kg; days += "\(k),\(t.kcal),\(t.p),\(t.c),\(t.f),\(w.map { "\($0)" } ?? "")\n" }
        var ws = "date,kg,has_photo\n"; for w in weights.reversed() { ws += "\(w.dayKey),\(w.kg),\(w.photo != nil)\n" }
        let out = [("days.csv", days), ("entries.csv", entries), ("weights.csv", ws)].map { n, s in let u = dir.appendingPathComponent(n); try? s.write(to: u, atomically: true, encoding: .utf8); return u }
        return out
    }
    static func q(_ s: String) -> String { "\"" + s.replacingOccurrences(of: "\"", with: "\"\"") + "\"" }
}
