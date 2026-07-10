# Getting Usual onto TestFlight

The app is an **Expo managed** project (no custom native code yet — just
`react-native-svg` + `async-storage`, both autolinked), so it builds in the
cloud with **EAS Build** and submits with **EAS Submit**. No Mac-Xcode dance.

This is the §13 Phase-1 exit step (your own dogfood ≥7 days) and §14.8 beta
channel.

## What you need (one-time)
- **Apple Developer Program** membership ($99/yr) — required for TestFlight.
- An **Expo account** (free) — `npx eas-cli login`.
- The default app icon (`app/assets/icon.png`) works for a dogfood; swap for
  real branding before a wider beta. Bundle id is `com.sidnerusu.usual` in
  `app.json` — change it to your own reverse-domain if you prefer (it just has
  to be unique in your Apple account).

---

## Tier 1 — fastest: app-only, no server (recommended first)

The app is **offline-first**: with no server it falls back to the seed data
(menu = local pool, search = limited, bubbles = seed). Enough to dogfood the
core loop — onboarding, ring, "the usual?", logging, progress. Skip the server
for your very first build.

```bash
cd ~/Desktop/usual/app
npm i -g eas-cli            # or use npx eas-cli
eas login
eas init                   # links this app to an EAS project (writes projectId)
eas build --platform ios --profile preview
eas submit --platform ios  # pick the build it just made
```

Then in **App Store Connect → your app → TestFlight**: it appears after
processing (~10–20 min). Add yourself as an internal tester and install via the
**TestFlight** app on your iPhone.

## Tier 2 — with the real catalogue (deploy the server)

To get the full 8,000-food search + real catalogue menu, deploy the server and
point the app at it.

1. **Deploy the server** (Render, free tier):
   - New → Blueprint → point at the `usual` repo → it reads `render.yaml`.
   - It boots the in-memory server seeded from the committed catalogue (no DB
     needed). Health check: `https://<your-app>.onrender.com/api/health`.
   - ⚠️ `render.yaml` deliberately leaves `NODE_ENV` unset so `/api/auth/dev`
     works for the dogfood. **Before a wider beta**: implement Apple Sign-In
     verification (`server/src/auth.ts`) and set `NODE_ENV=production`.
2. **Point the app at it**: set `EXPO_PUBLIC_API_BASE` in `app/eas.json`
   (preview + production profiles) to your Render URL.
3. **Rebuild + resubmit**: `eas build --platform ios --profile preview` then
   `eas submit`.

> Local dev stays on `http://localhost:8080` (the client default). Only the
> EAS-built binaries use the `EXPO_PUBLIC_API_BASE` from `eas.json`.

---

## Honest caveats before you lean on this
- **Auth is a dev stub.** Real Apple/Google Sign-In verification isn't
  implemented yet — fine for a solo dogfood, not for real users.
- **No real persistence server-side.** Logs persist on-device (AsyncStorage) and
  sync as opaque blobs; there's no Postgres yet (schema is in
  `server/migrations/001_init.sql`, adapter is a follow-up).
- **Still Phase-1-incomplete:** timeline edit, quick-add, barcode, HealthKit
  read, analytics, and notification scheduling aren't built. The lock-screen
  widget (the moat) is Phase 2 and needs a dev build + native code.
- **Android:** same flow with `--platform android` + a Play Console account.
