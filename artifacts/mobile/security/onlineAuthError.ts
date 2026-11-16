export type OnlineAuthErrorCategory = "rate-limit" | "network" | "unknown";
export type RecoveryLinkErrorCategory =
  | "expired-or-used"
  | "missing-verifier"
  | "rate-limit"
  | "network"
  | "unknown";

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  name?: unknown;
  status?: unknown;
};

/**
 * Convert Supabase/network failures into safe UI categories without displaying
 * raw server responses, which may contain account-specific details.
 */
export function classifyOnlineAuthError(error: unknown): OnlineAuthErrorCategory {
  const { status, code, name, message } = readError(error);

  if (status === 429 || /rate.?limit|too.?many.?requests|email.*rate/.test(`${code} ${message}`)) {
    return "rate-limit";
  }
  if (isNetworkError(error, name, message)) return "network";
  return "unknown";
}

export function classifyRecoveryLinkError(error: unknown): RecoveryLinkErrorCategory {
  const { status, code, name, message } = readError(error);
  if (name === "authpkcecodeverifiermissingerror" || code === "pkce_code_verifier_not_found") {
    return "missing-verifier";
  }
  if (status === 429 || /rate.?limit|too.?many.?requests/.test(`${code} ${message}`)) {
    return "rate-limit";
  }
  if (
    /otp_expired|flow_state_expired|flow_state_not_found|bad_code_verifier|invalid_grant/.test(code) ||
    /expired|already used|invalid.*(?:auth )?code|invalid grant/.test(message)
  ) {
    return "expired-or-used";
  }
  if (isNetworkError(error, name, message)) return "network";
  return "unknown";
}

function readError(error: unknown) {
  const value = error as ErrorLike | null;
  return {
    status: value && typeof value.status === "number" ? value.status : undefined,
    code: value && typeof value.code === "string" ? value.code.toLowerCase() : "",
    name: value && typeof value.name === "string" ? value.name.toLowerCase() : "",
    message: value && typeof value.message === "string" ? value.message.toLowerCase() : "",
  };
}

function isNetworkError(error: unknown, name: string, message: string): boolean {
  if (
    error instanceof TypeError ||
    name.includes("retryablefetch") ||
    /network|fetch failed|failed to fetch|request timeout|timed out/.test(message)
  ) {
    return true;
  }
  return false;
}
