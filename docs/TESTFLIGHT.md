# Shipping Yumo to TestFlight

The project is already configured: bundle ID `com.sidnerusu.yumo`, team `KX4SBPJ7C4`, automatic signing, HealthKit entitlement, Nunito bundled, 1024px icon. What remains is your Apple account.

## 1. Sign Xcode in to your Apple ID (once)
Xcode → Settings… → Accounts → `+` → Apple ID → sign in with the Apple ID that owns team KX4SBPJ7C4 (the one Runin/Goyo ships under). The team should appear under the account.

## 2. Register the bundle ID with HealthKit (once)
Easiest: open `Yumo.xcodeproj`, select the Yumo target → Signing & Capabilities. With "Automatically manage signing" and the team selected, Xcode registers `com.sidnerusu.yumo` and adds HealthKit to the App ID. If it complains, do it by hand: developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → `+` → App IDs → App → Description "Yumo", Bundle ID explicit `com.sidnerusu.yumo` → tick HealthKit → Register.

## 3. Create the app record in App Store Connect (once)
appstoreconnect.apple.com → Apps → `+` → New App: Platforms iOS · Name "Yumo" · Primary language English (UK) · Bundle ID `com.sidnerusu.yumo` (from the list; it appears after step 2) · SKU `yumo` · User access Full → Create.
If "Yumo" is taken as an app name, use e.g. "Yumo Tracker" — the name is only what shows in TestFlight/App Store; the bundle ID stays.

## 4. Archive and upload
Either run:
```bash
Scripts/testflight.sh
```
or in Xcode: Product → Destination → Any iOS Device (arm64) → Product → Archive → Organizer opens → Distribute App → App Store Connect → Upload → defaults (upload symbols, manage version/build) → Upload.

## 5. Add testers
App Store Connect → Yumo → TestFlight. The build shows up after processing (10–30 min; you get an email).
- Internal testing: `+` next to Internal Testing → group name "Team" → add yourself (anyone in Users and Access). No review needed; install from the TestFlight app on your phone with the same Apple ID.
- External testing (friends): `+` next to External Testing → group → "Enable Public Link" → share the link. The first external build needs a short Beta App Review (usually under a day); fill in the "What to Test" box and the contact email it asks for.

## Every later release
Bump nothing by hand: `Scripts/testflight.sh` sets the build number from the date and uploads. Change `MARKETING_VERSION` in `project.yml` when you want the version (1.0 → 1.1) to move.

## Still local-only
Accounts live on the phone (username + SHA-256 hash in SwiftData). The REST backend from the handoff (`/auth`, `/days`, `/weights`, `/photos`, `/foods/search`) is not built yet; when it is, wire it in `Domain/Store.swift` (account) and `Networking/`.
