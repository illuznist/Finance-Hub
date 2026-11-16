/**
 * Deduplicate PKCE callback exchanges by the authorization code itself.
 * Expo can deliver the same code through route params and a Linking URL whose
 * string forms differ. A PKCE authorization code must only be exchanged once.
 */
export function createSingleUseAuthCodeExchange<T>(
  exchange: (code: string) => Promise<T>,
): (code: string) => Promise<T> {
  const exchanges = new Map<string, Promise<T>>();

  return (code: string) => {
    const existing = exchanges.get(code);
    if (existing) return existing;

    const pending = Promise.resolve().then(() => exchange(code));
    exchanges.set(code, pending);
    return pending;
  };
}
