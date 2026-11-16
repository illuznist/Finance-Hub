const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  classifyOnlineAuthError,
  classifyRecoveryLinkError,
} = require("../onlineAuthError.ts");
const { createSingleUseAuthCodeExchange } = require("../singleUseAuthCodeExchange.ts");
const {
  continueAfterEmailVerification,
  resolveEmailVerificationScreenStatus,
} = require("../emailVerificationFlow.ts");

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
  await assert.rejects(
    exchangeOnce("one-time-code"),
    error => error.code === "auth_code_already_exchanged",
  );
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
  assert.match(callback, /callbackAttempt\.current/);
  assert.match(callback, /attempt\.promise/);
  assert.match(callback, /Password updated successfully\./);
  assert.doesNotMatch(settingsSource(), /console\.(?:log|warn|error)\([^)]*(?:password|token|recovery)/i);
});

test("a confirmed password update cannot be changed into a failure by later cleanup or navigation", () => {
  const context = read("context/OnlineAccountContext.tsx");
  const callback = read("app/auth/callback.tsx");
  const updateFlow = read("security/passwordRecoveryUpdate.ts");
  const saveHandler = callback.match(/async function saveNewPassword\(\) \{([\s\S]*?)\n  \}/)?.[1];

  assert.ok(saveHandler, "password update handler should remain explicit");
  assert.match(saveHandler, /updatePasswordWithCleanup/);
  assert.doesNotMatch(saveHandler, /router\.replace|online\.signOut/);
  assert.ok(updateFlow.indexOf("onConfirmed();") < updateFlow.indexOf("await cleanup();"));
  assert.match(updateFlow, /status: "confirmed", cleanupFailed: true/);
  assert.match(callback, /passwordUpdated \? \(/);
  assert.match(callback, /Password update is confirmed and the recovery session is closed/);
  assert.match(context, /const completePasswordRecovery = useCallback\(async \(password: string\) => \{[\s\S]*?auth\.updateUser\(\{ password \}\)[\s\S]*?if \(error\) throw error;\n  \}, \[\]\);/);
});

test("password recovery email rate limits use email-specific guidance", () => {
  const settings = read("components/OnlineAccountSettings.tsx");
  assert.match(settings, /category === "rate-limit" && mode === "recovery"/);
  assert.match(settings, /Too many password recovery emails were requested/);
});

test("a session-refresh failure cannot downgrade a completed email-link confirmation", () => {
  assert.equal(resolveEmailVerificationScreenStatus("confirmed", false), "confirmed");
  const callback = read("app/auth/callback.tsx");
  const context = read("context/OnlineAccountContext.tsx");
  assert.match(callback, /setCallbackOutcome\(outcome\)/);
  assert.match(context, /getSession\(\)[\s\S]*?\.catch\(\(\) => \{\s*if \(active\) setSession\(null\)/);
});

test("an already-verified session reaches a terminal state without a callback code", () => {
  assert.equal(resolveEmailVerificationScreenStatus(null, true), "already-verified");
  assert.equal(resolveEmailVerificationScreenStatus(null, false), "setup");
});

test("actual email-verification failures remain distinct from successful confirmation", () => {
  assert.equal(resolveEmailVerificationScreenStatus("failed", false), "failed");
  const callback = read("app/auth/callback.tsx");
  assert.match(callback, /setCallbackOutcome\("failed"\)/);
  assert.match(callback, /verificationErrorMessage/);
});

test("navigation failure does not change confirmed verification state", async () => {
  const result = await continueAfterEmailVerification("confirmed", async () => {
    throw new Error("navigation failed");
  });
  assert.deepEqual(result, { status: "confirmed", navigationFailed: true });
  assert.equal(resolveEmailVerificationScreenStatus(result.status, false), "confirmed");
});

test("duplicate deep-link deliveries reuse one callback attempt and do not strand loading state", () => {
  const callback = read("app/auth/callback.tsx");
  const context = read("context/OnlineAccountContext.tsx");
  assert.match(callback, /callbackAttempt\.current/);
  assert.match(callback, /attempt\.promise/);
  assert.match(context, /lastAuthCallback\.current\?\.code === code/);
  assert.doesNotMatch(callback, /\[url, code, callbackCode/);
  assert.match(callback, /finally\(\(\) => \{\s*if \(active\) setCallbackProcessing\(false\)/);
});

test("email verification continues to share the callback route without changing recovery handling", () => {
  const context = read("context/OnlineAccountContext.tsx");
  const callback = read("app/auth/callback.tsx");
  assert.match(context, /redirectType === "recovery"/);
  assert.match(context, /return "confirmed"/);
  assert.match(callback, /online\.needsPasswordRecovery \|\| callbackOutcome === "recovery"/);
  assert.match(callback, /continueAfterEmailVerification/);
});

test("email verification terminal states and navigation recovery are localized", () => {
  const localization = read("i18n/localization.ts");
  for (const phrase of [
    "Email verified successfully.",
    "This online account is already verified.",
    "This email verification link could not be confirmed. If your account is already verified, continue to Settings; otherwise open the latest confirmation email.",
    "Continue to Settings",
    "Email verification status is unchanged, but Settings could not be opened. Use Back or tap Continue to try again.",
  ]) {
    assert.ok(localization.includes(`"${phrase}":`), phrase);
  }
});

function settingsSource() {
  return read("components/OnlineAccountSettings.tsx");
}
