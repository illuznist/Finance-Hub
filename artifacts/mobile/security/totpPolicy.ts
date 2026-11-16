import { normalizeLocalizedNumberInput } from "../i18n/localization";

export type TotpAssuranceDecision = "ready" | "challenge" | "stale" | "unsupported";

export function classifyTotpAssurance(
  currentLevel: string | null,
  nextLevel: string | null,
): TotpAssuranceDecision {
  if (currentLevel === "aal1" && nextLevel === "aal1") return "ready";
  if (currentLevel === "aal1" && nextLevel === "aal2") return "challenge";
  if (currentLevel === "aal2" && nextLevel === "aal2") return "ready";
  if (currentLevel === "aal2" && nextLevel === "aal1") return "stale";
  return "unsupported";
}

export function isVerifiedTotpFactor(factor: {
  factor_type?: string;
  status?: string;
}): boolean {
  return factor.factor_type === "totp" && factor.status === "verified";
}

export function normalizeTotpCode(value: string): string {
  return normalizeLocalizedNumberInput(value).replace(/[^0-9]/g, "").slice(0, 6);
}
