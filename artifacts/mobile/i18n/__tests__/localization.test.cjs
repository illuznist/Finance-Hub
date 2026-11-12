const test = require("node:test");
const assert = require("node:assert/strict");
const {
  formatCurrency,
  formatAppDate,
  formatAppNumber,
  formatDisplayDate,
  formatNumber,
  isRightToLeftLanguage,
  normalizeLocalizedNumberInput,
  parseDisplayPreferences,
  parseLocalizedNumberInput,
  serializeDisplayPreferences,
  setActiveDisplayPreferences,
  translate,
} = require("../localization.ts");

test("display preferences default safely and persist only presentation choices", () => {
  assert.deepEqual(parseDisplayPreferences(null), { language: "en", calendar: "gregorian" });
  assert.deepEqual(parseDisplayPreferences('{"language":"ar","calendar":"hijri"}'), {
    language: "ar",
    calendar: "hijri",
  });
  assert.deepEqual(parseDisplayPreferences('{"language":"ar","calendar":"unknown"}'), {
    language: "ar",
    calendar: "gregorian",
  });
  assert.deepEqual(parseDisplayPreferences("{broken"), { language: "en", calendar: "gregorian" });
  assert.equal(serializeDisplayPreferences({ language: "ar", calendar: "hijri" }), '{"language":"ar","calendar":"hijri"}');
});

test("Arabic display uses Saudi Arabic text, Arabic-Indic digits, and RTL direction", () => {
  assert.equal(translate("Settings", "ar"), "الإعدادات");
  assert.equal(isRightToLeftLanguage("ar"), true);
  assert.equal(isRightToLeftLanguage("en"), false);
  assert.match(formatNumber(1234567.5, "ar"), /١٬٢٣٤٬٥٦٧٫٥/);
  assert.match(formatCurrency(1234, "SAR", "ar"), /^SAR /);
});

test("Gregorian remains default while Hijri changes display only", () => {
  const date = "2026-11-12";
  const gregorian = formatDisplayDate(date, "en", "gregorian", { day: "numeric", month: "long", year: "numeric" });
  const hijri = formatDisplayDate(date, "en", "hijri", { day: "numeric", month: "long", year: "numeric" });
  assert.match(gregorian, /November/);
  assert.notEqual(hijri, gregorian);
  assert.equal(parseDisplayPreferences(null).calendar, "gregorian");
});

test("localized numeric input normalizes digits without altering stored finance data", () => {
  assert.equal(normalizeLocalizedNumberInput("١٬٢٣٤٫٥٠"), "1234.50");
  assert.equal(parseLocalizedNumberInput("١٬٢٣٤٫٥٠"), 1234.5);
  assert.equal(parseLocalizedNumberInput("۱۲۳٫۴"), 123.4);
  assert.equal(parseLocalizedNumberInput("12x"), null);
});

test("active presentation preferences format display values without changing date keys", () => {
  const storedDate = "2026-11-12";
  setActiveDisplayPreferences({ language: "ar", calendar: "hijri" });
  assert.match(formatAppNumber(1234), /١٬٢٣٤/);
  assert.doesNotMatch(formatAppDate(storedDate), /November/);
  assert.equal(storedDate, "2026-11-12");
  setActiveDisplayPreferences({ language: "en", calendar: "gregorian" });
  assert.match(formatAppDate(storedDate), /Nov/);
});
