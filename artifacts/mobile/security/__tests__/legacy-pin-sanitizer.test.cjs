const assert = require("node:assert/strict");
const test = require("node:test");
const { sanitizeLegacyFinanceSnapshot } = require("../sanitizeFinanceSnapshot.ts");

test("legacy finance snapshot sanitizer removes only the raw PIN", () => {
  const original = {
    userName: "Manzoor",
    accounts: [{ id: "cash", openingBalance: 0, balance: 120 }],
    transactions: [{ id: "tx1", amount: 25 }],
    securitySettings: { pinEnabled: true, pin: "1234", autoLockMinutes: 5 },
  };
  const sanitized = sanitizeLegacyFinanceSnapshot(JSON.stringify(original));
  assert.ok(sanitized);
  const result = JSON.parse(sanitized);
  assert.deepEqual(result.accounts, original.accounts);
  assert.deepEqual(result.transactions, original.transactions);
  assert.deepEqual(result.securitySettings, { pinEnabled: true, autoLockMinutes: 5 });
  assert.equal(original.securitySettings.pin, "1234");
});

test("sanitizer leaves documents without raw PINs and malformed recovery copies untouched", () => {
  assert.equal(sanitizeLegacyFinanceSnapshot('{"securitySettings":{"pinEnabled":false}}'), null);
  assert.equal(sanitizeLegacyFinanceSnapshot("not-json"), null);
  assert.equal(sanitizeLegacyFinanceSnapshot("[]"), null);
});
