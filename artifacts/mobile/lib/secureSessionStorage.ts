import { randomUUID } from "expo-crypto";

type NativeSecureStore = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

type ChunkManifest = {
  __financeHubSecureSession: 1;
  id: string;
  count: number;
};

const MAX_CHUNK_BYTES = 1500;
const MAX_CHUNKS = 512;

function utf8Length(value: string): number {
  const codePoint = value.codePointAt(0) ?? 0;
  if (codePoint <= 0x7f) return 1;
  if (codePoint <= 0x7ff) return 2;
  if (codePoint <= 0xffff) return 3;
  return 4;
}

function splitUtf8(value: string, maxBytes = MAX_CHUNK_BYTES): string[] {
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;

  for (const character of value) {
    const bytes = utf8Length(character);
    if (current && currentBytes + bytes > maxBytes) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }
    current += character;
    currentBytes += bytes;
  }
  if (current || chunks.length === 0) chunks.push(current);
  return chunks;
}

function parseManifest(value: string | null): ChunkManifest | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ChunkManifest>;
    if (
      parsed.__financeHubSecureSession === 1 &&
      typeof parsed.id === "string" &&
      /^[0-9a-f-]{36}$/i.test(parsed.id) &&
      Number.isInteger(parsed.count) &&
      Number(parsed.count) > 0 &&
      Number(parsed.count) <= MAX_CHUNKS
    ) {
      return parsed as ChunkManifest;
    }
  } catch {
    return null;
  }
  return null;
}

function chunkKey(key: string, id: string, index: number): string {
  return `${key}.chunk.${id}.${index}`;
}

async function removeChunks(store: NativeSecureStore, key: string, manifest: ChunkManifest) {
  await Promise.all(
    Array.from({ length: manifest.count }, (_, index) =>
      store.deleteItemAsync(chunkKey(key, manifest.id, index)),
    ),
  );
}

export function createSecureSessionStorage(store: NativeSecureStore) {
  return {
    async getItem(key: string): Promise<string | null> {
      const value = await store.getItemAsync(key);
      const manifest = parseManifest(value);
      if (!manifest) return value;

      const chunks = await Promise.all(
        Array.from({ length: manifest.count }, (_, index) =>
          store.getItemAsync(chunkKey(key, manifest.id, index)),
        ),
      );
      if (chunks.some((chunk) => chunk === null)) return null;
      return chunks.join("");
    },

    async setItem(key: string, value: string): Promise<void> {
      const chunks = splitUtf8(value);
      if (chunks.length > MAX_CHUNKS) throw new Error("Secure session is too large to store.");

      const previousValue = await store.getItemAsync(key);
      const previousManifest = parseManifest(previousValue);
      const id = randomUUID();
      const manifest: ChunkManifest = {
        __financeHubSecureSession: 1,
        id,
        count: chunks.length,
      };
      let writtenChunks = 0;
      try {
        for (let index = 0; index < chunks.length; index++) {
          await store.setItemAsync(chunkKey(key, id, index), chunks[index]);
          writtenChunks++;
        }
        // Publish the new manifest last so an interrupted write preserves the prior session.
        await store.setItemAsync(key, JSON.stringify(manifest));
      } catch (error) {
        await Promise.all(
          Array.from({ length: writtenChunks }, (_, index) =>
            store.deleteItemAsync(chunkKey(key, id, index)).catch(() => {}),
          ),
        );
        throw error;
      }

      if (previousManifest) await removeChunks(store, key, previousManifest).catch(() => {});
    },

    async removeItem(key: string): Promise<void> {
      const value = await store.getItemAsync(key);
      const manifest = parseManifest(value);
      await store.deleteItemAsync(key);
      if (manifest) await removeChunks(store, key, manifest);
    },
  };
}

export const SECURE_SESSION_CHUNK_LIMIT_BYTES = MAX_CHUNK_BYTES;
