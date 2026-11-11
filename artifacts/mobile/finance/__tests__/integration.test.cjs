const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const S = require("../service.ts"), L = require("../ledger.ts"), R = require("../recurring.ts");
const A = require("../analytics.ts");
const B = require("../budgets.ts"), M = require("../migration.ts");
const today = "2026-11-11";
const base = () => ({
  userName: "", currency: "SAR", monthlyBudget: 1000, schemaVersion: 2, expenses: [], emis: [], loans: [],
  accounts: ["a", "b"].map(id => ({ id, name: id, balance: 100, openingBalance: 100, currency: "SAR", type: "bank" })),
  incomes: [], transactions: [], savingsGoals: [], notificationSettings: {}, securitySettings: {}, lastResetMonth: "", lastResetYear: "",
});
const receipt = () => ({ id: "i", name: "Salary", amount: 50, kind: "received", date: today, type: "salary", currency: "SAR", accountId: "a", category: "Work", color: "" });
const expense = () => ({ id: "e", name: "Food", amount: 20, category: "Food", dueDate: 11, isPaid: false, iconName: "coffee", color: "" });
const emi = () => ({ id: "m", name: "Vehicle", currency: "SAR", totalAmount: 150, monthlyAmount: 50, totalInstallments: 2, paidInstallments: 0, startMonth: "2026-11", dueDayOfMonth: 11, color: "", iconName: "car", balloonPaymentAmount: 50, paymentHistory: [] });
const loan = () => ({ id: "l", name: "Family loan", direction: "borrowed", counterpartyName: "Family", sourceType: "person", category: "family",
  principalAmount: 100, totalRepaymentAmount: 120, interestRate: 20, startDate: today, repaymentFrequency: "one-time", notes: "", payments: [], createdAt: `${today}T00:00:00Z` });
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
  assert.equal(s.transactions[0].referenceId, undefined); assert.equal(s.transactions[0].paymentId, "e");
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

test("explicit EMI reversals remove the paired movement and history once", () => {
  let s = commit(base(), s => ({ ...s, emis: [emi()] }));
  s = commit(s, s => S.confirmEMIPayment(s, "m", { amount: 50, paymentType: "monthly_emi", date: today, accountId: "a", operationId: "emi-1" }));
  s = commit(s, s => S.confirmEMIPayment(s, "m", { amount: 20, paymentType: "balloon", date: today, accountId: "a", operationId: "emi-balloon-1" }));
  assert.equal(balance(s), 30); assert.equal(s.transactions.length, 2);
  const t = s.transactions.find(t => t.paymentId === "emi-1");
  const reversed = commit(s, s => S.reverseEMIPayment(s, "m", "emi-1"));
  assert.equal(balance(reversed), 80); assert.equal(reversed.transactions.length, 1);
  assert.equal(reversed.emis[0].paidInstallments, 0);
  assert.equal(reversed.emis[0].paymentHistory.some(p => p.id === "emi-1"), false);
  assert.equal(reversed.transactions.some(x => x.id === t.id), false);
  assert.throws(() => S.reverseEMIPayment(reversed, "m", "emi-1"), /no longer exists/);
});

test("explicit loan repayment reversal changes its linked movement and history once", () => {
  let s = commit(base(), s => ({ ...s, loans: [loan()] }));
  s = commit(s, s => S.confirmLoanPayment(s, "l", { amount: 40, date: today, accountId: "a", operationId: "loan-pay-1" }));
  assert.equal(balance(s), 60);
  const t = s.transactions.find(t => t.paymentId === "loan-pay-1");
  const reversed = commit(s, s => S.reverseLoanPayment(s, "l", "loan-pay-1"));
  assert.equal(balance(reversed), 100); assert.equal(reversed.transactions.length, 0);
  assert.equal(reversed.loans[0].payments.length, 0);
  assert.equal(reversed.transactions.some(x => x.id === t.id), false);
  assert.throws(() => S.reverseLoanPayment(reversed, "l", "loan-pay-1"), /no longer exists/);
});

test("editing a linked EMI balloon updates ledger, balance, identity and history once", () => {
  let s = commit(base(), s => ({ ...s, emis: [emi()] }));
  s = commit(s, s => S.confirmEMIPayment(s, "m", { amount: 20, paymentType: "balloon", date: today, accountId: "a", operationId: "balloon-edit" }));
  const tx = s.transactions[0];
  s = commit(s, s => S.updateEMIPayment(s, "m", "balloon-edit", { amount: 30, date: "2026-11-10", accountId: "b", notes: "Corrected" }));
  assert.equal(s.transactions.length, 1); assert.equal(s.transactions[0].id, tx.id);
  assert.equal(s.transactions[0].amount, 30); assert.equal(s.transactions[0].date, "2026-11-10");
  assert.equal(s.transactions[0].accountId, "b"); assert.equal(s.transactions[0].notes, "Corrected");
  assert.equal(balance(s), 100); assert.equal(balance(s, "b"), 70);
  assert.deepEqual(s.emis[0].paymentHistory[0], { ...s.emis[0].paymentHistory[0], amount: 30, date: "2026-11-10", accountId: "b", notes: "Corrected" });
  assert.throws(() => S.updateEMIPayment(s, "m", "balloon-edit", { amount: 21, accountId: "missing" }), /no longer exists/);
  assert.equal(s.transactions.length, 1);
});

test("EMI edit enforces scheduled monthly amount in minor units and account currency", () => {
  let s = commit(base(), s => ({ ...s, emis: [emi()] }));
  s = commit(s, s => S.confirmEMIPayment(s, "m", { amount: 50, paymentType: "monthly_emi", date: today, accountId: "a", operationId: "monthly-edit" }));
  assert.throws(() => S.updateEMIPayment(s, "m", "monthly-edit", { amount: 49.99 }), /scheduled EMI amount/);
  s.accounts[1].currency = "USD";
  s.accounts.push({ id: "c", name: "Other SAR", type: "bank", balance: 100, openingBalance: 100, currency: "SAR" });
  assert.throws(() => S.updateEMIPayment(s, "m", "monthly-edit", { accountId: "b" }), /payment currency/);
  const corrected = commit(s, s => S.updateEMIPayment(s, "m", "monthly-edit", { amount: 50, date: "2026-11-10", accountId: "c" }));
  assert.equal(corrected.transactions.length, 1); assert.equal(corrected.transactions[0].date, "2026-11-10");
  assert.equal(corrected.transactions[0].accountId, "c"); assert.equal(balance(corrected), 100);
  assert.equal(balance(corrected, "c"), 50);
});

test("editing a linked loan repayment replaces its ledger movement atomically", () => {
  let s = commit(base(), s => ({ ...s, loans: [loan()] }));
  s = commit(s, s => S.confirmLoanPayment(s, "l", { amount: 40, date: today, accountId: "a", operationId: "loan-edit" }));
  const id = s.transactions[0].id;
  const corrected = commit(s, s => S.updateLoanPayment(s, "l", "loan-edit", { amount: 45, date: "2026-11-10", accountId: "b", notes: "Corrected" }));
  assert.equal(corrected.transactions.length, 1); assert.equal(corrected.transactions[0].id, id);
  assert.equal(corrected.transactions[0].amount, 45); assert.equal(corrected.transactions[0].accountId, "b");
  assert.equal(corrected.transactions[0].date, "2026-11-10"); assert.equal(corrected.transactions[0].notes, "Corrected");
  assert.equal(balance(corrected), 100); assert.equal(balance(corrected, "b"), 55);
  assert.equal(corrected.loans[0].payments[0].amount, 45); assert.equal(corrected.loans[0].payments[0].accountId, "b");
  assert.throws(() => S.updateLoanPayment(corrected, "l", "loan-edit", { amount: 121 }), /remaining loan balance/);
  assert.throws(() => S.updateLoanPayment(corrected, "l", "loan-edit", { date: "2026-02-30" }), /valid date/);
});

test("history-only legacy payments remain editable but cannot be reversed or replayed", () => {
  const original = commit(base(), s => ({
    ...s,
    emis: [{ ...emi(), paidInstallments: 1, paymentHistory: [{ id: "old", amount: 45, date: today, paymentType: "monthly_emi", status: "paid", legacy: true }] }],
    loans: [{ ...loan(), payments: [{ id: "old-loan", amount: 30, date: today, legacy: true }] }],
  }));
  const edited = commit(original, s => S.updateEMIPayment(s, "m", "old", { date: "2026-11-10", notes: "Historical edit" }));
  assert.equal(edited.transactions.length, 0); assert.equal(balance(edited), 100);
  assert.equal(edited.emis[0].paymentHistory[0].legacy, true); assert.equal(edited.emis[0].paymentHistory[0].date, "2026-11-10");
  assert.throws(() => S.reverseEMIPayment(edited, "m", "old"), /historical EMI record was kept/);
  assert.throws(() => S.reverseLoanPayment(edited, "l", "old-loan"), /historical loan record was kept/);
  const editedLoan = commit(edited, s => S.updateLoanPayment(s, "l", "old-loan", { notes: "Historical loan edit" }));
  assert.equal(editedLoan.transactions.length, 0); assert.equal(balance(editedLoan), 100);
  assert.equal(editedLoan.loans[0].payments[0].legacy, true);
  assert.equal(editedLoan.loans[0].payments[0].notes, "Historical loan edit");
});

test("detached payment identities remain available while source references are removed", () => {
  let s = commit(base(), s => ({ ...s, emis: [emi()], loans: [loan()], savingsGoals: [{ id: "g", name: "Save", savedAmount: 0, targetAmount: 100, color: "", iconName: "star" }] }));
  s = commit(s, s => S.confirmEMIPayment(s, "m", { amount: 50, paymentType: "monthly_emi", date: today, accountId: "a", operationId: "emikey" }));
  s = commit(s, s => S.confirmLoanPayment(s, "l", { amount: 20, date: today, accountId: "a", operationId: "loankey" }));
  s = commit(s, s => S.contributeToSavings(s, { id: "goalkey", goalId: "g", amount: 10, date: today, accountId: "a" }));
  s = commit(s, s => S.deleteDomainSource(S.deleteDomainSource(S.deleteDomainSource(s, "emi", "m"), "loan", "l"), "savings_goal", "g"));
  assert.deepEqual(s.transactions.map(t => t.paymentId).sort(), ["emikey", "loankey", undefined].sort());
  for (const type of ["emi", "loan", "savings_goal"]) assert.ok(s.transactions.some(t => t.originType === type && t.referenceType === undefined && t.referenceId === undefined));
  assert.equal(balance(s), 20);
  const r = A.buildAnalyticsReport(s, { from: "2026-11-01", to: today, currency: "SAR", includeDebt: true, includeSavings: true }, undefined, today);
  assert.equal(r.totals.expenses, 80); assert.equal(r.totals.income, 0);
  assert.equal(B.spending(s, { currency: "SAR", includeEMI: true, includeLoans: true, includeSavings: true, categories: [] }, "2026-11").total, 80);
});

test("loan proceeds are never earned income and funding survives loan removal", () => {
  let s = commit(base(), s => ({ ...s, loans: [loan()] }));
  s = commit(s, s => S.recordLoanFunding(s, "l", { id: "fund", accountId: "a", date: today }));
  const tx = s.transactions[0];
  assert.equal(balance(s), 200);
  s = commit(s, s => S.deleteDomainSource(s, "loan", "l"));
  assert.equal(balance(s), 200); assert.equal(s.transactions[0].id, tx.id);
  assert.equal(s.transactions[0].referenceType, undefined); assert.equal(s.transactions[0].originType, "loan");
  const r = A.buildAnalyticsReport(s, { from: "2026-11-01", to: today, currency: "SAR", includeDebt: true, includeSavings: false }, undefined, today);
  assert.equal(r.totals.income, 0); assert.equal(r.totals.expenses, 0);
});

test("source deletion, edit and reversal survive a lossless finance-store reload", async () => {
  const persistReload = async state => {
    const storage = new Map([[M.FINANCE_STORAGE_KEY, JSON.stringify(state)]]);
    return M.loadFinanceState({ getItem: async key => storage.get(key) ?? null, setItem: async (key, value) => { storage.set(key, value); } }, base());
  };
  let s = commit(base(), p => S.saveExpense(p, { ...expense(), isPaid: true, paidDate: today, accountId: "a" }));
  s = await persistReload(s);
  s = commit(s, p => S.deleteDomainSource(p, "expense", "e"));
  s = await persistReload(s);
  assert.equal(balance(s), 80); assert.equal(s.transactions.length, 1); assert.equal(s.transactions[0].paymentId, "e");

  s = commit(base(), p => ({ ...p, emis: [emi()] }));
  s = commit(s, p => S.confirmEMIPayment(p, "m", { amount: 50, paymentType: "monthly_emi", date: today, accountId: "a", operationId: "reload-emi" }));
  s = await persistReload(s);
  s = commit(s, p => S.updateEMIPayment(p, "m", "reload-emi", { date: "2026-11-10" }));
  s = await persistReload(s);
  assert.equal(s.transactions.length, 1); assert.equal(s.transactions[0].date, "2026-11-10"); assert.equal(balance(s), 50);
  s = commit(s, p => S.reverseEMIPayment(p, "m", "reload-emi"));
  s = await persistReload(s);
  assert.equal(s.transactions.length, 0); assert.equal(s.emis[0].paymentHistory.length, 0); assert.equal(balance(s), 100);
});

test("transfers remain paired and account deletion never drops confirmed or legacy history", () => {
  let s = commit(base(), p => S.recordTransfer(p, { id: "pair", sourceId: "a", destinationId: "b", amount: 25, date: today }));
  assert.equal(balance(s, "a"), 75); assert.equal(balance(s, "b"), 125);
  assert.throws(() => S.deleteAccount(s, "a"), /transactions or payment history/);
  assert.equal(S.deleteTransaction(s, "pair:out").transactions.length, 0);
  assert.equal(s.transactions.length, 2);

  const legacy = commit(base(), p => ({ ...p, loans: [{ ...loan(), payments: [{ id: "old", date: today, amount: 10, accountId: "a", legacy: true }] }] }));
  assert.throws(() => S.deleteAccount(legacy, "a"), /transactions or payment history/);
  assert.equal(legacy.loans[0].payments[0].accountId, "a");
});

test("deleting an account clears only future account choices and preserves schedules", () => {
  let s = R.saveRecurring(base(), {
    id: "r-account", name: "Phone", amount: 10, category: "Utilities", currency: "SAR",
    frequency: "monthly", startDate: today, nextDueDate: today, active: true,
    reminder: true, autoGenerate: true, color: "", iconName: "smartphone", accountId: "a",
  }, "future", today);
  s = { ...s,
    incomes: [{ ...receipt(), kind: "expected" }],
    expenses: [{ ...expense(), accountId: "a" }],
    emis: [{ ...emi(), linkedAccountId: "a" }],
    loans: [{ ...loan(), linkedAccountId: "a" }],
  };
  const next = commit(s, state => S.deleteAccount(state, "a"));
  assert.equal(next.accounts.some(a => a.id === "a"), false);
  assert.equal(next.incomes[0].accountId, undefined); assert.equal(next.expenses[0].accountId, undefined);
  assert.equal(next.emis[0].linkedAccountId, undefined); assert.equal(next.loans[0].linkedAccountId, undefined);
  assert.equal(next.planning.recurring[0].accountId, undefined);
  assert.equal(next.planning.occurrences.every(o => o.status !== "paid" && o.accountId === undefined), true);
  assert.equal(next.transactions.length, 0); assert.equal(balance(next, "b"), 100);
  assert.equal(next.planning.recurring[0].id, "r-account");
});

test("editing and reversing explicit payments stays idempotent after repeated saves", () => {
  let s = commit(base(), p => ({ ...p, loans: [loan()] }));
  s = commit(s, p => S.confirmLoanPayment(p, "l", { amount: 30, date: today, accountId: "a", operationId: "retry-payment" }));
  s = commit(s, p => S.confirmLoanPayment(p, "l", { amount: 30, date: today, accountId: "a", operationId: "retry-payment" }));
  assert.equal(s.transactions.length, 1); assert.equal(balance(s), 70);
  const edit = p => S.updateLoanPayment(p, "l", "retry-payment", { notes: "Same correction", accountId: "b" });
  s = commit(s, edit); s = commit(s, edit);
  assert.equal(s.transactions.length, 1); assert.equal(s.transactions[0].notes, "Same correction");
  assert.equal(balance(s), 100); assert.equal(balance(s, "b"), 70);
  const reverse = p => S.reverseLoanPayment(p, "l", "retry-payment");
  s = commit(s, reverse);
  assert.equal(balance(s, "b"), 100); assert.equal(s.transactions.length, 0);
  assert.equal(s.loans[0].payments.length, 0);
});
