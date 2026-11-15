const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const sourcePath = path.join(__dirname, "../../lib/secureSessionStorage.ts");
const source = fs.readFileSync(sourcePath, "utf8")
  .replace('import { randomUUID } from "expo-crypto";', 'const randomUUID = () => "123e4567-e89b-12d3-a456-426614174000";');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const cjsModule = { exports: {} };
new Function("module", "exports", compiled)(cjsModule, cjsModule.exports);
const { createSecureSessionStorage, SECURE_SESSION_CHUNK_LIMIT_BYTES } = cjsModule.exports;

function createStore() {
  const values = new Map();
  return {
    values,
    async getItemAsync(key) { return values.get(key) ?? null; },
    async setItemAsync(key, value) { values.set(key, value); },
    async deleteItemAsync(key) { values.delete(key); },
  };
}

test("secure session adapter stores large Unicode sessions in bounded chunks", async () => {
  const nativeStore = createStore();
  const storage = createSecureSessionStorage(nativeStore);
  const session = JSON.stringify({ token: "a".repeat(6500), displayName: "منظور 👋".repeat(400) });

  await storage.setItem("auth-session", session);
  assert.equal(await storage.getItem("auth-session"), session);
  for (const [key, value] of nativeStore.values) {
    if (key.startsWith("auth-session.chunk.")) {
      assert.ok(Buffer.byteLength(value, "utf8") <= SECURE_SESSION_CHUNK_LIMIT_BYTES);
    }
  }
});

test("new secure session writes publish atomically and retain the old session on failure", async () => {
  const nativeStore = createStore();
  const storage = createSecureSessionStorage(nativeStore);
  await storage.setItem("auth-session", "old session");

  const originalSet = nativeStore.setItemAsync;
  let failChunk = true;
  nativeStore.setItemAsync = async (key, value) => {
    if (failChunk && key.includes(".chunk.")) {
      failChunk = false;
      throw new Error("storage unavailable");
    }
    return originalSet(key, value);
  };

  await assert.rejects(() => storage.setItem("auth-session", "new session"), /storage unavailable/);
  assert.equal(await storage.getItem("auth-session"), "old session");
});

test("removing a session deletes its manifest and encrypted chunks", async () => {
  const nativeStore = createStore();
  const storage = createSecureSessionStorage(nativeStore);
  await storage.setItem("auth-session", "session payload".repeat(200));
  await storage.removeItem("auth-session");
  assert.equal(await storage.getItem("auth-session"), null);
  assert.equal(nativeStore.values.size, 0);
});
