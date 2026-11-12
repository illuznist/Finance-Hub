/** Keep the savings amount on its own line when content or type is large. */
export function useStackedSavingsHeader(screenWidth: number, fontScale: number): boolean {
  return screenWidth <= 430 || fontScale >= 1.2;
}
