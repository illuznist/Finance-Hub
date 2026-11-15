# Finance Hub v1.1.3 — Verified Working Build

## Freeze point

- Application version: **1.1.3** (`artifacts/mobile/app.json` and resolved Expo config agree)
- Branch: **main**
- Application source commit verified: `2d95f4419562fbbfe62996d26c4aafd6796e9f79`
- At verification start, `main` matched `origin/main` and the working tree was clean.
- No application code, dependency, finance calculation, storage migration, authentication, or UI changes were made for this freeze.

## Checks run in the workspace

- Mobile automated test suite: **230 passed**
- TypeScript: **passed**
- Expo Doctor: **20/20 checks passed**
- Expo dependency alignment: **up to date**
- Localization and release metadata audits: **passed** as part of the mobile test command
- iOS, Android, and web JavaScript exports: **passed** in the preceding recovery-fix verification

## Physical iPhone checks confirmed by the user

These checks were reported by the user on a physical iPhone and were not independently operated by the workspace:

- The app opens and loads correctly.
- English-to-Arabic switching works.
- Arabic UI displays correctly.
- Gregorian/Hijri calendar switching works.
- Closing and reopening the app works.
- The previous startup recovery error no longer occurs in the user's testing.

## Not separately verified on a physical iPhone

The checks above do not establish that every feature was manually exercised on-device. In particular, this freeze does not include separate physical-device verification of all finance create/edit/delete flows, backup import/export and restore, PIN or biometric flows, push notifications, or production signing and store submission. Automated tests cover relevant logic, but they are not substitutes for those device checks.

## Data and release safety

- No on-device records were accessed, cleared, migrated, or modified during this verification.
- No dependency changes or application release/version changes were made.
- Git freeze tag: `finance-hub-v1.1.3-verified` (points to the documentation-only freeze commit; application source is unchanged).
