const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  classifyOnlineAuthError,
  classifyRecoveryLinkError,
} = require("../onlineAuthError.ts");
const { createSingleUseAuthCodeExchange } = require("../singleUseAuthCodeExchange.ts");

const mobileRoot = path.resolve(__dirname, "../..");
const read = relativePath => fs.readFileSync(path.join(mobileRoot, relativePath), "utf8");

test("online auth failures are safely classified for localized feedback", () => {
  assert.equal(classifyOnlineAuthError({ status: 429 }), "rate-limit");
  assert.equal(classifyOnlineAuthError({ code: "over_email_send_rate_limit" }), "rate-limit");
  assert.equal(classifyOnlineAuthError(new TypeError("Network request failed")), "network");
  assert.equal(classifyOnlineAuthError({ name: "AuthRetryableFetchError" }), "network");
  assert.equal(classifyOnlineAuthError({ message: "Invalid login credentials" }), "unknown");
});

test("recovery callback errors distinguish expired links, missing PKCE state, limits, and network failures", () => {
  assert.equal(classifyRecoveryLinkError({ code: "otp_expired" }), "expired-or-used");
  assert.equal(classifyRecoveryLinkError({ code: "flow_state_not_found" }), "expired-or-used");
  assert.equal(classifyRecoveryLinkError({ name: "AuthPKCECodeVerifierMissingError" }), "missing-verifier");
  assert.equal(classifyRecoveryLinkError({ status: 429 }), "rate-limit");
  assert.equal(classifyRecoveryLinkError(new TypeError("Network request failed")), "network");
});

test("the same PKCE recovery code is exchanged once even across duplicate link deliveries", async () => {
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const exchangeOnce = createSingleUseAuthCodeExchange(async code => {
    calls++;
    await gate;
    return { code };
  });

  const first = exchangeOnce("one-time-code");
  const second = exchangeOnce("one-time-code");
  assert.strictEqual(first, second);
  release();
  assert.deepEqual(await Promise.all([first, second]), [
    { code: "one-time-code" },
    { code: "one-time-code" },
  ]);
  assert.equal(calls, 1);
});

test("an unsuccessful PKCE code exchange is not silently retried by a duplicate link event", async () => {
  let calls = 0;
  const exchangeOnce = createSingleUseAuthCodeExchange(async () => {
    calls++;
    throw Object.assign(new Error("expired"), { code: "otp_expired" });
  });
  const first = exchangeOnce("expired-code");
  const second = exchangeOnce("expired-code");
  await assert.rejects(first);
  await assert.rejects(second);
  assert.equal(calls, 1);
});

test("signed-in Settings exposes and submits the recovery form", () => {
  const settings = read("components/OnlineAccountSettings.tsx");
  assert.match(settings, /online\.user && mode === "recovery"/);
  assert.match(settings, /testID="online-account-recovery"/);
  assert.match(settings, /setEmail\(online\.user\?\.email \?\? ""\)/);
  assert.match(settings, /online\.sendPasswordRecovery\(email\)/);
  assert.match(settings, /loading=\{busy\}/);
});

test("password recovery uses the allowlisted Expo callback and PKCE recovery event", () => {
  const context = read("context/OnlineAccountContext.tsx");
  const callback = read("app/auth/callback.tsx");
  const supabase = read("lib/supabase.ts");
  assert.match(context, /resetPasswordForEmail\([\s\S]*?redirectTo:\s*getRedirectUrl\(\)/);
  assert.match(context, /event === "PASSWORD_RECOVERY"/);
  assert.match(context, /exchangeCodeForSession\(code\)/);
  assert.match(context, /redirectType === "recovery"/);
  assert.match(context, /createSingleUseAuthCodeExchange/);
  assert.match(supabase, /detectSessionInUrl:\s*false/);
  assert.match(context, /updateUser\(\{ password \}\)/);
  assert.match(callback, /testID="online-recovery-password"/);
  assert.match(callback, /testID="online-recovery-password-confirm"/);
  assert.match(callback, /urlCode/);
  assert.match(callback, /classifyRecoveryLinkError/);
  assert.match(callback, /Password updated successfully\./);
  assert.doesNotMatch(settingsSource(), /console\.(?:log|warn|error)\([^)]*(?:password|token|recovery)/i);
});

function settingsSource() {
  return read("components/OnlineAccountSettings.tsx");
}
