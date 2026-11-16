const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { classifyProtectedMetadataResponse } = require("../rlsProbeResult.ts");

const mobileRoot = path.resolve(__dirname, "../..");
const read = relativePath => fs.readFileSync(path.join(mobileRoot, relativePath), "utf8");

test("RLS diagnostic is visible only in development for a signed-in online account", () => {
  const settings = read("components/OnlineAccountSettings.tsx");
  assert.match(settings, /online\.user \? \([\s\S]*?\{__DEV__ \? <OnlineAccountRlsDiagnostic \/> : null\}/);
});

test("RLS diagnostic sends no request until its explicit button is tapped", () => {
  const component = read("components/OnlineAccountRlsDiagnostic.tsx");
  assert.match(component, /testID="online-rls-run-check"/);
  assert.match(component, /onPress=\{\(\) => void checkRls\(\)\}/);
  assert.equal((component.match(/\bcheckRls\(\)/g) ?? []).length, 2);
  assert.doesNotMatch(component, /\buseEffect\s*\(/);
});

test("RLS diagnostic uses only current-session read requests and never writes", () => {
  const component = read("components/OnlineAccountRlsDiagnostic.tsx");
  assert.equal((component.match(/\.from\("/g) ?? []).length, 6);
  assert.match(component, /from\("user_roles"\)\.select\("role"\)\.eq\("user_id", currentUserId\)/);
  assert.match(component, /from\("user_roles"\)\.select\("role"\)\.eq\("user_id", comparisonUserId\)/);
  assert.equal((component.match(/\.limit\(1\)/g) ?? []).length, 4);
  assert.doesNotMatch(component, /head:\s*true|\.limit\(0\)/);
  assert.match(component, /classifyProtectedMetadataResponse\(grants, signedInUserConfirmed\)/);
  for (const table of ["promotional_grants", "revenuecat_identity_links", "admin_audit_logs"]) {
    assert.match(component, new RegExp(`from\\("${table}"\\)\\.select\\("id"\\)\\.limit\\(1\\)`));
  }
  assert.match(component, /from\("webhook_inbox"\)\.select\("event_id"\)\.limit\(1\)/);
  assert.doesNotMatch(component, /\.(?:insert|upsert|update|delete|rpc)\s*\(/i);
  assert.doesNotMatch(component, /\bfetch\s*\(|\/api\/admin|\/api\/account/);
  assert.doesNotMatch(component, /getSession|getUser|access_token|refresh_token|SUPABASE_SECRET/);
});

test("RLS diagnostic masks the comparison ID and displays only safe status summaries", () => {
  const component = read("components/OnlineAccountRlsDiagnostic.tsx");
  assert.match(component, /secureTextEntry/);
  assert.match(component, /setOtherUserId\(""\)/);
  assert.doesNotMatch(component, /console\.|AsyncStorage|localStorage/);
  assert.doesNotMatch(component, /\{currentUserId\}|\{comparisonUserId\}|currentUserId:\s*|comparisonUserId:\s*/);
  assert.match(component, /ownRoles\.length === 1 && ownRoles\[0\] === "USER"/);
  assert.match(component, /otherRole\.data\?\.length === 0/);
  assert.match(component, /classifyProtectedMetadataResponse/);
});

test("permission denial is confirmed only after this session reads its own USER role", () => {
  assert.equal(classifyProtectedMetadataResponse({
    data: null,
    error: { code: "42501" },
    status: 403,
  }, true), "blocked");
  assert.equal(classifyProtectedMetadataResponse({
    data: null,
    error: { code: "42501" },
    status: 403,
  }, false), "authentication-failed");
});

test("successful empty metadata results are not mistaken for a permission denial", () => {
  assert.equal(classifyProtectedMetadataResponse({
    data: [],
    error: null,
    status: 200,
  }, true), "empty");
});

test("a visible metadata row is reported as unexpected access without returning row contents", () => {
  assert.equal(classifyProtectedMetadataResponse({
    data: [{ id: "must-not-be-shown" }],
    error: null,
    status: 200,
  }, true), "unexpected-access");
});

test("missing table, column, and schema errors are reported separately", () => {
  for (const code of ["42P01", "42703", "3F000", "PGRST106", "PGRST204", "PGRST205"]) {
    assert.equal(classifyProtectedMetadataResponse({
      data: null,
      error: { code },
      status: 404,
    }, true), "missing-schema", code);
  }
});

test("authentication and network errors are not reported as blocked", () => {
  assert.equal(classifyProtectedMetadataResponse({
    data: null,
    error: { code: "PGRST301" },
    status: 401,
  }, true), "authentication-failed");
  assert.equal(classifyProtectedMetadataResponse({
    data: null,
    error: { code: "" },
    status: 0,
  }, true), "network-failed");
});

test("unclassified HTTP failures remain unverified instead of being called blocked", () => {
  assert.equal(classifyProtectedMetadataResponse({
    data: null,
    error: { code: "" },
    status: 403,
  }, true), "unavailable");
});

test("RLS diagnostic has Arabic copy for all visible labels and outcomes", () => {
  const localization = read("i18n/localization.ts");
  for (const phrase of [
    "Development-only RLS check",
    "Tap for read-only checks. The account ID is masked; at most one metadata ID per table is checked and discarded. Nothing is saved or logged.",
    "Other ordinary account ID",
    "Enter a different valid account ID.",
    "RLS check unavailable.",
    "Check account access",
    "Own USER role visible",
    "Other account role hidden",
    "Promotional grants",
    "Purchase identity links",
    "Admin audit metadata",
    "Webhook metadata",
    "Passed",
    "Unexpected access",
    "Could not verify",
    "Blocked",
    "No visible rows; not proof of blocking",
    "Table or schema missing",
    "Authentication/session failed",
    "Network unavailable",
  ]) {
    assert.match(localization, new RegExp(`"${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}":\\s*"[^"]+"`), phrase);
  }
});
