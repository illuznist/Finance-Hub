const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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
  translatePlural,
} = require("../localization.ts");
const { applyDirectionPreference, getNativeDirectionStatus } = require("../rtlDirection.ts");

const resetForms = {
  en: {
    one: "One recurring expense was reset for {month}.",
    other: "{count} recurring expenses were reset for {month}.",
  },
  ar: {
    zero: "No recurring expenses were reset for {month}.",
    one: "One recurring expense was reset for {month}.",
    two: "Two recurring expenses were reset for {month}.",
    few: "{count} recurring expenses were reset for {month} (few).",
    many: "{count} recurring expenses were reset for {month} (many).",
    other: "{count} recurring expenses were reset for {month} (other).",
  },
};

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

test("native RTL changes report a restart without scheduling repeated reloads", () => {
  assert.deepEqual(getNativeDirectionStatus("en", "native", false), {
    targetIsRTL: false,
    restartRequired: false,
  });
  const arabicPending = getNativeDirectionStatus("ar", "native", false);
  assert.deepEqual(arabicPending, { targetIsRTL: true, restartRequired: true });
  assert.deepEqual(getNativeDirectionStatus("ar", "native", false), arabicPending);
  assert.deepEqual(getNativeDirectionStatus("ar", "native", true), {
    targetIsRTL: true,
    restartRequired: false,
  });
  assert.deepEqual(getNativeDirectionStatus("en", "native", true), {
    targetIsRTL: false,
    restartRequired: true,
  });
  assert.deepEqual(getNativeDirectionStatus("ar", "web", false), {
    targetIsRTL: true,
    restartRequired: false,
  });

  const provider = fs.readFileSync(
    path.join(__dirname, "../../context/PreferencesContext.tsx"),
    "utf8",
  );
  assert.doesNotMatch(provider, /reloadAppAsync/);
});

test("rapid language toggles always replace the pending native direction", () => {
  const requestedDirections = [];
  const arabic = applyDirectionPreference("ar", "native", false, target => requestedDirections.push(target));
  const english = applyDirectionPreference("en", "native", false, target => requestedDirections.push(target));
  assert.deepEqual(requestedDirections, [true, false]);
  assert.equal(arabic.restartRequired, true);
  assert.equal(english.restartRequired, false);
});

test("repeated language changes preserve the independent calendar preference", () => {
  let stored = serializeDisplayPreferences({ language: "en", calendar: "hijri" });
  for (const language of ["ar", "en", "ar", "en"]) {
    const current = parseDisplayPreferences(stored);
    stored = serializeDisplayPreferences({ ...current, language });
  }
  assert.deepEqual(parseDisplayPreferences(stored), { language: "en", calendar: "hijri" });
});

test("Arabic display uses Saudi Arabic text, Arabic-Indic digits, and RTL direction", () => {
  assert.equal(translate("Settings", "ar"), "الإعدادات");
  assert.equal(translate("Arabic", "ar"), "العربية");
  assert.equal(translate("Remove {name}?", "ar", { name: "Netflix" }), "هل تريد إزالة Netflix؟");
  assert.equal(isRightToLeftLanguage("ar"), true);
  assert.equal(isRightToLeftLanguage("en"), false);
  assert.match(formatNumber(1234567.5, "ar"), /١٬٢٣٤٬٥٦٧٫٥/);
  assert.match(formatCurrency(1234, "SAR", "ar"), /^SAR /);
});

test("Arabic plural forms select zero, one, two, few, many, and other with interpolation", () => {
  assert.equal(translatePlural(resetForms, "ar", 0, { month: "نوفمبر" }), "لم تُعد ضبط أي مصروفات متكررة لشهر نوفمبر.");
  assert.equal(translatePlural(resetForms, "ar", 1, { month: "نوفمبر" }), "تمت إعادة ضبط مصروف متكرر واحد لشهر نوفمبر.");
  assert.equal(translatePlural(resetForms, "ar", 2, { count: "٢", month: "نوفمبر" }), "تمت إعادة ضبط مصروفين متكررين لشهر نوفمبر.");
  assert.match(translatePlural(resetForms, "ar", 3, { count: "٣", month: "نوفمبر" }), /٣ مصروفات متكررة/);
  assert.match(translatePlural(resetForms, "ar", 11, { count: "١١", month: "نوفمبر" }), /١١ مصروفًا متكررًا/);
  assert.equal(
    translatePlural(resetForms, "en", 2, { month: "November" }),
    "2 recurring expenses were reset for November.",
  );
});

test("English and Arabic Gregorian/Hijri display combinations are supported", () => {
  const date = "2026-11-12";
  const opts = { day: "numeric", month: "long", year: "numeric" };
  const enGregorian = formatDisplayDate(date, "en", "gregorian", opts);
  const enHijri = formatDisplayDate(date, "en", "hijri", opts);
  const arGregorian = formatDisplayDate(date, "ar", "gregorian", opts);
  const arHijri = formatDisplayDate(date, "ar", "hijri", opts);
  assert.match(enGregorian, /November/);
  assert.notEqual(enHijri, enGregorian);
  assert.match(arGregorian, /٢٠٢٦/);
  assert.notEqual(arHijri, arGregorian);
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
