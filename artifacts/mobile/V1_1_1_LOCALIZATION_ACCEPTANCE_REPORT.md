# Finance Hub v1.1.1 Localization and Stabilization Report

## Release summary

- Expo app version: **1.1.1**, resolved from the authoritative `app.json`.
- Settings/About and encrypted backup metadata use the same dynamic version helper. The helper prefers Expo's resolved config and falls back to bundled `app.json` in Expo Go development.
- The private workspace package remains `0.0.0`; native build-number/version-code settings were not reset or changed.
- No financial records, payment history, stored dates, backup contents, or forecast calculations were changed by this localization work.
- No release was published.

## Localization audit

The automated audit is `scripts/audit-localization.cjs` and is part of `pnpm test`. It checks duplicate keys, empty Arabic translations, placeholder parity, literal keys used by screens and shared UI components, hardcoded JSX text, and static validation/error/alert strings. Legal document bodies are excluded from dictionary parity because they have separately maintained Arabic drafts.

- Arabic dictionary entries: **1,453**
- Unique app-owned UI and service-error translation candidates found in source: **990**
- Static candidate coverage: **100% (990/990)**
- Missing, duplicate, empty, or placeholder-mismatched keys: **0**
- Untranslated hardcoded JSX text and static alerts/errors: **0**
- The scanner also reports **230 dynamic translation call sites**. These include formatted values, finite status/label maps, runtime errors and user-entered/imported content. User-entered names, notes, categories, and imported labels remain unchanged by design; arbitrary native/platform exception text may still fall back to its source wording. Dynamic storage, migration, PIN, and backup-password errors now use translated templates or safe localized messages.

### Coverage by screen

| Screen or shared area | Covered / found |
| --- | ---: |
| App startup and notification reset | 10 / 10 |
| Main tab navigation | 5 / 5 |
| Home dashboard | 40 / 40 |
| Expenses | 40 / 40 |
| Wallets and income | 70 / 70 |
| EMI management and payment history | 82 / 82 |
| Loans and repayment history | 83 / 83 |
| Transactions and reconciliation | 69 / 69 |
| Budgets | 78 / 78 |
| Recurring payments | 61 / 61 |
| Upcoming payments | 46 / 46 |
| Analytics and net worth | 101 / 101 |
| Cash-flow forecast and scenarios | 92 / 92 |
| Settings and preferences | 76 / 76 |
| Backup and restore | 32 / 32 |
| Help and support | 8 / 8 |
| Authentication and signup | 15 / 15 |
| PIN and app lock | 15 / 15 |
| Onboarding | 20 / 20 |
| Error fallback | 6 / 6 |
| Finance storage recovery | 3 / 3 |
| Shared analytics components | 10 / 10 |
| Forecast chart | 3 / 3 |
| Payment account picker | 3 / 3 |
| Shared planning controls | 7 / 7 |
| Reminder builder | 5 / 5 |
| Notification channel | 1 / 1 |
| Not-found screen | 3 / 3 |
| Legal screen chrome and review notice | 3 / 3 |
| Finance analytics labels/errors | 3 / 3 |
| Finance budget validation errors | 7 / 7 |
| Finance calendar validation errors | 2 / 2 |
| Finance forecast validation errors | 8 / 8 |
| Finance ledger validation errors | 14 / 14 |
| Finance migration and recovery errors | 23 / 23 |
| Finance recurring validation errors | 12 / 12 |
| Finance service validation errors | 42 / 42 |
| Finance upcoming validation errors | 4 / 4 |
| Share/export status messages | 3 / 3 |

## RTL, number, and calendar checks

- English remains the default; language and calendar preferences remain independent and persist as presentation settings only.
- Arabic selects right-to-left direction. Native language changes still request the existing safe app reload; the web preview applies `lang` and `dir` without reloading.
- Arabic-Indic digits, Arabic currency formatting, and Arabic-aware zero/one/two/few/many/other plural selection are covered by localization tests.
- Gregorian remains the default. Gregorian and Umm al-Qura Hijri display formatting are tested in all four English/Arabic combinations.
- Date-entry fields retain ISO `YYYY-MM-DD` values; the preference UI clearly states that data entry remains Gregorian. Financial dates and saved values remain canonical and unchanged.
- Test coverage verifies preference serialization, formatting, number-input normalization, and that display changes do not rewrite stored date keys. A physical app-restart check for persistence remains pending.

## PIN and responsive UI regression checks

- The regression suite passes the PIN create/change/disable and current-session activation tests. Secure storage, verifier, recovery-journal, and backup tests pass; security was not weakened.
- The Savings responsive-layout test passes for narrow widths and accessibility text scaling.
- The Forecast route now disables the inherited native stack header, preventing the duplicate white `forecast` bar above its custom heading. Authenticated visual confirmation of this route is still pending.

## Browser and device acceptance

- The Expo browser preview loaded the normal English create-account screen at **402 × 874**. The screenshot showed no blank page or JavaScript runtime error. Browser console output included Expo Notifications' web-support warning and the browser's password-field/form warning.
- The preview browser was unauthenticated. It was not possible to inspect authenticated Home, Expenses, Wallets, EMIs, Loans, Transactions, Budget, Recurring, Upcoming, Analytics, Forecast, Settings, Backup, or Support screens in both languages; no authenticated browser acceptance is claimed.
- Arabic visual alignment, clipping, chart readability, modal layout, and language-switch persistence were not fully browser-verified.
- Physical Expo Go acceptance on the iPhone 17 Pro Max has **not been tested**. SecureStore and Face ID behavior must be confirmed on that device by the user.

### Safe physical iPhone test steps

1. Update Expo Go to the SDK 58-compatible version, start the FinanceApp workflow, and scan its QR code.
2. Use a separate test profile with no real financial records, or export and securely retain an encrypted backup first. Do not clear app storage.
3. In Settings, select Arabic and confirm the app reloads into RTL. Review each tab and check that labels, amounts, dates, back controls, charts, and sheets fit without clipping.
4. Switch to English and confirm LTR returns. Toggle Gregorian/Hijri in both languages and confirm only display formatting changes.
5. In the isolated test profile, set a PIN, confirm it, close/reopen the app, unlock with the PIN, test a mismatch, then test Face ID if enabled on the phone. Do not use real payments or balances for this check.
6. Verify the Forecast screen has one custom heading and no extra white native header. Confirm Settings shows **1.1.1**.
7. If any step fails, keep the app data intact and report the screen and exact message; do not uninstall or clear storage.

## Automated verification

| Check | Result |
| --- | --- |
| Full regression suite | **Passed: 213 tests** |
| TypeScript typecheck | **Passed** |
| Localization audit | **Passed: 100% of 990 discovered UI and service-error candidates** |
| Release metadata validation | **Passed: Expo app version 1.1.1** |
| Expo public config resolution | **Passed: version 1.1.1** |
| `git diff --check` | **Passed** |
| Expo Web export | **Passed** |
| Expo iOS JavaScript export | **Passed** |
| Expo Android JavaScript export | **Passed** |
| Expo dependency alignment | **Not aligned:** 20 SDK 58 packages are one patch behind Expo's expected versions. No dependency update or age-safeguard bypass was made. |
| Expo Doctor | **19/20 checks passed**; the sole failure is the same package-version alignment check. |

These exports validate JavaScript bundles; they are not native iOS/Android builds or a substitute for the physical Expo Go test.

## Legal documents and limitations

- Privacy Policy and Terms now include complete Arabic text drafts prepared for review.
- The Arabic screen clearly identifies the drafts as **for review only** and states that English remains authoritative. They are not represented as legally certified.
- Remaining acceptance gaps are authenticated English/Arabic browser walkthroughs across all major screens, physical iPhone PIN/Face ID validation, and Expo SDK patch alignment. No automatic release or Phase 6 work was started.
