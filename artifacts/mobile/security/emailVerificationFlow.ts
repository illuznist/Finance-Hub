export type AuthCallbackOutcome = "confirmed" | "recovery";
export type EmailVerificationScreenStatus =
  | "confirmed"
  | "already-verified"
  | "failed"
  | "setup";

export type EmailVerificationCallbackState = AuthCallbackOutcome | "failed" | null;

export function resolveEmailVerificationScreenStatus(
  callbackState: EmailVerificationCallbackState,
  sessionIsVerified: boolean,
): EmailVerificationScreenStatus {
  if (callbackState === "confirmed") return "confirmed";
  if (callbackState === "failed") return "failed";
  if (callbackState === "recovery") return "setup";
  return sessionIsVerified ? "already-verified" : "setup";
}

export async function continueAfterEmailVerification(
  status: EmailVerificationScreenStatus,
  navigate: () => void | Promise<void>,
): Promise<{ status: EmailVerificationScreenStatus; navigationFailed: boolean }> {
  try {
    await navigate();
    return { status, navigationFailed: false };
  } catch {
    // Keep confirmation status independent from a later routing failure.
    return { status, navigationFailed: true };
  }
}
