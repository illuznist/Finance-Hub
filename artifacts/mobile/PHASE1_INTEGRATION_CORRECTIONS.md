# Phase 1 integration corrections

## Order and scope

Completed on the existing working branch before beginning Phase 3. The original ledger, account balance formula, storage key and schema version 2 remain in place. No storage reset, backend, cloud integration, or guessed historical movement was introduced.

## Audit findings and fixes

- Received income was already synchronized by the shared persistence pipeline, contrary to the older brief's description. Its creation is now also routed through an explicit, testable `saveIncome` finance operation.
- Expected income remains planning-only. Received income posts its domain record and one stable `income:<submission>` movement atomically. Wallets uses a submission ID retained for the lifetime of the form.
- Wallets now supports editing income name/description, amount, date, account and category. The linked movement is updated instead of appended. A received payment cannot silently become a planned source; remove the source to retain history, then add a separate plan.
- Source deletion is not payment reversal. Removing income, a paid expense, or an EMI/loan/savings parent detaches confirmed ledger entries rather than erasing money. Actual transaction reversal/deletion remains an explicit Transactions action. Unpaid-expense and expected-income deletion creates nothing.
- Detached entries retain non-reference provenance (`originType`, and recurring occurrence identity where applicable), but no stale domain reference or payment reference. These are backward-compatible optional metadata; no schema upgrade is necessary.
- Paid expense edits synchronize the existing movement. Explicit mark-unpaid reverses it once. Stable form submissions do not duplicate expenses.
- Recurring synchronization preserves paid history when its expense source is removed but the standalone movement remains. Editing that standalone movement updates the occurrence snapshot; explicitly deleting the movement reopens the occurrence. No recurring definition or other paid occurrence is rewritten.
- The unused read/then/toggle expense API and unused automatic EMI-paid API were removed. Active EMI/balloon and loan payment paths use confirmed finance operations, with stable IDs, currency validation and synchronized histories. Transfers use a complete paired operation; reconciliation uses adjustment transactions.
- Existing accounts remain protected against direct balance/opening-balance/currency edits; reconciliation remains the correction mechanism. Savings goal metadata edits cannot directly rewrite saved-money totals or currency. Contributions still use the recorded finance operation. Initial legacy goal progress remains non-financial tracking, not a manufactured movement.
- Legacy paid flags or received records without ledger evidence are not replayed just because metadata is edited.
- Browser verification exposed two pre-existing UI integration issues. Native `Alert.alert` did not open web confirmations, so Wallets, Expenses and Transactions now use a shared native/web confirmation adapter. Removing an active web swipe row also triggered `No handler for tag`; web Expenses now has an explicit Delete button without mounting a swipe handler, while native swipe behaviour is retained.

## Changed files

- `finance/ledger.ts`: optional historical provenance fields.
- `finance/service.ts`: explicit income/expense save operations, stable retries, source detachment and legacy-evidence safeguard.
- `finance/recurring.ts`: paid occurrence synchronization after detachment/correction/reversal.
- `context/FinanceContext.tsx`: service-backed income/expense CRUD and removal/restriction of unsafe unused methods.
- `app/(tabs)/wallets.tsx`: stable income submission, editing, validation and history-preserving removal explanation.
- `app/(tabs)/expenses.tsx`: stable expense submission, validation feedback and history-preserving removal explanation.
- `app/transactions.tsx`, `utils/financialAlert.ts`: functional web confirmations with native behaviour preserved.
- `finance/__tests__/integration.test.cjs`: 16 context-order integration regressions.
- `finance/__tests__/ledger.test.cjs`: corrected old deletion expectation to preserve actual history.

## Automated verification before Phase 3

- Original baseline: **91 passing tests**.
- Corrected full Phase 1/2/integration suite: **107 passing, 0 failed**.
- Mobile TypeScript: **passed**.
- Expo dependency alignment: **up to date**.
- `git diff --check`: **passed**.
- Expo web, Android and iOS exports: **passed**; generated output remains outside version control.
- Migration and restart regressions pass, including detached transactions and unchanged opening balances.

## Signed-in browser gate

**Passed before Phase 3 began.** The disposable-account journey verified opening balance 1,000; expected 500 without a cash movement; received 100 then edited to 150/category/date/name without duplication; source removal retaining the 150 movement and balance 1,150; expense payment 20; correction to 30; mark-unpaid restoring 1,150; and unpaid source removal without changing money. The browser-only confirmation and swipe-handler issues above were corrected. A second expense of 10 was paid once, then its source removed while retaining the actual transaction and balance **1,140**. Final reload retained the standalone received 150 and paid 10 movements, the expected 500 source, the correct balance, and neither removed expense source. No gesture-handler error remained.

The final post-UI-correction TypeScript check and all three platform exports also passed. Phase 3 was started only after this gate succeeded, on the same working branch.

## Limits

No physical-device testing is claimed. Source removal deliberately retains actual historical money; explicitly reverse an incorrect payment in Transactions. Legacy records without recorded cash movements remain historical domain records, not fabricated ledger evidence.
