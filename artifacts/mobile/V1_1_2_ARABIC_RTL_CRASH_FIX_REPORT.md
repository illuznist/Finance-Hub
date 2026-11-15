# Finance Hub v1.1.2 Arabic RTL Switching Fix

## Outcome

- App version: **1.1.2**.
- Automatic native reloads on language changes have been removed.
- The selected language and calendar are still saved independently and apply to the running UI immediately.
- When a native layout-direction change is pending, Settings tells the user to close and reopen FinanceApp. Startup does not initiate another reload if the native direction still differs.
- Expo SDK 58 dependencies have been aligned with the SDK's recommended patch versions.
- No financial records, ledger entries, PIN/Face ID settings, backups, or forecast calculations were changed. App storage was not cleared.
- No release was published.

## Root cause

`PreferencesProvider` had two automatic reload paths:

1. Selecting a language persisted it, called `I18nManager.allowRTL` / `forceRTL`, then immediately called `reloadAppAsync`.
2. On every provider startup, a mismatch between the saved language and `I18nManager.isRTL` called `reloadAppAsync` again.

If Expo Go's JavaScript reload did not apply the native layout direction before the next provider startup, that startup saw the same mismatch and requested another reload. This could repeatedly reload or leave the app on its loading screen. The provider also marked preferences ready before its startup reload, coupling preference hydration and app boot to that reload.

This matches the reported failure path in the code. No native iPhone crash stack or device logs were available, so the exact native exception, if any, could not be independently confirmed.

## Changes

- Removed `reloadAppAsync` from language selection and preference hydration.
- Kept the native `allowRTL` and `forceRTL` request, but made it non-blocking and protected it from exceptions.
- Added a derived `rtlRestartRequired` status. If the native direction differs from the selected language, the user sees a translated Settings notice to close and reopen the app.
- On startup, preferences hydrate and the app continues rendering even when native RTL has not applied. The app does not automatically retry or enter a reload loop.
- Every native preference application writes the latest RTL or LTR target, even if it equals the currently reported direction. This clears a stale pending Arabic direction if a user rapidly switches back to English before restarting.
- The web preview continues to update document language and direction immediately.
- Serialized language/calendar writes so rapid changes cannot persist stale combinations.
- Updated the app version to **1.1.2**, added a changelog entry, and kept the private package version and native build-number strategy unchanged.
- Used Expo's SDK-aware installer to align the 20 SDK 58 packages. The repository's one-day package release-age safeguard was not changed.

## Regression coverage

The test suite covers:

- English/Gregorian defaults and saved preference parsing.
- English-to-Arabic and Arabic-to-English native direction requirements.
- Arabic already saved with the native direction applied.
- Arabic saved while native direction remains LTR, including repeated app starts: the status remains a restart notice rather than triggering reloads.
- Rapid Arabic-to-English toggles replace the pending native direction with the latest selection.
- Repeated language toggles without changing the independent calendar preference.
- Web direction changing without a native restart.
- A guard confirming the preference provider does not call `reloadAppAsync`.
- Existing Arabic digits, Gregorian/Hijri formatting, numeric input, PIN/security, backup, ledger, and forecast behavior.

## Verification

| Check | Result |
| --- | --- |
| Full tests | **Passed: 216 tests** |
| TypeScript | **Passed** |
| Localization audit | **Passed: 100% (991/991) discovered app-owned UI and service-error candidates** |
| Release metadata | **Passed: FinanceApp 1.1.2** |
| `expo install --check` | **Passed: dependencies up to date** |
| Expo Doctor | **Passed: 20/20 checks** |
| Web JavaScript export | **Passed** |
| iOS JavaScript export | **Passed** |
| Android JavaScript export | **Passed** |
| `git diff --check` | **Passed** |

Exports confirm the JavaScript bundles, not native device behavior. The browser preview was checked at 402 × 874 on the unauthenticated create-account screen; authenticated Settings interaction and native layout switching were not verified in a browser.

## Expo Go and device check

The app is intended to keep working if Expo Go does not apply `I18nManager` direction immediately. It saves the chosen language and shows a manual-restart notice instead of repeatedly restarting itself. A manual close-and-reopen is required if the current native layout direction is still wrong.

**Physical iPhone verification remains pending.** These steps do not clear app data:

1. Start the FinanceApp workflow, open its QR code in the SDK 58-compatible Expo Go, and sign in normally.
2. In Settings, switch from English to Arabic. Confirm Arabic text appears immediately and that Settings shows the restart notice if the layout direction has not changed.
3. Close Expo Go completely, reopen it, and scan the FinanceApp QR code again. Confirm the app opens in Arabic without getting stuck on the loading screen, Arabic numerals render, and navigation remains usable.
4. Switch to English. If Settings shows the restart notice, close and reopen Expo Go once more, then confirm the app is LTR.
5. Repeat the language switch a few times and restart the app with Arabic already selected. Confirm it opens each time without an automatic reload loop.
6. Change Gregorian/Hijri preferences and verify they remain independent of the language choice. Confirm the existing PIN and Face ID flow still works.

Do not uninstall FinanceApp or clear app storage for this test. If it still hangs, keep the data intact and report the screen and exact behavior; native logs from the iPhone will be needed to identify any remaining device-specific issue.
