#!/bin/zsh
# Archive Yumo and upload it to TestFlight. Needs Xcode signed in to the Apple ID that owns team KX4SBPJ7C4
# (Xcode → Settings → Accounts) and an app record "Yumo" with bundle id com.sidnerusu.yumo in App Store Connect.
set -e
# App Store Connect rejects uploads from beta Xcodes; use the release one in /Applications.
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
cd "$(dirname "$0")/.."
xcodegen generate
BUILD=$(date +%Y%m%d%H%M)
xcodebuild -project Yumo.xcodeproj -scheme Yumo -configuration Release -destination 'generic/platform=iOS' \
  -archivePath build/Yumo.xcarchive CURRENT_PROJECT_VERSION=$BUILD -allowProvisioningUpdates archive | grep -E "error:|warning: .*signing|ARCHIVE" || true
xcodebuild -exportArchive -archivePath build/Yumo.xcarchive -exportOptionsPlist Scripts/ExportOptions.plist \
  -exportPath build/export -allowProvisioningUpdates | grep -E "error:|Upload|EXPORT" || true
echo "Build $BUILD uploaded. It appears in App Store Connect → TestFlight after processing (10–30 min)."
