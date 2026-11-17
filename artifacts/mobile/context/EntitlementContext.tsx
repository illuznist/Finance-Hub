import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useGetAccountAccess } from "@workspace/api-client-react";
import { createDevelopmentPurchaseAdapter, type EntitlementSnapshot } from "@/finance/developmentPurchaseAdapter";
import { resolveServerEntitlement } from "@/finance/serverEntitlement";
import { useOnlineAccount } from "@/context/OnlineAccountContext";

interface EntitlementContextValue extends EntitlementSnapshot {
  isDevelopmentBuild: boolean;
  enableDevelopmentPreview: () => boolean;
  resetDevelopmentPreview: () => void;
}

const EntitlementContext = createContext<EntitlementContextValue | null>(null);

export function EntitlementProvider({ children }: { children: React.ReactNode }) {
  const isDevelopmentBuild = typeof __DEV__ !== "undefined" && __DEV__;
  const online = useOnlineAccount();
  const accountAccess = useGetAccountAccess({
    query: {
      enabled: Boolean(online.user?.id) && !online.loading,
      queryKey: ["/api/account/access", online.user?.id ?? "signed-out"],
      retry: false,
      staleTime: 0,
    },
  });
  const serverSnapshot = resolveServerEntitlement(
    online.user?.id ?? null,
    accountAccess.data,
    {
      isSuccess: accountAccess.isSuccess,
      isError: accountAccess.isError,
      isFetching: accountAccess.isFetching,
    },
  );
  const adapter = useMemo(() => createDevelopmentPurchaseAdapter(isDevelopmentBuild), [isDevelopmentBuild]);
  const [previewSnapshot, setPreviewSnapshot] = useState<EntitlementSnapshot>(() => adapter.getSnapshot());
  const snapshot = previewSnapshot.source === "development_preview" ? previewSnapshot : serverSnapshot;

  const enableDevelopmentPreview = useCallback(() => {
    const enabled = adapter.enablePreview();
    if (enabled) setPreviewSnapshot(adapter.getSnapshot());
    return enabled;
  }, [adapter]);

  const resetDevelopmentPreview = useCallback(() => {
    adapter.resetPreview();
    setPreviewSnapshot(adapter.getSnapshot());
  }, [adapter]);

  const value = useMemo<EntitlementContextValue>(() => ({
    ...snapshot,
    isDevelopmentBuild,
    enableDevelopmentPreview,
    resetDevelopmentPreview,
  }), [snapshot, isDevelopmentBuild, enableDevelopmentPreview, resetDevelopmentPreview]);

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
}

export function useEntitlements(): EntitlementContextValue {
  const context = useContext(EntitlementContext);
  if (!context) throw new Error("useEntitlements must be used within EntitlementProvider");
  return context;
}
