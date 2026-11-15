const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const mobileRoot = path.resolve(__dirname, "../..");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFinanceAlias(request, parent, isMain, options) {
  const resolved = request.startsWith("@/")
    ? path.join(mobileRoot, request.slice(2))
    : request;
  return originalResolveFilename.call(this, resolved, parent, isMain, options);
};

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
}).outputText, filename);

const policy = require("../entitlements.ts");
const archive = require("../accountArchive.ts");
const { createDevelopmentPurchaseAdapter } = require("../developmentPurchaseAdapter.ts");
const { migrateFinanceState } = require("../migration.ts");
const { isLoanSettled } = require("../../utils/loanCalculations.ts");

function account(id, archivedAt) {
  return { id, name: id, balance: 250, openingBalance: 250, type: "bank", color: "#123456", currency: "SAR", ...(archivedAt ? { archivedAt } : {}) };
}

function loan(id, paid = 0) {
  return { id, name: id, direction: "borrowed", counterpartyName: "", sourceType: "person", category: "personal", principalAmount: 100, totalRepaymentAmount: 100, startDate: "2026-01-01", repaymentFrequency: "monthly", notes: "", payments: paid ? [{ id: `${id}-payment`, amount: paid, date: "2026-02-01" }] : [], createdAt: "2026-01-01" };
}

function emi(id, paidInstallments = 0, balloonPaymentAmount = 0, balloonPaid = 0) {
  return {
    id, name: id, totalAmount: 300, monthlyAmount: 100, totalInstallments: 3,
    paidInstallments, startMonth: "2026-01", dueDayOfMonth: 1, color: "#123456", iconName: "credit-card",
    durationMonths: 3, balloonPaymentAmount,
    paymentHistory: balloonPaid ? [{ id: `${id}-balloon`, amount: balloonPaid, date: "2026-03-01", paymentType: "balloon", status: "paid" }] : [],
  };
}

function state(overrides = {}) {
  return {
    currency: "SAR", userName: "", monthlyBudget: 0,
    accounts: [], expenses: [], emis: [], loans: [], incomes: [], savingsGoals: [],
    transactions: [], notificationSettings: {}, securitySettings: {},
    lastResetMonth: "", lastResetYear: "", schemaVersion: 2,
    planning: { version: 1, plans: [], periods: [], recurring: [], occurrences: [] },
    ...overrides,
  };
}

test("Free limits count only active accounts, unsettled loans, and active EMI agreements", () => {
  const value = state({
    accounts: [account("active"), account("archived", "2026-11-15T00:00:00.000Z")],
    loans: [loan("open"), loan("settled", 100)],
    emis: [emi("open"), emi("completed", 3), emi("balloon-open", 3, 50, 0)],
  });
  assert.equal(isLoanSettled(value.loans[1]), true);
  assert.deepEqual(policy.getPlanUsage(value), { account: 1, loan: 1, emi: 2 });
  assert.equal(policy.canCreateResource(value, "account", false).allowed, false);
  assert.equal(policy.canCreateResource(value, "loan", false).allowed, false);
  assert.equal(policy.canCreateResource(value, "emi", false).allowed, true);
  assert.equal(policy.canCreateResource(value, "account", true).allowed, true);
});

test("completed EMI with a remaining balloon amount still occupies an active slot", () => {
  assert.equal(policy.isEMIActive(emi("open-balloon", 3, 50, 0)), true);
  assert.equal(policy.isEMIActive(emi("finished", 3, 50, 50)), false);
});

test("over-limit records remain present and manageable while new Free creation is blocked", () => {
  const value = state({
    accounts: [account("wallet-1"), account("wallet-2")],
    loans: [loan("loan-1"), loan("loan-2")],
    emis: [emi("emi-1"), emi("emi-2"), emi("emi-3"), emi("emi-4")],
  });
  assert.deepEqual(policy.getPlanUsage(value), { account: 2, loan: 2, emi: 4 });
  for (const resource of ["account", "loan", "emi"]) {
    assert.equal(policy.canCreateResource(value, resource, false).allowed, false);
  }
  assert.equal(value.accounts.length, 2);
  assert.equal(value.loans.length, 2);
  assert.equal(value.emis.length, 4);
});

test("archiving changes only the account marker and keeps all linked ledger history", () => {
  const transactions = [{ id: "tx-1", type: "expense", amount: 25, date: "2026-11-01", accountId: "wallet-1", description: "Groceries" }];
  const original = state({ accounts: [account("wallet-1")], transactions });
  const result = archive.archiveAccountInState(original, "wallet-1", "2026-11-15T00:00:00.000Z");
  assert.equal(result.ok, true);
  assert.equal(result.state.accounts[0].archivedAt, "2026-11-15T00:00:00.000Z");
  assert.equal(result.state.accounts[0].openingBalance, 250);
  assert.deepEqual(result.state.transactions, transactions);
  assert.equal(policy.getPlanUsage(result.state).account, 0);
});

test("schema migration preserves the optional archive marker without changing the schema version", () => {
  const saved = state({
    accounts: [account("old", "2026-11-15T00:00:00.000Z")],
  });
  const migrated = migrateFinanceState(JSON.stringify(saved), state());
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.accounts[0].archivedAt, "2026-11-15T00:00:00.000Z");
});

test("a replacement fits after archival; reactivation is blocked at the Free limit", () => {
  const original = state({ accounts: [account("old")] });
  const archived = archive.archiveAccountInState(original, "old", "2026-11-15T00:00:00.000Z");
  assert.equal(policy.canCreateResource(archived.state, "account", false).allowed, true);
  const withReplacement = state({ accounts: [archived.state.accounts[0], account("replacement")] });
  assert.deepEqual(archive.reactivateAccountInState(withReplacement, "old", false), {
    ok: false,
    reason: "active_wallet_limit",
  });
  assert.equal(archive.reactivateAccountInState(withReplacement, "old", true).ok, true);
});

test("development purchase adapter is session-only and cannot grant Pro in production", () => {
  const productionAdapter = createDevelopmentPurchaseAdapter(false);
  assert.equal(productionAdapter.enablePreview(), false);
  assert.deepEqual(productionAdapter.getSnapshot(), { isPro: false, source: "free" });

  const developmentAdapter = createDevelopmentPurchaseAdapter(true);
  assert.equal(developmentAdapter.enablePreview(), true);
  assert.deepEqual(developmentAdapter.getSnapshot(), { isPro: true, source: "development_preview" });
  developmentAdapter.resetPreview();
  assert.deepEqual(developmentAdapter.getSnapshot(), { isPro: false, source: "free" });
});
