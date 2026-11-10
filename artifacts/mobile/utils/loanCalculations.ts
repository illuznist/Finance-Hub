import type { Loan } from "@/context/FinanceContext";

export function getLoanObligation(loan: Loan): number {
  return Math.max(0, loan.totalRepaymentAmount ?? loan.principalAmount);
}

export function getLoanPaidAmount(loan: Loan): number {
  return (loan.payments ?? []).reduce((sum, payment) => sum + payment.amount, 0);
}

export function getLoanOutstandingBalance(loan: Loan): number {
  return Math.max(0, getLoanObligation(loan) - getLoanPaidAmount(loan));
}

export function getLoanProgress(loan: Loan): number {
  const obligation = getLoanObligation(loan);
  return obligation > 0 ? Math.min(1, Math.max(0, getLoanPaidAmount(loan) / obligation)) : 0;
}

export function isLoanSettled(loan: Loan): boolean {
  return getLoanOutstandingBalance(loan) <= 0.005;
}

export function canRecordLoanPayment(loan: Loan, amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= getLoanOutstandingBalance(loan) + 0.005;
}

export function canUpdateLoanPayment(loan: Loan, paymentId: string, amount: number): boolean {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  const paymentExists = loan.payments.some((payment) => payment.id === paymentId);
  if (!paymentExists) return false;
  const otherPayments = loan.payments
    .filter((payment) => payment.id !== paymentId)
    .reduce((sum, payment) => sum + payment.amount, 0);
  return otherPayments + amount <= getLoanObligation(loan) + 0.005;
}

export function wouldLoanBeOverpaid(loan: Loan): boolean {
  return getLoanPaidAmount(loan) > getLoanObligation(loan) + 0.005;
}
