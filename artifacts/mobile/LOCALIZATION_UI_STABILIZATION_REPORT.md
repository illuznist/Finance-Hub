# Finance Hub v1.1.0 localization and UI stabilization report

## Release scope

- App version: **1.1.0** from `app.json`; the mobile workspace package remains `0.0.0` because it is a private workspace package, not the app release version.
- Native build-number and version-code strategy: unchanged (no identifiers or native build counters are declared in the current static Expo config).
- No publication or GitHub release was created.

## Implemented

- PIN activation now preserves the open Settings session; first-launch PIN locking, biometric unlock, and password recovery remain enabled. PIN save errors remain visible in the setup modal; only the salted verifier is persisted.
- Added persisted language and display-calendar preferences with English/Gregorian defaults. Saudi Arabic uses Arabic-Indic digit formatting and sets RTL direction; native language changes persist and reload to apply direction. Hijri formatting uses the Umm al-Qura calendar for display only.
- Kept finance storage, calculations, schedule dates, and reporting period keys in the existing canonical Gregorian representation. Shared date entry labels identify Gregorian dates. Localized amount input is normalized only before parsing and does not rewrite stored records.
- Localized Settings (including security, reminders, and currency labels), main tab labels, Home summary, onboarding, authentication and app-lock flows; shared headers and common planning forms use the centralized translator.
- Reworked Savings amount wrapping based on screen width and accessibility font scale; the amount can wrap to a full-width line instead of overflowing.

## Automated checks

| Check | Result |
| --- | --- |
| Finance, forecast, security, backup, server, preference, and responsive-layout tests | **Passed: 211 tests** |
| Workspace TypeScript | **Passed** |
| Expo dependency alignment (`expo install --check`) | **Blocked:** 20 Expo SDK packages are one patch behind the versions expected by the installed SDK; dependency-age safeguards were not bypassed |
| Web, Android, and iOS exports | **Passed** |
| `git diff --check` | **Passed** |
| Expo app config | **Passed:** resolved version is 1.1.0; Settings/About displayed 1.1.0 after clearing the stale Metro transform cache |

## Localization coverage and limitations

- English remains the default; Arabic is user-selectable and does not auto-follow the device locale.
- User-entered and imported labels, names, descriptions, and account names are not translated.
- Audited the app-owned strings and found remaining English copy in detailed transaction, expense, loan, EMI, forecast, and analytics explanations, validation/error states, and some empty states. The full Privacy Policy and Terms text remains in English, with an Arabic notice explaining that it awaits reviewed translation.
- User-entered and imported content remains unchanged by design; currencies and codes such as SAR remain in their standard form.

## Browser and device acceptance

- Authenticated browser acceptance used the normal sign-up flow for a temporary local test account; it was not a bypass and its browser profile was discarded after testing.
- Home was checked in both languages at 402×874 and 1440×900; Settings was checked in Arabic at 402×874 and in English at 1440×900. Home was also checked at 320×800. No horizontal page overflow appeared at those widths. Arabic text direction, Arabic-Indic digits, calendar/language persistence, and the displayed 1.1.0 version were confirmed.
- Physical iPhone PIN retest: **pending**. SecureStore and Face ID behavior cannot be certified by web exports or the unauthenticated browser preview.

## v1.1.1 version-management update

- Authoritative Expo app version is now **1.1.1** in `app.json`.
- Settings/About reads the version from the resolved Expo config and falls back to the bundled static app configuration for Expo Go development; encrypted backup metadata uses the same version helper.
- The private workspace package remains `0.0.0`; its package version is not the end-user app version.
- No iOS build number or Android version code was reset or changed; the current static config does not declare either value.
- `CHANGELOG.md` now has a v1.1.1 entry for the PIN fix, responsive Savings card, Gregorian/Hijri preferences, English/Arabic localization, RTL, Arabic-Indic numbers, and UI/performance refinements.
- The application was not published and no GitHub release was created.
- See `V1_1_1_LOCALIZATION_ACCEPTANCE_REPORT.md` for the complete localization audit and this milestone’s verification results.
