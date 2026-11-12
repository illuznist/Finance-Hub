const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

const F = require("../forecast.ts");
const U = require("../upcoming.ts");
const L = require("../ledger.ts");
const B = require("../budgets.ts");
const today = "2026-11-12";

function account(id, openingBalance, currency = "SAR") {
  return { id, name: `Account ${id}`, type: "bank", balance: openingBalance, openingBalance, currency, color: "#2563EB" };
}

function base(accounts = [account("a", 1000)]) {
  return {
    currency: "SAR", userName: "", monthlyBudget: 0, accounts, expenses: [], emis: [], loans: [],
    incomes: [], savingsGoals: [], transactions: [], notificationSettings: {}, securitySettings: {},
    lastResetMonth: "", lastResetYear: "", schemaVersion: 2,
    planning: { version: 1, plans: [], periods: [], recurring: [], occurrences: [] },
  };
}

function forecast(state, overrides = {}) {
  return F.buildCashFlowForecast(state, {
    currency: "SAR", range: { from: today, to: "2026-11-18" }, mode: "conservative", today, ...overrides,
  });
}

function recurring(overrides = {}) {
  return {
    id: "r", name: "Internet", amount: 30, currency: "SAR", category: "Subscriptions",
    iconName: "wifi", color: "#2563EB", accountId: "a", frequency: "monthly",
    startDate: "2026-11-14", nextDueDate: "2026-11-14", active: true, reminder: false,
    autoGenerate: false, ...overrides,
  };
}

function emi(overrides = {}) {
  return {
    id: "e", name: "Car", currency: "SAR", totalAmount: 200, monthlyAmount: 100,
    monthlyEMIAmount: 100, totalInstallments: 2, durationMonths: 2, paidInstallments: 0,
    startMonth: "2026-11", dueDayOfMonth: 13, firstPaymentDate: "2026-11-13",
    dueDayOfMonth: 13, paymentDueDay: 13, linkedAccountId: "a", color: "#2563EB", iconName: "car",
    paymentHistory: [], ...overrides,
  };
}

test("7, 30, 60, and 90-day horizons use exact inclusive local-date boundaries", () => {
  for (const [preset, end] of [["7", "2026-11-18"], ["30", "2026-12-11"], ["60", "2027-01-10"], ["90", "2027-02-09"]]) {
    assert.deepEqual(F.forecastRange(preset, today), { from: today, to: end });
  }
  assert.deepEqual(F.forecastRange("custom", today, { from: "2026-12-01", to: "2026-12-31" }), {
    from: "2026-12-01", to: "2026-12-31",
  });
  assert.throws(() => F.forecastRange("custom", today, { from: "2026-11-11", to: "2026-11-18" }), /starting today/);
  assert.throws(() => F.forecastRange("custom", today, { from: "2026-12-31", to: "2026-12-01" }), /starting today/);
});

test("expected mode includes only explicitly dated expected income and never posts it", () => {
  const state = base();
  state.incomes = [
    { id: "dated", name: "Salary", amount: 500, currency: "SAR", kind: "expected", date: "2026-11-14", accountId: "a" },
    { id: "undated", name: "Unconfirmed", amount: 900, currency: "SAR", kind: "expected" },
    { id: "received", name: "Already received", amount: 700, currency: "SAR", kind: "received", date: "2026-11-15", accountId: "a" },
  ];
  const conservative = forecast(state);
  const expected = forecast(state, { mode: "expected" });
  assert.equal(conservative.expectedInflows, 500);
  assert.equal(conservative.projectedEndingBalance, 1000);
  assert.equal(conservative.events.some(e => e.kind === "expected-income"), false);
  assert.equal(expected.expectedInflows, 500);
  assert.equal(expected.projectedEndingBalance, 1500);
  assert.deepEqual(state.transactions, []);
  assert.equal(expected.events.filter(e => e.kind === "expected-income").length, 1);
});

test("custom windows carry forward known movements before the selected start date", () => {
  const state = base();
  state.planning.recurring = [recurring({ amount: 30 })];
  state.incomes = [{
    id: "salary", name: "Salary", amount: 200, currency: "SAR",
    kind: "expected", date: "2026-11-16", accountId: "a",
  }];
  const range = { from: "2026-11-20", to: "2026-11-25" };
  const conservative = forecast(state, { range, mode: "conservative" });
  const expected = forecast(state, { range, mode: "expected" });
  assert.equal(conservative.currentAvailable, 1000);
  assert.equal(conservative.expectedInflows, 0);
  assert.equal(conservative.scheduledOutflows, 0);
  assert.equal(conservative.projectedEndingBalance, 970);
  assert.equal(conservative.events.length, 0);
  assert.equal(conservative.points[0].date, range.from);
  assert.equal(conservative.points[0].balance, 970);
  assert.equal(expected.projectedEndingBalance, 1170);
  assert.equal(expected.expectedInflows, 0);
  assert.equal(expected.points[0].balance, 1170);
  assert.deepEqual(state.transactions, []);

  const shortfallState = base([account("a", 20)]);
  shortfallState.planning.recurring = [recurring({ amount: 50 })];
  const shortfall = forecast(shortfallState, { range });
  assert.equal(shortfall.events.length, 0);
  assert.equal(shortfall.shortfall.date, "2026-11-14");
  assert.equal(shortfall.projectedEndingBalance, -30);
  assert.equal(shortfall.points[0].balance, -30);
});

test("partially paid EMI, balloon, and loan schedules forecast only remaining amounts", () => {
  const state = base();
  state.emis = [emi({
    balloonPaymentAmount: 200, balloonPaymentDueDate: "2026-11-14",
    paymentHistory: [
      { id: "partial", amount: 30, paymentType: "monthly_emi", status: "paid", scheduledDueDate: "2026-11-13" },
      { id: "balloon-partial", amount: 50, paymentType: "balloon", status: "paid" },
    ],
  })];
  state.loans = [{
    id: "l", name: "Car loan", direction: "borrowed", currency: "SAR", counterpartyName: "Bank",
    sourceType: "bank", category: "vehicle", principalAmount: 100, totalRepaymentAmount: 120,
    startDate: "2026-11-01", repaymentStartDate: "2026-11-15", expectedEndDate: "2026-12-15",
    repaymentFrequency: "monthly", plannedPaymentAmount: 60, payments: [
      { id: "loan-partial", amount: 10, date: "2026-11-12", scheduledDueDate: "2026-11-15" },
    ], notes: "", createdAt: "2026-11-01T00:00:00.000Z", linkedAccountId: "a",
  }];
  const upcoming = U.getUpcoming(state, today, "2026-11-18", today);
  assert.equal(upcoming.find(e => e.id === "emi:e:2026-11-13").amount, 70);
  assert.equal(upcoming.find(e => e.id === "balloon:e:2026-11-14").amount, 150);
  assert.equal(upcoming.find(e => e.id === "loan:l:2026-11-15").amount, 50);
  const result = forecast(state);
  assert.equal(result.scheduledOutflows, 270);
  assert.equal(result.projectedEndingBalance, 730);
});

test("recurring occurrences are deduplicated and paid or skipped items are excluded", () => {
  const state = base();
  state.planning.recurring = [recurring()];
  state.planning.occurrences = [{
    id: "rec:r:2026-11-14", recurringId: "r", dueDate: "2026-11-14", name: "Internet",
    amount: 30, currency: "SAR", category: "Subscriptions", iconName: "wifi", color: "#2563EB",
    accountId: "a", status: "pending",
  }];
  let result = forecast(state);
  assert.equal(result.events.filter(e => e.id === "rec:r:2026-11-14").length, 1);
  assert.equal(result.scheduledOutflows, 30);
  state.planning.occurrences[0].status = "paid";
  result = forecast(state);
  assert.equal(result.events.length, 0);
  assert.equal(result.projectedEndingBalance, 1000);
  state.planning.recurring[0].active = false;
  state.planning.occurrences[0].status = "skipped";
  assert.equal(forecast(state).events.length, 0);
});

test("forecast does not invent missing schedule dates or replay completed transactions", () => {
  const state = base();
  state.emis = [emi({ firstPaymentDate: undefined, paymentHistory: [{ id: "old", amount: 100, paymentType: "monthly_emi", status: "paid" }] })];
  state.transactions = [{
    id: "posted", operationId: "posted", amount: 100, currency: "SAR", date: today,
    description: "Completed payment", category: "Debt repayments", accountId: "a", type: "emi_payment",
    direction: "out", createdAt: "2026-11-12T10:00:00Z",
  }];
  const before = JSON.stringify(state);
  const result = forecast(state);
  assert.equal(result.currentAvailable, 900);
  assert.equal(result.events.length, 0);
  assert.equal(result.projectedEndingBalance, 900);
  assert.equal(JSON.stringify(state), before);
});

test("invalid schedule and expected-income dates are safely excluded", () => {
  const state = base();
  state.planning.recurring = [recurring({ startDate: "2026-02-31", nextDueDate: "2026-11-14" })];
  state.planning.occurrences = [{
    id: "bad-occurrence", recurringId: "r", dueDate: "2026-02-31", name: "Invalid",
    amount: 40, currency: "SAR", category: "Bills", iconName: "repeat", color: "#2563EB",
    accountId: "a", status: "pending",
  }];
  state.emis = [emi({
    firstPaymentDate: "2026-02-31",
    balloonPaymentAmount: 50,
    balloonPaymentDueDate: "2026-02-31",
  })];
  state.loans = [{
    id: "l", name: "Invalid loan", direction: "borrowed", currency: "SAR", counterpartyName: "Bank",
    sourceType: "bank", category: "personal", principalAmount: 100, totalRepaymentAmount: 100,
    startDate: today, repaymentStartDate: "2026-02-31", repaymentFrequency: "one-time",
    payments: [], notes: "", createdAt: "2026-11-01T00:00:00.000Z", linkedAccountId: "a",
  }];
  state.incomes = [{ id: "bad-income", name: "Invalid", amount: 100, currency: "SAR", kind: "expected", date: "2026-02-31", accountId: "a" }];
  assert.deepEqual(forecast(state, { mode: "expected" }).events, []);
});

test("currency and account balances remain isolated; unknown-account outflows stay unallocated", () => {
  const state = base([account("sar", 100, "SAR"), account("usd", 500, "USD")]);
  state.planning.recurring = [recurring({ accountId: undefined, currency: "SAR", amount: 25 })];
  const sar = forecast(state, { currency: "SAR" });
  const usd = forecast(state, { currency: "USD" });
  assert.equal(sar.currentAvailable, 100);
  assert.equal(sar.projectedEndingBalance, 100);
  assert.equal(sar.unallocatedOutflows, 25);
  assert.equal(usd.currentAvailable, 500);
  assert.equal(usd.events.length, 0);
});

test("recorded transfers change account projections without changing same-currency total cash", () => {
  const state = base([account("from", 300), account("to", 50), account("usd", 900, "USD")]);
  const [outgoing, incoming] = L.transferEntries({
    id: "move", source: { id: "from", openingBalance: 300, currency: "SAR" },
    destination: { id: "to", openingBalance: 50, currency: "SAR" },
    amount: 75, date: today,
  });
  state.transactions = [outgoing, incoming];
  const sar = forecast(state);
  const usd = forecast(state, { currency: "USD" });
  assert.equal(sar.currentAvailable, 350);
  assert.equal(sar.projectedEndingBalance, 350);
  assert.equal(sar.events.length, 0);
  assert.equal(usd.currentAvailable, 900);
  assert.equal(usd.projectedEndingBalance, 900);
});

test("shortfalls use account-level balances and same-day movements are netted together", () => {
  const state = base([account("a", 20)]);
  state.planning.recurring = [recurring({ amount: 50 })];
  const result = forecast(state);
  assert.deepEqual(
    { date: result.shortfall.date, accountId: result.shortfall.accountId, balance: result.shortfall.balance, required: result.shortfall.amountRequired },
    { date: "2026-11-14", accountId: "a", balance: -30, required: 30 },
  );
  assert.equal(result.nextPayment.id, "rec:r:2026-11-14");

  const sameDay = base([account("a", 100)]);
  sameDay.planning.recurring = [recurring({ amount: 100 })];
  sameDay.loans = [{
    id: "lent", name: "Repayment received", direction: "lent", currency: "SAR", counterpartyName: "Person",
    sourceType: "person", category: "family", principalAmount: 100, totalRepaymentAmount: 100,
    startDate: today, repaymentStartDate: "2026-11-14", repaymentFrequency: "one-time",
    payments: [], notes: "", createdAt: "2026-11-01T00:00:00.000Z", linkedAccountId: "a",
  }];
  const netted = forecast(sameDay);
  assert.equal(netted.shortfall, null);
  assert.equal(netted.projectedEndingBalance, 100);
});

test("scenario adjustments change only the simulation and can be discarded", () => {
  const state = base();
  const before = JSON.stringify(state);
  const baseline = forecast(state);
  const simulated = forecast(state, { scenarios: [{
    id: "scenario-1", kind: "one_time_expense", currency: "SAR", amount: 125, date: "2026-11-15", accountId: "a",
  }] });
  const reset = forecast(state, { scenarios: [] });
  assert.equal(baseline.projectedEndingBalance, 1000);
  assert.equal(simulated.projectedEndingBalance, 875);
  assert.equal(simulated.events[0].confidence, "hypothetical");
  assert.equal(reset.projectedEndingBalance, 1000);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(state.transactions, []);
});

test("scenario modes support delayed expected income and recurring budget changes", () => {
  const state = base();
  state.incomes = [{ id: "salary", name: "Salary", amount: 200, kind: "expected", currency: "SAR", date: "2026-11-14", accountId: "a" }];
  const delay = { id: "delay", kind: "delay_expected_income", currency: "SAR", incomeId: "salary", delayDays: 3 };
  const expected = forecast(state, { mode: "expected", scenarios: [delay] });
  assert.equal(expected.events.find(e => e.scenarioId === "delay").date, "2026-11-17");
  assert.equal(expected.projectedEndingBalance, 1200);
  const conservative = forecast(state, { scenarios: [delay] });
  assert.equal(conservative.events.length, 0);
  const monthly = forecast(state, { scenarios: [{
    id: "monthly", kind: "increase_monthly_spending", currency: "SAR", amount: 10, date: "2026-11-13", accountId: "a",
  }] });
  assert.equal(monthly.events.length, 1);
  assert.equal(monthly.projectedEndingBalance, 990);
});

test("month and year-end dates remain valid and deterministic", () => {
  const range = F.forecastRange("7", "2026-12-29");
  assert.deepEqual(range, { from: "2026-12-29", to: "2027-01-04" });
  const state = base();
  state.planning.recurring = [recurring({ startDate: "2026-01-31", nextDueDate: "2026-12-31", frequency: "monthly", amount: 5 })];
  const result = F.buildCashFlowForecast(state, { currency: "SAR", range: { from: "2026-12-29", to: "2027-02-01" }, mode: "conservative", today: "2026-12-29" });
  assert.deepEqual(result.events.map(e => e.date), ["2026-12-31", "2027-01-31"]);
  assert.equal(JSON.stringify(result), JSON.stringify(F.buildCashFlowForecast(state, { currency: "SAR", range: { from: "2026-12-29", to: "2027-02-01" }, mode: "conservative", today: "2026-12-29" })));
});

test("budget outlook separates actual spending from eligible scheduled commitments", () => {
  const state = base();
  state.transactions = [{
    id: "actual", operationId: "actual", amount: 20, currency: "SAR", date: "2026-11-12",
    description: "Paid subscription", category: "Subscriptions", accountId: "a", type: "expense",
    direction: "out", createdAt: "2026-11-12T10:00:00Z",
  }];
  const plan = {
    currency: "SAR", startMonth: "2026-11", mode: "fixed", limit: 200,
    categories: [{ id: "subscriptions", name: "Subscriptions", icon: "repeat", color: "#2563EB", limit: 100, rollover: false, alerts: true }],
    includeEMI: false, includeLoans: false, includeSavings: false, carryDeficit: false, alerts: true, thresholds: [75, 90, 100],
  };
  const result = F.buildBudgetOutlook(state, plan, "2026-11", [
    { id: "r", sourceId: "r", date: "2026-11-15", name: "Internet", category: "Subscriptions", source: "Recurring expense", kind: "expense", direction: "out", confidence: "scheduled", amount: 50, currency: "SAR", accountId: "a" },
    { id: "emi", sourceId: "e", date: "2026-11-15", name: "Car", category: "Debt repayments", source: "EMI", kind: "emi", direction: "out", confidence: "scheduled", amount: 40, currency: "SAR", accountId: "a" },
    { id: "scenario", sourceId: "scenario", date: "2026-11-15", name: "Hypothetical", category: "Other", source: "Scenario", kind: "scenario", direction: "out", confidence: "hypothetical", amount: 60, currency: "SAR", accountId: "a" },
    { id: "transfer", sourceId: "transfer", date: "2026-11-15", name: "Transfer", category: "Transfer", source: "Transfer", kind: "expense", direction: "out", confidence: "scheduled", amount: 80, currency: "SAR", accountId: "a" },
  ]);
  assert.equal(result.actual, 20);
  assert.equal(result.scheduled, 50);
  assert.equal(result.projected, 70);
  assert.equal(result.projectedRemaining, 130);
  assert.equal(result.categories.find(c => c.name === "Subscriptions").scheduled, 50);
  assert.equal(result.categories.some(c => c.name === "Debt repayments"), false);
});
