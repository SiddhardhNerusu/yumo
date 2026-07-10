# Native moat — lock-screen widget, notifications, HealthKit

This is the one part of the plan that **cannot be built or verified in a
headless environment**: it needs Xcode, a physical device, and an Expo **dev
build** (`expo-dev-client` — not Expo Go). This doc is the concrete plan; the
data the native code needs is already computed and tested in TypeScript.

## The data contract (done + tested)

`app/src/widget/payload.ts` → `widgetPayload(events, now, budget)` returns
exactly what the widget shows — the Brain runs on-device and produces:

```json
{
  "slot": "lunch",
  "ring": { "eaten": 280, "budget": 2200, "remaining": 1920 },
  "suggestion": { "foodId": "chicken_rice", "name": "Chicken & rice", "portionG": 400, "kcal": 620 },
  "updatedAt": 1783686600000
}
```

The native layer only has to (a) read this JSON and render it, and (b) write a
"pending log" back when the user taps. Everything else is TS you already have.

## 1. Lock-screen widget (the hero, §3.7)

**Architecture — shared App Group:**
- Add an **App Group** (`group.com.sidnerusu.usual`) to the app + the widget
  extension. It's the shared container both read/write.
- **App → widget:** on every foreground and after every log, the RN app calls
  `widgetPayload(...)`, writes the JSON to the App Group container, then triggers
  `WidgetCenter.shared.reloadAllTimelines()`.
- **Widget → app (one-tap):** the widget button is an **App Intent** that
  appends a "pending log" (`{foodId, kcal, portionG, slot, ts}`) to a file in the
  App Group. On next foreground/background-launch the RN `eventStore` drains
  pending logs into the event log (same `logFood` path) and posts the "Logged
  🍚 620 kcal — 1,410 left" confirmation.

**How to add the widget target to an Expo project** (managed workflow can't add
a target directly — use one of):
- **`@bacons/apple-targets`** (config plugin, recommended) — declares the widget
  + App Group as an Expo target; `expo prebuild` generates the Xcode target.
- or eject to a custom config plugin that patches the `.xcodeproj`.

**Swift pieces** (in the widget extension):
- `TimelineProvider` that reads the App Group JSON → a `WidgetEntry`.
- SwiftUI view: the ring + "The usual? {name} · {kcal}" + a `Button(intent:)`.
- `AppIntent` (`LogUsualIntent`) that writes the pending log to the App Group.
- `Info.plist` + entitlements: App Group.

**Android:** Glance widget + a shared file (or DataStore); the button fires a
broadcast the RN headless task drains. Same contract.

## 2. Actionable notifications (§3.6, §3.7)

- **Notifee** for both platforms. iOS notification **category** with
  `LOG_NOW` + `SOMETHING_ELSE` actions; Android action buttons.
- On every foreground + after every log: recompute next-24h predictions
  (`nextNudge` per upcoming slot), then cancel + reschedule local notifications.
  Fire at `median-log-time − 10min` (from the Brain's portion/time model) or the
  onboarding meal times.
- `LOG_NOW` → background handler logs the event (no app open) + posts the
  confirmation. `SOMETHING_ELSE` → deep-link to the Quick-Log tiles.
- The **budget state machine already exists** (`@usual/brain` `canNudge`,
  `nextNudge`) — the native layer only schedules what it returns.

## 3. HealthKit / Health Connect read (§2.1, §3.3)

- **react-native-health** (iOS) / Health Connect (Android). Read scopes: steps,
  bodyweight, workouts.
- Weight → Progress trend. Workouts → the Brain's `seq` term
  (`ScoreContext.isWorkoutDay` / `workoutAffinity`, already wired). Steps →
  the optional "+150 kcal from your walk" ring chip (§6.1) — never auto-applied.

## Build order (on device)

1. `npx expo install expo-dev-client` + set up EAS dev build.
2. Add `@bacons/apple-targets`, declare widget + App Group; `expo prebuild`.
3. Implement the App Group read/write bridge (a tiny native module or
   `react-native-shared-group-preferences`).
4. Wire `widgetPayload` → App Group on foreground/log; add the pending-log drain
   to `eventStore`.
5. Widget SwiftUI + `LogUsualIntent`; test one-tap-app-closed on device.
6. Notifee scheduling from `nextNudge`; test app-closed logging.
7. HealthKit read; feed weight + workout-day.

> Everything above consumes TS that's already built and tested. None of it can
> be verified without a device — treat this as the spec, and verify each step on
> hardware (per the project's on-device verification rule).
