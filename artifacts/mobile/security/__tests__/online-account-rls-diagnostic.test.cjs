const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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
  assert.equal((component.match(/head:\s*true/g) ?? []).length, 4);
  assert.equal((component.match(/\.limit\(0\)/g) ?? []).length, 4);
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
  assert.match(component, /error\.code === "42501" \? "blocked" : "unavailable"/);
  assert.match(component, /ownRoles\.length === 1 && ownRoles\[0\] === "USER"/);
  assert.match(component, /otherRole\.data\?\.length === 0/);
});

test("RLS diagnostic has Arabic copy for all visible labels and outcomes", () => {
  const localization = read("i18n/localization.ts");
  for (const phrase of [
    "Development-only RLS check",
    "Runs read-only checks only after you tap. IDs are masked and are not saved or logged.",
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
    "Access not blocked",
  ]) {
    assert.match(localization, new RegExp(`"${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}":\\s*"[^"]+"`), phrase);
  }
});
