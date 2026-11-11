export type BudgetMode = "fixed" | "custom" | "rollover";
export interface BudgetCategory {
  id: string; name: string; icon: string; color: string;
  limit: number; rollover: boolean; alerts: boolean;
}
export interface BudgetPlan {
  currency: string; startMonth: string; mode: BudgetMode; limit: number;
  categories: BudgetCategory[]; includeEMI: boolean; includeLoans: boolean;
  includeSavings: boolean; carryDeficit: boolean; alerts: boolean;
  thresholds: number[];
}
export interface BudgetPeriod extends BudgetPlan {
  id: string; month: string; baseLimit: number;
  carryFrom?: string; carryAmounts: Record<string, number>;
  customized?: boolean;
  carryFinalized?: boolean;
}
export type RecurringFrequency = "daily" | "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual" | "custom";
export interface RecurringExpense {
  id: string; name: string; amount: number; currency: string; category: string;
  iconName: string; color: string; accountId?: string;
  frequency: RecurringFrequency; interval?: number; intervalUnit?: "day" | "week" | "month";
  startDate: string; nextDueDate: string; endDate?: string;
  active: boolean; deleted?: boolean; reminder: boolean; autoGenerate: boolean; notes?: string;
}
export interface RecurringOccurrence {
  id: string; recurringId: string; dueDate: string;
  name: string; amount: number; currency: string; category: string;
  iconName: string; color: string; accountId?: string; notes?: string;
  status: "pending" | "paid" | "skipped"; expenseId?: string; skipReason?: string;
}
export interface PlanningState {
  version: 1; plans: BudgetPlan[]; periods: BudgetPeriod[];
  recurring: RecurringExpense[]; occurrences: RecurringOccurrence[];
}
export type UpcomingType = "expense" | "emi" | "balloon" | "loan";
export interface UpcomingPayment {
  id: string; sourceId: string; type: UpcomingType; name: string;
  amount: number; currency: string; dueDate: string; accountId?: string;
  status: "upcoming" | "due_today" | "overdue" | "paid" | "skipped";
  reminder: boolean; recurringId?: string; occurrenceId?: string;
}
