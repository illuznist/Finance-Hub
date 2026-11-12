const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const {
  createCredentialVerifier,
  legacyPasswordDigest,
  verifyCredentialVerifier,
} = require("../credentials.ts");
const { pinDelayMs } = require("../pinPolicy.ts");
const {
  lockOnResume,
  lockWhenBackgrounded,
  nextAppLockStatus,
} = require("../appLockPolicy.ts");
const {
  PIN_ATTEMPTS_KEY,
  PIN_VERIFIER_KEY,
  clearPinVerifier,
  savePinVerifier,
  verifyPinVerifier,
} = require("../pinVerifier.ts");

function oldCodeUnitBytes(value) {
  const bytes = [];
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return Buffer.from(bytes);
}

test("legacy digest matches the exact prior login encoding", () => {
  for (const password of ["correct horse", "كلمة-سر", "emoji-🙂"]) {
    const input = `financeapp:manzoor@example.com:${password}`;
    const expected = createHash("sha256").update(oldCodeUnitBytes(input)).digest("hex");
    assert.equal(legacyPasswordDigest("Manzoor@Example.com", password), expected);
  }
});

test("new account credentials use a salted PBKDF2 verifier and reject wrong passwords", async () => {
  let counter = 0;
  const random = async length => Uint8Array.from({ length }, () => (counter++ * 31 + 7) & 255);
  const first = await createCredentialVerifier("a sufficiently long password", random);
  const second = await createCredentialVerifier("a sufficiently long password", random);
  assert.equal(first.algorithm, "PBKDF2-HMAC-SHA256");
  assert.equal(first.iterations, 600_000);
  assert.notEqual(first.salt, second.salt);
  assert.equal(await verifyCredentialVerifier("a sufficiently long password", first), true);
  assert.equal(await verifyCredentialVerifier("a different password", first), false);
});

test("PIN retry waits grow progressively but never impose a permanent lockout", () => {
  assert.equal(pinDelayMs(1), 1_000);
  assert.equal(pinDelayMs(2), 2_000);
  assert.equal(pinDelayMs(3), 4_000);
  assert.equal(pinDelayMs(6), 30_000);
  assert.equal(pinDelayMs(1000), 30_000);
});

test("PIN setup, change, wrong entry, and disable preserve only a verifier", async () => {
  const secrets = new Map([[PIN_ATTEMPTS_KEY, '{"failures":2,"lockedUntil":1}']]);
  const store = {
    get: async key => secrets.get(key) ?? null,
    set: async (key, value) => { secrets.set(key, value); },
    remove: async key => { secrets.delete(key); },
  };
  let counter = 0;
  const random = async length => Uint8Array.from({ length }, () => (counter++ * 17 + 11) & 255);

  await assert.rejects(() => savePinVerifier("12", store, random), /4-digit PIN/);
  await savePinVerifier("1234", store, random);
  const initial = secrets.get(PIN_VERIFIER_KEY);
  assert.equal(await verifyPinVerifier("1234", initial), true);
  assert.equal(await verifyPinVerifier("1111", initial), false);
  assert.equal(secrets.get(PIN_ATTEMPTS_KEY), undefined);

  await savePinVerifier("5678", store, random);
  const changed = secrets.get(PIN_VERIFIER_KEY);
  assert.equal(await verifyPinVerifier("1234", changed), false);
  assert.equal(await verifyPinVerifier("5678", changed), true);

  await clearPinVerifier(store);
  assert.equal(secrets.has(PIN_VERIFIER_KEY), false);
  assert.equal(secrets.has(PIN_ATTEMPTS_KEY), false);
});

test("app lock policy covers immediate, delayed, long, and never-lock settings", () => {
  assert.equal(lockWhenBackgrounded(-1), true);
  assert.equal(lockOnResume(-1, 0), true);
  assert.equal(lockWhenBackgrounded(1), false);
  assert.equal(lockOnResume(1, 59_999), false);
  assert.equal(lockOnResume(1, 60_000), true);
  assert.equal(lockOnResume(30, 29 * 60_000), false);
  assert.equal(lockOnResume(30, 30 * 60_000), true);
  assert.equal(lockWhenBackgrounded(0), false);
  assert.equal(lockOnResume(0, 86_400_000), false);
});

test("enabling a PIN during the current session does not interrupt setup", () => {
  assert.equal(nextAppLockStatus(false, false), "open");
  assert.equal(nextAppLockStatus(false, true), "locked");
  assert.equal(nextAppLockStatus(true, true), null);
  assert.equal(nextAppLockStatus(true, false), "open");
});
