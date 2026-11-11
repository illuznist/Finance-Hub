# Finance Hub Phase 2 — Smart budgets and recurring commitments

## 1. Repository audit and Phase 1 baseline

Inspected the actual transaction types and pure ledger service, FinanceContext, account opening/derived balances, storage migration/backup/write queue, expense flags, EMI and loan payment ownership, Transactions screen, Home, notification scheduler and settings. The initial baseline passed all 47 financial tests and mobile TypeScript.

Phase 1 balances remain owned by opening balance plus signed ledger movements. Existing histories and account snapshots are not replayed. Phase 2 replaces three remaining planning gaps: Home's planned-expense budget totals, automatic recurring paid-flag resets, and cancel-all/reschedule notifications based on planned spending.

## 2. Budget functionality and calculation rules

- Dedicated Budget screen, linked from the existing Home budget card.
- Monthly overall and category limits; current/previous/next month navigation and explicit confirmation for historical edits.
- Fixed templates, month-specific custom budgets, and category-opt-in rollover.
- Custom categories with icon, restrained colour, editable limit, per-category reminders/rollover, and deletion.
- Actual spent, remaining, percent used, daily average, month-end projection and comparison with the preceding month.
- Shared threshold boundaries: below 75% normal, 75–89% approaching, 90–99% near, 100%+ exceeded. An unset zero limit is not treated as a configured exceeded budget.
- Integer minor-unit aggregation. Currency and selected local-calendar month are isolated.
- Expense transactions count by default, but original loan-principal funding does not. Income, account transfers, refunds and balance adjustments are excluded.
- EMI/balloon, loan repayments and savings contributions are excluded by default and have explicit inclusion controls. An explicitly budgeted matching loan-payment category also includes its loan repayments. Filtering selects each ledger transaction once; there is no addition of scheduled totals.
- Category aliases (for example Food → Food and Dining, Bills → Utilities) avoid changing historical transaction categories.
- Category carry is provisional while viewing a future month, so additional spending before month-end is reflected accurately. It is finalized once the period starts. Deficits carry only when explicitly enabled, including deficits larger than a new category's base limit. Later historical transaction corrections update actual spending, not finalized carry. Editor totals include carry; template bases subtract it so it cannot compound. Automatically generated future previews are refreshed after template edits; explicitly customized future periods are preserved.
- Custom monthly mode starts unconfigured months at zero, not an inferred amount. No unused overall budget is silently carried independently of opted-in categories.

## 3. Recurring expenses and occurrences

Definitions include name, positive amount, currency/category/icon/colour, optional account, frequency/custom interval, start/next/end dates, active state, reminder preference, notes and pending-generation preference.

Supported frequencies: daily, weekly, monthly, every two months, quarterly, semiannual, annual and custom day/week/month intervals. Month-based recurrences keep the original day anchor: January 31 → February 28/29 → March 31. Calendar calculations use local dates, not UTC string conversion.

Definitions, occurrences, actual expense records and ledger transactions are distinct. A stable occurrence ID combines definition ID and scheduled date. Generation creates pending occurrences only and checks IDs before inserting. Automatic generation can be disabled while keeping schedules visible for manual payment.

Explicit confirmation creates an owned expense and one ledger movement using a stable payment identity. Reversing/correcting the real expense also synchronizes its occurrence. Skips retain history without posting money; skip-and-pause stops future generation. Resume starts from the next calendar slot, not retroactive charges for the paused interval. Already-generated due items may still be settled while future recurrence is paused.

Editing offers future-only or pending-and-future scope. Paid history is not rewritten. Deleting a definition archives it, preserves paid/skipped histories and transactions, marks pending instances skipped and stops future generation/reminders.

## 4. Upcoming Payments

Dedicated Upcoming screen combines selectors over recurring occurrences/definitions, existing EMI installment schedules, balloon due dates and explicit loan repayment schedules. No duplicate EMI/loan schedule entities or balance systems are created.

Includes chronological order, account/currency/type, upcoming/due-today/overdue/paid/skipped states, type filters, 7/30-day/current-month/custom ranges and an explicit overdue toggle. Future recurring rows can be projected without inserting pending or actual financial records.

Payments ask for account/date and explicit confirmation. Balloon and loan installments support multiple distinct partial confirmations; a retained per-form operation ID prevents repeated submission from posting twice. Remaining scheduled amounts update after partial payments. Linked accounts missing from a definition display as unassigned.

Loan reminders require a first repayment date and planned amount, or a one-time expected end date. Origination date alone is not assumed to be a repayment schedule. Loan forms now expose the explicit first repayment date and optional planned account.

## 5. Local notifications

Local notifications only; no push service/backend. Master and expense/EMI/balloon/loan switches and due-day/1/3/7-day timing are available. The scheduler reads existing device permission; it never prompts automatically. The explicit Settings enable action requests permission.

A serialized reconciler compares deterministic notification IDs/content and cancels only obsolete or changed app-owned reminders. Paid, skipped, archived, paused and disabled commitments lose outstanding reminders. Existing unrelated notifications are not canceled.

Budget alerts use real eligible ledger spending, configurable 75/90/100 thresholds and category/global preferences. Successful threshold delivery scheduling is recorded once per currency/month/category/threshold, so dropping below and rising again does not re-alert. These receipts are notification metadata, not financial records.

For platform queue limits, scheduling is limited to the next 60 days and at most 60 pending app reminders/alerts, refilled when app state changes/foregrounds. Reminders fire at local 09:00; past trigger times are not moved into invented later reminders. Date/timezone changes trigger reconciliation.

## 6. Home and existing screens

Home retains its balance/account/savings presentation. The existing budget card now uses actual eligible spending, links Budget and shows overspend clearly. Coming up shows only the next three unpaid commitments with View all.

Expenses links Recurring and Upcoming. Legacy recurrence flags are retained with an explanation rather than silently converted to guessed schedules. The old monthly paid-flag reset engine is removed. Existing Expenses, EMIs, Loans, Wallets, Transactions, account balances and explicit confirmation flows remain in place.

## 7. Migration and backwards compatibility

The primary AsyncStorage key remains `@finance_state_v4`. Schema 2 adds an optional planning subdocument; schema 1 is recognized as an existing ledger, not mistaken for pre-ledger data. All existing transactions, accounts, paid flags, EMI/loan histories, security/preferences and budgets are retained.

Before upgrading, the exact document is retained under `@finance_state_v4_pre_planning_backup`; existing pre-ledger and compatibility backups are preserved. Intermediate documents missing only new planning fields receive initialized defaults, not a financial reset. The compatibility rule for missing opening balances remains intact.

Existing monthly budget is retained as the current month's starting template in its original currency. No historical start date is invented. Incomplete legacy recurrence flags do not create definitions, pending occurrences or transactions.

Migration and period/occurrence creation are idempotent. Storage validation or write failures retain the protected-storage path and never clear records.

## 8. Files

Created:
- `finance/planningTypes.ts` — explicit budget/period/recurrence/occurrence/commitment types.
- `finance/calendar.ts` — local calendar and anchored month arithmetic.
- `finance/budgets.ts` — inclusion, categories, period snapshots, rollover and dashboard calculations.
- `finance/recurring.ts` — definition lifecycle, occurrence generation and ledger payment bridge.
- `finance/upcoming.ts` — EMI/balloon/loan/recurrence selectors and scheduled confirmation.
- `finance/reminderPlan.ts` — pure reminder planning and adapter-based reconciliation.
- `finance/__tests__/planning.test.cjs` — calculation/lifecycle/migration/reminder regression tests.
- `app/budget.tsx`, `app/recurring.tsx`, `app/upcoming.tsx`, `components/PlanningUI.tsx`.

Modified:
- `context/FinanceContext.tsx`, `finance/migration.ts`, `utils/notifications.ts`.
- `app/_layout.tsx`, `app/settings.tsx`.
- `app/(tabs)/index.tsx`, `app/(tabs)/expenses.tsx`, `app/(tabs)/loans.tsx`.

No Expo SDK or application dependencies were upgraded. No backend, cloud sync, bank integration or other excluded subsystem was introduced.

## 9. Verification

- Baseline: 47 Phase 1 tests and TypeScript passed.
- Combined Phase 1/2 unit suite: **91 passed, 0 failed**. Coverage includes spending thresholds/inclusions, category aliases, transaction correction/deletion, month/currency isolation, custom/fixed budgets, rollover/deficit snapshots, provisional future carry/finalization, month-end/leap dates, all recurrence families, generation/payment idempotency, scoped editing, pause/resume/archive/skip/reversal, upcoming schedules/status/order/filtering, partial repayments, schema upgrade preservation, restart round-trip, reminder timing/deduplication/cancellation, disabled/denied permission and once-per-period alerts.
- Final `pnpm --filter @workspace/mobile run typecheck`: **passed**.
- Final `git diff --check`: **passed**.
- `CI=1 pnpm exec expo install --check`: **dependencies up to date**.
- `CI=1 pnpm exec expo export --platform all --output-dir ../../generated-artifacts/mobile-phase2-export`: **web, Android and iOS passed**. Generated files are excluded from Git/deployment.
- Expo Doctor was attempted but **could not execute**: its standalone package failed to resolve its own `@expo/env` dependency. Resolving via the existing Expo module path did not fix the diagnostic tool. No SDK/dependency changes were made to work around it. This is not a passing Doctor result.
- Signed-in browser, 375×812, normal existing disposable tester session: Home → Budget opened correctly after a stale Metro session was restarted. Saved a 1,000 overall / 100 Food and Dining budget, observed actual spend 75 and category 75% Approaching, navigated to prior month and returned without changing current limits.
- Created a monthly recurring expense of 25, linked to the tester's Primary account. The pending occurrence did **not** change the two baseline transactions or account balance. Confirming once created one expense/transaction, changed Primary **1,075 → 1,050**, and budget spending **75 → 100**. The category reached **100/100, Exceeded**.
- Future-only edit to 30 preserved the paid 25 history/transaction. Skipped and paused the next 30 occurrence; history retained both Paid and Skipped with no fourth ledger transaction. Reload preserved the budget, three transactions, paused definition and histories, with no protected-storage startup gate.
- Budget, Recurring and Upcoming rendered in light/System and Dark; original System preference restored. Expenses and EMIs loading placeholders settled to their expected content/empty state; Loans, Wallets and Transactions also opened with expected figures. These are route/render smoke checks, not an exhaustive browser run of every existing edit/delete form.
- The first browser attempts were interrupted by stale Metro/live source refreshes before the financial recurrence flow completed. After refreshing the preview and stopping source edits, the remaining journey passed. No storage clearing, authentication bypass or changes to another user's records were used.
- Browser warnings were limited to expected Expo-web notification support and animation fallback messages; no remaining functional route error was reported.
- Final visual review corrected locale-dependent date-token splitting in Upcoming: month labels now format the actual month directly, full dates are read by accessibility, and non-current years are explicit. The final display-only correction was typechecked; it did not change the tested financial services or persisted records.

## 10. Known limits

- Physical-device notification delivery, denied-permission OS prompts, background scheduling, native keyboard and native persistence require real-device verification; mock-adapter tests or web checks do not establish them.
- No background execution service is added. Due occurrence materialization and reminder queue refresh occur on loading/foregrounding and while the app is active; schedules themselves remain calendar-derived.
- Histories lacking explicit repayment/recurrence anchors remain intact but unscheduled rather than guessed.
- Category rollover is finalized when a period starts; later historical corrections do not retroactively alter finalized limits. Future-month previews remain provisional.
- Loan schedule generation is bounded to 1,200 installments and each recurrence range to 5,000 dates to avoid unbounded startup work. This does not post any automatic money movement.
- Cross-currency conversion is not introduced.
