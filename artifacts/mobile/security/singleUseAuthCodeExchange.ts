/**
 * Deduplicate PKCE callback exchanges by the authorization code itself.
 * Expo can deliver the same code through route params and a Linking URL whose
 * string forms differ. A PKCE authorization code must only be exchanged once.
 */
export function createSingleUseAuthCodeExchange<T>(
  exchange: (code: string) => Promise<T>,
): (code: string) => Promise<T> {
  const exchanges = new Map<string, { promise: Promise<T>; settled: boolean }>();

  return (code: string) => {
    const existing = exchanges.get(code);
    if (existing) {
      if (existing.settled) {
        return Promise.reject(
          Object.assign(new Error("This authorization code has already been exchanged."), {
            name: "AuthCodeAlreadyExchangedError",
            code: "auth_code_already_exchanged",
          }),
        );
      }
      return existing.promise;
    }

    const pending = Promise.resolve().then(() => exchange(code));
    const entry = { promise: pending, settled: false };
    exchanges.set(code, entry);
    void pending.then(
      () => { entry.settled = true; },
      () => { entry.settled = true; },
    );
    return pending;
  };
}
