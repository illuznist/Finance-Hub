import { gcm } from "@noble/ciphers/aes.js";
import { equalBytes } from "@noble/ciphers/utils.js";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

export const BACKUP_KDF = "PBKDF2-HMAC-SHA256";
export const BACKUP_KDF_ITERATIONS = 600_000;
export const MIN_BACKUP_KDF_ITERATIONS = 100_000;
export const MAX_BACKUP_KDF_ITERATIONS = 2_000_000;
export const AES_KEY_BYTES = 32;
export const GCM_NONCE_BYTES = 12;
export const KDF_SALT_BYTES = 16;

export type RandomBytes = (length: number) => Promise<Uint8Array>;

export async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations = BACKUP_KDF_ITERATIONS,
): Promise<Uint8Array> {
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_BACKUP_KDF_ITERATIONS) {
    throw new Error("The backup key settings are not supported.");
  }
  if (salt.length === 0) throw new Error("The backup salt is invalid.");
  return pbkdf2Async(sha256, password.normalize("NFKC"), salt, {
    c: iterations,
    dkLen: AES_KEY_BYTES,
    asyncTick: 8,
  });
}

export async function createPasswordVerifier(
  password: string,
  randomBytes: RandomBytes,
  iterations = BACKUP_KDF_ITERATIONS,
): Promise<{ algorithm: typeof BACKUP_KDF; iterations: number; salt: string; verifier: string }> {
  const salt = await checkedRandomBytes(randomBytes, KDF_SALT_BYTES);
  const key = await deriveKey(password, salt, iterations);
  return {
    algorithm: BACKUP_KDF,
    iterations,
    salt: bytesToHex(salt),
    verifier: bytesToHex(key),
  };
}

export async function verifyPasswordVerifier(
  password: string,
  record: { algorithm: string; iterations: number; salt: string; verifier: string },
): Promise<boolean> {
  if (
    record.algorithm !== BACKUP_KDF ||
    !Number.isInteger(record.iterations) ||
    record.iterations < MIN_BACKUP_KDF_ITERATIONS ||
    record.iterations > MAX_BACKUP_KDF_ITERATIONS ||
    !isHexOfLength(record.salt, KDF_SALT_BYTES) ||
    !isHexOfLength(record.verifier, AES_KEY_BYTES)
  ) {
    return false;
  }
  const expected = hexToBytes(record.verifier);
  const actual = await deriveKey(password, hexToBytes(record.salt), record.iterations);
  return equalBytes(actual, expected);
}

export async function encryptGcm(
  key: Uint8Array,
  plaintext: Uint8Array,
  additionalData: Uint8Array,
  randomBytes: RandomBytes,
): Promise<{ nonce: Uint8Array; ciphertext: Uint8Array }> {
  if (key.length !== AES_KEY_BYTES) throw new Error("Encryption key is invalid.");
  const nonce = await checkedRandomBytes(randomBytes, GCM_NONCE_BYTES);
  return { nonce, ciphertext: gcm(key, nonce, additionalData).encrypt(plaintext) };
}

export function decryptGcm(
  key: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  additionalData: Uint8Array,
): Uint8Array {
  if (key.length !== AES_KEY_BYTES || nonce.length !== GCM_NONCE_BYTES || ciphertext.length < 16) {
    throw new Error("The encrypted data is incomplete or unsupported.");
  }
  return gcm(key, nonce, additionalData).decrypt(ciphertext);
}

export function encodeBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const hasSecond = index + 1 < bytes.length;
    const hasThird = index + 2 < bytes.length;
    const second = hasSecond ? bytes[index + 1] : 0;
    const third = hasThird ? bytes[index + 2] : 0;
    output += alphabet[first >> 2];
    output += alphabet[((first & 3) << 4) | (second >> 4)];
    output += hasSecond ? alphabet[((second & 15) << 2) | (third >> 6)] : "=";
    output += hasThird ? alphabet[third & 63] : "=";
  }
  return output;
}

export function decodeBase64(value: string): Uint8Array {
  if (
    typeof value !== "string" ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    throw new Error("The backup file is damaged or has an invalid encoding.");
  }
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const output = new Uint8Array((value.length / 4) * 3 - (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0));
  let outputIndex = 0;
  for (let index = 0; index < value.length; index += 4) {
    const a = alphabet.indexOf(value[index]);
    const b = alphabet.indexOf(value[index + 1]);
    const c = value[index + 2] === "=" ? 0 : alphabet.indexOf(value[index + 2]);
    const d = value[index + 3] === "=" ? 0 : alphabet.indexOf(value[index + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) throw new Error("The backup file is damaged.");
    if (outputIndex < output.length) output[outputIndex++] = (a << 2) | (b >> 4);
    if (outputIndex < output.length) output[outputIndex++] = ((b & 15) << 4) | (c >> 2);
    if (outputIndex < output.length) output[outputIndex++] = ((c & 3) << 6) | d;
  }
  return output;
}

export function isHexOfLength(value: unknown, byteLength: number): value is string {
  return typeof value === "string" && value.length === byteLength * 2 && /^[0-9a-f]+$/i.test(value);
}

export function utf8(value: string): Uint8Array {
  return utf8ToBytes(value);
}

export function fromUtf8(value: Uint8Array): string {
  let output = "";
  for (let index = 0; index < value.length;) {
    const first = value[index++];
    if (first < 0x80) {
      output += String.fromCharCode(first);
    } else if ((first & 0xe0) === 0xc0 && index < value.length) {
      output += String.fromCodePoint(((first & 0x1f) << 6) | (value[index++] & 0x3f));
    } else if ((first & 0xf0) === 0xe0 && index + 1 < value.length) {
      output += String.fromCodePoint(((first & 0x0f) << 12) | ((value[index++] & 0x3f) << 6) | (value[index++] & 0x3f));
    } else if ((first & 0xf8) === 0xf0 && index + 2 < value.length) {
      output += String.fromCodePoint(((first & 0x07) << 18) | ((value[index++] & 0x3f) << 12) | ((value[index++] & 0x3f) << 6) | (value[index++] & 0x3f));
    } else {
      throw new Error("The encrypted data contains invalid text.");
    }
  }
  return output;
}

export function hex(value: Uint8Array): string {
  return bytesToHex(value);
}

export function unhex(value: string): Uint8Array {
  return hexToBytes(value);
}

export async function checkedRandomBytes(randomBytes: RandomBytes, length: number): Promise<Uint8Array> {
  const result = await randomBytes(length);
  if (!(result instanceof Uint8Array) || result.length !== length) {
    throw new Error("Secure random data is unavailable on this device.");
  }
  return new Uint8Array(result);
}
