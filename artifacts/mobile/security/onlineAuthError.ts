export type OnlineAuthErrorCategory = "rate-limit" | "network" | "unknown";

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
  const value = error as ErrorLike | null;
  const status = value && typeof value.status === "number" ? value.status : undefined;
  const code = value && typeof value.code === "string" ? value.code.toLowerCase() : "";
  const name = value && typeof value.name === "string" ? value.name.toLowerCase() : "";
  const message = value && typeof value.message === "string" ? value.message.toLowerCase() : "";

  if (status === 429 || /rate.?limit|too.?many.?requests|email.*rate/.test(`${code} ${message}`)) {
    return "rate-limit";
  }
  if (
    error instanceof TypeError ||
    name.includes("retryablefetch") ||
    /network|fetch failed|failed to fetch|request timeout|timed out/.test(message)
  ) {
    return "network";
  }
  return "unknown";
}
