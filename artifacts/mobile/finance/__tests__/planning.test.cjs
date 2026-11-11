const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};
const B = require("../budgets.ts"), C = require("../calendar.ts"), R = require("../recurring.ts");
const U = require("../upcoming.ts"), S = require("../service.ts"), M = require("../migration.ts");
const N = require("../reminderPlan.ts");
function base() {
  const state = { currency: "SAR", userName: "", monthlyBudget: 1000, budgetCurrency: "SAR",
    expenses: [], emis: [], loans: [], accounts: [{ id: "a", name: "Bank", balance: 0, openingBalance: 0, currency: "SAR", type: "bank" }],
    incomes: [], savingsGoals: [], transactions: [], schemaVersion: 2,
    notificationSettings: { enabled: true, timing: "same", emiEnabled: true, expenseEnabled: true, budgetEnabled: true, loanEnabled: true, balloonEnabled: true },
    securitySettings: {}, lastResetMonth: "", lastResetYear: "" };
  state.planning = B.initialPlanning(state, "2026-01-01");
  return state;
}
function spent(state, amount, category = "Food", date = "2026-01-10", id = "x") {
  return S.addManualMovement(state, { id, type: "expense", amount, category, date, description: id, accountId: "a", currency: "SAR" });
}
function recurring(overrides = {}) {
  return { id: "r", name: "Internet", amount: 100, currency: "SAR", category: "Utilities",
    frequency: "monthly", startDate: "2026-01-31", nextDueDate: "2026-01-31",
    active: true, reminder: true, autoGenerate: true, accountId: "a", color: "#2563EB", iconName: "wifi", ...overrides };
}
function schedule(state = base(), input = recurring(), today = "2026-01-01") {
  return R.saveRecurring(state, input, "future", today);
}
const budget = (s, month = "2026-01") => B.getBudgetView(s, month);
test("actual budget spending below, at and above limit", () => {
  for (const [amount, remaining, status] of [[500, 500, "normal"], [1000, 0, "exceeded"], [1200, -200, "exceeded"]]) {
    const view = budget(spent(base(), amount));
    assert.equal(view.spent, amount); assert.equal(view.remaining, remaining); assert.equal(view.status, status);
  }
});
test("consistent budget threshold boundaries", () => {
  assert.equal(B.budgetStatus(74.99, 100), "normal");
  assert.equal(B.budgetStatus(75, 100), "approaching"); assert.equal(B.budgetStatus(90, 100), "near");
  assert.equal(B.budgetStatus(100, 100), "exceeded"); assert.equal(B.budgetStatus(10, 0), "unset");
});
test("category budgets use aliases without rewriting ledger categories", () => {
  const s = spent(base(), 80);
  s.planning.plans[0].categories.find(c => c.name === "Food and Dining").limit = 100;
  const view = budget(s), food = view.categories.find(c => c.name === "Food and Dining");
  assert.equal(food.spent, 80); assert.equal(food.remaining, 20); assert.equal(food.status, "approaching");
  assert.equal(s.transactions[0].category, "Food");
});
test("transfers, income, adjustments and savings are excluded by default", () => {
  const s = spent(base(), 50);
  s.transactions.push(...["transfer", "income", "adjustment", "savings_contribution"].map((type, i) => ({ ...s.transactions[0], id: type, type, amount: 100, operationId: `other${i}` })));
  assert.equal(budget(s).spent, 50);
  s.planning.plans[0].includeSavings = true; assert.equal(budget(s).spent, 150);
});
test("EMI and balloon inclusion is explicit and counted once", () => {
  const s = spent(base(), 25);
  for (const type of ["emi_payment", "balloon_payment"]) s.transactions.push({ ...s.transactions[0], id: type, operationId: type, type, amount: 100 });
  assert.equal(budget(s).spent, 25);
  s.planning.plans[0].includeEMI = true; assert.equal(budget(s).spent, 225);
});
test("loan repayments require inclusion or an explicitly budgeted debt category; principal is never ordinary spend", () => {
  const s = spent(base(), 10);
  s.transactions.push({ ...s.transactions[0], id: "loan", type: "loan_repayment", category: "Loan payment", amount: 100 });
  s.transactions.push({ ...s.transactions[0], id: "funding", referenceType: "loan", amount: 1000 });
  assert.equal(budget(s).spent, 10);
  s.planning.plans[0].categories.find(c => c.name === "Debt repayments").limit = 200;
  assert.equal(budget(s).spent, 110);
});
test("budget re-computes actuals after transaction edits and deletion", () => {
  const s = spent(base(), 100), id = s.transactions[0].id;
  const edited = S.updateTransaction(s, id, { amount: 60 });
  assert.equal(budget(edited).spent, 60); assert.equal(budget(S.deleteTransaction(edited, id)).spent, 0);
});
test("month and currency isolation excludes neighboring periods", () => {
  let s = spent(base(), 100);
  s = spent(s, 200, "Food", "2026-02-01", "feb");
  s.transactions.push({ ...s.transactions[0], id: "USD", currency: "USD", amount: 500 });
  assert.equal(budget(s).spent, 100); assert.equal(budget(s, "2026-02").spent, 200);
});
test("month-end and leap-year calendar navigation stays local and anchored", () => {
  assert.equal(C.addMonths("2024-01-31", 1), "2024-02-29");
  assert.equal(C.addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(C.addMonths("2026-01-31", 2), "2026-03-31");
  assert.equal(C.monthBounds("2024-02").days, 29); assert.equal(C.shiftMonth("2026-12", 1), "2027-01");
});
test("category rollover snapshots unused funds exactly once and freezes carry after a historical correction", () => {
  let s = spent(base(), 60); const plan = s.planning.plans[0]; plan.mode = "rollover";
  const food = plan.categories.find(c => c.name === "Food and Dining"); food.limit = 100; food.rollover = true;
  s = B.ensureBudgetPeriod(s, "2026-02");
  const feb = budget(s, "2026-02");
  assert.equal(feb.period.limit, 1040); assert.equal(feb.categories.find(c => c.id === food.id).limit, 140);
  assert.deepEqual(B.ensureBudgetPeriod(s, "2026-02"), s);
  s = S.updateTransaction(s, s.transactions[0].id, { amount: 50 });
  assert.equal(budget(s, "2026-02").period.limit, 1040);
});
test("negative category balances roll only with explicit deficit carry-forward", () => {
  for (const carryDeficit of [false, true]) {
    const s = spent(base(), 150); const p = s.planning.plans[0]; p.mode = "rollover"; p.carryDeficit = carryDeficit;
    p.categories.find(c => c.name === "Food and Dining").limit = 100;
    p.categories.find(c => c.name === "Food and Dining").rollover = true;
    assert.equal(budget(s, "2026-02").period.limit, carryDeficit ? 950 : 1000);
  }
});
test("fixed budgets repeat; custom periods do not silently copy money", () => {
  const fixed = base(); assert.equal(budget(fixed, "2026-02").period.limit, 1000);
  const custom = base(); custom.planning.plans[0].mode = "custom";
  assert.equal(budget(custom, "2026-02").period.limit, 0);
});
test("editing an earlier month cannot change the current budget template", () => {
  const s = base(), view = budget(s);
  const edited = B.saveBudget(s, "2026-01", { ...view.period, limit: 400 });
  assert.equal(budget(edited).period.limit, 400); assert.equal(edited.planning.plans[0].limit, 1000);
});
test("custom budget categories persist and duplicates are rejected", () => {
  const s = base(), p = budget(s).period;
  const custom = { id: "pet", name: "Pets", icon: "heart", color: "#2563EB", limit: 100, rollover: false, alerts: false };
  const next = B.saveBudget(s, "2026-01", { ...p, categories: [...p.categories, custom] });
  assert.equal(budget(next).categories.find(c => c.id === "pet").limit, 100);
  assert.throws(() => B.saveBudget(s, "2026-01", { ...p, categories: [...p.categories, { ...custom, name: "Food" }] }), /unique/);
});
test("monthly recurrence preserves the original month-end day", () => {
  assert.deepEqual(R.scheduleDates(recurring(), "2026-01-01", "2026-04-30"), ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
});
test("weekly, quarterly, annual and custom intervals use calendar-safe dates", () => {
  assert.deepEqual(R.scheduleDates(recurring({ frequency: "weekly", startDate: "2026-12-25" }), "2026-12-25", "2027-01-10"), ["2026-12-25", "2027-01-01", "2027-01-08"]);
  assert.deepEqual(R.scheduleDates(recurring({ frequency: "quarterly" }), "2026-01-01", "2026-08-01"), ["2026-01-31", "2026-04-30", "2026-07-31"]);
  assert.deepEqual(R.scheduleDates(recurring({ frequency: "annual", startDate: "2024-02-29" }), "2024-01-01", "2028-03-01"), ["2024-02-29", "2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"]);
  assert.deepEqual(R.scheduleDates(recurring({ frequency: "custom", interval: 2, intervalUnit: "day" }), "2026-01-31", "2026-02-05"), ["2026-01-31", "2026-02-02", "2026-02-04"]);
});
test("due generation is idempotent and unpaid occurrences never move money", () => {
  let s = schedule(); s = R.generateDueOccurrences(s, "2026-03-31");
  assert.equal(s.planning.occurrences.length, 3); assert.equal(s.transactions.length, 0);
  assert.equal(S.balances(s)[0].balance, 0);
  assert.deepEqual(R.generateDueOccurrences(s, "2026-03-31"), s);
  assert.equal(s.planning.recurring[0].nextDueDate, "2026-04-30");
});
test("confirming recurring payment twice creates one expense and one transaction", () => {
  const s = schedule(), input = { accountId: "a", date: "2026-01-31" };
  const paid = R.payRecurring(s, "r", "2026-01-31", input);
  const twice = R.payRecurring(paid, "r", "2026-01-31", input);
  assert.equal(twice.transactions.length, 1); assert.equal(twice.expenses.length, 1);
  assert.equal(S.balances(twice)[0].balance, -100); assert.equal(twice.planning.occurrences[0].status, "paid");
});
test("future-only editing preserves pending snapshots and paid transactions", () => {
  let s = R.generateDueOccurrences(schedule(), "2026-02-28");
  s = R.payRecurring(s, "r", "2026-01-31", { accountId: "a", date: "2026-01-31" });
  const before = JSON.stringify(s.transactions);
  s = R.saveRecurring(s, { ...s.planning.recurring[0], amount: 200 }, "future", "2026-02-28");
  assert.equal(s.planning.occurrences.find(o => o.dueDate === "2026-02-28").amount, 100);
  assert.equal(U.getUpcoming(s, "2026-03-01", "2026-03-31")[0].amount, 200); assert.equal(JSON.stringify(s.transactions), before);
  s = R.saveRecurring(s, { ...s.planning.recurring[0], amount: 250 }, "pending", "2026-02-28");
  assert.equal(s.planning.occurrences.find(o => o.dueDate === "2026-02-28").amount, 250);
  assert.equal(JSON.stringify(s.transactions), before);
});
test("pause and resume skip the paused interval without retroactive charges", () => {
  let s = R.setRecurringActive(schedule(), "r", false, "2026-01-01");
  s = R.generateDueOccurrences(s, "2026-04-30"); assert.equal(s.planning.occurrences.length, 0);
  s = R.setRecurringActive(s, "r", true, "2026-05-15");
  assert.equal(s.planning.recurring[0].nextDueDate, "2026-05-31"); assert.equal(s.transactions.length, 0);
});
test("skip preserves history, advances schedule and can pause without payment", () => {
  let s = R.skipRecurring(schedule(), "r", "2026-01-31");
  assert.equal(s.planning.occurrences[0].status, "skipped"); assert.equal(s.transactions.length, 0);
  assert.equal(s.planning.recurring[0].nextDueDate, "2026-02-28");
  s = R.skipRecurring(s, "r", "2026-02-28", true); assert.equal(s.planning.recurring[0].active, false);
});
test("archiving preserves paid histories and stops future generation/reminders", () => {
  let s = R.payRecurring(schedule(), "r", "2026-01-31", { accountId: "a", date: "2026-01-31" });
  s = R.deleteRecurring(s, "r"); s = R.generateDueOccurrences(s, "2026-05-31");
  assert.equal(s.transactions.length, 1); assert.equal(s.planning.occurrences.length, 1);
  assert.equal(U.getUpcoming(s, "2026-01-01", "2026-06-30").length, 1);
});
test("actual payment reversal updates its occurrence without changing the definition", () => {
  let s = R.payRecurring(schedule(), "r", "2026-01-31", { accountId: "a", date: "2026-01-31" });
  s = R.synchronizeOccurrences(S.deleteTransaction(s, s.transactions[0].id));
  assert.equal(s.planning.occurrences[0].status, "pending"); assert.equal(s.planning.recurring[0].amount, 100);
});
test("auto-generation disabled keeps future schedule visible without pending records", () => {
  const s = schedule(base(), recurring({ autoGenerate: false }));
  assert.equal(R.generateDueOccurrences(s, "2026-03-31").planning.occurrences.length, 0);
  assert.equal(U.getUpcoming(s, "2026-01-01", "2026-03-31").length, 3);
});
test("upcoming combines EMI, balloon, recurring and explicit loan schedules in date order", () => {
  let s = schedule();
  s.emis = [{ id: "e", name: "Car", currency: "SAR", firstPaymentDate: "2026-01-20", paymentDueDay: 20,
    totalInstallments: 2, durationMonths: 2, paidInstallments: 0, monthlyAmount: 200, balloonPaymentAmount: 400, balloonPaymentDueDate: "2026-02-28", paymentHistory: [] }];
  s.loans = [{ id: "l", name: "Loan", currency: "SAR", direction: "borrowed", principalAmount: 100, startDate: "2026-01-01",
    repaymentStartDate: "2026-01-25", repaymentFrequency: "monthly", plannedPaymentAmount: 50, payments: [] }];
  const all = U.getUpcoming(s, "2026-01-01", "2026-02-28", "2026-01-25");
  assert.equal(all.length, 7); assert.deepEqual([...new Set(all.map(i => i.type))].sort(), ["balloon", "emi", "expense", "loan"]);
  assert.deepEqual(all.map(i => i.dueDate), [...all.map(i => i.dueDate)].sort());
  assert.equal(all[0].status, "overdue"); assert.equal(all[1].status, "due_today");
  assert.equal(U.filterUpcoming(all, "balloon", "2026-02-01", "2026-02-28").length, 1);
});
test("loan origination alone is never assumed to be a repayment schedule", () => {
  const s = base(); s.loans = [{ id: "l", name: "Loan", principalAmount: 1000, startDate: "2026-01-01", plannedPaymentAmount: 100, repaymentFrequency: "monthly", payments: [] }];
  assert.equal(U.getUpcoming(s, "2026-01-01", "2026-12-31").length, 0);
});
test("upcoming exposes paid/skipped status and handles missing linked accounts", () => {
  let s = R.skipRecurring(schedule(), "r", "2026-01-31");
  s = R.payRecurring(s, "r", "2026-02-28", { date: "2026-02-28" });
  s.accounts = [];
  const all = U.getUpcoming(s, "2026-01-01", "2026-02-28");
  assert.equal(all[0].status, "skipped"); assert.equal(all[1].status, "paid"); assert.equal(all[1].accountId, undefined);
});
test("schema 1 to 2 migration preserves ledger, old flags, budget and incomplete recurrence", async () => {
  let s = spent(base(), 123); delete s.planning; s.schemaVersion = 1;
  s.expenses[0].recurrence = "monthly"; const raw = JSON.stringify(s), map = new Map([[M.FINANCE_STORAGE_KEY, raw]]);
  const storage = { getItem: async k => map.get(k) ?? null, setItem: async (k, v) => map.set(k, v) };
  const first = await M.loadFinanceState(storage, base());
  assert.deepEqual(first.transactions, JSON.parse(JSON.stringify(s.transactions))); assert.equal(first.monthlyBudget, 1000);
  assert.equal(first.expenses[0].isPaid, true); assert.equal(first.planning.recurring.length, 0);
  assert.equal(map.get(M.PLANNING_BACKUP_KEY), raw);
  assert.deepEqual(await M.loadFinanceState(storage, base()), first);
});
test("planning round-trip preserves occurrence histories without extra charges", () => {
  const s = R.payRecurring(schedule(), "r", "2026-01-31", { date: "2026-01-31", accountId: "a" });
  const loaded = M.migrateFinanceState(JSON.stringify(s), base());
  assert.deepEqual(loaded.transactions, JSON.parse(JSON.stringify(s.transactions)));
  assert.deepEqual(loaded.planning, JSON.parse(JSON.stringify(s.planning)));
});
function notificationHarness(allowed = true) {
  const scheduled = new Map(), values = new Map(), calls = { schedule: 0, cancel: 0, permission: 0 };
  const adapter = {
    permission: async () => { calls.permission++; return allowed; },
    list: async () => [...scheduled.values()].map(r => ({ id: r.id, data: r.data })),
    schedule: async r => { calls.schedule++; scheduled.set(r.id, r); },
    cancel: async id => { calls.cancel++; scheduled.delete(id); },
  };
  const storage = { getItem: async k => values.get(k) ?? null, setItem: async (k, v) => values.set(k, v) };
  return { sync: N.createReminderSynchronizer(adapter, storage), scheduled, values, calls };
}
const clock = new Date(2026, 10, 10, 8);
function reminderState() { return schedule(base(), recurring({ startDate: "2026-11-11", nextDueDate: "2026-11-11" }), "2026-11-01"); }
test("reminders support due day, 1, 3 and 7 days before using local 09:00", () => {
  for (const [timing, days] of [["same", 0], ["1day", 1], ["3days", 3], ["7days", 7]]) {
    const s = schedule(base(), recurring({ startDate: "2026-11-17", nextDueDate: "2026-11-17" }), "2026-11-01");
    s.notificationSettings.timing = timing;
    const first = N.buildReminderPlan(s, new Set(), clock).find(r => r.data.type === "expense");
    assert.equal(new Date(first.timestamp).getDate(), 17 - days); assert.equal(new Date(first.timestamp).getHours(), 9);
  }
});
test("reminder reconciliation never duplicates unchanged scheduled IDs", async () => {
  const h = notificationHarness(), s = reminderState(); await h.sync(s, clock); const count = h.calls.schedule;
  await h.sync(s, clock); assert.equal(h.calls.schedule, count); assert.equal(h.calls.cancel, 0);
});
test("paid, skipped and paused occurrences cancel their outstanding reminders", async () => {
  for (const action of ["paid", "skipped", "paused"]) {
    const h = notificationHarness(), s = reminderState(); await h.sync(s, clock);
    const next = action === "paid" ? R.payRecurring(s, "r", "2026-11-11", { date: "2026-11-11" })
      : action === "skipped" ? R.skipRecurring(s, "r", "2026-11-11") : R.setRecurringActive(s, "r", false);
    await h.sync(next, clock);
    assert.ok(![...h.scheduled.values()].some(r => r.data.dueDate === "2026-11-11"));
  }
});
test("disabled notifications and denied permission cannot schedule reminders", async () => {
  const denied = notificationHarness(false); await denied.sync(reminderState(), clock); assert.equal(denied.calls.schedule, 0);
  const h = notificationHarness(), s = reminderState(); await h.sync(s, clock);
  s.notificationSettings.enabled = false; await h.sync(s, clock); assert.equal(h.scheduled.size, 0);
});
test("budget thresholds alert once per period even after spending drops and rises", async () => {
  const h = notificationHarness(); let s = spent(base(), 80, "Food", "2026-11-10");
  s.planning.plans[0].limit = 100;
  await h.sync(s, clock); assert.equal(h.calls.schedule, 1);
  await h.sync(s, clock); assert.equal(h.calls.schedule, 1);
  s = S.updateTransaction(s, s.transactions[0].id, { amount: 20 }); await h.sync(s, clock);
  s = S.updateTransaction(s, s.transactions[0].id, { amount: 80 }); await h.sync(s, clock);
  assert.equal(h.calls.schedule, 1);
  s = S.updateTransaction(s, s.transactions[0].id, { amount: 100 }); await h.sync(s, clock); assert.equal(h.calls.schedule, 3);
});
test("per-category disabled alerts and excluded transfers never alert", async () => {
  const s = base(); s.planning.plans[0].categories.find(c => c.name === "Food and Dining").limit = 100;
  s.planning.plans[0].categories.find(c => c.name === "Food and Dining").alerts = false;
  const next = spent(s, 80, "Food", "2026-11-10"), h = notificationHarness();
  await h.sync(next, clock); assert.equal(h.calls.schedule, 0);
  next.transactions[0].type = "transfer"; await h.sync(next, clock); assert.equal(h.calls.schedule, 0);
});
test("rollover editor totals do not compound carry into the fixed monthly base", () => {
  const month = require("../ledger.ts").localDate().slice(0, 7), prior = C.shiftMonth(month, -1);
  let s = base(); s.planning.plans[0].startMonth = prior; s.planning.plans[0].mode = "rollover";
  const category = s.planning.plans[0].categories.find(c => c.name === "Food and Dining"); category.limit = 100; category.rollover = true;
  s = spent(s, 60, "Food", `${prior}-10`); s = B.ensureBudgetPeriod(s, month);
  s = B.saveBudget(s, month, { ...budget(s, month).period });
  assert.equal(s.planning.plans[0].limit, 1000);
  assert.equal(s.planning.plans[0].categories.find(c => c.id === category.id).limit, 100);
  assert.equal(budget(s, month).period.limit, 1040);
});
test("explicit deficit carry retains amounts larger than the next base limit across restart", () => {
  let s = spent(base(), 400); const p = s.planning.plans[0]; p.mode = "rollover"; p.carryDeficit = true;
  p.categories.find(c => c.name === "Food and Dining").limit = 100; p.categories.find(c => c.name === "Food and Dining").rollover = true;
  s = B.ensureBudgetPeriod(s, "2026-02");
  assert.equal(budget(s, "2026-02").categories.find(c => c.name === "Food and Dining").limit, -200);
  const loaded = M.migrateFinanceState(JSON.stringify(s), base());
  assert.equal(budget(loaded, "2026-02").categories.find(c => c.name === "Food and Dining").limit, -200);
});
test("editing fixed current template refreshes auto-created future periods but preserves custom ones", () => {
  const month = require("../ledger.ts").localDate().slice(0, 7), future = C.shiftMonth(month, 1);
  let s = B.ensureBudgetPeriod(base(), future);
  s = B.saveBudget(s, month, { ...budget(s, month).period, limit: 1500 });
  assert.equal(budget(s, future).period.limit, 1500);
  s = B.saveBudget(s, future, { ...budget(s, future).period, limit: 1800 });
  s = B.saveBudget(s, month, { ...budget(s, month).period, limit: 1600 });
  assert.equal(budget(s, future).period.limit, 1800);
});
test("long custom intervals keep their calendar cursor rather than creating daily duplicates", () => {
  let s = schedule(base(), recurring({ frequency: "custom", interval: 24, intervalUnit: "month" }));
  s = R.generateDueOccurrences(s, "2026-01-31");
  assert.equal(s.planning.recurring[0].nextDueDate, "2028-01-31");
  assert.equal(s.planning.occurrences.length, 1);
});
test("existing due occurrence can be settled while future recurrence is paused", () => {
  let s = R.generateDueOccurrences(schedule(), "2026-01-31");
  s = R.setRecurringActive(s, "r", false, "2026-02-01");
  s = R.payRecurring(s, "r", "2026-01-31", { date: "2026-02-01", accountId: "a" });
  assert.equal(s.planning.occurrences[0].status, "paid"); assert.equal(s.planning.recurring[0].active, false);
});
test("scheduled balloon permits distinct partial payments but repeated submission is idempotent", () => {
  let s = base(); s.emis = [{ id: "e", name: "Car", totalAmount: 1000, monthlyAmount: 100, totalInstallments: 10,
    paidInstallments: 0, paymentHistory: [], balloonPaymentAmount: 200, balloonPaymentDueDate: "2026-02-28" }];
  const item = U.getUpcoming(s, "2026-02-28", "2026-02-28")[0];
  s = U.recordScheduledPayment(s, item, "a", "2026-02-28", 50, "first");
  s = U.recordScheduledPayment(s, item, "a", "2026-02-28", 50, "first");
  assert.equal(s.transactions.length, 1);
  assert.equal(U.getUpcoming(s, "2026-02-28", "2026-02-28")[0].amount, 150);
  s = U.recordScheduledPayment(s, item, "a", "2026-02-28", 75, "second");
  assert.equal(s.transactions.length, 2);
  assert.equal(U.getUpcoming(s, "2026-02-28", "2026-02-28")[0].amount, 75);
});
test("scheduled loan partials preserve the installment remainder and reject excessive payments", () => {
  let s = base(); s.loans = [{ id: "l", name: "Loan", currency: "SAR", direction: "borrowed", principalAmount: 1000,
    repaymentStartDate: "2026-01-31", repaymentFrequency: "monthly", plannedPaymentAmount: 100, payments: [] }];
  const item = U.getUpcoming(s, "2026-01-31", "2026-01-31")[0];
  s = U.recordScheduledPayment(s, item, "a", "2026-01-31", 40, "one");
  assert.equal(U.getUpcoming(s, "2026-01-31", "2026-01-31")[0].amount, 60);
  assert.throws(() => U.recordScheduledPayment(s, item, "a", "2026-01-31", 100, "two"), /remaining/);
  s = U.recordScheduledPayment(s, item, "a", "2026-01-31", 60, "two");
  assert.equal(U.getUpcoming(s, "2026-01-31", "2026-01-31")[0].status, "paid");
  assert.equal(s.transactions.length, 2);
});
test("turning off a budget threshold cancels its pending alert without erasing its receipt", async () => {
  const h = notificationHarness(); let s = spent(base(), 80, "Food", "2026-11-10");
  s.planning.plans[0].limit = 100; s = B.ensureBudgetPeriod(s, "2026-11");
  await h.sync(s, clock); assert.equal(h.scheduled.size, 1);
  s.planning.periods.find(p => p.month === "2026-11").thresholds = [];
  await h.sync(s, clock); assert.equal(h.scheduled.size, 0);
  const receipts = JSON.parse(h.values.get(N.ALERT_RECEIPTS_KEY)); assert.equal(receipts.length, 1);
});
test("future rollover previews track actual spending until the new month starts, then freeze", () => {
  const current = require("../ledger.ts").localDate().slice(0, 7), future = C.shiftMonth(current, 1);
  let s = base(); const p = s.planning.plans[0]; p.startMonth = current; p.mode = "rollover";
  p.categories.find(c => c.name === "Food and Dining").limit = 100; p.categories.find(c => c.name === "Food and Dining").rollover = true;
  s = spent(s, 60, "Food", `${current}-01`);
  s = B.ensureBudgetPeriod(s, future);
  assert.equal(budget(s, future).period.limit, 1040); assert.equal(budget(s, future).period.carryFinalized, false);
  s = spent(s, 30, "Food", `${current}-02`, "second");
  assert.equal(budget(s, future).period.limit, 1010);
  assert.equal(budget(s, C.shiftMonth(future, 1)).period.limit, 1110);
  s = B.ensureBudgetPeriod(s, future, "SAR", `${future}-01`);
  assert.equal(budget(s, future).period.carryFinalized, true); assert.equal(budget(s, future).period.limit, 1010);
  s = S.updateTransaction(s, s.transactions[0].id, { amount: 20 });
  assert.equal(budget(s, future).period.limit, 1010);
});
