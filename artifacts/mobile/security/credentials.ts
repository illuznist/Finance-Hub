import {
  BACKUP_KDF,
  BACKUP_KDF_ITERATIONS,
  createPasswordVerifier,
  verifyPasswordVerifier,
  type RandomBytes,
} from "./crypto.ts";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

export interface CredentialVerifier {
  version: 1;
  algorithm: typeof BACKUP_KDF;
  iterations: number;
  salt: string;
  verifier: string;
}

export async function createCredentialVerifier(
  password: string,
  randomBytes: RandomBytes,
): Promise<CredentialVerifier> {
  const result = await createPasswordVerifier(password, randomBytes, BACKUP_KDF_ITERATIONS);
  return { version: 1, ...result };
}

export async function verifyCredentialVerifier(
  password: string,
  verifier: CredentialVerifier,
): Promise<boolean> {
  if (verifier.version !== 1) return false;
  return verifyPasswordVerifier(password, verifier);
}

/**
 * The old app hashed this exact prefix with its own SHA-256 helper.
 * This adapter preserves the old UTF-16-code-unit encoding so legacy logins
 * can be upgraded after successful authentication without resetting accounts.
 */
export function legacyPasswordDigest(email: string, password: string): string {
  const value = `financeapp:${email.toLowerCase().trim()}:${password}`;
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return bytesToHex(sha256(new Uint8Array(bytes)));
}
