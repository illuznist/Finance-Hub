const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { classifyOnlineAuthError } = require("../onlineAuthError.ts");

const mobileRoot = path.resolve(__dirname, "../..");
const read = relativePath => fs.readFileSync(path.join(mobileRoot, relativePath), "utf8");

test("online auth failures are safely classified for localized feedback", () => {
  assert.equal(classifyOnlineAuthError({ status: 429 }), "rate-limit");
  assert.equal(classifyOnlineAuthError({ code: "over_email_send_rate_limit" }), "rate-limit");
  assert.equal(classifyOnlineAuthError(new TypeError("Network request failed")), "network");
  assert.equal(classifyOnlineAuthError({ name: "AuthRetryableFetchError" }), "network");
  assert.equal(classifyOnlineAuthError({ message: "Invalid login credentials" }), "unknown");
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
  assert.match(context, /resetPasswordForEmail\([\s\S]*?redirectTo:\s*getRedirectUrl\(\)/);
  assert.match(context, /event === "PASSWORD_RECOVERY"/);
  assert.match(context, /exchangeCodeForSession\(code\)/);
  assert.match(context, /updateUser\(\{ password \}\)/);
  assert.match(callback, /testID="online-recovery-password"/);
  assert.match(callback, /testID="online-recovery-password-confirm"/);
  assert.match(callback, /Password updated successfully\./);
  assert.doesNotMatch(settingsSource(), /console\.(?:log|warn|error)\([^)]*(?:password|token|recovery)/i);
});

function settingsSource() {
  return read("components/OnlineAccountSettings.tsx");
}
