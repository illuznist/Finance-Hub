# Expo SDK 58 validation

## Upgrade checks

- The Expo 57.0.32 intermediate passed dependency alignment, Expo Doctor (21/21), typecheck, and iOS/Android exports before moving to SDK 58.
- Final Expo version: 58.0.23; resolved app config advertises SDK 58.0.0.
- `CI=1 pnpm exec expo install --check`, Expo Doctor (20/20), and `pnpm run typecheck` passed on SDK 58.
- iOS and Android Expo exports passed on SDK 58.
- `pnpm run build` generated both platform bundles and manifests successfully.
- `pnpm run serve` returned the landing page, SDK 58 iOS/Android manifests, and non-empty bundles for both platforms.
- The managed Expo workflow starts, and its live manifest advertises SDK 58.0.0.
- The official Expo versions endpoint reports stock Expo Go SDK 58 availability: iOS client 58.0.7 and Android client 58.0.5.

## Device validation

- Device: iPhone 17 Pro Max.
- Platform: iOS.
- Client: stock Expo Go application.
- Result reported by the user: passed (“App works”).
- The user gave a general pass and did not separately itemize each requested interaction or native feature.
- Android physical-device or simulator validation was not performed.

Expo Go does not support Android remote push notifications; no development client was added. The app's local notification behavior was not separately itemized in the user's test report.
