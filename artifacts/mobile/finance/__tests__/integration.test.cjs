const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const S = require("../service.ts"), L = require("../ledger.ts"), R = require("../recurring.ts");
const B = require("../budgets.ts"), M = require("../migration.ts");
const today = "2026-11-11";
const base = () => ({
  userName: "", currency: "SAR", monthlyBudget: 1000, schemaVersion: 2, expenses: [], emis: [], loans: [],
  accounts: ["a", "b"].map(id => ({ id, name: id, balance: 100, openingBalance: 100, currency: "SAR", type: "bank" })),
  incomes: [], transactions: [], savingsGoals: [], notificationSettings: {}, securitySettings: {}, lastResetMonth: "", lastResetYear: "",
});
const receipt = () => ({ id: "i", name: "Salary", amount: 50, kind: "received", date: today, type: "salary", currency: "SAR", accountId: "a", category: "Work", color: "" });
const expense = () => ({ id: "e", name: "Food", amount: 20, category: "Food", dueDate: 11, isPaid: false, iconName: "coffee", color: "" });
const balance = (s, id = "a") => S.balances(s).find(a => a.id === id).balance;
// Exact financial ordering used by FinanceContext, not isolated arithmetic only.
const commit = (s, edit) => B.ensureBudgetPeriod(R.generateDueOccurrences(R.synchronizeOccurrences(S.synchronizeDomain(s, edit(s))), today), "2026-11", undefined, today);
test("Wallets expected income is a plan only", () => {
  const s = commit(base(), s => S.saveIncome(s, { ...receipt(), kind: "expected", date: undefined }));
  assert.equal(s.incomes.length, 1); assert.equal(s.transactions.length, 0); assert.equal(balance(s), 100);
});
test("Wallets received income posts atomically exactly once with stable reference and operation", () => {
  let s = commit(base(), s => S.saveIncome(s, receipt()));
  s = commit(s, s => S.saveIncome(s, receipt()));
  assert.equal(s.incomes.length, 1); assert.equal(s.transactions.length, 1); assert.equal(balance(s), 150);
  const t = s.transactions[0];
  assert.equal(t.id, "income:i"); assert.equal(t.operationId, "income:i"); assert.equal(t.referenceId, "i");
  for (const key of ["amount", "date", "currency", "accountId", "category"]) assert.equal(t[key], receipt()[key]);
  assert.equal(t.description, "Salary");
});
test("received income contributes to actual month and cash flow, expected does not", () => {
  let s = S.saveIncome(base(), receipt());
  s = S.saveIncome(s, { ...receipt(), id: "plan", kind: "expected", amount: 5000 });
  assert.deepEqual(L.cashFlow(L.getTransactionsByDateRange(s.transactions, "2026-11-01", "2026-11-30"), "SAR"), { moneyIn: 50, moneyOut: 0, net: 50 });
});
test("editing receipt updates amount, date, account, category and description without duplicates", () => {
  const before = S.saveIncome(base(), receipt());
  const after = commit(before, s => S.saveIncome(s, { ...receipt(), amount: 75, accountId: "b", date: "2026-10-31", name: "Corrected", category: "Consulting" }));
  assert.equal(after.transactions.length, 1); assert.equal(balance(after), 100); assert.equal(balance(after, "b"), 175);
  assert.equal(after.transactions[0].date, "2026-10-31"); assert.equal(after.transactions[0].category, "Consulting");
  assert.equal(after.transactions[0].description, "Corrected");
});
test("deleting receipt source keeps standalone actual history and no orphaned reference", () => {
  let s = S.saveIncome(base(), receipt());
  s = commit(s, s => ({ ...s, incomes: [] }));
  assert.equal(s.incomes.length, 0); assert.equal(s.transactions.length, 1); assert.equal(balance(s), 150);
  assert.equal(s.transactions[0].referenceType, undefined); assert.equal(s.transactions[0].referenceId, undefined);
  assert.equal(L.cashFlow(s.transactions, "SAR").moneyIn, 50);
  assert.equal(S.saveIncome(s, receipt()).incomes.length, 0);
  assert.equal(S.addManualMovement(s, { id: "i", type: "income", amount: 50, date: today, description: "Retry", category: "Work" }).transactions.length, 1);
});
test("deleting expected income leaves the ledger and balances unchanged", () => {
  const s = S.saveIncome(base(), { ...receipt(), kind: "expected" });
  const after = commit(s, s => ({ ...s, incomes: [] }));
  assert.equal(after.transactions.length, 0); assert.equal(balance(after), 100);
});
test("received income cannot silently be reclassified as expected", () => {
  const s = S.saveIncome(base(), receipt());
  assert.throws(() => S.saveIncome(s, { ...receipt(), kind: "expected" }));
});
test("an explicitly converted expected record posts only its confirmed receipt", () => {
  const s = S.saveIncome(base(), { ...receipt(), kind: "expected" });
  assert.equal(S.saveIncome(s, receipt()).transactions.length, 1);
});
test("editing uncertain legacy receipts or paid flags does not manufacture history", () => {
  const s = { ...base(), incomes: [receipt()], expenses: [{ ...expense(), isPaid: true }] };
  const after = commit(s, s => S.saveExpense(S.saveIncome(s, { ...receipt(), amount: 60 }), { ...s.expenses[0], amount: 30 }));
  assert.equal(after.transactions.length, 0); assert.equal(balance(after), 100);
});
test("paid expense edits synchronize the ledger and retain one movement", () => {
  let s = S.saveExpense(base(), { ...expense(), isPaid: true, accountId: "a", paidDate: today });
  s = commit(s, s => S.saveExpense(s, { ...s.expenses[0], amount: 30, name: "Updated", category: "Travel", accountId: "b", paidDate: "2026-10-30" }));
  assert.equal(s.transactions.length, 1); assert.equal(balance(s), 100); assert.equal(balance(s, "b"), 70);
  assert.equal(s.transactions[0].category, "Travel"); assert.equal(s.transactions[0].date, "2026-10-30");
});
test("unpaying a paid expense reverses once even through the context pipeline", () => {
  let s = S.saveExpense(base(), { ...expense(), isPaid: true, accountId: "a", paidDate: today });
  const reverse = s => S.setExpensePayment(s, "e", { paid: false, operationId: "reverse" });
  s = commit(s, reverse); s = commit(s, reverse);
  assert.equal(s.transactions.length, 0); assert.equal(balance(s), 100);
});
test("deleting a paid expense keeps actual outflow as standalone; deleting unpaid creates nothing", () => {
  let s = S.saveExpense(base(), { ...expense(), isPaid: true, accountId: "a", paidDate: today });
  s = commit(s, s => ({ ...s, expenses: [] }));
  assert.equal(s.transactions.length, 1); assert.equal(balance(s), 80);
  assert.equal(s.transactions[0].referenceId, undefined); assert.equal(s.transactions[0].paymentId, undefined);
  const unpaid = S.saveExpense(base(), expense());
  assert.equal(commit(unpaid, s => ({ ...s, expenses: [] })).transactions.length, 0);
});
test("paid expense repeated submissions and retries after source removal do not duplicate", () => {
  const input = { ...expense(), isPaid: true, accountId: "a", paidDate: today };
  let s = S.saveExpense(base(), input);
  s = commit(s, s => S.saveExpense(s, input));
  assert.equal(s.transactions.length, 1);
  s = commit(s, s => ({ ...s, expenses: [] }));
  assert.equal(S.saveExpense(s, input).expenses.length, 0);
});
test("deleting a recurring paid expense preserves paid occurrence; explicit reversal reopens it", () => {
  let s = R.saveRecurring(base(), { id: "r", name: "Internet", amount: 10, category: "Utilities", currency: "SAR", frequency: "monthly",
    startDate: today, nextDueDate: today, active: true, reminder: true, autoGenerate: true, color: "", iconName: "wifi" }, "future", today);
  s = commit(s, s => R.payRecurring(s, "r", today, { date: today, accountId: "a" }));
  const id = s.transactions[0].id;
  s = commit(s, s => ({ ...s, expenses: [] }));
  assert.equal(s.planning.occurrences[0].status, "paid"); assert.equal(balance(s), 90);
  assert.equal(s.transactions[0].recurringOccurrenceId, "rec:r:2026-11-11");
  s = commit(s, s => S.updateTransaction(s, id, { ...s.transactions[0], amount: 15 }));
  assert.equal(s.planning.occurrences[0].amount, 15); assert.equal(balance(s), 85);
  s = commit(s, s => S.deleteTransaction(s, id));
  assert.equal(s.planning.occurrences[0].status, "pending"); assert.equal(balance(s), 100);
});
test("parent EMI/loan/savings deletion detaches confirmed history rather than reversing money", () => {
  for (const [referenceType, collection] of [["emi", "emis"], ["loan", "loans"], ["savings_goal", "savingsGoals"]]) {
    const before = { ...base(), [collection]: [{ id: "parent" }] };
    before.transactions = [{ id: "t", operationId: "t", type: "expense", amount: 5, date: today, currency: "SAR", direction: "out", accountId: "a",
      description: "Historical", category: "Other", createdAt: new Date().toISOString(), referenceType, referenceId: "parent" }];
    const after = S.synchronizeDomain(before, { ...before, [collection]: [] });
    assert.equal(balance(after), 95); assert.equal(after.transactions[0].referenceId, undefined);
    assert.equal(after.transactions[0].originType, referenceType);
  }
});
test("detached transactions and opening balances survive migration/restart unchanged", async () => {
  let s = S.saveIncome(base(), receipt());
  s = commit(s, s => ({ ...s, incomes: [] }));
  const store = new Map([[M.FINANCE_STORAGE_KEY, JSON.stringify(s)]]);
  const storage = { getItem: async k => store.get(k) ?? null, setItem: async (k, v) => store.set(k, v) };
  const restored = await M.loadFinanceState(storage, base());
  assert.equal(balance(restored), 150); assert.equal(restored.accounts[0].openingBalance, 100);
  assert.deepEqual(restored.transactions, JSON.parse(JSON.stringify(s.transactions)));
});
