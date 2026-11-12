import {
  createPasswordVerifier,
  verifyPasswordVerifier,
  type RandomBytes,
} from "./crypto.ts";

export const PIN_VERIFIER_KEY = "finance_pin_verifier_v2";
export const PIN_ATTEMPTS_KEY = "finance_pin_attempts_v1";
export const PIN_LENGTH = 4;

export type PinVerifierRecord = {
  version: 1;
  algorithm: "PBKDF2-HMAC-SHA256";
  iterations: number;
  salt: string;
  verifier: string;
};

export type PinSecretStore = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

export async function savePinVerifier(
  pin: string,
  secrets: PinSecretStore,
  randomBytes: RandomBytes,
): Promise<void> {
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) {
    throw new Error(`Enter a ${PIN_LENGTH}-digit PIN.`);
  }
  const verifier = await createPasswordVerifier(pin, randomBytes);
  await secrets.set(PIN_VERIFIER_KEY, JSON.stringify({ version: 1, ...verifier }));
  await secrets.remove(PIN_ATTEMPTS_KEY);
}

export async function verifyPinVerifier(
  pin: string,
  serializedVerifier: string,
): Promise<boolean> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serializedVerifier);
  } catch {
    throw new Error("PIN protection data is unreadable.");
  }
  const value = parsed as Partial<PinVerifierRecord> | null;
  if (
    !value ||
    value.version !== 1 ||
    value.algorithm !== "PBKDF2-HMAC-SHA256" ||
    !Number.isInteger(value.iterations) ||
    typeof value.salt !== "string" ||
    typeof value.verifier !== "string"
  ) {
    throw new Error("PIN protection data is unreadable.");
  }
  return verifyPasswordVerifier(pin, value as PinVerifierRecord);
}

export async function clearPinVerifier(secrets: PinSecretStore): Promise<void> {
  await secrets.remove(PIN_VERIFIER_KEY);
  await secrets.remove(PIN_ATTEMPTS_KEY);
}
