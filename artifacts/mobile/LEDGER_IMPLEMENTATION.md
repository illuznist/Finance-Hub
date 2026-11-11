# Phase 1 implementation plan

## Audit findings

- Financial state is a single AsyncStorage document at `@finance_state_v4`. Preserve this key.
- Accounts currently store independent balances; expense, EMI, loan and savings operations do not change them.
- Income records are recurring monthly definitions, not confirmed receipts.
- Expense recurrence resets paid flags; historical ledger entries must survive those resets.
- Legacy EMI normalization synthesizes dates from installment counts. Those entries are not reliable evidence of actual dated account movements.
- Payment validation currently reads render-time state, so repeated taps can race.
- Initialization replaces unreadable data with defaults and immediately saves; persistence failures are swallowed. Both are unsafe.
- Analytics currently generates fictional monthly trends from current totals. Replace these with recorded ledger activity.
- Currency selection currently mixes numeric amounts and indicative rate presentation. Ledger/account currency must be explicit and totals must not mix currencies.
- Wallets is a visible primary tab; Transactions will be a root stack route, not a hidden native tab. Keep EMIs and Loans separate.

## Implementation sequence

1. Add pure typed ledger, local-calendar utilities, integer-minor-unit arithmetic, balance selectors and financial invariants.
2. Add versioned validation/migration and storage adapter: save the exact original before migration, do not invent historical ledger entries, fail closed with retry/recovery rather than overwrite unreadable data.
3. Connect domain mutations to ledger operations in one state commit. Use stable event/payment IDs and submission IDs, derive balances, serialize persistence, expose errors.
4. Add account/date selection to payment flows; preserve expected income definitions and explicitly record receipts. Keep savings goal allocations distinct from actual money movement unless the user records a contribution.
5. Add Transactions filtering, search, detail, manual income/expense, linked transfers and synchronized corrections/deletion. Provide one-time reconciliation without rewriting opening balances.
6. Remove new-user demo records and onboarding defaults; update actual cash-flow analytics and protect zero-budget empty states.
7. Test pure financial operations, migration, failure behavior, duplicate submissions and persistence; run TypeScript, Expo Doctor, bundling, whitespace checks and a focused browser flow where authentication permits.

## Ownership rules

Account current balance is opening balance plus signed ledger entries in the same currency. Domain records own payment details; linked ledger entries mirror them and cannot independently contradict them. Transfers have equal, opposite entries under one group ID and are excluded from income/expense reporting. Missing accounts are explicitly unassigned and never change an invented account. Historical records without trustworthy account-impact evidence remain legacy records, not transactions.
