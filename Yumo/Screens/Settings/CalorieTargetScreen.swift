import SwiftUI
import SwiftData

/// Exactly three cards + Save: Daily target (hero, −/+ → manual override), Goal (mode + pace), Maintenance (→ About you).
struct CalorieTargetScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Session.self) private var session
    @Environment(Toaster.self) private var toaster
    @State private var mode: GoalMode = .cut
    @State private var pace: Double = -0.5
    @State private var override: Int? = nil
    @State private var showAbout = false
    @State private var tick = 0
    @State private var adaptive = true
    @State private var trainingOn = false
    @State private var trainingKcal = 0; @State private var restKcal = 0; @State private var restEdited = false
    @State private var days: [Bool] = [true, true, false, true, true, false, false]
    var store: Store { Store(ctx) }
    var body: some View {
        let p = store.profile(); let kg = store.currentKg()
        let bmr = Calc.bmr(sex: p.sex, kg: kg, cm: p.heightCm, age: p.age, bodyFat: p.bodyFatPct), tdee = Calc.tdee(bmr: bmr, activity: p.activity)
        let formulaAuto = Calc.automaticTarget(tdee: tdee, mode: mode, pace: pace)
        let auto = (adaptive ? p.adaptiveTarget : nil) ?? formulaAuto
        let shown = override ?? auto; let floor = Calc.floor(for: p.sex)
        let weeklyAvg = Calc.weeklyAverage(training: trainingKcal, rest: restKcal, days: days)
        VStack(spacing: 0) {
            PageHeader(back: "Settings", title: "Calorie target", onBack: { dismiss() }).padding(.horizontal, Space.gutter)
            ScrollView {
                VStack(spacing: Space.cardGap) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Daily target").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted)
                        HStack(alignment: .center) {
                            HStack(alignment: .firstTextBaseline, spacing: 6) { Text(Fmt.k(max(floor, shown))).font(.yumo.hero).kerning(-2).tabular().foregroundStyle(Color.yumo.accent); Text("kcal").font(.yumo.displayMuted).foregroundStyle(Color.yumo.inkMuted) }
                            Spacer()
                            HStack(spacing: 8) { StepperButton(glyph: "−") { override = max(floor, shown - 50) }; StepperButton(glyph: "+") { override = shown + 50 } }
                        }
                        if let _ = override {
                            HStack(spacing: 6) { Text("Set manually · automatic would be \(Fmt.k(auto))").font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted); TextAction(label: "Back to automatic") { override = nil } }
                        } else {
                            Text(mode == .maintain ? "Automatic · maintenance" : "Automatic · \(Fmt.k(Calc.round50(tdee))) \(pace < 0 ? "−" : "+") \(Fmt.k(abs(Calc.paceKcal(pace))))").font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted)
                        }
                        if shown < floor { Text("Below this isn't safe without medical supervision.").font(.nunito(13, .extrabold)).foregroundStyle(Color.yumo.danger) }
                        Rectangle().fill(Color.yumo.hairline).frame(height: 0.5).padding(.vertical, 4)
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(p.tdeeMeasured.map { "Measured maintenance \(Fmt.k(Calc.round50($0))) · adaptive" } ?? "Measured maintenance · after your first full week").font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted)
                                Text("Adjust automatically each week").font(.yumo.bodyStrong)
                            }
                            Spacer(); Toggle("", isOn: $adaptive).labelsHidden().tint(.yumo.accent)
                        }
                    }.frame(maxWidth: .infinity, alignment: .leading).card()
                    VStack(alignment: .leading, spacing: 12) {
                        Segmented(options: GoalMode.allCases.map { ($0, $0.rawValue) }, selection: $mode)
                        if mode != .maintain {
                            Text(mode == .cut ? "Lose per week" : "Gain per week").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted)
                            Segmented(options: [0.25, 0.5, 0.75, 1.0].map { v in (mode == .cut ? -v : v, "\(mode == .cut ? "−" : "+")\(v.formatted()) kg") }, selection: $pace)
                            Text("\(Fmt.delta(Double(Calc.paceKcal(pace)) / 1, unit: "kcal").replacingOccurrences(of: ".0", with: "")) a day from maintenance.").font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted)
                        } else { Text("Eat at maintenance.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted) }
                    }.card()
                    Button { showAbout = true } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Maintenance").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted)
                                HStack(alignment: .firstTextBaseline, spacing: 4) { Text(Fmt.k(Calc.round50(tdee))).font(.nunito(28, .extrabold)).tabular(); Text("kcal").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted) }
                                Text("\(Fmt.kg(kg)) kg · \(p.heightCm) cm · \(p.age) · \(p.activity.name)").font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted)
                            }.foregroundStyle(Color.yumo.ink)
                            Spacer(); Text("Edit ›").font(.yumo.action).foregroundStyle(Color.yumo.accent)
                        }.frame(maxWidth: .infinity).card()
                    }.buttonStyle(PlainPressStyle())
                    VStack(alignment: .leading, spacing: 12) {
                        HStack { Text("Different target on training days").font(.yumo.bodyStrong); Spacer(); Toggle("", isOn: $trainingOn).labelsHidden().tint(.yumo.accent) }
                        if trainingOn {
                            HStack { Text("Training").font(.yumo.title); Spacer(); ValueStepper(value: Fmt.k(trainingKcal), onMinus: { trainingKcal -= 50; rebalance(shown) }, onPlus: { trainingKcal += 50; rebalance(shown) }) }
                            HStack { Text("Rest").font(.yumo.title); Spacer(); ValueStepper(value: Fmt.k(restKcal), onMinus: { restKcal -= 50; restEdited = true }, onPlus: { restKcal += 50; restEdited = true }) }
                            HStack(spacing: 8) {
                                ForEach(0..<7, id: \.self) { i in
                                    Button { days[i].toggle(); rebalance(shown) } label: { Text(["M", "T", "W", "T", "F", "S", "S"][i]).font(.yumo.segment).foregroundStyle(days[i] ? .white : Color.yumo.ink).frame(width: 36, height: 36).background(Circle().fill(days[i] ? Color.yumo.accent : .yumo.control)) }.buttonStyle(PlainPressStyle())
                                }
                            }
                            let diff = weeklyAvg - shown
                            Text(diff == 0 ? "Weekly average \(Fmt.k(weeklyAvg)) · on target" : "Weekly average \(Fmt.k(weeklyAvg)) · \(diff > 0 ? "+" : "−")\(Fmt.k(abs(diff))) \(diff > 0 ? "over" : "under")").font(.yumo.caption).tabular().foregroundStyle(diff == 0 ? Color.yumo.inkMuted : .yumo.danger)
                        }
                    }.card()
                    PrimaryButton(label: "Save") {
                        p.goalMode = mode; p.paceKgPerWeek = pace; p.overrideKcal = override; p.adaptiveOn = adaptive
                        p.trainingOn = trainingOn; p.trainingKcal = trainingKcal; p.restKcal = restKcal; p.trainingDays = days
                        store.save(); toaster.show("Target \(Fmt.k(max(floor, shown)))"); session.changed(); dismiss()
                    }.padding(.top, 8)
                }.padding(Space.gutter).padding(.bottom, 40)
            }
        }
        .id(tick)
        .background(Color.yumo.bg.ignoresSafeArea())
        .onAppear {
            mode = p.goalMode; pace = p.paceKgPerWeek; override = p.overrideKcal; adaptive = p.adaptiveOn
            trainingOn = p.trainingOn; days = p.trainingDays; trainingKcal = p.trainingKcal > 0 ? p.trainingKcal : shown + 200; restKcal = p.restKcal > 0 ? p.restKcal : Calc.weeklyAverage(training: 0, rest: 0, days: days); if p.restKcal == 0 { rebalance(shown) }
        }
        .onChange(of: mode) { pace = mode == .cut ? -0.5 : mode == .bulk ? 0.25 : 0; override = nil }
        .onChange(of: trainingOn) { if trainingOn && p.trainingKcal == 0 { trainingKcal = shown + 200; rebalance(shown) } }
        .pushCover(isPresented: $showAbout, onDismiss: { tick += 1 }) { AboutYouScreen(back: "Target") }
    }
}

extension CalorieTargetScreen {
    /// Rest auto-balances so the 7-day mean equals the target, unless the user edited Rest themselves.
    func rebalance(_ target: Int) {
        guard !restEdited else { return }
        let n = days.filter { $0 }.count
        restKcal = n == 7 ? trainingKcal : Int((Double(target * 7 - trainingKcal * n) / Double(7 - n)).rounded())
    }
}

/// Sex, age, height, weight (read-only from the log), body fat (optional, clearable), activity rows, formula footer.
struct AboutYouScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Session.self) private var session
    var back: String
    @State private var tick = 0
    var store: Store { Store(ctx) }
    var body: some View {
        let p = store.profile(); let kg = store.currentKg()
        let bmr = Calc.bmr(sex: p.sex, kg: kg, cm: p.heightCm, age: p.age, bodyFat: p.bodyFatPct), tdee = Calc.tdee(bmr: bmr, activity: p.activity)
        VStack(spacing: 0) {
            PageHeader(back: back, title: "About you", onBack: { session.changed(); dismiss() }).padding(.horizontal, Space.gutter)
            ScrollView {
                VStack(alignment: .leading, spacing: Space.cardGap) {
                    ListCard {
                        SettingsRow(label: "Sex") { Segmented(options: Sex.allCases.map { ($0, $0.rawValue) }, selection: Binding(get: { p.sex }, set: { p.sex = $0; bump() })).frame(width: 160) }.hairline()
                        SettingsRow(label: "Age") { ValueStepper(value: "\(p.age)", onMinus: { p.age = max(14, p.age - 1); bump() }, onPlus: { p.age = min(90, p.age + 1); bump() }) }.hairline()
                        SettingsRow(label: "Height") { ValueStepper(value: "\(p.heightCm) cm", onMinus: { p.heightCm = max(120, p.heightCm - 1); bump() }, onPlus: { p.heightCm = min(230, p.heightCm + 1); bump() }) }.hairline()
                        SettingsRow(label: "Weight") { Text("\(Fmt.kg(kg)) kg · from your log").font(.yumo.body).tabular().foregroundStyle(Color.yumo.inkMuted) }.hairline()
                        SettingsRow(label: "Body fat %", sub: p.bodyFatPct == nil ? "Optional · switches to Katch-McArdle" : "Lean mass \(Fmt.kg(Calc.leanMass(kg: kg, bodyFat: p.bodyFatPct!))) kg") {
                            HStack(spacing: 8) {
                                if p.bodyFatPct != nil { TextAction(label: "Clear") { p.bodyFatPct = nil; bump() } }
                                ValueStepper(value: p.bodyFatPct.map { "\(Int($0)) %" } ?? "Not set", onMinus: { p.bodyFatPct = max(4, (p.bodyFatPct ?? 20) - 1); bump() }, onPlus: { p.bodyFatPct = min(50, (p.bodyFatPct ?? 14) + 1); bump() })
                            }
                        }
                    }
                    Overline(text: "Activity").padding(.top, 10)
                    ListCard {
                        ForEach(Activity.allCases) { a in
                            HStack { VStack(alignment: .leading, spacing: 2) { Text(a.name).font(.yumo.title); Text(a.sub).font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted) }; Spacer(); CheckCircle(on: p.activity == a) }
                                .padding(.vertical, Space.rowSettings).padding(.trailing, Space.cardPad).contentShape(Rectangle()).onTapGesture { p.activity = a; bump() }.hairline()
                        }
                    }
                    Text("A session is 45–60 min of weights or cardio that gets you sweating. A walk doesn't count; a job on your feet all day bumps you up one level.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).padding(.horizontal, 4)
                    Text("Maintenance \(Fmt.k(Calc.round50(tdee))) kcal · \(Calc.formulaName(bodyFat: p.bodyFatPct)), BMR \(Fmt.k(bmr)) × \(p.activity.rawValue.formatted()). Updates automatically as your weight changes.").font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted).padding(.horizontal, 4).padding(.top, 6)
                }.padding(Space.gutter).padding(.bottom, 40)
            }
        }.id(tick).background(Color.yumo.bg.ignoresSafeArea())
    }
    func bump() { store.save(); tick += 1 }
}
