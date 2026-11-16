import {
  classifyOnlineAuthError,
  type OnlineAuthErrorCategory,
} from "./onlineAuthError.ts";

export type PasswordRecoveryUpdateOutcome =
  | { status: "confirmed"; cleanupFailed: boolean }
  | { status: "unconfirmed"; category: OnlineAuthErrorCategory };

/**
 * Separate Supabase's password-update result from best-effort local cleanup.
 * An ambiguous request error must not be described as a confirmed failure, and
 * a cleanup error after a confirmed update must never reverse that success.
 */
export async function updatePasswordWithCleanup(
  updatePassword: () => Promise<void>,
  onConfirmed: () => void,
  cleanup: () => void | Promise<void>,
): Promise<PasswordRecoveryUpdateOutcome> {
  try {
    await updatePassword();
  } catch (error) {
    return { status: "unconfirmed", category: classifyOnlineAuthError(error) };
  }

  onConfirmed();
  try {
    await cleanup();
    return { status: "confirmed", cleanupFailed: false };
  } catch {
    return { status: "confirmed", cleanupFailed: true };
  }
}
