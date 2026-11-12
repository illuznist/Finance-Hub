# Finance Hub Phase 5: Cash-Flow Forecasting

## Phase 4 acceptance gate

**PASS — Phase 4 final signed-in acceptance allowed Phase 5 to proceed.** The
disposable authenticated backup/restore checks, security findings, and items
that could not be verified on a physical device are recorded in
`PHASE4_FINAL_ACCEPTANCE_REPORT.md`. No existing user or production finance
records were used for this work.

## Implemented features

- Added a read-only cash-flow forecast screen at `/forecast`, reachable through
  **Plan ahead** on Analytics.
- Added 7-, 30-, 60-, 90-day, and custom forecast windows, Conservative and
  Expected income modes, a projected-balance chart, account shortfall warnings,
  and a dated commitment timeline.
- Added currency-isolated views. No foreign-exchange conversion is performed.
- Added a current-month budget outlook that separates recorded spending from
  eligible scheduled commitments.
- Added in-memory hypothetical scenarios for extra income, one-time expenses,
  monthly spending changes, delayed expected income, extra loan repayments, and
  savings contributions. Reset removes the simulations without touching
  finance records.
- Added optional dates and account assignments for expected income. Monthly
  estimates without a specific date are not treated as forecast cash.
- Timeline items now open their corresponding recurring, EMI, loan, or income
  record. EMI detail amounts use the EMI's own currency when opened from a
  different-currency forecast.
- Invalid recurring, EMI, loan, and expected-income dates are excluded instead
  of being projected.

## Calculation rules and assumptions

- The engine is pure: it does not post transactions or alter payment history,
  wallet balances, opening balances, budgets, or backup contents.
- Money is accumulated in integer minor units. Current balances come from the
  existing ledger.
- Scheduled EMI, balloon, and loan payments use remaining amounts after linked
  payment history; paid and skipped commitments are excluded. Recurring
  occurrences are deduplicated.
- Conservative mode excludes expected income from balances. Expected mode
  includes only explicitly dated expected income. Both modes show the total
  dated expected inflow for the selected window.
- For a custom window starting after today, known movements before the window
  are applied to its projected opening balance. The timeline and selected-window
  totals still show only movements inside the window.
- Account-linked events affect only their matching account and currency.
  Unallocated events remain visible, but do not change an account projection.
  Same-currency transfers do not change combined cash.
- Same-day account movements are netted before shortfall detection.
- Budget outlook combines actual spending with eligible scheduled expense,
  EMI, and loan commitments; it does not count the same ledger payment twice.
- Projections are estimates, not guaranteed balances. Unknown dates, exchange
  rates, and future transactions are not invented.

## Screens and files

- `app/forecast.tsx` — forecast screen and navigation.
- `components/forecast/ForecastChart.tsx` — projected and scenario chart.
- `app/analytics.tsx` — Analytics entry point.
- `app/recurring.tsx`, `app/(tabs)/emis.tsx`, `app/(tabs)/loans.tsx`, and
  `app/(tabs)/wallets.tsx` — open the source record from a forecast item.
- `finance/forecast.ts` — forecast, shortfall, scenario, and budget calculations.
- `finance/upcoming.ts` — remaining-amount projection and invalid-date guards.
- `finance/__tests__/forecast.test.cjs` — forecast regression coverage.
- `PHASE4_FINAL_ACCEPTANCE_REPORT.md` — final Phase 4 gate evidence.

## Automated verification

- Mobile automated suite: **PASS — 204 passed, 0 failed**.
- Workspace TypeScript check (`pnpm typecheck`): **PASS**.
- Expo web, Android, and iOS JavaScript exports: **PASS** on Expo `58.0.23`.
- `git diff --check`: **PASS**.
- Expo SDK dependency alignment (`CI=1 pnpm exec expo install --check`):
  **BLOCKED / NOT ALIGNED**. Expo recommends 20 SDK 58 patch updates, including
  Expo `58.0.24`; the project remains on `58.0.23`. The workspace's 24-hour
  package-age safeguard was not bypassed, and no dependency updates were made.
- Expo Go app-standard review: static app config, pnpm lockfile, Expo Go
  development workflow, and absence of app-owned `ios/` and `android/`
  directories were confirmed. The workspace root does not currently declare
  an exact `packageManager` version; it was left unchanged because the
  publishing runtime's effective pnpm version was not verified.

## Authenticated browser acceptance

**PASS — all checks used an isolated signed-in browser profile and disposable
finance data.** New SAR and USD accounts both started with zero opening
balances.

| Check | Expected | Observed |
| --- | --- | --- |
| 7-day SAR, Conservative | Current SAR 500; scheduled outflows SAR 950; the SAR 500 dated salary is excluded from the balance; ending SAR -50 | **PASS** — ending SAR -50; first shortfall Nov 18, 2026, SAR 50 |
| 7-day SAR, Expected | Include the dated SAR 500 salary; end SAR 450 | **PASS** — ending SAR 450; no shortfall |
| 30/60/90-day ranges | Exact inclusive dates and scheduled balances | **PASS** — Nov 12–Dec 11: SAR 450; Nov 12–Jan 10: SAR -100; Nov 12–Feb 9: SAR -650 |
| Custom Nov 20–25 window | Include known earlier movements in the starting projection | **PASS** — Expected ends SAR 450; Conservative ends SAR -50; earlier movements are explained in the UI |
| Currency isolation | USD view uses only USD account and income; SAR result remains unchanged | **PASS** — USD expected ending USD 200; SAR Expected ending SAR 450 |
| Scenario and reset | A hypothetical SAR 75 expense lowers SAR ending balance from 450 to 375; reset returns to baseline | **PASS** — observed SAR 375, then SAR 450; serialized finance state was unchanged |
| Open source records | Recurring, EMI, loan, and expected-income items open their matching source record | **PASS** — recurring details, EMI details, loan details, and income edit form opened |
| Reload and themes | Reload keeps records; dark theme remains usable | **PASS** — forecast rendered after reload, finance storage was unchanged, and authenticated dark-mode rendering was checked |

The SAR 950 scheduled-outflow total includes a SAR 400 loan payment with no
wallet assigned. That item remains visible as unallocated and does not reduce
the tracked wallet balance. The account-linked Internet, EMI, and rent
commitments produce the SAR 50 Conservative shortfall.

## Known limitations and outstanding risks

- **NOT TESTED:** Stock Expo Go 58 on a physical phone or simulator. Successful
  JavaScript exports do not establish Expo Go behavior or native compilation.
- **BLOCKED:** Expo reports 20 recommended SDK 58 package patch updates. They
  were not applied because of the package-age safeguard.
- **NOT VERIFIED:** An exact pnpm version compatible with the remote publishing
  runtime; the workspace root has no exact `packageManager` pin.
- Phase 4 audit items remain open as documented in its final report: 125
  workspace dependency findings (12 critical, 62 high, 37 moderate, 14 low),
  two high static-analysis alerts, one low privacy finding, finance records
  stored unencrypted at rest, and native-only backup/security flows not tested.
  This Phase 5 work does not resolve or suppress those findings.

## Phase 5 readiness

**PASS WITH LIMITATIONS for the implemented forecast in the authenticated web
preview.** Automated checks, all three exports, currency/mode calculations,
scenario isolation, and source-record navigation passed. Do not treat this as
full Expo Go, publishing, or security-audit acceptance until the outstanding
items above are addressed.

**No Phase 6 work was started.** Recommended next step: verify the app in stock
Expo Go 58 on a phone or simulator, then resolve the SDK patch and Phase 4
security findings before considering publication.
