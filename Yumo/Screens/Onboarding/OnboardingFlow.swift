import SwiftUI
import SwiftData

/// Welcome → Goal → About you → Weight → Body fat (optional) → Activity → Pace (skipped on Maintain) → Your plan → Account → Done.
struct OnboardingFlow: View {
    @Environment(\.modelContext) private var ctx
    @Environment(Session.self) private var session
    @Environment(Toaster.self) private var toaster
    enum Step: Int, CaseIterable { case welcome, goal, about, weight, bodyFat, activity, pace, plan, staples, supplements, account, done }
    @State private var step: Step = .welcome
    @State private var signIn = false
    // draft
    @State private var mode: GoalMode = .cut
    @State private var sex: Sex = .male; @State private var age = 28; @State private var height = 180
    @State private var kg = 80.0
    @State private var bodyFat: Double? = nil; @State private var bfDraft = 15.0
    @State private var activity: Activity = .moderate
    @State private var pace = -0.5
    @State private var username = ""; @State private var pw1 = ""; @State private var pw2 = ""
    var store: Store { Store(ctx) }

    var bmr: Double { Calc.bmr(sex: sex, kg: kg, cm: height, age: age, bodyFat: bodyFat) }
    var tdee: Double { Calc.tdee(bmr: bmr, activity: activity) }
    var target: Int { max(Calc.floor(for: sex), Calc.automaticTarget(tdee: tdee, mode: mode, pace: pace)) }
    var protein: Int { pO ?? Calc.defaultProtein(kg: kg, bodyFat: bodyFat) }
    var fat: Int { fO ?? Calc.defaultFat(kg: kg) }
    @State private var pO: Int? = nil; @State private var fO: Int? = nil; @State private var cO: Int? = nil   // Your plan drag overrides (rev 5)
    var planCarbs: Int { cO ?? Calc.carbs(target: target, protein: protein, fat: fat) }
    var planKcal: Int { protein * 4 + planCarbs * 4 + fat * 9 }
    var planPct: Int { Int((Double(planKcal) / Double(max(1, target)) * 100).rounded()) }
    var fatFloor: Int { Int((0.6 * kg / 5).rounded()) * 5 }
    var proteinFloor: Int { Int((1.6 * kg / 5).rounded()) * 5 }
    var planEdited: Bool { pO != nil || fO != nil || cO != nil }
    func beginMacroDrag() { if pO == nil || fO == nil || cO == nil { let c = planCarbs; pO = protein; fO = fat; cO = Int((Double(c) / 5).rounded()) * 5 } }
    var carbs: Int { Calc.carbs(target: target, protein: protein, fat: fat) }
    var steps: [Step] { Step.allCases.filter { $0 != .welcome && $0 != .done && !($0 == .pace && mode == .maintain) } }

    var body: some View {
        VStack(spacing: 0) {
            if step != .welcome && step != .done {
                HStack(spacing: 12) {
                    Button(action: back) { Text("‹").font(.nunito(20, .extrabold)).foregroundStyle(Color.yumo.ink).frame(width: 36, height: 36).background(Circle().fill(Color.yumo.control)) }.buttonStyle(PlainPressStyle())
                    HStack(spacing: 4) { ForEach(steps, id: \.rawValue) { s in Capsule().fill(s.rawValue <= step.rawValue ? Color.yumo.accent : .yumo.surfaceEdge).frame(height: 5) } }
                }.frame(height: 44).padding(.horizontal, Space.gutter)
            }
            Group {
                switch step {
                case .welcome: welcome
                case .goal: page("What are you here for?", "This sets the direction. You can change it any time.") { goal }
                case .about: page("About you", "For your maintenance calories.") { about }
                case .weight: page("Your weight today", "You'll log this most mornings.") { weight }
                case .bodyFat: page("Body fat, roughly", "Optional. It makes the numbers more accurate.") { bodyFatStep }
                case .activity: page("How active are you?", "Training sessions, not steps.") { activityStep }
                case .pace: page(mode == .cut ? "How fast do you want to lose?" : "How fast do you want to gain?", "Slower keeps more muscle. You can change it later.") { paceStep }
                case .plan: page("Your plan", mode == .cut ? "Eat this to lose \(abs(pace).formatted()) kg a week." : mode == .bulk ? "Eat this to gain \(pace.formatted()) kg a week." : "Eat this to stay where you are.") { plan }
                case .supplements: page("Take anything daily?", "Yumo can't see pills. Add what you take and your nutrient numbers are right from day one. Optional.") { supplementsStep }
                case .staples: page("Your staples", "The foods you eat most weeks. When your prep comes out different, Yumo works out the amounts of these that land the day. Optional.") { staplesStep }
                case .account: page("Save your plan", "A username and password. Nothing else.") { account }
                case .done: doneStep
                }
            }.transition(.asymmetric(insertion: .move(edge: .trailing), removal: .move(edge: .leading)))
        }
        .background(Color.yumo.bg.ignoresSafeArea())
        .animation(Motion.push, value: step)
        .pushCover(isPresented: $signIn) { SignInScreen() }
    }

    func page<C: View>(_ title: String, _ sub: String, @ViewBuilder _ c: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title).font(.yumo.pageTitle).kerning(-0.3).padding(.top, 12)
            Text(sub).font(.yumo.subtitle).foregroundStyle(Color.yumo.inkMuted).padding(.top, 6)
            c().padding(.top, 20)
        }.padding(.horizontal, Space.gutter).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
    func cta(_ label: String = "Continue", disabled: Bool = false) -> some View { PrimaryButton(label: label, disabled: disabled, action: next).padding(.horizontal, Space.gutter).padding(.bottom, 8) }
    func next() {
        guard let i = steps.firstIndex(of: step) else { step = .goal; return }
        step = i + 1 < steps.count ? steps[i + 1] : .done
    }
    func back() { guard let i = steps.firstIndex(of: step) else { return }; step = i == 0 ? .welcome : steps[i - 1] }

    var welcome: some View {
        VStack(spacing: 0) {
            Spacer()
            Text("y").font(.nunito(56, .black)).foregroundStyle(.white).frame(width: 96, height: 96).background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(Color.yumo.accent)).lifted(.yumo.accentEdge, lift: Lift.primary, radius: 24)
            Text("Yumo").font(.yumo.wordmark).kerning(-1).padding(.top, 22)
            Text("Log what you eat.\nHit your numbers.").font(.nunito(17, .bold)).foregroundStyle(Color.yumo.inkMuted).multilineTextAlignment(.center).padding(.top, 10)
            Spacer()
            PrimaryButton(label: "Get started", size: .hero) { step = .goal }.padding(.horizontal, Space.gutter)
            TextAction(label: "I already have an account") { signIn = true }.padding(.top, 16).padding(.bottom, 8)
        }
    }
    var goal: some View {
        VStack(spacing: Space.cardGap) {
            ForEach([(GoalMode.cut, "Lose fat, keep muscle"), (.maintain, "Hold your weight, eat well"), (.bulk, "Build muscle, controlled gain")], id: \.0) { m, s in SelectableCard(title: m.rawValue, subtitle: s, selected: mode == m) { mode = m; pace = m == .cut ? -0.5 : m == .bulk ? 0.25 : 0 } }
            Spacer(); cta()
        }.padding(.horizontal, -Space.gutter).padding(.horizontal, Space.gutter)
    }
    var about: some View {
        VStack(spacing: 0) {
            ListCard {
                SettingsRow(label: "Sex") { Segmented(options: Sex.allCases.map { ($0, $0.rawValue) }, selection: $sex).frame(width: 160) }.hairline()
                SettingsRow(label: "Age") { ValueStepper(value: "\(age)", onMinus: { age = max(14, age - 1) }, onPlus: { age = min(90, age + 1) }) }.hairline()
                SettingsRow(label: "Height") { ValueStepper(value: "\(height) cm", onMinus: { height = max(120, height - 1) }, onPlus: { height = min(230, height + 1) }) }
            }
            Spacer(); cta()
        }.padding(.horizontal, -Space.gutter).padding(.horizontal, Space.gutter)
    }
    var weight: some View {
        VStack(spacing: 0) {
            VStack(spacing: 8) {
                HStack(alignment: .firstTextBaseline, spacing: 6) { Text(String(format: "%.2f", kg)).font(.yumo.rulerValue).kerning(-2.5).tabular(); Text("kg").font(.yumo.displayMuted).foregroundStyle(Color.yumo.inkMuted) }
                RulerView(value: $kg, min: 30, max: 250, lb: false)
            }.frame(maxWidth: .infinity).card(padding: EdgeInsets(top: 18, leading: 0, bottom: 12, trailing: 0))
            Spacer(); cta()
        }.padding(.horizontal, -Space.gutter).padding(.horizontal, Space.gutter)
    }
    var bodyFatStep: some View {
        VStack(spacing: 0) {
            VStack(spacing: 12) {
                HStack(spacing: 20) {
                    StepperButton(glyph: "−", big: true) { bfDraft = max(4, bfDraft - 1); bodyFat = bfDraft }
                    HStack(alignment: .firstTextBaseline, spacing: 4) { Text("\(Int(bfDraft))").font(.yumo.rulerValue).kerning(-2).tabular(); Text("%").font(.yumo.displayMuted).foregroundStyle(Color.yumo.inkMuted) }.frame(minWidth: 130)
                    StepperButton(glyph: "+", big: true) { bfDraft = min(50, bfDraft + 1); bodyFat = bfDraft }
                }
                Text(Calc.bodyFatDescription(bfDraft)).font(.yumo.subtitle).foregroundStyle(Color.yumo.inkMuted)
                if bodyFat != nil { Text("Lean mass about \(Fmt.kg(Calc.leanMass(kg: kg, bodyFat: bfDraft))) kg").font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted) }
            }.frame(maxWidth: .infinity).card()
            Text("A guess is fine. Mirror, not maths: pick the line that sounds most like you.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).padding(.top, 12).padding(.horizontal, 4)
            Spacer()
            PrimaryButton(label: "Continue") { if bodyFat == nil { bodyFat = bfDraft }; next() }
            TextAction(label: "Skip for now") { bodyFat = nil; next() }.padding(.top, 14).padding(.bottom, 8)
        }
    }
    var activityStep: some View {
        VStack(spacing: 0) {
            ListCard { ForEach(Activity.allCases) { a in SelectableCard(title: a.name, subtitle: a.sub, selected: activity == a, row: true) { activity = a } } }
            Text("A session is 45–60 min of weights or cardio that gets you sweating. A walk doesn't count; a job on your feet all day bumps you up one level.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).padding(.top, 12).padding(.horizontal, 4)
            Spacer(); cta()
        }.padding(.horizontal, -Space.gutter).padding(.horizontal, Space.gutter)
    }
    var paceStep: some View {
        VStack(spacing: 0) {
            ListCard {
                ForEach([0.25, 0.5, 0.75, 1.0], id: \.self) { v in
                    let p = mode == .cut ? -v : v
                    SelectableCard(title: "\(p < 0 ? "−" : "+")\(v.formatted()) kg a week", subtitle: "\(Fmt.k(max(Calc.floor(for: sex), Calc.automaticTarget(tdee: tdee, mode: mode, pace: p)))) kcal a day", selected: pace == p, row: true) { pace = p }
                }
            }
            Text("Maintenance is about \(Fmt.k(Calc.round50(tdee))) kcal; 0.5 kg a week is about \(Fmt.k(abs(Calc.paceKcal(0.5)))) kcal a day \(mode == .cut ? "below" : "above") it.").font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted).padding(.top, 12).padding(.horizontal, 4)
            Spacer(); cta()
        }.padding(.horizontal, -Space.gutter).padding(.horizontal, Space.gutter)
    }
    var plan: some View {
        let fLow = fat < fatFloor, pLow = protein < proteinFloor, ok = planPct == 100
        return ScrollView {
        VStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Daily target").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted)
                HStack(alignment: .firstTextBaseline, spacing: 6) { Text(Fmt.k(target)).font(.yumo.plan).kerning(-2).tabular().foregroundStyle(Color.yumo.accent); Text("kcal").font(.yumo.displayMuted).foregroundStyle(Color.yumo.inkMuted) }
                Text(mode == .maintain ? "Maintenance" : "\(Fmt.k(Calc.round50(tdee))) maintenance \(pace < 0 ? "−" : "+") \(Fmt.k(abs(Calc.paceKcal(pace))))").font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted)
            }.frame(maxWidth: .infinity, alignment: .leading).card()
            HStack(spacing: 10) {
                MacroDragTile(label: "Protein", value: Binding(get: { protein }, set: { pO = $0 }), lo: 50, hi: 400, danger: pLow, onBegin: beginMacroDrag)
                MacroDragTile(label: "Carbs", value: Binding(get: { planCarbs }, set: { cO = $0 }), lo: 0, hi: 700, danger: false, onBegin: beginMacroDrag)
                MacroDragTile(label: "Fat", value: Binding(get: { fat }, set: { fO = $0 }), lo: 20, hi: 200, danger: fLow, onBegin: beginMacroDrag)
            }
            VStack(alignment: .leading, spacing: 10) {
                let t = Double(max(1, target))
                StackedBar(parts: [Double(protein * 4) / t, Double(planCarbs * 4) / t, Double(fat * 9) / t])
                HStack(alignment: .firstTextBaseline) {
                    HStack(spacing: 12) {
                        legend(.yumo.accent, "P \(Int((Double(protein * 4) / t * 100).rounded())) %"); legend(.yumo.ink, "C \(Int((Double(planCarbs * 4) / t * 100).rounded())) %"); legend(.yumo.inkMuted, "F \(Int((Double(fat * 9) / t * 100).rounded())) %")
                    }
                    Spacer(); Text("\(planPct) %").font(.nunito(15, .extrabold)).tabular().foregroundStyle(ok ? Color.yumo.ink : .yumo.danger)
                }
                Text("of your \(Fmt.k(target)) kcal").font(.yumo.footnote).tabular().foregroundStyle(Color.yumo.inkMuted).frame(maxWidth: .infinity, alignment: .trailing)
            }.card(padding: EdgeInsets(top: 14, leading: 16, bottom: 12, trailing: 16))
            if fLow || pLow { Text(fLow ? "Fat below 0.6 g/kg (\(fatFloor) g). Hormones and recovery suffer under that." : "Protein below 1.6 g/kg (\(proteinFloor) g). You'll lose muscle on a cut.").font(.yumo.caption).foregroundStyle(Color.yumo.danger).multilineTextAlignment(.center).frame(maxWidth: .infinity) }
            HStack(spacing: 14) { Text("Drag a number up or down · 5 g steps").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted); if planEdited { TextAction(label: "Reset") { pO = nil; fO = nil; cO = nil } } }
            Text(bodyFat.map { "Katch-McArdle from \(Fmt.kg(Calc.leanMass(kg: kg, bodyFat: $0))) kg lean mass · protein 2.8 g/kg lean · fat 0.8 g/kg. Change any of it later in Settings." } ?? "Mifflin-St Jeor · protein 2.2 g/kg · fat 0.8 g/kg. Add body fat % later for a tighter estimate.").font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted).multilineTextAlignment(.center).padding(.horizontal, 8).padding(.top, 6)
            PrimaryButton(label: "Looks good", disabled: !ok, action: next).padding(.top, 10)
        }.padding(.bottom, 12)
        }.scrollIndicators(.hidden)
    }
    func legend(_ c: Color, _ t: String) -> some View { HStack(spacing: 5) { Circle().fill(c).frame(width: 8, height: 8); Text(t).font(.yumo.footnote).tabular().foregroundStyle(Color.yumo.inkMuted) } }
    var staplesStep: some View {
        VStack(spacing: 0) {
            ScrollView { StaplesEditor(mode: .onboarding, onChange: { stapleCount = store.staples().count }).padding(.bottom, 12) }.scrollDismissesKeyboard(.interactively)
            PrimaryButton(label: stapleCount > 0 ? "Continue" : "Skip for now", action: next).padding(.bottom, 8)
        }.onAppear { stapleCount = store.staples().count }
    }
    @State private var stapleCount = 0
    var supplementsStep: some View {
        VStack(spacing: 0) {
            ScrollView { SupplementsOnboardingEditor().padding(.bottom, 12) }
            PrimaryButton(label: "Continue", action: next)
            Text("Nothing to add? Just continue.").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).padding(.top, 10).padding(.bottom, 8)
        }
    }
    var accountHint: String? {
        let u = username.trimmingCharacters(in: .whitespaces)
        if u.count < 3 { return "Username needs 3 or more characters." }
        if !u.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "_" }) || u.count > 24 { return "Letters, numbers and _ only, up to 24." }
        if pw1.count < 8 { return "Password needs 8 or more characters." }
        if pw1 != pw2 { return "Passwords don't match yet." }
        return nil
    }
    var account: some View {
        VStack(spacing: 12) {
            TextField("Username", text: $username).textContentType(.username).modifier(FieldStyle())
            SecureField("Password · 8+ characters", text: $pw1).textContentType(.newPassword).modifier(FieldStyle())
            SecureField("Confirm password", text: $pw2).textContentType(.newPassword).modifier(FieldStyle())
            Text(accountHint ?? "Your account is only for Yumo. Nothing is shared with any other app.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 4)
            Spacer()
            PrimaryButton(label: "Create account", disabled: accountHint != nil, action: createAccount)
        }.padding(.bottom, 8)
    }
    func createAccount() {
        let p = store.profile()
        p.username = username.trimmingCharacters(in: .whitespaces).lowercased(); p.passwordHash = Store.hash(pw1, salt: p.username)
        p.sex = sex; p.age = age; p.heightCm = height; p.bodyFatPct = bodyFat; p.activity = activity; p.goalMode = mode; p.paceKgPerWeek = pace; p.overrideKcal = nil
        // Your plan (rev 5): dragged macros are saved as the custom split; untouched = the formula defaults
        if planEdited { p.macrosCustomised = true; p.proteinG = protein; p.fatG = fat; p.carbsG = planCarbs; p.planEdited = true } else { p.macrosCustomised = false; p.carbsG = nil; p.planEdited = false }
        store.saveWeight(dayKey: Date().dayKey, kg: kg, photo: nil)
        p.onboarded = true; store.save(); step = .done
    }
    var doneStep: some View {
        VStack(spacing: 0) {
            Spacer()
            Image(systemName: "checkmark").font(.system(size: 34, weight: .black)).foregroundStyle(.white).frame(width: 72, height: 72).background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Color.yumo.accent)).lifted(.yumo.accentEdge, lift: Lift.primary, radius: 20)
            Text("You're set").font(.yumo.pageTitle).padding(.top, 22)
            Text("Your target is \(Fmt.k(target)) kcal. Log your first meal when you're ready.").font(.yumo.subtitle).tabular().foregroundStyle(Color.yumo.inkMuted).multilineTextAlignment(.center).padding(.top, 8).padding(.horizontal, 32)
            Spacer()
            PrimaryButton(label: "Open Today") { session.changed(); session.startTour = true; session.onboarded = true }.padding(.horizontal, Space.gutter).padding(.bottom, 8)
        }
    }
}

struct SelectableCard: View {
    var title: String; var subtitle: String; var selected: Bool; var row = false; var onSelect: () -> Void
    var body: some View {
        Button(action: onSelect) {
            HStack { VStack(alignment: .leading, spacing: 2) { Text(title).font(row ? .yumo.title : .nunito(19, .extrabold)); Text(subtitle).font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted) }; Spacer(); CheckCircle(on: selected) }
                .foregroundStyle(Color.yumo.ink).frame(maxWidth: .infinity)
                .padding(.vertical, row ? Space.rowSettings : 16).padding(.trailing, Space.cardPad).padding(.leading, row ? 0 : Space.cardPad)
        }
        .buttonStyle(PlainPressStyle())
        .modifier(SelectableChrome(row: row, selected: selected))
    }
}
struct SelectableChrome: ViewModifier {
    var row: Bool; var selected: Bool
    func body(content: Content) -> some View {
        if row { content.hairline() }
        else { content.background(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).fill(Color.yumo.surface)).overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).stroke(selected ? Color.yumo.accent : .clear, lineWidth: 2.5)).lifted() }
    }
}

/// Sign in with the local account (username + password). The REST backend replaces this when it exists.
struct SignInScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Session.self) private var session
    @State private var u = ""; @State private var pw = ""; @State private var error: String? = nil
    var body: some View {
        VStack(spacing: 0) {
            PageHeader(back: "Back", title: "Sign in", onBack: { dismiss() }).padding(.horizontal, Space.gutter)
            VStack(spacing: 12) {
                TextField("Username", text: $u).textContentType(.username).modifier(FieldStyle())
                SecureField("Password", text: $pw).textContentType(.password).modifier(FieldStyle())
                if let e = error { Text(e).font(.nunito(13, .extrabold)).foregroundStyle(Color.yumo.danger).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 4) }
                PrimaryButton(label: "Sign in", disabled: u.isEmpty || pw.isEmpty) {
                    let p = Store(ctx).profile()
                    if p.username == u.lowercased().trimmingCharacters(in: .whitespaces), p.passwordHash == Store.hash(pw, salt: p.username) { p.onboarded = true; Store(ctx).save(); session.onboarded = true; dismiss() }
                    else { error = p.username.isEmpty ? "No account on this phone yet. Create one first." : "Wrong username or password." }
                }.padding(.top, 8)
            }.padding(Space.gutter)
            Spacer()
        }.background(Color.yumo.bg.ignoresSafeArea())
    }
}
