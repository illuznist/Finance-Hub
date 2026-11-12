export type AppLockStatus = "open" | "locked";

/**
 * Select the status after auth and finance storage finish loading, then handle
 * later preference changes without locking the user out of the setup screen.
 */
export function nextAppLockStatus(
  initialized: boolean,
  pinEnabled: boolean,
): AppLockStatus | null {
  if (!initialized) return pinEnabled ? "locked" : "open";
  return pinEnabled ? null : "open";
}

export function lockWhenBackgrounded(autoLockMinutes: number): boolean {
  return autoLockMinutes < 0;
}

export function lockOnResume(autoLockMinutes: number, elapsedMs: number): boolean {
  return autoLockMinutes < 0 || (autoLockMinutes > 0 && elapsedMs >= autoLockMinutes * 60_000);
}
