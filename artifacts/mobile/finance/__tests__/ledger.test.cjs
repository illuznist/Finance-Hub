const { test } = require("node:test");
const assert = require("node:assert/strict");
// Compile only modules requested by these unit tests, using the existing TypeScript dependency.
const ts = require("typescript");
const fs = require("node:fs");
require.extensions[".ts"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText, filename);
};
const L = require("../ledger.ts");
const S = require("../service.ts");
const M = require("../migration.ts");

const empty = () => ({
  userName: "", currency: "SAR", monthlyBudget: 0, expenses: [], emis: [], loans: [],
  accounts: [], incomes: [], savingsGoals: [], transactions: [], schemaVersion: 1,
  notificationSettings: { enabled: true }, securitySettings: { pinEnabled: false },
  lastResetMonth: "", lastResetYear: "",
});
const base = () => ({
  ...empty(),
  accounts: [
    { id: "a", name: "Bank", type: "bank", color: "#2563EB", balance: 1000, openingBalance: 1000, currency: "SAR" },
    { id: "b", name: "Cash", type: "cash", color: "#2563EB", balance: 100, openingBalance: 100, currency: "SAR" },
  ],
});
const balance = (s, id = "a") => S.balances(s).find(a => a.id === id).balance;
const manual = (type = "income", id = "event") => ({
  id, type, amount: 150, date: "2026-11-11", description: "Recorded movement",
  category: type === "income" ? "Salary" : "Bills", accountId: "a", currency: "SAR",
});
const expense = () => ({ id: "e", name: "Electricity", amount: 75, category: "Bills", dueDate: 11, isPaid: false, iconName: "zap", color: "#2563EB" });
const emi = () => ({
  id: "emi", name: "Car", totalAmount: 10000, monthlyAmount: 100, totalInstallments: 10,
  paidInstallments: 0, startMonth: "2026-11", dueDayOfMonth: 11, paymentHistory: [],
  balloonPaymentAmount: 500, linkedAccountId: "a", color: "#2563EB", iconName: "truck",
});
const loan = (direction = "borrowed") => ({
  id: "loan", name: "Family", direction, counterpartyName: "Person", principalAmount: 1000,
  sourceType: "person", category: "personal", startDate: "2026-11-01",
  repaymentFrequency: "monthly", notes: "", payments: [], createdAt: "2026-11-01T00:00:00Z",
});
const monthly = () => ({ amount: 100, date: "2026-11-11", paymentType: "monthly_emi", operationId: "confirm", accountId: "a" });
const correction = t => ({
  amount: t.amount, date: t.date, description: t.description, category: t.category, accountId: t.accountId, notes: t.notes,
});
test("income increases only the selected account", () => {
  const s = S.addManualMovement(base(), manual());
  assert.equal(balance(s), 1150); assert.equal(balance(s, "b"), 100);
});
test("unpaid expense never changes an account", () => {
  const s = S.synchronizeDomain(base(), { ...base(), expenses: [expense()] });
  assert.equal(s.transactions.length, 0); assert.equal(balance(s), 1000);
});
test("confirm expense creates exactly one expense and correct balance", () => {
  const s = S.setExpensePayment({ ...base(), expenses: [expense()] }, "e", { paid: true, operationId: "pay", accountId: "a", date: "2026-11-11" });
  assert.equal(balance(s), 925); assert.equal(s.transactions.length, 1);
  assert.equal(s.transactions[0].referenceId, "e");
  assert.equal(S.setExpensePayment(s, "e", { paid: true, operationId: "repeat", accountId: "a" }), s);
});
test("marking unpaid reverses the current expense payment", () => {
  let s = S.setExpensePayment({ ...base(), expenses: [expense()] }, "e", { paid: true, operationId: "pay", accountId: "a" });
  s = S.setExpensePayment(s, "e", { paid: false, operationId: "undo" });
  assert.equal(balance(s), 1000); assert.equal(s.transactions.length, 0); assert.equal(s.expenses[0].isPaid, false);
});
test("unassigned payment is explicit and never invents an account", () => {
  const s = S.addManualMovement(base(), { ...manual("expense"), accountId: undefined });
  assert.equal(balance(s), 1000); assert.equal(s.transactions[0].accountId, undefined);
  assert.equal(L.cashFlow(s.transactions, "SAR").moneyOut, 150);
});
test("expense correction synchronizes its owned record", () => {
  let s = S.addManualMovement(base(), manual("expense"));
  const t = s.transactions[0];
  s = S.updateTransaction(s, t.id, { ...correction(t), amount: 80, date: "2026-11-12", accountId: "b" });
  assert.equal(balance(s), 1000); assert.equal(balance(s, "b"), 20);
  assert.equal(s.expenses[0].amount, 80); assert.equal(s.expenses[0].paidDate, "2026-11-12");
});
test("monthly EMI confirmation creates one transaction and is idempotent", () => {
  let s = { ...base(), emis: [emi()] };
  s = S.confirmEMIPayment(s, "emi", monthly());
  const repeated = S.confirmEMIPayment(s, "emi", monthly());
  assert.equal(repeated, s); assert.equal(s.transactions.length, 1); assert.equal(balance(s), 900);
  assert.equal(s.emis[0].paidInstallments, 1);
});
test("scheduled auto-debit is not a confirmed payment", () => {
  const s = S.synchronizeDomain(base(), { ...base(), emis: [{ ...emi(), autoDebitEnabled: true, firstPaymentDate: "2020-01-01" }] });
  assert.equal(s.transactions.length, 0); assert.equal(balance(s), 1000);
});
test("balloon partial payments remain separate and reject overpayment", () => {
  let s = S.confirmEMIPayment({ ...base(), emis: [emi()] }, "emi", monthly());
  const p = { amount: 200, date: "2026-11-11", paymentType: "balloon", accountId: "a", operationId: "balloon1" };
  s = S.confirmEMIPayment(s, "emi", p);
  s = S.confirmEMIPayment(s, "emi", { ...p, operationId: "balloon2", amount: 300 });
  assert.equal(s.transactions.filter(t => t.type === "balloon_payment").length, 2);
  assert.equal(balance(s), 400);
  assert.throws(() => S.confirmEMIPayment(s, "emi", { ...p, operationId: "excess", amount: 1 }), /balloon/);
});
test("editing an EMI payment updates its ledger and history", () => {
  let s = S.confirmEMIPayment({ ...base(), emis: [emi()] }, "emi", monthly());
  const t = s.transactions[0];
  assert.throws(() => S.updateTransaction(s, t.id, { ...correction(t), amount: 90 }), /scheduled EMI amount/);
  s = S.updateTransaction(s, t.id, { ...correction(t), amount: 100, date: "2026-11-12" });
  assert.equal(balance(s), 900); assert.equal(s.emis[0].paymentHistory[0].amount, 100);
  assert.equal(s.emis[0].paymentHistory[0].date, "2026-11-12");
  assert.equal(s.transactions.length, 1);
});
test("deleting an EMI payment restores balance and installment progress", () => {
  let s = S.confirmEMIPayment({ ...base(), emis: [emi()] }, "emi", monthly());
  s = S.deleteTransaction(s, s.transactions[0].id);
  assert.equal(balance(s), 1000); assert.equal(s.emis[0].paidInstallments, 0); assert.equal(s.emis[0].paymentHistory.length, 0);
});
test("loan alone does not change balance", () => {
  const s = S.synchronizeDomain(base(), { ...base(), loans: [loan()] });
  assert.equal(s.transactions.length, 0); assert.equal(balance(s), 1000);
});
test("borrowed loan repayment decreases balance and duplicate is harmless", () => {
  const p = { amount: 200, date: "2026-11-11", accountId: "a", operationId: "repay" };
  const s = S.confirmLoanPayment({ ...base(), loans: [loan()] }, "loan", p);
  assert.equal(balance(s), 800); assert.equal(s.transactions[0].type, "loan_repayment");
  assert.equal(S.confirmLoanPayment(s, "loan", p), s);
});
test("receipt from a lent loan increases balance", () => {
  const s = S.confirmLoanPayment({ ...base(), loans: [loan("lent")] }, "loan", { amount: 200, date: "2026-11-11", accountId: "a", operationId: "received" });
  assert.equal(balance(s), 1200); assert.equal(s.transactions[0].type, "loan_received");
});
test("loan payment edits cannot overpay; deletion restores balance", () => {
  let s = S.confirmLoanPayment({ ...base(), loans: [loan()] }, "loan", { amount: 200, date: "2026-11-11", accountId: "a", operationId: "repay" });
  const t = s.transactions[0];
  assert.throws(() => S.updateTransaction(s, t.id, { ...correction(t), amount: 1001 }), /loan balance/);
  s = S.updateTransaction(s, t.id, { ...correction(t), amount: 100 });
  assert.equal(s.loans[0].payments[0].amount, 100); assert.equal(balance(s), 900);
  s = S.deleteTransaction(s, t.id); assert.equal(balance(s), 1000);
});
test("original loan funds are recorded only by explicit action", () => {
  const initial = { ...base(), loans: [loan()] };
  const s = S.recordLoanFunding(initial, "loan", { id: "principal", accountId: "a", date: "2026-11-11" });
  assert.equal(balance(s), 2000); assert.equal(s.loans[0].payments.length, 0);
  assert.equal(S.recordLoanFunding(s, "loan", { id: "again", accountId: "a", date: "2026-11-11" }), s);
});
test("transfers balance both accounts without income or expense", () => {
  const s = S.recordTransfer(base(), { id: "transfer", sourceId: "a", destinationId: "b", amount: 250, date: "2026-11-11" });
  assert.equal(balance(s), 750); assert.equal(balance(s, "b"), 350);
  assert.deepEqual(L.cashFlow(s.transactions, "SAR"), { moneyIn: 0, moneyOut: 0, net: 0 });
  assert.equal(s.transactions[0].transferGroupId, s.transactions[1].transferGroupId);
});
test("transfer edits and deletes always affect the complete pair", () => {
  let s = S.recordTransfer(base(), { id: "transfer", sourceId: "a", destinationId: "b", amount: 250, date: "2026-11-11" });
  s = S.updateTransaction(s, s.transactions[0].id, { ...correction(s.transactions[0]), amount: 200, date: "2026-11-12" });
  assert.equal(balance(s), 800); assert.equal(balance(s, "b"), 300);
  assert.ok(s.transactions.every(t => t.amount === 200 && t.date === "2026-11-12"));
  s = S.deleteTransaction(s, s.transactions[1].id);
  assert.equal(s.transactions.length, 0); assert.equal(balance(s), 1000); assert.equal(balance(s, "b"), 100);
});
test("duplicate manual creation never duplicates domain or ledger", () => {
  for (const type of ["income", "expense"]) {
    const first = S.addManualMovement(base(), manual(type));
    const again = S.addManualMovement(first, manual(type));
    assert.equal(again.transactions.length, 1); assert.equal(again[type === "income" ? "incomes" : "expenses"].length, 1);
  }
});
test("invalid transfer accounts and cross-currency transfers are rejected", () => {
  assert.throws(() => S.recordTransfer(base(), { id: "t", sourceId: "a", destinationId: "a", amount: 10, date: "2026-11-11" }));
  const s = base(); s.accounts[1].currency = "USD";
  assert.throws(() => S.recordTransfer(s, { id: "t", sourceId: "a", destinationId: "b", amount: 10, date: "2026-11-11" }), /currency/);
});
test("currency totals never combine unlike currencies", () => {
  const s = base(); s.accounts[1].currency = "USD";
  const t = S.addManualMovement(s, { ...manual(), currency: "USD", accountId: "b" });
  assert.equal(L.cashFlow(t.transactions, "SAR").moneyIn, 0);
  assert.equal(balance(t), 1000); assert.equal(balance(t, "b"), 250);
});
test("invalid amounts, precision and impossible dates are rejected", () => {
  for (const amount of [NaN, Infinity, -1, 0, 0.001]) assert.throws(() => L.positiveMoney(amount));
  assert.equal(L.validLocalDate("2026-02-30"), false); assert.equal(L.validLocalDate("2028-02-29"), true);
  assert.throws(() => S.addManualMovement(base(), { ...manual(), date: "2026-02-30" }));
});
test("minor-unit arithmetic avoids cumulative floating-point drift", () => {
  let s = base();
  for (let i = 0; i < 100; i++) s = S.addManualMovement(s, { ...manual("expense", String(i)), amount: 0.1 });
  assert.equal(balance(s), 990);
});
test("expected income definitions never create transactions", () => {
  const s = S.synchronizeDomain(base(), { ...base(), incomes: [{ id: "expected", name: "Salary", amount: 1000, type: "salary", color: "", kind: "expected" }] });
  assert.equal(s.transactions.length, 0); assert.equal(balance(s), 1000);
});
test("domain edit and delete synchronize income without duplicates", () => {
  let s = S.addManualMovement(base(), manual());
  let next = { ...s, incomes: s.incomes.map(i => ({ ...i, amount: 200 })) };
  next = S.synchronizeDomain(s, next);
  assert.equal(next.transactions.length, 1); assert.equal(balance(next), 1200);
  next = S.synchronizeDomain(next, { ...next, incomes: [] }); assert.equal(balance(next), 1200);
  assert.equal(next.transactions[0].referenceId, undefined);
});
test("recurring expense history survives later occurrence and correction", () => {
  let s = S.addManualMovement(base(), manual("expense"));
  const oldId = s.transactions[0].id;
  // Reset flags, not history (same behavior as initialization's reset engine).
  s = { ...s, expenses: s.expenses.map(e => ({ ...e, isPaid: false, paymentId: undefined, paidDate: undefined })) };
  s = S.setExpensePayment(s, "event", { paid: true, operationId: "next-month", date: "2026-12-11", accountId: "a" });
  assert.equal(s.transactions.length, 2);
  s = S.deleteTransaction(s, oldId);
  assert.equal(s.expenses[0].isPaid, true); assert.equal(s.transactions.length, 1);
});
test("savings contribution is idempotent and corrections update goal", () => {
  let s = { ...base(), savingsGoals: [{ id: "g", name: "Goal", targetAmount: 500, savedAmount: 0, color: "", iconName: "flag" }] };
  const p = { id: "saving", goalId: "g", amount: 50, accountId: "a", date: "2026-11-11" };
  s = S.contributeToSavings(s, p);
  assert.equal(S.contributeToSavings(s, p), s); assert.equal(balance(s), 950);
  s = S.updateTransaction(s, "saving", { ...correction(s.transactions[0]), amount: 25 });
  assert.equal(s.savingsGoals[0].savedAmount, 25); assert.equal(balance(s), 975);
  s = S.deleteTransaction(s, "saving"); assert.equal(s.savingsGoals[0].savedAmount, 0); assert.equal(balance(s), 1000);
});
test("reconciliation is explicit and does not rewrite opening balance", () => {
  const s = S.reconcileAccountBalance(base(), { id: "reconcile", accountId: "a", actualBalance: 900, date: "2026-11-11" });
  assert.equal(s.accounts[0].openingBalance, 1000); assert.equal(balance(s), 900);
  assert.deepEqual(L.cashFlow(s.transactions, "SAR"), { moneyIn: 0, moneyOut: 0, net: 0 });
});
test("legacy migration preserves records and does not invent transactions or EMI dates", () => {
  const legacy = base(); delete legacy.schemaVersion; delete legacy.transactions;
  legacy.expenses = [{ ...expense(), isPaid: true }];
  legacy.emis = [{ ...emi(), paidInstallments: 3 }]; delete legacy.emis[0].paymentHistory;
  legacy.loans = [{ ...loan(), payments: [{ id: "old", amount: 50, date: "unknown" }] }];
  const migrated = M.migrateFinanceState(JSON.stringify(legacy), empty());
  assert.equal(migrated.expenses[0].isPaid, true); assert.equal(migrated.emis[0].paidInstallments, 3);
  assert.equal(migrated.emis[0].paymentHistory, undefined); assert.equal(migrated.loans[0].payments[0].date, "unknown");
  assert.equal(migrated.transactions.length, 0); assert.equal(balance(migrated), 1000);
  assert.equal(migrated.reconciliationRequired, true);
  assert.deepEqual(M.migrateFinanceState(JSON.stringify(migrated), empty()), migrated);
});
test("fresh installations have no fictional financial records", () => {
  const s = M.migrateFinanceState(null, empty());
  for (const key of ["accounts", "expenses", "incomes", "emis", "loans", "savingsGoals", "transactions"]) assert.equal(s[key].length, 0);
  assert.equal(s.monthlyBudget, 0);
  const context = fs.readFileSync(require("node:path").join(__dirname, "../../context/FinanceContext.tsx"), "utf8");
  assert.match(context, /monthlyBudget: 0/);
  assert.doesNotMatch(context, /id: "exp1"|id: "acc1"|id: "sg1"/);
});
test("migration backup is exact and retained across repeat startup", async () => {
  const legacy = base(); delete legacy.schemaVersion;
  const raw = JSON.stringify(legacy);
  const data = new Map([[M.FINANCE_STORAGE_KEY, raw]]);
  const storage = { getItem: async k => data.get(k) ?? null, setItem: async (k, v) => { data.set(k, v); } };
  const first = await M.loadFinanceState(storage, empty());
  assert.equal(data.get(M.LEGACY_BACKUP_KEY), raw);
  const second = await M.loadFinanceState(storage, empty());
  assert.deepEqual(first, second); assert.equal(data.get(M.LEGACY_BACKUP_KEY), raw);
});
test("corrupt data and failed backups never overwrite primary storage", async () => {
  for (const raw of ["{broken", JSON.stringify({ accounts: "not-an-array" })]) {
    let writes = 0;
    await assert.rejects(M.loadFinanceState({ getItem: async () => raw, setItem: async () => { writes++; } }, empty()));
    assert.equal(writes, 0);
  }
  const legacy = base(); delete legacy.schemaVersion;
  let primaryWrites = 0;
  await assert.rejects(M.loadFinanceState({
    getItem: async k => k === M.FINANCE_STORAGE_KEY ? JSON.stringify(legacy) : null,
    setItem: async k => { if (k === M.LEGACY_BACKUP_KEY) throw new Error("disk full"); primaryWrites++; },
  }, empty()));
  assert.equal(primaryWrites, 0);
});
test("whole state persists and reloads transaction history after simulated restart", async () => {
  const data = new Map();
  const storage = { getItem: async k => data.get(k) ?? null, setItem: async (k, v) => { data.set(k, v); } };
  const s = S.addManualMovement(base(), manual());
  await M.createWriteQueue(storage)(s);
  const loaded = await M.loadFinanceState(storage, empty());
  assert.deepEqual(loaded.transactions, s.transactions); assert.equal(balance(loaded), 1150);
});
test("write queue preserves commit order and exposes write failure", async () => {
  const saved = [];
  const storage = { getItem: async () => null, setItem: async (k, v) => { const s = JSON.parse(v); if (s.userName === "fail") throw new Error("failed write"); saved.push(s.userName); } };
  const write = M.createWriteQueue(storage);
  const first = write({ ...empty(), userName: "first" });
  const failure = write({ ...empty(), userName: "fail" });
  const rejection = assert.rejects(failure, /failed write/);
  const last = write({ ...empty(), userName: "last" });
  await Promise.all([first, rejection, last]);
  assert.deepEqual(saved, ["first", "last"]);
});
test("local calendar month boundaries and inclusive filtering", () => {
  assert.deepEqual(L.monthRange(0, new Date(2026, 10, 11)), { from: "2026-11-01", to: "2026-11-30" });
  assert.deepEqual(L.monthRange(-1, new Date(2026, 0, 1)), { from: "2025-12-01", to: "2025-12-31" });
  const s = S.addManualMovement(base(), manual());
  assert.equal(L.getTransactionsByDateRange(s.transactions, "2026-11-11", "2026-11-11").length, 1);
});
test("context synchronization preserves manual category and does not double-count", () => {
  for (const type of ["income", "expense"]) {
    const before = base();
    const next = S.synchronizeDomain(before, S.addManualMovement(before, manual(type)));
    assert.equal(next.transactions.length, 1);
    assert.equal(next.transactions[0].category, type === "income" ? "Salary" : "Bills");
    assert.equal(balance(next), type === "income" ? 1150 : 850);
  }
});
test("context synchronization preserves corrected EMI details and account", () => {
  const before = S.confirmEMIPayment({ ...base(), emis: [emi()] }, "emi", monthly());
  const t = before.transactions[0];
  const next = S.synchronizeDomain(before, S.updateTransaction(before, t.id, {
    ...correction(t), amount: 100, accountId: "b", description: "Corrected payment", notes: "Correction",
  }));
  assert.equal(next.transactions.length, 1); assert.equal(next.transactions[0].description, "Corrected payment");
  assert.equal(next.emis[0].paymentHistory[0].accountId, "b"); assert.equal(balance(next), 1000); assert.equal(balance(next, "b"), 0);
});
test("changing EMI linked account does not silently move historical payments", () => {
  const before = S.confirmEMIPayment({ ...base(), emis: [emi()] }, "emi", monthly());
  const next = S.synchronizeDomain(before, { ...before, emis: before.emis.map(e => ({ ...e, linkedAccountId: "b" })) });
  assert.equal(next.transactions[0].accountId, "a"); assert.equal(balance(next), 900);
});
test("explicitly unassigned EMI ignores the plan's linked account", () => {
  const s = S.confirmEMIPayment({ ...base(), emis: [emi()] }, "emi", { ...monthly(), accountId: undefined });
  assert.equal(s.transactions[0].accountId, undefined); assert.equal(balance(s), 1000);
});
test("legacy history correction never invents account movements", () => {
  const initial = { ...base(), emis: [{ ...emi(), paidInstallments: 1, paymentHistory: [{ ...monthly(), id: "old", status: "paid", legacy: true }] }] };
  const next = S.synchronizeDomain(initial, { ...initial, emis: initial.emis.map(e => ({ ...e, paymentHistory: e.paymentHistory.map(p => ({ ...p, amount: 80 })) })) });
  assert.equal(next.transactions.length, 0); assert.equal(balance(next), 1000);
});
test("loan principal correction/deletion never changes repayment history", () => {
  let s = S.recordLoanFunding({ ...base(), loans: [loan()] }, "loan", { id: "fund", accountId: "a", date: "2026-11-11" });
  s = S.updateTransaction(s, s.transactions[0].id, { ...correction(s.transactions[0]), amount: 900 });
  assert.equal(s.loans[0].funding.amount, 900); assert.equal(s.loans[0].payments.length, 0); assert.equal(balance(s), 1900);
  s = S.deleteTransaction(s, s.transactions[0].id);
  assert.equal(s.loans[0].funding, undefined); assert.equal(balance(s), 1000);
});
test("matching reconciliation confirms review without a fictional adjustment", () => {
  let s = { ...base(), reconciliationRequired: true };
  s = S.reconcileAccountBalance(s, { id: "r1", accountId: "a", actualBalance: 1000, date: "2026-11-11" });
  assert.equal(s.reconciliationRequired, true); assert.equal(s.transactions.length, 0);
  s = S.reconcileAccountBalance(s, { id: "r2", accountId: "b", actualBalance: 100, date: "2026-11-11" });
  assert.equal(s.reconciliationRequired, false); assert.equal(s.transactions.length, 0);
});
test("migration rejects inconsistent transfer pairs without discarding data", () => {
  const s = S.recordTransfer(base(), { id: "transfer", sourceId: "a", destinationId: "b", amount: 10, date: "2026-11-11" });
  s.transactions[1].amount = 20;
  assert.throws(() => M.migrateFinanceState(JSON.stringify(s), empty()), /transfer pair/);
});
test("manual API rejects orphan EMI and loan payments", () => {
  assert.throws(() => S.addManualMovement(base(), { ...manual(), type: "emi_payment" }), /own payment flow/);
});
test("intermediate schema accounts missing opening balances load without losing saved balances", async () => {
  const intermediate = base();
  delete intermediate.accounts[0].openingBalance;
  delete intermediate.accounts[1].openingBalance;
  const raw = JSON.stringify(intermediate);
  const data = new Map([[M.FINANCE_STORAGE_KEY, raw]]);
  const storage = { getItem: async k => data.get(k) ?? null, setItem: async (k, v) => { data.set(k, v); } };
  const loaded = await M.loadFinanceState(storage, empty());
  assert.equal(balance(loaded), 1000); assert.equal(balance(loaded, "b"), 100);
  assert.equal(data.get(M.COMPATIBILITY_BACKUP_KEY), raw);
  assert.deepEqual(await M.loadFinanceState(storage, empty()), loaded);
});
test("zero-balance accounts missing opening balances recover as zero", () => {
  const state = base(); state.accounts.forEach(a => { a.balance = 0; delete a.openingBalance; });
  const loaded = M.migrateFinanceState(JSON.stringify(state), empty());
  assert.ok(loaded.accounts.every(a => a.openingBalance === 0));
  assert.equal(balance(loaded), 0); assert.equal(loaded.transactions.length, 0);
});
test("schema 1 opening repair preserves existing ledger impact exactly once", () => {
  const state = S.addManualMovement(base(), manual());
  delete state.accounts[0].openingBalance;
  const loaded = M.migrateFinanceState(JSON.stringify(state), empty());
  assert.equal(loaded.accounts[0].openingBalance, 1000);
  assert.equal(balance(loaded), 1150);
  assert.deepEqual(loaded.transactions, state.transactions);
});
