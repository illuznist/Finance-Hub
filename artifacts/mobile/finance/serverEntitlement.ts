import type { EntitlementSnapshot } from "./developmentPurchaseAdapter";

type AccountAccessRequestState = {
  isSuccess: boolean;
  isError: boolean;
  isFetching: boolean;
};

const FREE_ENTITLEMENT: EntitlementSnapshot = { isPro: false, source: "free" };

/**
 * Accept only a fresh access response for the currently signed-in account.
 * Paid access remains unavailable until verified store purchases are wired in.
 */
export function resolveServerEntitlement(
  currentUserId: string | null,
  data: unknown,
  request: AccountAccessRequestState,
): EntitlementSnapshot {
  if (
    !currentUserId ||
    !request.isSuccess ||
    request.isError ||
    request.isFetching ||
    !data ||
    typeof data !== "object"
  ) {
    return FREE_ENTITLEMENT;
  }

  const access = data as Record<string, unknown>;
  if (access.accountId !== currentUserId || access.isPro !== true) {
    return FREE_ENTITLEMENT;
  }

  if (access.proSource === "promotional") {
    return { isPro: true, source: "promotional_grant" };
  }
  if (access.proSource === "super_admin") {
    return { isPro: true, source: "super_admin" };
  }

  return FREE_ENTITLEMENT;
}
