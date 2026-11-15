import type { Account, EMI, FinanceState } from "@/context/FinanceContext";
import { isLoanSettled } from "@/utils/loanCalculations";

export type LimitedResource = "account" | "loan" | "emi";

export const FREE_PLAN_LIMITS: Readonly<Record<LimitedResource, number>> = {
  account: 1,
  loan: 1,
  emi: 3,
};

export interface PlanUsage {
  account: number;
  loan: number;
  emi: number;
}

export interface CreationDecision {
  allowed: boolean;
  resource: LimitedResource;
  used: number;
  limit: number | null;
}

export function isAccountArchived(account: Account): boolean {
  return typeof account.archivedAt === "string" && account.archivedAt.length > 0;
}

export function isEMIActive(emi: EMI): boolean {
  const duration = emi.durationMonths ?? emi.totalInstallments;
  const paid = Math.min(duration, emi.paidInstallments ?? 0);
  const balloonPaid = (emi.paymentHistory ?? [])
    .filter((payment) => payment.paymentType === "balloon" && payment.status === "paid")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const balloonRemaining = Math.max(0, (emi.balloonPaymentAmount ?? 0) - balloonPaid);
  return paid < duration || balloonRemaining > 0;
}

export function getPlanUsage(state: Pick<FinanceState, "accounts" | "loans" | "emis">): PlanUsage {
  return {
    account: state.accounts.filter((account) => !isAccountArchived(account)).length,
    loan: state.loans.filter((loan) => !isLoanSettled(loan)).length,
    emi: state.emis.filter(isEMIActive).length,
  };
}

export function canCreateResource(
  state: Pick<FinanceState, "accounts" | "loans" | "emis">,
  resource: LimitedResource,
  isPro: boolean,
): CreationDecision {
  const used = getPlanUsage(state)[resource];
  const limit = isPro ? null : FREE_PLAN_LIMITS[resource];
  return {
    allowed: limit === null || used < limit,
    resource,
    used,
    limit,
  };
}
