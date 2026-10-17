import SwiftUI
import SwiftData

/// Type-to-log rows (README §4a): shown inside the Type it sheet when the line contains a digit.
struct TypeItView: View {
    @Environment(\.modelContext) private var ctx
    var line: String; var meal: Meal; var dayKey: String
    var onSearchAll: (String) -> Void; var onLogged: (Int) -> Void
    @State private var rows: [TypeToLog.Resolution] = []
    @State private var picks: [UUID: Food] = [:]          // user's choice for an asked row
    @State private var forceAsk: Set<UUID> = []           // "Change" on a resolved row
    @State private var expanded: Set<UUID> = []
    var store: Store { Store(ctx) }

    var resolved: [TypeToLog.Resolution] { rows.map { r in var r = r; if let f = picks[r.id] { r.food = f; r.ask = false }; if forceAsk.contains(r.id) { r.food = nil; r.ask = true }; return r } }
    var allResolved: Bool { !resolved.isEmpty && resolved.allSatisfy { $0.food != nil } }
    var together: (Double, Double, Double, Double) { resolved.reduce((0, 0, 0, 0)) { a, r in guard let f = r.food else { return a }; let g = r.grams / 100; return (a.0 + f.kcal100 * g, a.1 + f.p100 * g, a.2 + f.c100 * g, a.3 + f.f100 * g) } }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if rows.isEmpty { ProgressView().tint(.yumo.inkMuted).frame(maxWidth: .infinity).padding(.top, 20) } else {
            VStack(spacing: 0) { ForEach(resolved) { r in row(r) } }.padding(.leading, Space.cardPad).listCard()
            if allResolved { let t = together; Text("Together · \(Fmt.k(t.0)) kcal · P \(Fmt.g(t.1)) · C \(Fmt.g(t.2)) · F \(Fmt.g(t.3))").font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted).padding(.leading, 4) }
            PrimaryButton(label: "Log \(resolved.count) food\(resolved.count == 1 ? "" : "s")", size: .regular) { logAll() }.opacity(allResolved ? 1 : 0.45).disabled(!allResolved).padding(.top, 4)
            if !allResolved { Text(resolved.contains { $0.notFound } ? "Fix the food that wasn't found to log" : "Answer the question to log").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).frame(maxWidth: .infinity) }
            }
        }
        .task(id: line + "|" + meal.rawValue) { await reparse(keepPicks: lastMeal == meal); lastMeal = meal }
    }
    @State private var lastMeal: Meal? = nil
    /// Debounced 150 ms; `.task(id:)` restarts for every change so the latest line always wins.
    func reparse(keepPicks: Bool) async {
            try? await Task.sleep(for: .milliseconds(150)); guard !Task.isCancelled else { return }
            let groups = TypeToLog.parse(line); let res = TypeToLog.resolve(groups, meal: meal, store: store)
            // keep picks for rows whose words did not change
            var newPicks: [UUID: Food] = [:]; var newForce: Set<UUID> = []
            if keepPicks { for r in res { if let old = rows.first(where: { $0.group.words == r.group.words }) { if let f = picks[old.id] { newPicks[r.id] = f }; if forceAsk.contains(old.id) { newForce.insert(r.id) } } } }
            rows = res; picks = newPicks; forceAsk = newForce
    }
    @ViewBuilder func row(_ r: TypeToLog.Resolution) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    if let f = r.food {
                        HStack(alignment: .firstTextBaseline, spacing: 6) { Text(TypeToLog.shortName(f)).font(.nunito(17, .bold)).lineLimit(1); Text(r.amountLabel).font(.nunito(14, .semibold)).foregroundStyle(Color.yumo.inkMuted) }
                        let g = r.grams / 100
                        Text(f.macrosUnknown ? "macros not published" : "P \(Fmt.g(f.p100 * g)) · C \(Fmt.g(f.c100 * g)) · F \(Fmt.g(f.f100 * g))").font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted)
                        if picks[r.id] != nil { Text("I'll remember after \(TypeToLog.remaining(word: r.group.words, meal: meal, food: f, store: store)) more").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted) }
                        else if let why = r.reason { HStack(spacing: 6) { Text(why).font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted); Button("Change") { forceAsk.insert(r.id); picks[r.id] = nil }.font(.yumo.footnote).foregroundStyle(Color.yumo.accent).buttonStyle(PlainPressStyle()) } }
                    } else if r.notFound {
                        HStack(alignment: .firstTextBaseline, spacing: 6) { Text(r.group.words).font(.nunito(17, .bold)); Text(r.group.amount.map { "\(Fmt.g($0)) \(r.group.unitWord ?? "g")" } ?? "").font(.nunito(14, .semibold)).foregroundStyle(Color.yumo.inkMuted) }
                        Button { onSearchAll(r.group.words) } label: { Text("Not found — tap to search").font(.yumo.caption).foregroundStyle(Color.yumo.accent) }.buttonStyle(PlainPressStyle())
                    } else {
                        HStack(alignment: .firstTextBaseline, spacing: 6) { Text(r.group.words.capitalized).font(.nunito(17, .bold)); Text(r.group.amount.map { "\(Fmt.g($0)) \(r.group.unitWord ?? "g")" } ?? "").font(.nunito(14, .semibold)).foregroundStyle(Color.yumo.inkMuted) }
                        Text("Which \(r.group.words)? \(r.candidates.filter { $0.count > 0 }.count >= 2 ? "Your usual two first." : "")").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted)
                    }
                }
                Spacer()
                Text(r.food == nil ? "—" : Fmt.k(r.kcal)).font(.yumo.title).tabular()
            }
            if r.ask { ask(r) }
        }.padding(.vertical, 10).padding(.trailing, Space.cardPad).hairline()
    }
    func ask(_ r: TypeToLog.Resolution) -> some View {
        let open = expanded.contains(r.id); let top = Array(r.candidates.prefix(2)); let rest = Array(r.candidates.dropFirst(2))
        return AskList {
            ForEach(open ? r.candidates : top) { c in
                let gr = grams(r, c.food)
                AskOption(name: c.food.name + (c.food.brand.map { " · \($0)" } ?? ""), sub: c.count > 0 ? "\(mealWord(c.food)) · \(c.count) time\(c.count == 1 ? "" : "s")" : (c.food.state ?? c.food.tier.rawValue), kcal: c.food.macrosUnknown ? "—" : Fmt.k(c.food.kcal100 * gr / 100)) { pick(r, c.food) }
            }
            if !open && !rest.isEmpty { let logged = rest.filter { $0.count > 0 }.count; AskFooter(label: logged > 0 ? "\(rest.count) more · \(logged) you've logged" : "\(rest.count) more") { expanded.insert(r.id) } }
            if open || rest.isEmpty { AskFooter(label: "Search all \(r.group.words)") { onSearchAll(r.group.words) } }
        }.padding(.trailing, 0)
    }
    func grams(_ r: TypeToLog.Resolution, _ f: Food) -> Double { var t = r; t.food = f; return t.grams }
    @MainActor func mealWord(_ f: Food) -> String {
        for m in Meal.allCases { if let l = TypeToLog.learned("", meal: m, store: store), l.foodId == f.id { return m.rawValue.lowercased() } }
        var d = FetchDescriptor<FoodEntry>(sortBy: [SortDescriptor(\.loggedAt, order: .reverse)]); d.fetchLimit = 300
        let es = (try? store.ctx.fetch(d))?.filter { $0.food?.id == f.id } ?? []
        var counts: [Meal: Int] = [:]; for e in es { counts[e.meal, default: 0] += 1 }
        return counts.max { $0.value < $1.value }?.key.rawValue.lowercased() ?? "logged"
    }
    func pick(_ r: TypeToLog.Resolution, _ f: Food) { withAnimation(Motion.snap) { picks[r.id] = f; forceAsk.remove(r.id); expanded.remove(r.id) } }
    func logAll() {
        var n = 0
        for r in resolved { guard let f = r.food else { continue }
            _ = store.log(food: f, meal: meal, dayKey: dayKey, quantity: r.quantity, serving: r.serving); n += 1
            if r.candidates.count > 1 { TypeToLog.confirm(word: r.group.words, meal: meal, food: f, store: store) }
        }
        let p = store.profile(); if !p.typeItHintSeen { p.typeItHintSeen = true; store.save() }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        onLogged(n)
    }
}
