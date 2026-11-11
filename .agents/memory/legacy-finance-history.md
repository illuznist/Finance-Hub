---
name: Legacy finance history
description: Why pre-ledger payment records cannot safely be replayed against account balances.
---

Preserve uncertain historical financial records without guessing dates or replaying them as new account movements. Existing loan principal is not automatically a receipt or an outgoing payment.

**Why:** Before the unified ledger, FinanceApp's wallet balances were maintained independently of expense flags and EMI/loan histories. Some EMI history was estimated from paid-installment counts. Neither a payment record nor a linked account proves that the saved balance excludes that payment. Replaying those records can double-count money.

**How to apply:** Treat historical balances as the preserved starting snapshot. Record new confirmed events once; use explicit user-confirmed reconciliation for uncertain history. Never silently rewrite opening balances, infer actual payments from due dates, or delete old records because they resemble demo data. The user prioritized financial integrity and preservation over filling historical charts.

New account opening balances default to zero.

**Why:** The user explicitly requested zero opening balances for new accounts.

**How to apply:** Start new account forms at zero rather than a fictional amount. Do not treat that default as permission to erase existing financial records.

A stored schema-version marker does not prove that all migration fields were populated.

**Why:** During incremental development, hot reload can persist a partially upgraded document before the full migration is installed, causing existing users to be locked out by strict new-field validation.

**How to apply:** Validate supported intermediate shapes and add lossless compatibility migrations backed by the original document. Use the documented meaning of old fields; never reset balances or remove safeguards merely to bypass an initialization error.
