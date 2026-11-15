import type { Account, FinanceState } from "@/context/FinanceContext";
import { canCreateResource } from "@/finance/entitlements";

export type AccountArchiveResult =
  | { ok: true; state: FinanceState }
  | { ok: false; reason: "account_not_found" | "active_wallet_limit" };

export function archiveAccountInState(
  state: FinanceState,
  accountId: string,
  archivedAt: string,
): AccountArchiveResult {
  const account = state.accounts.find((item) => item.id === accountId);
  if (!account) return { ok: false, reason: "account_not_found" };
  if (account.archivedAt) return { ok: true, state };

  const archivedAccount: Account = { ...account, archivedAt };
  return {
    ok: true,
    // Only the account's archive marker changes. Transactions and balances stay untouched.
    state: {
      ...state,
      accounts: state.accounts.map((item) => item.id === accountId ? archivedAccount : item),
    },
  };
}

export function reactivateAccountInState(
  state: FinanceState,
  accountId: string,
  isPro: boolean,
): AccountArchiveResult {
  const account = state.accounts.find((item) => item.id === accountId);
  if (!account) return { ok: false, reason: "account_not_found" };
  if (!account.archivedAt) return { ok: true, state };
  if (!canCreateResource(state, "account", isPro).allowed) {
    return { ok: false, reason: "active_wallet_limit" };
  }

  const { archivedAt: _archivedAt, ...activeAccount } = account;
  return {
    ok: true,
    state: {
      ...state,
      accounts: state.accounts.map((item) => item.id === accountId ? activeAccount : item),
    },
  };
}
