import type { Transaction } from "./ledger";

export type PeriodPreset = "this" | "last" | "last3" | "last6" | "year" | "lastYear" | "custom";
export interface DateRange { from: string; to: string }
export interface ReportRange extends DateRange { label: string; previous: DateRange }
export interface AnalyticsQuery extends DateRange { currency: string; includeDebt: boolean; includeSavings: boolean }
export type SpendingKind = "everyday" | "recurring" | "emi" | "balloon" | "loan" | "savings";
export interface SpendingEntry { transaction: Transaction; kind: SpendingKind; category: string; key: string; fixed: boolean }
export interface FlowTotals { income: number; expenses: number; net: number; savingsRate: number | null }
export interface CashFlowPoint extends DateRange, FlowTotals { key: string; label: string; partial: boolean }
export interface CategoryTotal { key: string; name: string; kind: SpendingKind; amount: number; percentage: number; count: number }
export interface IncomeSource { key: string; name: string; amount: number; count: number }
export interface NetWorthItem { id: string; name: string; kind: "account" | "receivable" | "borrowed" | "overdraft"; amount: number }
export interface NetWorthSnapshot { date: string; currency: string; assets: number; liabilities: number; netWorth: number; capturedAt: string }
export interface NetWorthView {
  currency: string; assets: number; liabilities: number; netWorth: number;
  assetItems: NetWorthItem[]; liabilityItems: NetWorthItem[];
  excludedReceivables: { id: string; name: string; reason: string }[];
  history: NetWorthSnapshot[]; monthChange: number | null; historyStart: string | null;
  reliable: boolean; notices: string[];
}
export type AnalyticsDrill = { type: "income" | "expenses" | "movements"; categoryKey?: string; sourceKey?: string; kind?: SpendingKind };
export interface AnalyticsReport {
  query: AnalyticsQuery; totals: FlowTotals; previous: FlowTotals; previousRange: DateRange;
  comparisonAvailable: boolean; monthly: CashFlowPoint[]; yearly: CashFlowPoint[];
  categories: CategoryTotal[]; incomeSources: IncomeSource[];
  expectedIncome: number; expectedSources: { id: string; name: string; amount: number }[];
  fixed: number; variable: number; unclassified: number;
  emiTotal: number; balloonTotal: number; loanTotal: number; savingsTotal: number;
  health: { savingsRate: number | null; fixedBurden: number | null; variableBurden: number | null; debtBurden: number | null; consistency: number | null; completeMonths: number };
  historyStart: string | null; notices: string[]; currencies: string[];
  incomeTransactions: Transaction[]; expenseTransactions: Transaction[]; movements: Transaction[];
  netWorth: NetWorthView;
}
