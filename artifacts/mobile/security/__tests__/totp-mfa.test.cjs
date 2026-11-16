const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText, filename);
};

const {
  classifyTotpAssurance,
  isVerifiedTotpFactor,
  normalizeTotpCode,
} = require("../totpPolicy.ts");
const mobileRoot = path.resolve(__dirname, "../..");
const read = relativePath => fs.readFileSync(path.join(mobileRoot, relativePath), "utf8");

test("TOTP policy challenges AAL1 sessions that have an enrolled second factor", () => {
  assert.equal(classifyTotpAssurance("aal1", "aal1"), "ready");
  assert.equal(classifyTotpAssurance("aal1", "aal2"), "challenge");
  assert.equal(classifyTotpAssurance("aal2", "aal2"), "ready");
  assert.equal(classifyTotpAssurance("aal2", "aal1"), "stale");
  assert.equal(classifyTotpAssurance(null, null), "unsupported");
});

test("only verified TOTP factors count as app-supported authenticators", () => {
  assert.equal(isVerifiedTotpFactor({ factor_type: "totp", status: "verified" }), true);
  assert.equal(isVerifiedTotpFactor({ factor_type: "totp", status: "unverified" }), false);
  assert.equal(isVerifiedTotpFactor({ factor_type: "phone", status: "verified" }), false);
});

test("TOTP input accepts Arabic and Persian digits but submits six ASCII digits", () => {
  assert.equal(normalizeTotpCode("١٢٣ ٤٥٦"), "123456");
  assert.equal(normalizeTotpCode("۱۲۳-۴۵۶7"), "123456");
  assert.equal(normalizeTotpCode("12ab"), "12");
});

test("online account MFA uses Supabase verification, enforces AAL2, and never logs or persists secrets", () => {
  const mfa = read("components/OnlineAccountMfa.tsx");
  const settings = read("components/OnlineAccountSettings.tsx");
  assert.match(mfa, /auth\.mfa\.enroll/);
  assert.match(mfa, /auth\.mfa\.challenge/);
  assert.match(mfa, /auth\.mfa\.verify/);
  assert.match(mfa, /auth\.mfa\.listFactors/);
  assert.match(mfa, /auth\.mfa\.unenroll/);
  assert.match(mfa, /currentLevel !== "aal2"/);
  assert.match(mfa, /kind: "confirm-removal"/);
  assert.match(settings, /<OnlineAccountSecuritySection\s*\/>/);
  assert.match(mfa, /SvgXml xml=\{operation\.draft\.qrCode\}/);
  assert.doesNotMatch(mfa, /console\.(?:log|warn|error)/i);
  assert.doesNotMatch(mfa, /\b(?:AsyncStorage|SecureStore|localStorage)\b/);
  assert.doesNotMatch(mfa, /access_token|refresh_token|service_role/i);
});

test("enrollment and factor removal are explicit user actions, never startup automation", () => {
  const mfa = read("components/OnlineAccountMfa.tsx");
  const assessmentEffect = mfa.match(/useEffect\(\(\) => \{\s*void assessMfa\(\);([\s\S]*?)\}, \[assessMfa\]\);/);
  assert.ok(assessmentEffect, "signed-in sessions should check their assurance level");
  assert.doesNotMatch(assessmentEffect[1], /mfa\.(?:enroll|unenroll)/);
  assert.match(mfa, /onPress=\{\(\) => void beginAddAuthenticator\(\)\}/);
  assert.match(mfa, /onPress=\{\(\) => void removeFactor\(operation\.target, false\)\}/);
});

test("the development assurance diagnostic is opt-in and exposes only current/next levels", () => {
  const settings = read("components/OnlineAccountSettings.tsx");
  const start = settings.indexOf("function DevelopmentAssuranceCheck()");
  const end = settings.indexOf("function PrimaryButton(", start);
  const diagnostic = settings.slice(start, end);

  assert.ok(start >= 0 && end > start, "the diagnostic should be a focused component");
  assert.match(settings, /online\.user \? \([\s\S]*?\{__DEV__ \? <DevelopmentAssuranceCheck \/> : null\}/);
  assert.match(diagnostic, /onPress=\{\(\) => void checkCurrentSession\(\)\}/);
  assert.match(diagnostic, /auth\.mfa\.getAuthenticatorAssuranceLevel\(\)/);
  assert.match(diagnostic, /setLevels\(\{ currentLevel: data\.currentLevel, nextLevel: data\.nextLevel \}\)/);
  assert.match(diagnostic, /levels\.currentLevel/);
  assert.match(diagnostic, /levels\.nextLevel/);
  assert.doesNotMatch(diagnostic, /useEffect|challenge\(|unenroll\(|signOut\(|refreshSession|admin|access_token|refresh_token|user\.id|console\./i);
  assert.doesNotMatch(diagnostic, /currentAuthenticationMethods/);
});

test("admin authorization remains server-enforced and unchanged by the mobile MFA flow", () => {
  const authorization = fs.readFileSync(
    path.resolve(mobileRoot, "../api-server/src/middlewares/requireAdmin.ts"),
    "utf8",
  );
  assert.match(authorization, /isAdminAuthorized/);
  assert.match(authorization, /aal/);
});
