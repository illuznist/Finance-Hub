# Phase 3: ledger-based analytics, cash flow and recorded net worth

## 1. Execution order

Implemented on the same `main` working branch, after the Phase 1 correction gate passed. No separate implementation branch, duplicate ledger, backend or cloud service was introduced.

See `PHASE1_INTEGRATION_CORRECTIONS.md` for the correction audit, 107-test gate, three-platform builds and signed-in income/expense lifecycle verification. Phase 3 calculations were not authored until that gate succeeded.

## 2. Architecture audit

- Retained the Phase 1 ledger and its opening-balance-plus-signed-movements formula.
- Replaced the old Analytics fixed six-month series, which showed zero months before available history.
- Removed the scheduled-expense “Subscriptions” statistic and ambiguous category inclusion of principal funding.
- Replaced old Analytics exports, which mixed current plans/schedules with activity and did not consistently follow the selected reporting period.
- Retired the now-unused `utils/generateReport.ts`; report generation has one new shared calculation/serialization path.
- Context actual monthly figures use the same default operating-activity definition as Analytics, instead of treating borrowed proceeds or lent collections as earned income.
- Removed unused hardcoded exchange-rate exports and illustrative exchange-rate labels in Settings. Currency selection is filtering, not conversion.

## 3. Files

New:
- `finance/analyticsTypes.ts`: report, period, classification, net-worth and snapshot contracts.
- `finance/analytics.ts`: pure period, flow, category, source, chart, drill-down and health selectors.
- `finance/netWorth.ts`: currency-specific current positions, receivable eligibility and observed snapshots.
- `finance/analyticsExport.ts`: shared CSV rows and escaped printable HTML.
- `utils/shareAnalyticsReport.ts`: browser download/print and native file/print/share adapters.
- `components/analytics/AnalyticsParts.tsx`: reusable live report sections, charts and breakdown modal.
- `finance/__tests__/analytics.test.cjs`: 46 analytics/history/export/snapshot regressions, including keeping the ongoing month partial even on its last calendar day.

Updated:
- `app/analytics.tsx`: replaced old Analytics with live period/currency-filtered reporting.
- `app/transactions.tsx`: consumes report period/currency/category/source filters; summary follows visible records; new records use selected report currency.
- `app/(tabs)/loans.tsx`: consumes liability drill-down `loanId`, preserves loan currency in detail/edit/payment labels and uses working web confirmations.
- `app/settings.tsx`: currency names instead of hardcoded exchange-rate labels.
- `app/(tabs)/emis.tsx`: separate accessible detail/payment buttons (no nested HTML buttons) and standard SVG rotation; both issues were exposed by signed-in verification.
- `finance/budgets.ts`: retained loan-funding provenance remains excluded after source deletion, matching Analytics.
- `context/FinanceContext.tsx`: shared actual monthly figures and atomic observed-position capture.
- `finance/migration.ts`: optional snapshot validation and a write-once original-document analytics backup.

The Phase 1 correction files and its 16 new integration tests remain part of this same change set; they were not undone.

## 4. Analytics surface

- This month, last month, last 3/6 months, this/last year and validated custom ranges.
- Actual received income, included actual outflows, net cash flow and savings rate.
- Prior equivalent calendar-window comparison only when prior history has complete recorded coverage; custom ranges use an immediately preceding equal-day window. Partial multi-month/year presets compare the same calendar cutoff in the earlier block. Increases in spending are not coloured as favourable.
- Interactive monthly/yearly cash-flow points with full amounts, a zero baseline, negative net below zero, partial-coverage marks and transaction drill-down.
- Category amount/share/count, separated into everyday, recurring, EMI, balloon, borrowed repayment and savings kinds. One movement belongs to one kind/category.
- Explicit debt and savings inclusion controls, with matched figures, categories, drill-down and export scope.
- Fixed, variable and other recorded payments. Recurring references, EMI and balloon types establish fixed patterns; ordinary one-off expenses are variable. Loan repayments/savings without sufficient fixed-pattern evidence remain “other”, not guessed.
- Income by recorded description/source, monthly income within the cash-flow chart and a clearly separate current expected monthly plan.
- Current recorded net worth, asset/liability details, eligible receivables, exclusion reasons and observed history.
- Transparent savings/fixed/variable/debt/consistency ratios, no score or professional financial advice.

## 5. Exact operating cash-flow rules

All arithmetic accumulates integer minor units before display. Queries are inclusive local `YYYY-MM-DD` ranges and one explicit currency.

- Income: `type=income`, direction in, actually present in the ledger.
- Outflows: outgoing ordinary/recurring expenses, EMI payments, balloon payments and borrowed-loan repayments when debt is included. Savings contributions are included only when requested.
- Defaults: debt included, savings excluded.
- Excluded: expected income, unpaid/pending schedules, internal transfers, reconciliation adjustments, loan receipts/collections, lent-principal funding and refunds. These remain visible in Transactions; refunds are not silently treated as earned income or assigned to an inferred original expense.
- Net cash flow = qualifying income minus included outflows.
- Savings rate = positive net cash flow / qualifying income × 100; unavailable when income is zero.
- Debt burden is unavailable when debt is excluded, not a false zero. Other ratios are unavailable with zero income.
- Consistency requires at least three complete recorded months and measures the share with non-negative net flow. Partial months are excluded.
- These are explicitly scoped operating figures, not a claim that all bank-balance changes are earnings or expenses.
- Detached confirmed movements from deleted income/expense sources remain included. Explicit transaction correction/reversal changes the report immediately.

## 6. Exact current net-worth rules

Per currency:
- Account balances are derived using the existing ledger service exactly once.
- Non-negative balances are account assets; negative balances are overdraft liabilities.
- Borrowed liabilities are the non-negative remaining **recorded total repayment obligation** less recorded payments. Contractual charges are included where the loan record includes them; this is not an invented principal amortization.
- Loan principal is never automatically added to cash. Only the explicit principal-received operation changes an account.
- A lent receivable is eligible only with a matching explicit principal outflow from a tracked same-currency account, matching loan reference/principal, no ambiguous interest allocation, and verified same-currency repayment-to-account history. Eligible zero-interest receivables decline as cash collections occur, so value is not counted twice.
- Unsupported/unfunded/unassigned/interest-ambiguous lent balances are excluded with their reasons, not converted into extra assets.
- Savings goals have no independent custody/destination-account model and are not additional assets. A contribution without a tracked asset destination cannot prove another owned asset.
- EMI schedules are not added again as liabilities without a reliable outstanding-principal model; this also avoids guessing that separate EMI and loan records are distinct debts.
- Net worth = assets − liabilities. It is always labelled current, not backdated to the selected cash-flow report.

## 7. Currency policy

The selector includes currencies represented by accounts, transactions, loans, income, goals, or saved observations. Each report/net-worth figure contains one currency only. No rates, conversion, cross-currency addition or combined net-worth figure is used. The UI explains that a combined total is unavailable without a valid conversion policy.

## 8. History and storage

- History starts at the earliest stored ledger date for the selected currency, not an inferred account opening date or paid flag.
- Earlier months are omitted; zero-activity months appear only within recorded coverage. Future zero-activity months are not invented.
- When a selected range starts before history, a visible limitation appears above the report.
- Net-worth history begins with observed positions, not reconstruction of legacy balances. Capture occurs on load, confirmed state changes and date/foreground refresh, in the existing atomic document/write queue.
- One observation per local date/currency is updated as the current day changes. Older observed dates are not rewritten or gap-filled. Month change requires an actual previous-month observation and is labelled relative to that snapshot.
- Unreconciled legacy account balances pause reliable position capture, with an explanation.
- Snapshots are optional backward-compatible derived metadata; financial schema version 2 and `@finance_state_v4` are retained. Before first analytics metadata, the original raw document is backed up once as `@finance_state_v4_pre_analytics_backup`. All necessary backups complete before any migration primary write.
- Original openings, transactions and domain histories are not reset, replayed or manufactured.

## 9. Export

Both formats serialize the same selected `AnalyticsReport`, without separate calculations:
- CSV: browser download; native UTF-8 cached file and share sheet.
- PDF: native Expo Print/share; web opens printable report HTML and the browser Print / Save PDF dialog.

Includes period, currency, settings, actual income/outflows/net/savings rate, categories/shares/counts, income sources, fixed/variable/other split, included EMI/balloon/loan/savings totals, monthly figures, current position, history limitations and supporting selected movements. HTML is escaped and CSV user text is protected against spreadsheet formula injection.

## 10. Verification

- Correction gate: **107 passed** before Phase 3 started.
- Current complete Phase 1/2/correction/analytics suite: **153 passed, 0 failed**.
- Mobile TypeScript: **passed**.
- Expo dependency alignment: **up to date**.
- `git diff --check`: **passed**.
- Web, Android and iOS Expo exports: **passed**.
- SDK, package dependencies, native configuration, backend and navigation structure are unchanged.
- Signed-in Phase 3 checks passed: baseline SAR 300 income / 110 outflows / 190 net / 2,290 net worth; an expected SAR 1,000 did not change actuals; a received SAR 100 increased income/cash by 100; an unpaid SAR 40 did not count; explicit payment changed actuals to 400 income / 150 outflows / 250 net / 2,350 net worth.
- The browser exposed an existing EMI nested-button/SVG issue. Its source was corrected and TypeScript, full regressions and three-platform exports passed afterward. The resumed browser journey did not return a completion result, nor did a bounded request for its existing checkpoint; both runs were stopped.
- **Final browser acceptance remains incomplete.** No passing browser claim is made for EMI payment after the fix, transfers, loan funding/repayment and liability navigation, category/month drill-downs, period/currency controls, actual downloaded CSV/print output, final reload or both themes. These have calculation/serializer tests, source/type checks and builds where applicable, but that does not replace the required signed-in interaction evidence.

## 11. Explicit limitations

- No physical-device notification, persistence, print/share or native chart test is claimed.
- Remaining signed-in browser acceptance is explicitly incomplete as listed above; Phase 3 must not be represented as fully end-to-end verified.
- Native PDF/CSV adapters compile; actual native sharing still needs device verification. Browser PDF means Print / Save PDF, not a claim of a headless PDF download.
- Current data cannot reliably allocate principal versus future interest on every lent loan, value untracked goal custody, or establish EMI principal liabilities. Those unsupported values are explained/excluded rather than guessed.
- Earlier financial activity remains incomplete where it was never recorded. No synthetic history, snapshot backfill or inferred payments are used.
- No investments, crypto, banks, cloud sync, FX conversion or AI advice were added.
