import SwiftUI
import SwiftData

/// Weekly review (REV10_SPEC §7): full-screen page, five pages — Verdict · Macros · Calories · Maintenance · Next week.
/// Replaces the Sunday check-in. Dismiss keeps it pending (chip); Apply / Keep / a stall choice finishes it.
struct WeeklyReviewScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(\.pushDismiss) private var pushDismiss
    @Environment(Session.self) private var session
    @Environment(Toaster.self) private var toaster
    @State private var page = 0
    @State private var forward = true
    @State private var macro: Review.Macro = .protein
    @State private var stallChoice: Expenditure.StallChoice = .dietBreak
    @State private var showMaintenance = false
    @State private var week: Review.Week? = nil
    @State private var pageHeight: CGFloat = 0
    var store: Store { Store(ctx) }

    var body: some View {
        VStack(spacing: 0) {
            Text("Your week").font(.yumo.title).foregroundStyle(Color.yumo.ink).frame(height: 44)
            // pager dots: inactive 6 × 6 surface.edge, active 18 × 6 accent, radius 3, tappable
            HStack(spacing: 6) { ForEach(0..<5, id: \.self) { i in Capsule().fill(i == page ? Color.yumo.accent : .yumo.surfaceEdge).frame(width: i == page ? 18 : 6, height: 6).onTapGesture { go(i) } } }
                .padding(.top, 10).animation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.3), value: page)
            if let w = week {
                ScrollView {
                    Group {
                        switch page {
                        case 0: verdict(w).frame(minHeight: max(0, pageHeight - 34))   // vertically centred column (§7.3)
                        case 1: macros(w)
                        case 2: calories(w)
                        case 3: maintenance(w)
                        default: nextWeek(w)
                        }
                    }
                    .padding(EdgeInsets(top: 14, leading: Space.gutter, bottom: 20, trailing: Space.gutter))
                    .id(page).transition(.asymmetric(insertion: .opacity.combined(with: .offset(x: forward ? 14 : -14)), removal: .opacity))   // motion.reviewPage = motion.dayChange
                }
                .scrollIndicators(.hidden)
                .background { GeometryReader { g in Color.clear.onAppear { pageHeight = g.size.height }.onChange(of: g.size.height) { pageHeight = g.size.height } } }
                .simultaneousGesture(DragGesture(minimumDistance: 20).onEnded { v in
                    guard abs(v.translation.width) > 60, abs(v.translation.width) > abs(v.translation.height) else { return }
                    if v.translation.width < 0, page < 4 { go(page + 1) } else if v.translation.width > 0, page > 0 { go(page - 1) }
                })
                footer(w)
            } else { Spacer() }
        }
        .background(Color.yumo.bg.ignoresSafeArea())
        .onAppear {
            let s = store, p = s.profile()
            let start = p.reviewWeek.map(Date.fromKey) ?? Expenditure.weekStart(Date()).adding(days: -7)
            week = Review.week(s, weekStart: start)
            page = min(4, max(0, p.reviewPage)); p.reviewOpened = true; s.save()
        }
        .pushCover(isPresented: $showMaintenance) { MaintenanceScreen(back: "Your week") }
    }
    func go(_ i: Int) { forward = i > page; withAnimation(Motion.dayChange) { page = i }; let p = store.profile(); p.reviewPage = i; store.save() }
    func leave() { if let pd = pushDismiss { pd { dismiss() } } else { dismiss() } }
    func finish(toast: String) { Review.finish(store); toaster.show(toast); session.changed(); leave() }

    // MARK: Footer — pages 1–4: Next + "Dismiss for now"; page 5: Apply + Keep (or the stall option + Decide later)
    @ViewBuilder func footer(_ w: Review.Week) -> some View {
        if page < 4 {
            VStack(spacing: 0) {
                PrimaryButton(label: "Next") { go(page + 1) }
                Button { leave() } label: { Text("Dismiss for now").font(.yumo.action).foregroundStyle(Color.yumo.inkMuted).frame(maxWidth: .infinity).frame(height: 44) }.buttonStyle(PlainPressStyle())
            }.padding(EdgeInsets(top: 0, leading: Space.gutter, bottom: 24, trailing: Space.gutter))
        } else if let st = w.stall {
            VStack(spacing: 10) {
                PrimaryButton(label: stallChoice == .dietBreak ? "Start the diet break" : (stallChoice == .hold ? "Hold for a week" : "Lower to \(Fmt.k(w.target - 100))")) {
                    Expenditure.applyStall(store, choice: stallChoice)
                    finish(toast: stallChoice == .dietBreak ? "Diet break until \(Fmt.dayTitle(Date().adding(days: 14)))" : (stallChoice == .hold ? "Holding \(Fmt.k(w.target))" : "Target → \(Fmt.k(w.target - 100))"))
                }
                SecondaryButton(label: "Decide later", size: .regular) { leave() }   // stays pending
            }.padding(EdgeInsets(top: 0, leading: Space.gutter, bottom: 34, trailing: Space.gutter)).onAppear { _ = st }
        } else if let to = w.proposal, to != w.target {
            VStack(spacing: 10) {
                PrimaryButton(label: "Apply \(Fmt.k(to))") { Expenditure.apply(store, accept: true); finish(toast: "Target → \(Fmt.k(to))") }
                SecondaryButton(label: "Keep \(Fmt.k(w.target))", size: .regular) { Expenditure.apply(store, accept: false); finish(toast: "Keeping \(Fmt.k(w.target))") }
            }.padding(EdgeInsets(top: 0, leading: Space.gutter, bottom: 34, trailing: Space.gutter))
        } else {
            PrimaryButton(label: "Keep \(Fmt.k(w.target))") { Expenditure.apply(store, accept: false); finish(toast: "Keeping \(Fmt.k(w.target))") }
                .padding(EdgeInsets(top: 0, leading: Space.gutter, bottom: 34, trailing: Space.gutter))
        }
    }

    // MARK: Page 1 — Verdict (§7.3)
    func verdict(_ w: Review.Week) -> some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)
            VerdictTick()
            Text(w.weekLabel).font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).padding(.top, 26)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                if let d = w.trendDelta { CountUpSigned(value: d) } else { Text("—").font(.yumo.verdict).kerning(-2).foregroundStyle(Color.yumo.inkMuted) }   // no weigh-ins: never a made-up number
                Text("kg").font(.nunito(24, .bold)).foregroundStyle(Color.yumo.inkMuted)
            }.padding(.top, 4)
            Text(Review.headline(w)).font(.yumo.headline).kerning(-0.4).foregroundStyle(Color.yumo.ink).multilineTextAlignment(.center).padding(.top, 10)
            Text(Review.sub(w)).font(.nunito(16, .semibold)).foregroundStyle(Color.yumo.inkMuted).multilineTextAlignment(.center).lineSpacing(5).frame(maxWidth: 300).padding(.top, 12).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 10) {
                statCard("\(w.loggedCount)", nil, "days logged")
                statCard(Fmt.g(w.pAvg), "g", "protein avg")
                statCard(Fmt.k(w.kcalAvg), nil, "kcal avg")
            }.padding(.top, 28)
            Spacer(minLength: 0)
        }.frame(maxWidth: .infinity)
        .onAppear { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    }
    /// radius.statCard 16, lift.card, padding 12 14: value 22/800 −0.3, label 12/700 muted.
    func statCard(_ value: String, _ unit: String?, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 2) { Text(value).font(.nunito(22, .extrabold)).kerning(-0.3).tabular().foregroundStyle(Color.yumo.ink); if let unit { Text(unit).font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted) } }
            Text(label).font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted)
        }.frame(maxWidth: .infinity, alignment: .leading).card(padding: EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14), radius: Radius.statCard)
    }

    // MARK: Page 2 — Macros (§7.4)
    func macros(_ w: Review.Week) -> some View {
        let goal = macro == .protein ? w.proteinGoal : macro == .carbs ? w.carbsGoal : w.fatGoal
        let avg = macro == .protein ? w.pAvg : macro == .carbs ? w.cAvg : w.fAvg
        let total = w.macroTotal(macro)
        return VStack(spacing: Space.cardGap) {
            Segmented(options: Review.Macro.allCases.map { ($0, $0.rawValue) }, selection: $macro)
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) { Text(macro.rawValue).font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted); Spacer(); Text(Review.macroNote(w, macro)).font(.nunito(13, .extrabold)).tabular().foregroundStyle(Color.yumo.inkMuted) }
                HStack(alignment: .firstTextBaseline, spacing: 6) { Text(Fmt.g(avg)).font(.yumo.statBig).kerning(-1).tabular().foregroundStyle(Color.yumo.ink); Text("g avg / \(goal)").font(.yumo.subtitle).tabular().foregroundStyle(Color.yumo.inkMuted) }.padding(.top, 6)
                HStack(spacing: 6) {
                    ForEach(w.days) { d in
                        VStack(spacing: 5) {
                            let hit = d.logged && w.hit(macro, d)
                            let v = macro == .protein ? d.p : macro == .carbs ? d.c : d.f
                            ZStack {
                                Circle().fill(!d.logged ? Color.clear : hit ? .yumo.accent : .yumo.accentTint)
                                if !d.logged { Circle().strokeBorder(Color.yumo.surfaceEdge, lineWidth: 2) }
                                Text(d.logged ? Fmt.g(v) : "—").font(.yumo.overline).tabular().foregroundStyle(!d.logged ? Color.yumo.inkMuted : hit ? .yumo.onAccent : .yumo.accentEdge)
                            }.frame(width: 36, height: 36)
                            Text(Fmt.weekday(d.date).prefix(1)).font(.nunito(11, .bold)).foregroundStyle(Color.yumo.inkMuted)
                        }.frame(maxWidth: .infinity)
                    }
                }.padding(.top, 14)
            }.card(padding: EdgeInsets(top: 18, leading: 20, bottom: 18, trailing: 20))
            let foods = w.foods(for: macro)
            if !foods.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    Text("Where your \(macro.rawValue.lowercased()) came from").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).padding(.bottom, 4)
                    ForEach(Array(foods.enumerated()), id: \.offset) { i, f in
                        HStack(alignment: .center, spacing: 12) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(f.name).font(.yumo.subtitle).foregroundStyle(Color.yumo.ink).lineLimit(1)
                                Text(macro == .protein ? "\(f.days) day\(f.days == 1 ? "" : "s")" : "\(Int((f.macro / max(1, total) * 100).rounded())) % of the week's \(macro.rawValue.lowercased())").font(.yumo.footnote).tabular().foregroundStyle(Color.yumo.inkMuted)
                            }
                            Spacer(minLength: 8); Text(Review.amount(f.grams)).font(.yumo.title).tabular().foregroundStyle(Color.yumo.ink)
                        }.padding(.vertical, 11).overlay(alignment: .bottom) { if i < foods.count - 1 { Rectangle().fill(Color.yumo.hairline).frame(height: 0.5) } }
                    }
                }.card(padding: EdgeInsets(top: 16, leading: 20, bottom: 6, trailing: 20))
            }
        }.animation(nil, value: macro)
    }

    // MARK: Page 3 — Calories (§7.5)
    func calories(_ w: Review.Week) -> some View {
        let denom = max(Double(w.target) * 1.125, w.days.map(\.kcal).max() ?? 0)
        return VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) { Text("Calories").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted); Spacer(); Text("\(w.kcalOnTargetDays) / \(w.loggedCount) days on target").font(.nunito(13, .extrabold)).tabular().foregroundStyle(Color.yumo.inkMuted) }
            HStack(alignment: .firstTextBaseline, spacing: 6) { Text(Fmt.k(w.kcalAvg)).font(.yumo.statBig).kerning(-1).tabular().foregroundStyle(Color.yumo.ink); Text("avg / \(Fmt.k(w.target))").font(.yumo.subtitle).tabular().foregroundStyle(Color.yumo.inkMuted) }.padding(.top, 6)
            HStack(alignment: .bottom, spacing: 8) {
                ForEach(w.days) { d in
                    let on = d.logged && abs(d.kcal - Double(w.target)) <= 100
                    VStack(spacing: 4) {
                        Text(d.logged ? Fmt.k(d.kcal) : "—").font(.yumo.axis).tabular().foregroundStyle(d.logged ? Color.yumo.ink : .yumo.inkMuted)
                        UnevenRoundedRectangle(topLeadingRadius: 8, bottomLeadingRadius: 3, bottomTrailingRadius: 3, topTrailingRadius: 8, style: .continuous)
                            .fill(!d.logged ? Color.yumo.track : on ? .yumo.accent : .yumo.accentSoft)
                            .frame(height: d.logged ? max(4, CGFloat(d.kcal / denom) * 116) : 4)
                    }.frame(maxWidth: .infinity)
                }
            }.frame(height: 150, alignment: .bottom).padding(.top, 14)
            HStack(spacing: 8) { ForEach(w.days) { d in Text(Fmt.weekday(d.date).prefix(1)).font(.nunito(11, .bold)).foregroundStyle(Color.yumo.inkMuted).frame(maxWidth: .infinity) } }.padding(.top, 6)
            Text(Review.calorieNote(w)).font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted).lineSpacing(4).padding(.top, 16).fixedSize(horizontal: false, vertical: true)
        }.card(padding: EdgeInsets(top: 18, leading: 20, bottom: 18, trailing: 20))
    }

    // MARK: Page 4 — Maintenance (§7.6)
    func maintenance(_ w: Review.Week) -> some View {
        VStack(spacing: Space.cardGap) {
            MaintenanceHero(week: w, estimates: store.weeklyEstimates(), note: Review.maintenanceNote(w))
            ThisWeekCard(week: w)
            Button { showMaintenance = true } label: { Text("How it's worked out ›").font(.yumo.action).foregroundStyle(Color.yumo.accent).frame(maxWidth: .infinity).frame(height: 44) }.buttonStyle(PlainPressStyle()).padding(.top, 4)
        }
    }

    // MARK: Page 5 — Next week (§7.7)
    @ViewBuilder func nextWeek(_ w: Review.Week) -> some View {
        if let st = w.stall { stallCards(st, w) }
        else {
            VStack(spacing: Space.cardGap) {
                if w.scenario != .gain, w.pace < 0 {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Keep this up").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted)
                        Text("\(Fmt.kg(w.endKg)) kg by \(Review.longDate(w.endDate)).").font(.nunito(24, .extrabold)).kerning(-0.3).tabular().foregroundStyle(Color.yumo.ink).padding(.top, 6)
                        Text("At \(Review.kg1(w.pace)) kg a week, six weeks from now.").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted).padding(.top, 2)
                        ProjectionChart(past: w.pastWeeks, now: w.nowKg, pace: w.pace, startDate: w.weekStart.adding(days: -21), endDate: w.endDate).frame(height: 150).padding(.top, 14)
                    }.frame(maxWidth: .infinity, alignment: .leading).card(padding: EdgeInsets(top: 18, leading: 20, bottom: 22, trailing: 20))
                }
                VStack(alignment: .leading, spacing: 0) {
                    Text("Next week").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted)
                    if let to = w.proposal, to != w.target {
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Text(Fmt.k(w.target)).font(.yumo.display).kerning(-0.4).tabular().foregroundStyle(Color.yumo.inkMuted).strikethrough(true, pattern: .solid, color: .yumo.inkMuted)
                            Text("→").font(.nunito(22, .bold)).foregroundStyle(Color.yumo.inkMuted)
                            Text(Fmt.k(to)).font(.yumo.display).kerning(-0.4).tabular().foregroundStyle(Color.yumo.accent)
                        }.padding(.top, 6)
                    } else {
                        Text("Stay at \(Fmt.k(w.target))").font(.yumo.display).kerning(-0.4).tabular().foregroundStyle(Color.yumo.ink).padding(.top, 6)
                    }
                    Text(w.scenario == .gain ? "One week up doesn't move the target. \(Review.why(w, hasStaples: !store.staples().isEmpty))" : Review.why(w, hasStaples: !store.staples().isEmpty)).font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted).lineSpacing(4).padding(.top, 10).fixedSize(horizontal: false, vertical: true)
                }.frame(maxWidth: .infinity, alignment: .leading).card(padding: EdgeInsets(top: 18, leading: 20, bottom: 18, trailing: 20))
            }
        }
    }
    /// Stall week: the "Looks like a stall" card with three option tiles (README §7b); the footer carries the choice.
    func stallCards(_ st: Expenditure.Stall, _ w: Review.Week) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Looks like a stall").font(.yumo.title)
            Text("You've stuck to \(Fmt.k(w.target)) and the trend hasn't moved in 3 weeks. After \(st.cutWeeks) weeks of cutting that's more likely adaptation and water retention than a wrong target — so lowering calories isn't the first move.").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted).fixedSize(horizontal: false, vertical: true)
            OptionTile(title: "Diet break · 2 weeks at \(Fmt.k(st.maintenance))", body_: "Eat at your measured maintenance for 14 days, then resume. Water drops first, so the scale may rise then fall.", selected: stallChoice == .dietBreak) { stallChoice = .dietBreak }
            OptionTile(title: "Hold at \(Fmt.k(w.target)) · 1 more week", body_: "Nothing changes. Ask again next week with one more week of data.", selected: stallChoice == .hold) { stallChoice = .hold }
            OptionTile(title: "Lower to \(Fmt.k(w.target - 100))", body_: "A small cut. Only if you are sure logging has been complete.", selected: stallChoice == .lower) { stallChoice = .lower }
        }.frame(maxWidth: .infinity, alignment: .leading).card()
    }
}

/// §7.3 tick: 88 pt accent circle, lift 5 accent.edge, white tick 44 × 34 stroke 2.4. motion.tabPop scale then the stroke draws on.
struct VerdictTick: View {
    @State private var popped = false
    @State private var drawn: CGFloat = 0
    var body: some View {
        ZStack {
            Circle().fill(Color.yumo.accent).lifted(.yumo.accentEdge, lift: 5, radius: 44)
            Path { p in p.move(to: CGPoint(x: 4, y: 18)); p.addLine(to: CGPoint(x: 17, y: 31)); p.addLine(to: CGPoint(x: 40, y: 3)) }
                .trim(from: 0, to: drawn).stroke(Color.yumo.onAccent, style: StrokeStyle(lineWidth: 2.4 * 44 / 34 * 1.2, lineCap: .round, lineJoin: .round)).frame(width: 44, height: 34)
        }.frame(width: 88, height: 88).scaleEffect(popped ? 1 : 0.9)
        .onAppear {
            withAnimation(Motion.tabPop.delay(0.1)) { popped = true }
            withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.35).delay(0.35)) { drawn = 1 }
        }
    }
}

/// verdict 64/800 −2 with a real minus; motion.countUp on the two decimals.
struct CountUpSigned: View { var value: Double
    @State private var shown = 0.0
    var body: some View {
        Text((shown < -0.004 ? "−" : shown > 0.004 ? "+" : "") + Review.kg2(shown)).font(.yumo.verdict).kerning(-2).tabular().foregroundStyle(Color.yumo.ink)
            .contentTransition(.numericText(value: shown))
            .onAppear { withAnimation(Motion.countUp.delay(0.2)) { shown = value } }
    }
}

/// §7.7 projection: 3 hairline grid lines with right-aligned 11/700 labels; past 4 weeks solid accent 3 pt; future 6 weeks dashed (2 / 7); now dot r 5 accent; end dot r 5 surface + accent 3 pt stroke; x labels start · Today · end.
struct ProjectionChart: View {
    var past: [Double]; var now: Double; var pace: Double; var startDate: Date; var endDate: Date
    var body: some View {
        let pts = past + [now], future = (1...6).map { now + pace * Double($0) }
        let all = pts + future
        let lo = floor((all.min() ?? now) - 0.5), hi = ceil((all.max() ?? now) + 0.4)
        VStack(spacing: 6) {
            GeometryReader { g in
                let W = g.size.width - 34, H = g.size.height
                let n = pts.count + future.count - 1
                let x: (Int) -> CGFloat = { i in 6 + CGFloat(i) * (W - 12) / CGFloat(max(1, n)) }
                let y: (Double) -> CGFloat = { v in hi == lo ? H / 2 : 8 + CGFloat((hi - v) / (hi - lo)) * (H - 16) }
                ZStack(alignment: .topLeading) {
                    ForEach([hi, (hi + lo) / 2, lo], id: \.self) { v in
                        Path { p in p.move(to: CGPoint(x: 0, y: y(v))); p.addLine(to: CGPoint(x: W, y: y(v))) }.stroke(Color.yumo.hairline, lineWidth: 1)
                        Text(String(format: "%.1f", v)).font(.nunito(11, .bold)).tabular().foregroundStyle(Color.yumo.inkMuted).frame(width: 34, alignment: .trailing).position(x: W + 17, y: y(v))
                    }
                    Path { p in for (i, v) in pts.enumerated() { let c = CGPoint(x: x(i), y: y(v)); i == 0 ? p.move(to: c) : p.addLine(to: c) } }
                        .stroke(Color.yumo.accent, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
                    Path { p in p.move(to: CGPoint(x: x(pts.count - 1), y: y(now))); for (i, v) in future.enumerated() { p.addLine(to: CGPoint(x: x(pts.count + i), y: y(v))) } }
                        .stroke(Color.yumo.accent, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round, dash: [2, 7]))
                    Circle().fill(Color.yumo.accent).frame(width: 10, height: 10).position(x: x(pts.count - 1), y: y(now))
                    Text(Fmt.kg(now)).font(.yumo.axis).tabular().foregroundStyle(Color.yumo.ink).position(x: x(pts.count - 1), y: y(now) + 16)
                    Circle().fill(Color.yumo.surface).stroke(Color.yumo.accent, lineWidth: 3).frame(width: 10, height: 10).position(x: x(n), y: y(future.last ?? now))
                    Text(Fmt.kg(future.last ?? now)).font(.nunito(13, .extrabold)).tabular().foregroundStyle(Color.yumo.accentEdge).padding(.horizontal, 3).background(RoundedRectangle(cornerRadius: 3).fill(Color.yumo.surface)).position(x: min(W - 16, x(n) - 6), y: y(future.last ?? now) - 16)
                }
            }
            HStack { Text(Review.shortDate(startDate)); Spacer(); Text("Today"); Spacer(); Text(Review.shortDate(endDate)) }.font(.nunito(11, .bold)).foregroundStyle(Color.yumo.inkMuted).padding(.trailing, 34)
        }
    }
}
