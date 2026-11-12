const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../crypto.ts");
const B = require("../backup.ts");
const J = require("../restoreJournal.ts");

const fixedRandom = (() => {
  let seed = 0;
  return async length => Uint8Array.from({ length }, () => (seed++ * 37 + 19) & 255);
})();

test("PBKDF2-HMAC-SHA256 matches the RFC 6070 SHA-256 vector", async () => {
  assert.equal(
    C.hex(await C.deriveKey("password", C.utf8("salt"), 1)),
    "120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b",
  );
});

test("base64 encoding round trips empty, padded, and binary values", () => {
  for (const value of [new Uint8Array(), C.utf8("f"), C.utf8("fo"), C.utf8("Finance Hub"), Uint8Array.from([0, 255, 16, 128])]) {
    assert.deepEqual(C.decodeBase64(C.encodeBase64(value)), value);
  }
  assert.throws(() => C.decodeBase64("bad!"));
});

test("UTF-8 decoding rejects malformed and overlong sequences", () => {
  assert.throws(() => C.fromUtf8(Uint8Array.from([0xc0, 0x80])));
  assert.throws(() => C.fromUtf8(Uint8Array.from([0xe2, 0x28, 0xa1])));
  assert.throws(() => C.fromUtf8(Uint8Array.from([0xed, 0xa0, 0x80])));
});

test("AES-256-GCM rejects changed ciphertext and additional data", async () => {
  const key = new Uint8Array(32).fill(5);
  const { nonce, ciphertext } = await C.encryptGcm(key, C.utf8("financial records"), C.utf8("header"), fixedRandom);
  assert.equal(C.fromUtf8(C.decryptGcm(key, nonce, ciphertext, C.utf8("header"))), "financial records");
  const changed = new Uint8Array(ciphertext);
  changed[0] ^= 1;
  assert.throws(() => C.decryptGcm(key, nonce, changed, C.utf8("header")));
  assert.throws(() => C.decryptGcm(key, nonce, ciphertext, C.utf8("other")));
});

test("backup encrypt/decrypt round trip preserves records and excludes device security state", async () => {
  const state = {
    schemaVersion: 2,
    accounts: [{ id: "account-1", openingBalance: 100, balance: 150, currency: "SAR" }],
    transactions: [{ id: "txn-1", operationId: "op-1", amount: 25 }],
    incomes: [{ id: "income-1", amount: 50 }],
    expenses: [{ id: "expense-1", amount: 10 }],
    emis: [{ id: "emi-1", paymentHistory: [{ id: "emi-payment-1", operationId: "emi-op-1" }] }],
    loans: [{ id: "loan-1", fundingHistory: [{ id: "funding-1" }], payments: [{ id: "loan-payment-1", operationId: "loan-op-1" }] }],
    savingsGoals: [{ id: "goal-1", contributions: [{ id: "contribution-1" }] }],
    netWorthSnapshots: [{ id: "snapshot-1", total: 150 }],
    planning: {
      plans: [{ id: "plan-1" }],
      periods: [{ id: "period-1" }],
      recurring: [{ id: "recurring-1" }],
      occurrences: [{ id: "occurrence-1" }],
    },
    securitySettings: { pin: "1234", pinEnabled: true },
  };
  const serialized = await B.createFinanceBackup(
    state,
    "dark",
    "long-enough-backup-password",
    fixedRandom,
    "1.0.0",
    "2026-11-12T12:00:00.000Z",
  );
  const opened = await B.openFinanceBackup(serialized, "long-enough-backup-password");
  const expectedFinanceState = structuredClone(state);
  delete expectedFinanceState.securitySettings;
  assert.deepEqual(opened.payload.financeState, expectedFinanceState);
  assert.deepEqual(opened.payload.userPreferences, { themeMode: "dark" });
  assert.equal(opened.metadata.recordCounts.transactions, 1);
  assert.equal(opened.metadata.recordCounts.emiPayments, 1);
  assert.equal(opened.metadata.recordCounts.loanPayments, 1);
  assert.equal(opened.metadata.recordCounts.recurringOccurrences, 1);
  await assert.rejects(() => B.openFinanceBackup(serialized, "wrong-password"), /could not be opened/);
  const changed = JSON.parse(serialized);
  changed.metadata.appVersion = "tampered";
  await assert.rejects(() => B.openFinanceBackup(JSON.stringify(changed), "long-enough-backup-password"), /could not be opened/);
});

test("backup rejects unsupported format, malformed metadata, and weak passwords", async () => {
  await assert.rejects(
    () => B.createFinanceBackup({}, "system", "short", fixedRandom, "1.0.0"),
    /at least 12 characters/,
  );
  await assert.rejects(
    () => B.openFinanceBackup(JSON.stringify({ magic: B.BACKUP_MAGIC, formatVersion: 99 }), "password"),
    /version is not supported/,
  );
});

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: async key => values.has(key) ? values.get(key) : null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async key => { values.delete(key); },
    values,
  };
}

function memorySecretStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get: async key => values.has(key) ? values.get(key) : null,
    set: async (key, value) => { values.set(key, value); },
    remove: async key => { values.delete(key); },
    values,
  };
}

test("prepared restore journal restores the exact old finance document", async () => {
  const storage = memoryStorage({ "@finance_state_v4": '{"schemaVersion":2,"accounts":[]}' });
  const secrets = memorySecretStore();
  await J.createRestoreJournal(storage, secrets, {
    "@finance_state_v4": await storage.getItem("@finance_state_v4"),
    "@finance_theme_v1": "dark",
  }, fixedRandom);
  await storage.setItem("@finance_state_v4", '{"schemaVersion":2,"accounts":[{"id":"new"}]}');
  await storage.setItem("@finance_theme_v1", "light");
  assert.equal(await J.recoverInterruptedRestore(storage, secrets), "rolled-back");
  assert.equal(await storage.getItem("@finance_state_v4"), '{"schemaVersion":2,"accounts":[]}');
  assert.equal(await storage.getItem("@finance_theme_v1"), "dark");
  assert.equal(await storage.getItem(J.RESTORE_JOURNAL_KEY), null);
  assert.equal(await secrets.get(J.RESTORE_JOURNAL_SECRET_KEY), null);
});

test("committed restore journal keeps the replacement and clears recovery material", async () => {
  const storage = memoryStorage({ "@finance_state_v4": '{"before":true}' });
  const secrets = memorySecretStore();
  await J.createRestoreJournal(storage, secrets, {
    "@finance_state_v4": await storage.getItem("@finance_state_v4"),
    "@finance_theme_v1": null,
  }, fixedRandom);
  await storage.setItem("@finance_state_v4", '{"after":true}');
  await J.commitRestoreJournal(storage);
  assert.equal(await J.recoverInterruptedRestore(storage, secrets), "committed");
  assert.equal(await storage.getItem("@finance_state_v4"), '{"after":true}');
  assert.equal(await storage.getItem(J.RESTORE_JOURNAL_KEY), null);
  assert.equal(await secrets.get(J.RESTORE_JOURNAL_SECRET_KEY), null);
});

test("restore journal restores an empty starting app after interrupted import", async () => {
  const storage = memoryStorage();
  const secrets = memorySecretStore();
  await J.createRestoreJournal(storage, secrets, { "@finance_state_v4": null, "@finance_theme_v1": null }, fixedRandom);
  await storage.setItem("@finance_state_v4", '{"partial":true}');
  assert.equal(await J.recoverInterruptedRestore(storage, secrets), "rolled-back");
  assert.equal(await storage.getItem("@finance_state_v4"), null);
});

test("restore journal refuses to change finance data when its protected key is missing", async () => {
  const storage = memoryStorage({ "@finance_state_v4": '{"after":true}' });
  const secrets = memorySecretStore();
  await J.createRestoreJournal(storage, secrets, {
    "@finance_state_v4": '{"before":true}',
    "@finance_theme_v1": "system",
  }, fixedRandom);
  await secrets.remove(J.RESTORE_JOURNAL_SECRET_KEY);
  await assert.rejects(() => J.recoverInterruptedRestore(storage, secrets), /cannot be opened/);
  assert.equal(await storage.getItem("@finance_state_v4"), '{"after":true}');
});

test("restore journal refuses a tampered recovery snapshot without overwriting current data", async () => {
  const storage = memoryStorage({ "@finance_state_v4": '{"after":true}' });
  const secrets = memorySecretStore();
  await J.createRestoreJournal(storage, secrets, {
    "@finance_state_v4": '{"before":true}',
    "@finance_theme_v1": null,
  }, fixedRandom);
  const journal = JSON.parse(await storage.getItem(J.RESTORE_JOURNAL_KEY));
  journal.ciphertext = `${journal.ciphertext[0] === "A" ? "B" : "A"}${journal.ciphertext.slice(1)}`;
  await storage.setItem(J.RESTORE_JOURNAL_KEY, JSON.stringify(journal));
  await assert.rejects(() => J.recoverInterruptedRestore(storage, secrets), /integrity check/);
  assert.equal(await storage.getItem("@finance_state_v4"), '{"after":true}');
  assert.ok(await storage.getItem(J.RESTORE_JOURNAL_KEY));
});
