import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createDevelopmentPurchaseAdapter, type EntitlementSnapshot } from "@/finance/developmentPurchaseAdapter";

interface EntitlementContextValue extends EntitlementSnapshot {
  isDevelopmentBuild: boolean;
  enableDevelopmentPreview: () => boolean;
  resetDevelopmentPreview: () => void;
}

const EntitlementContext = createContext<EntitlementContextValue | null>(null);

export function EntitlementProvider({ children }: { children: React.ReactNode }) {
  const isDevelopmentBuild = typeof __DEV__ !== "undefined" && __DEV__;
  const adapter = useMemo(() => createDevelopmentPurchaseAdapter(isDevelopmentBuild), [isDevelopmentBuild]);
  const [snapshot, setSnapshot] = useState<EntitlementSnapshot>(() => adapter.getSnapshot());

  const enableDevelopmentPreview = useCallback(() => {
    const enabled = adapter.enablePreview();
    if (enabled) setSnapshot(adapter.getSnapshot());
    return enabled;
  }, [adapter]);

  const resetDevelopmentPreview = useCallback(() => {
    adapter.resetPreview();
    setSnapshot(adapter.getSnapshot());
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
