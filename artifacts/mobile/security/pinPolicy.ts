/** Progressive PIN retry delay, capped so access is never permanently locked. */
export function pinDelayMs(failureCount: number): number {
  const exponent = Math.max(0, Math.min(5, Math.floor(failureCount) - 1));
  return Math.min(30_000, 1_000 * 2 ** exponent);
}
