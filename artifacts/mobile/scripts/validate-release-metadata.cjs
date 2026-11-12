const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appConfig = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
const appVersion = appConfig.expo?.version;
assert.match(appVersion, /^\d+\.\d+\.\d+$/, "app.json must declare a semantic app version");

const settings = fs.readFileSync(path.join(root, "app/settings.tsx"), "utf8");
const backup = fs.readFileSync(path.join(root, "app/backup.tsx"), "utf8");
const versionHelper = fs.readFileSync(path.join(root, "utils/appVersion.ts"), "utf8");
const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
const stabilizationReport = fs.readFileSync(path.join(root, "LOCALIZATION_UI_STABILIZATION_REPORT.md"), "utf8");

assert.match(settings, /getApplicationVersion\(\)/, "Settings must display the dynamic app version");
assert.match(backup, /getApplicationVersion\(\)/, "Backup metadata must use the shared app version");
assert.match(versionHelper, /Constants\.expoConfig\?\.version/, "Version helper must use Expo's resolved runtime config");
assert.match(versionHelper, /appConfig\.expo\.version/, "Version helper must fall back to bundled app.json");
assert.match(changelog, new RegExp(`^## ${appVersion.replaceAll(".", "\\.")}$`, "m"), "Changelog must include the current app version");
assert.match(stabilizationReport, new RegExp(`\\*\\*${appVersion.replaceAll(".", "\\.")}\\*\\*`), "Stabilization report must record the current version");

console.log(`Release metadata is consistent: FinanceApp ${appVersion}`);
