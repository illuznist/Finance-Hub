export function lockWhenBackgrounded(autoLockMinutes: number): boolean {
  return autoLockMinutes < 0;
}

export function lockOnResume(autoLockMinutes: number, elapsedMs: number): boolean {
  return autoLockMinutes < 0 || (autoLockMinutes > 0 && elapsedMs >= autoLockMinutes * 60_000);
}
