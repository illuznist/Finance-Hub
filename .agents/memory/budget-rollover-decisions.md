---
name: Budget rollover stability
description: Why carry-forward amounts are frozen rather than recalculated after historical corrections.
---

Once a budget period starts, its carry-forward is a frozen planning snapshot. Future previews remain provisional so additional spending before month-end is included. Editing an older transaction after rollover finalization changes that month's actual spending but does not silently alter carry already applied to another period.

**Why:** Repeated application or retroactive propagation could change a user's later spending limits unexpectedly. Predictable historical budgets and idempotent restarts take priority over continuously restating carry.

**How to apply:** Explicitly explain this behavior when showing/editing rollover. Treat any future request to recompute old carry as a deliberate reconciliation feature, not an automatic side effect of editing a transaction.
