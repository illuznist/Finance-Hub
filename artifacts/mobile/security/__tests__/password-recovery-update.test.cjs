const test = require("node:test");
const assert = require("node:assert/strict");
const { updatePasswordWithCleanup } = require("../passwordRecoveryUpdate.ts");

test("confirmed password update stays successful after a navigation or session-refresh failure", async () => {
  let updateCalls = 0;
  let confirmed = false;

  const result = await updatePasswordWithCleanup(
    async () => { updateCalls++; },
    () => { confirmed = true; },
    async () => { throw new Error("post-update navigation or session-refresh failure"); },
  );

  assert.equal(updateCalls, 1);
  assert.equal(confirmed, true);
  assert.deepEqual(result, { status: "confirmed", cleanupFailed: true });
});

test("ambiguous update errors are not labeled as confirmed failures or retried", async () => {
  let updateCalls = 0;
  let confirmed = false;

  const result = await updatePasswordWithCleanup(
    async () => {
      updateCalls++;
      throw new TypeError("Network request failed");
    },
    () => { confirmed = true; },
    () => {},
  );

  assert.equal(updateCalls, 1);
  assert.equal(confirmed, false);
  assert.deepEqual(result, { status: "unconfirmed", category: "network" });
});

test("password-update rate limits remain distinct from recovery-email limits", async () => {
  const result = await updatePasswordWithCleanup(
    async () => { throw { status: 429 }; },
    () => {},
    () => {},
  );
  assert.deepEqual(result, { status: "unconfirmed", category: "rate-limit" });
});
