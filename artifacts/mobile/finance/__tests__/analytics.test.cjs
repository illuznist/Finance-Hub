const { test } = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const A = require("../analytics.ts"), N = require("../netWorth.ts"), E = require("../analyticsExport.ts");
const S = require("../service.ts"), L = require("../ledger.ts"), M = require("../migration.ts");
const today = "2026-11-11", query = { from: "2026-11-01", to: today, currency: "SAR", includeDebt: true, includeSavings: false };
const base = () => ({ currency: "SAR", userName: "", monthlyBudget: 0, accounts: [{ id: "a", name: "Bank", type: "bank", openingBalance: 1000, balance: 1000, currency: "SAR", color: "" }],
  expenses: [], incomes: [], emis: [], loans: [], savingsGoals: [], transactions: [], schemaVersion: 2, notificationSettings: {}, securitySettings: {}, lastResetMonth: "", lastResetYear: "" });
function movement(state, type, amount, extra = {}) {
  const id = extra.id ?? `${type}-${state.transactions.length}`;
  const t = { id, operationId: id, amount, type, direction: L.directionFor(type), description: "Salary", category: "Food", date: today,
    currency: "SAR", accountId: "a", createdAt: "2026-11-11T10:00:00Z", ...extra };
  return { ...state, transactions: [...state.transactions, t] };
}
const report = (s, overrides = {}) => A.buildAnalyticsReport(s, { ...query, ...overrides }, undefined, today);
const loan = (direction = "borrowed", id = "l") => ({ id, name: id, direction, principalAmount: 400, currency: "SAR", counterpartyName: "Person",
  sourceType: "person", category: "personal", startDate: today, repaymentFrequency: "monthly", payments: [], notes: "", createdAt: "2026-11-11T10:00:00Z" });
test("recorded income increases actual cash flow", () => assert.equal(report(movement(base(), "income", 100)).totals.net, 100));
test("recorded expense reduces actual cash flow", () => assert.equal(report(movement(base(), "expense", 25)).totals.net, -25));
test("EMI is counted from ledger once, not again from payment history", () => {
  const s = movement({ ...base(), emis: [{ id: "e", paymentHistory: [{ amount: 100 }] }] }, "emi_payment", 100);
  assert.equal(report(s).emiTotal, 100); assert.equal(report(s).totals.expenses, 100);
});
for (const type of ["balloon_payment", "loan_repayment"]) test(`${type} is financial only when explicitly posted`, () => {
  const pending = { ...base(), loans: [loan()], emis: [{ id: "e", balloonPaymentAmount: 200 }] };
  assert.equal(report(pending).totals.expenses, 0);
  assert.equal(report(movement(pending, type, 50)).totals.expenses, 50);
});
for (const type of ["transfer", "adjustment", "loan_received", "refund"]) test(`${type} is not earned income or operating spending`, () => {
  assert.deepEqual(report(movement(base(), type, 100)).totals, { income: 0, expenses: 0, net: 0, savingsRate: null });
});
test("expected income is explicitly separate from received income", () => {
  const s = { ...base(), incomes: [{ id: "planned", name: "Salary", amount: 5000, kind: "expected", type: "salary" }] };
  const r = report(s); assert.equal(r.expectedIncome, 5000); assert.equal(r.totals.income, 0);
});
test("pending recurring schedules never enter analytics", () => {
  const s = { ...base(), planning: { recurring: [{ amount: 999 }], occurrences: [{ status: "pending", amount: 999 }] } };
  assert.equal(report(s).totals.expenses, 0);
});
test("savings contribution inclusion is explicit", () => {
  const s = movement(base(), "savings_contribution", 30);
  assert.equal(report(s).totals.expenses, 0); assert.equal(report(s, { includeSavings: true }).totals.expenses, 30);
});
test("debt inclusion controls the same overview, categories and drill-down", () => {
  const s = movement(base(), "loan_repayment", 40), q = { ...query, includeDebt: false };
  assert.equal(report(s, q).totals.expenses, 0); assert.equal(report(s, q).categories.length, 0);
  assert.equal(A.selectAnalyticsTransactions(s, q, { type: "expenses" }).length, 0);
});
test("lent principal funding is a value transfer, including after source detachment", () => {
  const s = movement(base(), "expense", 100, { referenceType: undefined, originType: "loan" });
  assert.equal(report(s).totals.expenses, 0);
});
test("category totals, shares and counts match qualifying movements without overlap", () => {
  let s = movement(base(), "expense", 10, { category: "Food" });
  s = movement(s, "expense", 20, { category: "Bills" }); s = movement(s, "expense", 10, { category: "Food" });
  const r = report(s);
  assert.equal(r.categories.reduce((s, c) => s + c.amount, 0), 40);
  assert.ok(Math.abs(r.categories.reduce((s, c) => s + c.percentage, 0) - 100) < 1e-9);
  assert.equal(r.categories.find(c => c.name === "Food").count, 2);
});
test("missing categories are handled as Uncategorized", () => assert.equal(report(movement(base(), "expense", 10, { category: undefined })).categories[0].name, "Uncategorized"));
test("transaction corrections and explicit deletion immediately change analytics", () => {
  let s = S.addManualMovement(base(), { id: "x", type: "expense", amount: 10, date: today, description: "Test", category: "Food", accountId: "a" });
  s = S.updateTransaction(s, s.transactions[0].id, { ...s.transactions[0], amount: 20, category: "Travel" });
  assert.equal(report(s).categories[0].name, "Travel"); assert.equal(report(s).totals.expenses, 20);
  assert.equal(report(S.deleteTransaction(s, s.transactions[0].id)).totals.expenses, 0);
});
test("category and income-source drill-downs explain exactly their totals", () => {
  let s = movement(base(), "expense", 10); s = movement(s, "expense", 30, { category: "Bills" }); s = movement(s, "income", 100, { description: "Work" });
  const r = report(s), c = r.categories[0], source = r.incomeSources[0];
  assert.equal(A.selectAnalyticsTransactions(s, query, { type: "expenses", categoryKey: c.key }).reduce((a, t) => a + t.amount, 0), c.amount);
  assert.equal(A.selectAnalyticsTransactions(s, query, { type: "income", sourceKey: source.key }).length, 1);
});
test("fixed recurring and variable ordinary expenses use references, not guessed categories", () => {
  let s = movement(base(), "expense", 20, { recurringOccurrenceId: "known" });
  s = movement(s, "expense", 30, { category: "Rent" }); s = movement(s, "emi_payment", 10);
  const r = report(s); assert.equal(r.fixed, 30); assert.equal(r.variable, 30);
  assert.equal(r.categories.find(c => c.kind === "recurring").amount, 20);
});
test("zero income has unavailable ratios; negative net has zero positive savings rate", () => {
  assert.equal(report(base()).health.debtBurden, null);
  const s = movement(movement(base(), "income", 10), "expense", 20);
  assert.equal(report(s).totals.savingsRate, 0);
});
test("cash flow uses integer units without accumulation drift", () => {
  let s = base(); for (let i = 0; i < 100; i++) s = movement(s, "expense", 0.1);
  assert.equal(report(s).totals.expenses, 10);
});
test("account assets use opening plus ledger once, including already-derived account props", () => {
  let s = movement(base(), "income", 100);
  s = { ...s, accounts: S.balances(s) };
  assert.equal(N.currentNetWorth(s, "SAR", today).assets, 1100);
});
test("borrowed liabilities use remaining recorded obligation, not schedules twice", () => {
  const s = { ...base(), loans: [{ ...loan(), totalRepaymentAmount: 450, payments: [{ id: "old", amount: 50, date: today, legacy: true }] }] };
  const n = N.currentNetWorth(s, "SAR", today); assert.equal(n.liabilities, 400); assert.equal(n.netWorth, 600);
});
test("unfunded lent principal is excluded rather than added to cash assets", () => {
  const n = N.currentNetWorth({ ...base(), loans: [loan("lent")] }, "SAR", today);
  assert.equal(n.assets, 1000); assert.equal(n.excludedReceivables.length, 1);
});
test("explicit lent funding shifts cash into a receivable without creating value; collection reverses that shift", () => {
  let s = { ...base(), loans: [loan("lent")] };
  s = S.recordLoanFunding(s, "l", { id: "fund", accountId: "a", date: today });
  assert.equal(N.currentNetWorth(s, "SAR", today).netWorth, 1000);
  assert.equal(N.currentNetWorth(s, "SAR", today).assetItems.find(i => i.kind === "receivable").amount, 400);
  s = S.confirmLoanPayment(s, "l", { amount: 100, date: today, accountId: "a", operationId: "collect" });
  assert.equal(N.currentNetWorth(s, "SAR", today).netWorth, 1000);
  assert.equal(report(s).totals.income, 0);
});
test("unassigned/interest-bearing/mismatched lent funding is excluded with a reason", () => {
  for (const extras of [{ interestRate: 5 }, { totalRepaymentAmount: 500 }]) {
    let s = { ...base(), loans: [{ ...loan("lent"), ...extras }] };
    s = S.recordLoanFunding(s, "l", { id: "f", accountId: "a", date: today });
    assert.equal(N.currentNetWorth(s, "SAR", today).excludedReceivables.length, 1);
  }
  let s = { ...base(), loans: [loan("lent")] };
  s = S.recordLoanFunding(s, "l", { id: "f", date: today });
  assert.equal(N.currentNetWorth(s, "SAR", today).assetItems.some(i => i.kind === "receivable"), false);
});
test("explicit borrowed proceeds increase cash and liability equally; repayment reduces both", () => {
  let s = { ...base(), loans: [loan()] };
  s = S.recordLoanFunding(s, "l", { id: "fund", accountId: "a", date: today });
  assert.equal(N.currentNetWorth(s, "SAR", today).assets, 1400); assert.equal(N.currentNetWorth(s, "SAR", today).liabilities, 400);
  s = S.confirmLoanPayment(s, "l", { amount: 100, date: today, accountId: "a", operationId: "repay" });
  assert.equal(N.currentNetWorth(s, "SAR", today).netWorth, 1000);
});
test("savings goals do not inflate account assets", () => {
  assert.equal(N.currentNetWorth({ ...base(), savingsGoals: [{ id: "g", savedAmount: 9999 }] }, "SAR", today).assets, 1000);
});
test("negative account balances are overdraft liabilities, not positive assets", () => {
  const s = base(); s.accounts[0].openingBalance = -100;
  const n = N.currentNetWorth(s, "SAR", today); assert.equal(n.assets, 0); assert.equal(n.liabilities, 100); assert.equal(n.netWorth, -100);
});
test("currencies are never added together or converted with hardcoded rates", () => {
  const s = base(); s.accounts.push({ ...s.accounts[0], id: "usd", currency: "USD", openingBalance: 100000 });
  const n = N.currentNetWorth(s, "SAR", today); assert.equal(n.assets, 1000); assert.match(n.notices.join(" "), /combined net worth is unavailable/);
  assert.equal(report(movement(s, "income", 500, { currency: "USD", accountId: "usd" })).totals.income, 0);
});
test("month/year/custom boundaries use local calendar dates including leap years", () => {
  assert.deepEqual(A.reportingRange("last", "2028-03-01").from, "2028-02-01");
  assert.equal(A.reportingRange("last", "2028-03-01").to, "2028-02-29");
  assert.equal(A.reportingRange("lastYear", today).from, "2025-01-01"); assert.equal(A.reportingRange("lastYear", today).to, "2025-12-31");
  assert.equal(A.reportingRange("custom", today, { from: "2026-11-01", to: "2026-11-11" }).previous.to, "2026-10-31");
  assert.throws(() => A.reportingRange("custom", today, { from: "2026-02-30", to: today }));
});
test("zero months appear only within available recorded history, never before it", () => {
  const s = movement(base(), "income", 100, { date: "2026-09-10" });
  const r = report(s, { from: "2026-01-01", to: today });
  assert.deepEqual(r.monthly.map(m => m.key), ["2026-09", "2026-10", "2026-11"]);
  assert.equal(r.monthly[1].income, 0); assert.equal(r.monthly[0].partial, true);
  assert.match(r.notices.join(" "), /2026-09-10/); assert.equal(r.comparisonAvailable, false);
});
test("empty history creates no synthetic historical chart or savings rate", () => {
  const r = report(base(), { from: "2020-01-01", to: today });
  assert.equal(r.monthly.length, 0); assert.equal(r.yearly.length, 0); assert.equal(r.historyStart, null);
});
test("date filtering excludes transactions across exact boundaries and yearly aggregates agree", () => {
  let s = movement(base(), "income", 40, { date: "2025-12-31" });
  s = movement(s, "expense", 10, { date: "2026-01-01" });
  assert.equal(report(s, { from: "2026-01-01", to: "2026-12-31" }).totals.income, 0);
  const r = report(s, { from: "2025-12-31", to: today });
  assert.equal(r.yearly.reduce((sum, p) => sum + p.net, 0), r.totals.net);
});
test("comparison is available only with complete prior recorded coverage", () => {
  const s = movement(base(), "income", 10, { date: "2026-01-01" });
  assert.equal(report(s).comparisonAvailable, true);
});
test("observed snapshot tracking does not backfill and begins only after reconciliation", () => {
  const s = { ...base(), reconciliationRequired: true };
  assert.equal(N.captureNetWorthSnapshots(s, today), s);
  const observed = N.captureNetWorthSnapshots({ ...s, reconciliationRequired: false }, today);
  assert.equal(observed.netWorthSnapshots.length, 1); assert.equal(observed.netWorthSnapshots[0].date, today);
  assert.equal(N.currentNetWorth(observed, "SAR", today).monthChange, null);
  assert.equal(N.captureNetWorthSnapshots(observed, today), observed);
});
test("daily snapshots update current positions but preserve earlier observations and month-over-month evidence", () => {
  let s = N.captureNetWorthSnapshots(base(), "2026-10-31");
  s = movement(s, "income", 100); s = N.captureNetWorthSnapshots(s, today);
  assert.equal(s.netWorthSnapshots.length, 2); assert.equal(N.currentNetWorth(s, "SAR", today).monthChange, 100);
  assert.equal(s.netWorthSnapshots[0].netWorth, 1000);
});
test("snapshot metadata and detached transactions persist through safe restart without ledger changes", async () => {
  const s = N.captureNetWorthSnapshots(base(), today);
  const store = new Map([[M.FINANCE_STORAGE_KEY, JSON.stringify(s)]]);
  const storage = { getItem: async k => store.get(k) ?? null, setItem: async (k, v) => store.set(k, v) };
  const loaded = await M.loadFinanceState(storage, base());
  assert.deepEqual(loaded.netWorthSnapshots, s.netWorthSnapshots); assert.equal(loaded.transactions.length, 0);
});
test("exports use identical report totals, date range, currency and breakdown", () => {
  const r = report(movement(movement(base(), "income", 150), "expense", 25));
  const rows = E.analyticsReportRows(r);
  assert.equal(rows.find(row => row[0] === "Actual received income")[1], r.totals.income);
  assert.equal(rows.find(row => row[0] === "Included actual outflows")[1], r.totals.expenses);
  assert.equal(rows.find(row => row[0] === "From")[1], query.from); assert.equal(rows.find(row => row[0] === "To")[1], query.to);
  assert.equal(rows.find(row => row[0] === "Currency")[1], "SAR");
  assert.ok(E.analyticsCSV(r).includes('"Net cash flow","125"')); assert.ok(E.analyticsHTML(r).includes(">125<"));
});
test("exports prevent CSV formula injection and escape HTML without changing financial data", () => {
  const r = report(movement(base(), "income", 10, { description: '=SUM(1,1)<script>alert("x")</script>' }));
  assert.ok(E.analyticsCSV(r).includes("'=SUM")); assert.equal(E.analyticsHTML(r).includes("<script>"), false);
});
test("detached actual income and expense sources remain in analytics after removal", () => {
  let s = S.addManualMovement(base(), { id: "in", type: "income", amount: 150, description: "Work", category: "Salary", date: today, accountId: "a" });
  s = S.addManualMovement(s, { id: "out", type: "expense", amount: 10, description: "Food", category: "Food", date: today, accountId: "a" });
  s = S.synchronizeDomain(s, { ...s, incomes: [], expenses: [] });
  assert.deepEqual(report(s).totals, { income: 150, expenses: 10, net: 140, savingsRate: 140 / 150 * 100 });
});
test("USD exports exclude SAR records and preserve selected custom range", () => {
  let s = movement(base(), "income", 100);
  s.accounts.push({ ...s.accounts[0], id: "usd", currency: "USD" });
  s = movement(s, "income", 33, { currency: "USD", accountId: "usd", description: "USD receipt" });
  const r = report(s, { currency: "USD", from: today, to: today }), csv = E.analyticsCSV(r);
  assert.equal(r.totals.income, 33); assert.equal(r.movements.length, 1);
  assert.ok(csv.includes('"Currency","USD"')); assert.ok(csv.includes('"From","2026-11-11"'));
  assert.ok(csv.includes('"Actual received income","33"'));
});
test("analytics metadata backup is original, write-once and fail-safe", async () => {
  const original = JSON.stringify(base()), store = new Map([[M.FINANCE_STORAGE_KEY, original]]);
  const storage = { getItem: async k => store.get(k) ?? null, setItem: async (k, v) => store.set(k, v) };
  await M.loadFinanceState(storage, base());
  assert.equal(store.get(M.ANALYTICS_BACKUP_KEY), original);
  store.set(M.FINANCE_STORAGE_KEY, JSON.stringify(N.captureNetWorthSnapshots(base(), today)));
  await M.loadFinanceState(storage, base());
  assert.equal(store.get(M.ANALYTICS_BACKUP_KEY), original);
  await assert.rejects(M.loadFinanceState({ getItem: async k => k === M.FINANCE_STORAGE_KEY ? original : null, setItem: async () => { throw new Error("Full"); } }, base()), /Full/);
});
test("snapshot validation rejects unsupported precision and duplicate history dates", () => {
  const s = N.captureNetWorthSnapshots(base(), today);
  assert.equal(N.validSnapshot({ ...s.netWorthSnapshots[0], assets: 1.234, netWorth: 1.234 }), false);
  assert.throws(() => M.migrateFinanceState(JSON.stringify({ ...s, netWorthSnapshots: [...s.netWorthSnapshots, ...s.netWorthSnapshots] }), base()), /snapshots/);
});
test("detached loan principal is neither operating spending nor budget spending", () => {
  const B = require("../budgets.ts");
  const s = movement(base(), "expense", 200, { referenceType: undefined, referenceId: undefined, originType: "loan", category: "Loan principal" });
  assert.equal(report(s).totals.expenses, 0);
  assert.equal(B.spending(s, { currency: "SAR", includeEMI: true, includeLoans: true, includeSavings: true, categories: [] }, "2026-11").total, 0);
  assert.equal(N.currentNetWorth(s, "SAR").assets, 800);
});
test("the ongoing month remains partial on its last calendar day", () => {
  let s = movement(base(), "income", 100, { date: "2026-09-01" });
  s = movement(s, "income", 100, { date: "2026-10-01" });
  s = movement(s, "income", 100, { date: "2026-11-01" });
  const q = { ...query, from: "2026-09-01", to: "2026-11-30" };
  const ongoing = A.buildAnalyticsReport(s, q, undefined, "2026-11-30");
  assert.equal(ongoing.monthly.at(-1).partial, true);
  assert.equal(ongoing.health.completeMonths, 2);
  assert.equal(ongoing.health.consistency, null);
  const closed = A.buildAnalyticsReport(s, q, undefined, "2026-12-01");
  assert.equal(closed.monthly.at(-1).partial, false);
  assert.equal(closed.health.completeMonths, 3);
  assert.equal(closed.health.consistency, 100);
});
