const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const sourceRoots = ["app", "components", "finance", "utils"];
const uiRoots = ["app", "components"];
const translationsPath = path.join(root, "i18n/localization.ts");
const localizationFile = ts.createSourceFile(
  translationsPath,
  fs.readFileSync(translationsPath, "utf8"),
  ts.ScriptTarget.Latest,
  true,
);

let arabicObject;
function findArabicObject(node) {
  if (
    ts.isVariableDeclaration(node) &&
    node.name.getText(localizationFile) === "ARABIC_TRANSLATIONS"
  ) {
    arabicObject = node.initializer;
  }
  ts.forEachChild(node, findArabicObject);
}
findArabicObject(localizationFile);
if (!arabicObject || !ts.isObjectLiteralExpression(arabicObject)) {
  throw new Error("Could not find ARABIC_TRANSLATIONS.");
}

const arabic = new Map();
const duplicateKeys = [];
for (const property of arabicObject.properties) {
  if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.name)) continue;
  const key = property.name.text;
  if (arabic.has(key)) duplicateKeys.push(key);
  const value = ts.isStringLiteral(property.initializer) ? property.initializer.text : "";
  arabic.set(key, value);
}

function collectFiles(directory) {
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...collectFiles(fullPath));
    else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/(__tests__|\.test\.)/.test(fullPath)) output.push(fullPath);
  }
  return output;
}

const files = sourceRoots.flatMap((directory) => collectFiles(path.join(root, directory)));
const uiFileSet = new Set(uiRoots.flatMap((directory) => collectFiles(path.join(root, directory))));
const usedByFile = new Map();
const candidateByFile = new Map();
const missingKeys = [];
const untranslatedText = [];
const missingErrorKeys = [];
const untranslatedAlerts = [];
const dynamicLocalizationCalls = [];
const legalFiles = new Set(["legal.tsx"]);

function addCandidate(file, key) {
  if (!key || key.trim() === "") return;
  if (!candidateByFile.has(file)) candidateByFile.set(file, new Set());
  candidateByFile.get(file).add(key);
}

function placeholders(value) {
  return [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]).sort();
}

function isExcludedVisibleText(value) {
  const text = value.trim();
  return (
    !text ||
    text === "FinanceApp" ||
    /^[\d\s.,:/()+·٪%–—-]+$/.test(text) ||
    /^v\d+$/i.test(text) ||
    /^(?:YYYY|MM|DD|HH|mm|ss)(?:[-/:](?:YYYY|MM|DD|HH|mm|ss))*$/.test(text) ||
    /^\d+(?:\.\d+)?$/.test(text)
  );
}

function stringValue(node, source) {
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}

function collectTranslatedCandidates(node) {
  const values = [];
  function visit(current) {
    if (ts.isConditionalExpression(current)) {
      visit(current.whenTrue);
      visit(current.whenFalse);
      return;
    }
    if (ts.isStringLiteralLike(current) || ts.isNoSubstitutionTemplateLiteral(current)) {
      values.push(current.text);
      return;
    }
    if (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isNonNullExpression(current)) {
      visit(current.expression);
    }
  }
  visit(node);
  return values;
}

function containsTranslationCall(node, source) {
  let found = false;
  function visit(current) {
    if (
      ts.isCallExpression(current) &&
      ts.isIdentifier(current.expression) &&
      ["t", "translate", "translateAppText"].includes(current.expression.text)
    ) found = true;
    ts.forEachChild(current, visit);
  }
  visit(node);
  return found;
}

const translatedAttributeComponents = new Set([
  "Button", "Chips", "EmptyBlock", "Field", "FormModal", "HeaderAction",
  "Input", "ScreenHeader", "Stat", "ToggleRow", "SectionHeader", "ActionRow",
]);
const translatedAttributeNames = new Set(["label", "title", "subtitle", "hint", "body", "placeholder", "l", "d"]);

for (const absolutePath of files) {
  const relativePath = path.relative(root, absolutePath);
  const source = ts.createSourceFile(
    absolutePath,
    fs.readFileSync(absolutePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const screenKey = relativePath.startsWith("app/")
    ? relativePath.replace(/^app\//, "").replace(/\.(tsx?|jsx?)$/, "")
    : relativePath;
  let literalKeyCount = 0;

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      /(LABELS?|PERIODS|FREQS)$/i.test(node.name.text) &&
      node.initializer
    ) {
      for (const candidate of collectTranslatedCandidates(node.initializer)) {
        if (isExcludedVisibleText(candidate)) continue;
        addCandidate(screenKey, candidate);
        if (!arabic.has(candidate)) missingKeys.push(`${relativePath}: ${candidate}`);
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      node.type?.getText(source).includes("LocalizedPluralForms") &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      const arabicForms = node.initializer.properties.find(
        (property) => ts.isPropertyAssignment(property) && property.name.getText(source) === "ar",
      );
      if (arabicForms && ts.isPropertyAssignment(arabicForms) && ts.isObjectLiteralExpression(arabicForms.initializer)) {
        for (const form of arabicForms.initializer.properties) {
          if (!ts.isPropertyAssignment(form)) continue;
          const key = stringValue(form.initializer, source);
          if (key === undefined) continue;
          addCandidate(screenKey, key);
          if (!arabic.has(key)) missingKeys.push(`${relativePath}: ${key}`);
        }
      }
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["t", "translate", "translateAppText"].includes(node.expression.text) &&
      node.arguments.length > 0
    ) {
      const key = stringValue(node.arguments[0], source);
      if (key !== undefined) {
        addCandidate(screenKey, key);
        literalKeyCount++;
        if (!arabic.has(key)) missingKeys.push(`${relativePath}: ${key}`);
      } else {
        dynamicLocalizationCalls.push(`${relativePath}: ${node.expression.text}(${node.arguments[0].getText(source)})`);
        for (const candidate of collectTranslatedCandidates(node.arguments[0])) {
          if (isExcludedVisibleText(candidate)) continue;
          addCandidate(screenKey, candidate);
          if (!arabic.has(candidate)) missingKeys.push(`${relativePath}: ${candidate}`);
        }
      }
    }

    if (ts.isJsxText(node) && uiFileSet.has(absolutePath)) {
      const value = node.text.replace(/\s+/g, " ").trim();
      if (!isExcludedVisibleText(value) && !legalFiles.has(path.basename(absolutePath))) {
        untranslatedText.push(`${relativePath}: ${JSON.stringify(value)}`);
      }
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const componentName = node.tagName.getText(source).split(".").pop();
      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute) || !ts.isIdentifier(attribute.name)) continue;
        if (!translatedAttributeNames.has(attribute.name.text)) continue;
        if (!translatedAttributeComponents.has(componentName)) continue;
        if (!attribute.initializer) continue;
        const values = ts.isStringLiteral(attribute.initializer)
          ? [attribute.initializer.text]
          : ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression
            ? collectTranslatedCandidates(attribute.initializer.expression)
            : [];
        for (const key of values) {
          if (isExcludedVisibleText(key) || /^\d/.test(key) || /^(?:e\.g\.|example)/i.test(key)) continue;
          addCandidate(screenKey, key);
          if (!arabic.has(key)) missingKeys.push(`${relativePath}: ${key}`);
        }
      }
    }

    if (
      uiFileSet.has(absolutePath) &&
      path.basename(absolutePath) !== "legal.tsx" &&
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      translatedAttributeNames.has(node.name.text)
    ) {
      const value = stringValue(node.initializer, source);
      if (value !== undefined && !isExcludedVisibleText(value) && !/^(?:e\.g\.|example)/i.test(value)) {
        addCandidate(screenKey, value);
        if (!arabic.has(value)) missingKeys.push(`${relativePath}: ${value}`);
      }
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(source) === "Alert" &&
      node.expression.name.text === "alert"
    ) {
      for (const argument of node.arguments.slice(0, 2)) {
        const value = stringValue(argument, source);
        if (value !== undefined && !containsTranslationCall(argument, source)) {
          untranslatedAlerts.push(`${relativePath}: ${value}`);
        }
      }
    }

    if (
      ts.isNewExpression(node) &&
      node.expression.getText(source) === "Error" &&
      node.arguments?.length > 0
    ) {
      const value = stringValue(node.arguments[0], source);
      const isProviderInvariant = value && /^use(?:Auth|Finance|Preferences) must be used (?:within|inside) /.test(value);
      if (value !== undefined && !isProviderInvariant && !isExcludedVisibleText(value)) {
        addCandidate(screenKey, value);
        if (!arabic.has(value)) missingErrorKeys.push(`${relativePath}: ${value}`);
      }
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["setError", "setErr", "setMessage", "setNotice"].includes(node.expression.text) &&
      node.arguments.length > 0
    ) {
      const value = stringValue(node.arguments[0], source);
      if (value && !arabic.has(value)) missingErrorKeys.push(`${relativePath}: ${value}`);
    }

    ts.forEachChild(node, visit);
  }
  visit(source);
  if (literalKeyCount > 0 && !usedByFile.has(screenKey)) usedByFile.set(screenKey, new Set());
  if (literalKeyCount > 0) usedByFile.get(screenKey).add(literalKeyCount);
}

const placeholderMismatches = [];
const emptyTranslations = [];
for (const [key, value] of arabic) {
  if (!value.trim()) emptyTranslations.push(key);
  if (JSON.stringify(placeholders(key)) !== JSON.stringify(placeholders(value))) {
    placeholderMismatches.push(key);
  }
}

const failures = [
  ...duplicateKeys.map((key) => `duplicate translation key: ${key}`),
  ...emptyTranslations.map((key) => `empty Arabic translation: ${key}`),
  ...placeholderMismatches.map((key) => `placeholder mismatch: ${key}`),
  ...missingKeys.map((entry) => `missing Arabic translation: ${entry}`),
  ...untranslatedText.map((entry) => `hardcoded UI text: ${entry}`),
  ...missingErrorKeys.map((entry) => `untranslated error key: ${entry}`),
  ...untranslatedAlerts.map((entry) => `untranslated alert: ${entry}`),
];

const uniqueCandidates = new Set([...candidateByFile.values()].flatMap((keys) => [...keys]));
const screenRows = [...candidateByFile.entries()]
  .map(([screen, keys]) => ({ screen, used: keys.size, translated: [...keys].filter((key) => arabic.has(key)).length }))
  .sort((a, b) => a.screen.localeCompare(b.screen));

console.log(`Arabic dictionary keys: ${arabic.size}`);
console.log(`Unique UI translation candidates: ${uniqueCandidates.size}`);
console.log(`Direct English/Arabic source-key coverage: ${uniqueCandidates.size ? ((uniqueCandidates.size - missingKeys.length) / uniqueCandidates.size * 100).toFixed(1) : "100.0"}%`);
console.log(`Screens with localized UI: ${screenRows.length}`);
console.log("Coverage by screen (localized unique keys / discovered candidate keys):");
for (const row of screenRows) console.log(`  ${row.screen}: ${row.translated}/${row.used}`);
console.log(`Dynamic translation calls requiring runtime value review: ${dynamicLocalizationCalls.length}`);

if (failures.length) {
  console.error("\nLocalization audit findings:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("\nLocalization audit passed: no missing/empty keys, placeholder mismatches, duplicate keys, raw JSX text, or untranslated static alerts/errors.");
}
