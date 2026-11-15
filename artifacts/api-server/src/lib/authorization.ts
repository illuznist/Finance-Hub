export type AccountRole = "USER" | "ADMIN" | "SUPER_ADMIN";
export type ProAccessSource = "free" | "promotional" | "super_admin";

export type AuthorizationIdentity = {
  userId: string;
  email?: string;
  emailVerified: boolean;
  aal: string | null;
};

export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+([A-Za-z0-9._~-]+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export function isCompactJwt(token: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
}

export function decodeVerifiedAal(token: string, verifiedUserId: string): string | null {
  try {
    if (!isCompactJwt(token)) return null;
    const parts = token.split(".");
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      sub?: unknown;
      aal?: unknown;
    };
    if (claims.sub !== verifiedUserId || typeof claims.aal !== "string") return null;
    return claims.aal;
  } catch {
    return null;
  }
}

export function isAdminAuthorized(
  roles: readonly AccountRole[],
  aal: string | null,
  emailVerified: boolean,
): boolean {
  return emailVerified &&
    roles.some((role) => role === "ADMIN" || role === "SUPER_ADMIN") &&
    aal === "aal2";
}

export function resolveProAccess(
  roles: readonly AccountRole[],
  hasActivePromotionalGrant: boolean,
): { isPro: boolean; source: ProAccessSource } {
  if (roles.includes("SUPER_ADMIN")) return { isPro: true, source: "super_admin" };
  if (hasActivePromotionalGrant) return { isPro: true, source: "promotional" };
  return { isPro: false, source: "free" };
}
