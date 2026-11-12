const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { readStaticFile, resolveStaticPath } = require("../safeStaticPath");

test("resolves existing files only inside the static root", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "finance-static-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "assets"));
  fs.writeFileSync(path.join(root, "assets", "app.js"), "ok");

  assert.equal(resolveStaticPath(root, "/assets/app.js"), path.join(root, "assets", "app.js"));
  assert.equal(resolveStaticPath(root, "/assets/missing.js"), path.join(root, "assets", "missing.js"));
  assert.deepEqual(readStaticFile(root, "/assets/app.js", "utf8"), {
    status: "ok",
    filePath: path.join(root, "assets", "app.js"),
    content: "ok",
  });
  assert.equal(readStaticFile(root, "/assets/missing.js").status, "not-found");
  assert.equal(readStaticFile(root, "/../private.txt").status, "forbidden");
});

test("rejects encoded, plain, and backslash traversal paths", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "finance-static-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const outside = path.join(path.dirname(root), "secret-finance-file.txt");
  fs.writeFileSync(outside, "private");
  t.after(() => fs.rmSync(outside, { force: true }));

  for (const requestPath of [
    "/../secret-finance-file.txt",
    "/%2e%2e/secret-finance-file.txt",
    "/..%2fsecret-finance-file.txt",
    "/..\\secret-finance-file.txt",
    "/%00secret.txt",
    "/%ZZ",
  ]) {
    assert.equal(resolveStaticPath(root, requestPath), null, requestPath);
  }
});

test("rejects symlinks that point outside the static root", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "finance-static-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "finance-outside-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outside, "secret.txt"), "private");
  fs.symlinkSync(outside, path.join(root, "linked"), "dir");

  assert.equal(resolveStaticPath(root, "/linked/secret.txt"), null);
  assert.equal(readStaticFile(root, "/linked/secret.txt").status, "forbidden");
});
