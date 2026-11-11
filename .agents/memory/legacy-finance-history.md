---
name: Legacy finance history
description: Why pre-ledger payment records cannot safely be replayed against account balances.
---

Preserve uncertain historical financial records without guessing dates or replaying them as new account movements. Existing loan principal is not automatically a receipt or an outgoing payment.

**Why:** Before the unified ledger, FinanceApp's wallet balances were maintained independently of expense flags and EMI/loan histories. Some EMI history was estimated from paid-installment counts. Neither a payment record nor a linked account proves that the saved balance excludes that payment. Replaying those records can double-count money.

**How to apply:** Treat historical balances as the preserved starting snapshot. Record new confirmed events once; use explicit user-confirmed reconciliation for uncertain history. Never silently rewrite opening balances, infer actual payments from due dates, or delete old records because they resemble demo data. The user prioritized financial integrity and preservation over filling historical charts.
