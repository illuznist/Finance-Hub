const test = require("node:test");
const assert = require("node:assert/strict");
const { useStackedSavingsHeader } = require("../presentationLayout.ts");

test("savings amount gets a full-width row on narrow screens and accessible type scales", () => {
  assert.equal(useStackedSavingsHeader(375, 1), true);
  assert.equal(useStackedSavingsHeader(430, 1.1), true);
  assert.equal(useStackedSavingsHeader(431, 1), false);
  assert.equal(useStackedSavingsHeader(700, 1.3), true);
});
