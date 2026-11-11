import type { AnalyticsReport } from "./analyticsTypes";
import { SPENDING_LABELS } from "./analytics";

/** Spreadsheet formula characters in user-supplied names must not execute. */
export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (typeof value === "string" && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function analyticsReportRows(r: AnalyticsReport): (string | number)[][] {
  return [
    ["FinanceApp financial report"], ["From", r.query.from], ["To", r.query.to], ["Currency", r.query.currency],
    ["Debt included in spending", r.query.includeDebt ? "Yes" : "No"], ["Savings included in spending", r.query.includeSavings ? "Yes" : "No"],
    ["Actual received income", r.totals.income], ["Included actual outflows", r.totals.expenses], ["Net cash flow", r.totals.net],
    ["Savings rate (%)", r.totals.savingsRate ?? "Unavailable"], ["Fixed", r.fixed], ["Variable", r.variable], ["Other recorded payments", r.unclassified],
    ["Included EMI payments", r.emiTotal], ["Included balloon payments", r.balloonTotal], ["Included borrowed-loan repayments", r.loanTotal], ["Included savings contributions", r.savingsTotal],
    ["Expected monthly plan (not period receipts)", r.expectedIncome], [],
    ["Category", "Kind", "Amount", "Share (%)", "Transactions"],
    ...r.categories.map(c => [c.name, SPENDING_LABELS[c.kind], c.amount, c.percentage, c.count]), [],
    ["Received income source", "Amount", "Transactions"], ...r.incomeSources.map(s => [s.name, s.amount, s.count]), [],
    ["Month", "Income", "Outflows", "Net", "Partial recorded coverage"],
    ...r.monthly.map(m => [m.key, m.income, m.expenses, m.net, m.partial ? "Yes" : "No"]), [],
    ["Current net worth (not backdated to reporting period)", r.netWorth.netWorth], ["Current assets", r.netWorth.assets], ["Current liabilities", r.netWorth.liabilities],
    ["Notes"], ...r.notices.concat(r.netWorth.notices).map(n => [n]), [],
    ["Actual transaction ID", "Date", "Description", "Category", "Type", "Currency", "Amount", "Direction", "Account"],
    ...r.movements.map(t => [t.id, t.date, t.description, t.category, t.type, t.currency, t.amount, t.direction, t.accountId ?? "Unassigned"]),
  ];
}
export function analyticsCSV(r: AnalyticsReport): string {
  return "\uFEFF" + analyticsReportRows(r).map(row => row.map(csvCell).join(",")).join("\r\n");
}
export function analyticsHTML(r: AnalyticsReport): string {
  const escape = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  const rows = analyticsReportRows(r).map(row => row.length
    ? `<tr>${row.map(v => `<td>${escape(v)}</td>`).join("")}</tr>` : '<tr class="gap"><td colspan="10"></td></tr>').join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>FinanceApp financial report</title><style>
  body{font:12px Arial,sans-serif;color:#10213b;padding:24px}h1{color:#2563eb;font-size:24px}p{color:#52627b}table{border-collapse:collapse;width:100%;table-layout:auto}td{padding:8px;border-bottom:1px solid #e2e8f0;vertical-align:top;overflow-wrap:anywhere}.gap td{height:14px;border:0}@page{margin:18mm}@media print{body{padding:0}tr{break-inside:avoid}}</style></head><body>
  <h1>FinanceApp</h1><p>${escape(r.query.from)} – ${escape(r.query.to)} · ${escape(r.query.currency)} · Recorded activity only</p><table>${rows}</table></body></html>`;
}
