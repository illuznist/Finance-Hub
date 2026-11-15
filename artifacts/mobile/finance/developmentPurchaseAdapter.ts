export type EntitlementSource =
  | "free"
  | "paid_purchase"
  | "promotional_grant"
  | "super_admin"
  | "development_preview";

export interface EntitlementSnapshot {
  isPro: boolean;
  source: EntitlementSource;
}

export interface DevelopmentPurchaseAdapter {
  readonly enabled: boolean;
  getSnapshot(): EntitlementSnapshot;
  enablePreview(): boolean;
  resetPreview(): void;
}

/**
 * In-memory testing adapter only. It has no storage or store access, and the
 * production instance is permanently unable to enable Pro.
 */
export function createDevelopmentPurchaseAdapter(enabled: boolean): DevelopmentPurchaseAdapter {
  let previewEnabled = false;
  return {
    enabled,
    getSnapshot: () => previewEnabled
      ? { isPro: true, source: "development_preview" }
      : { isPro: false, source: "free" },
    enablePreview: () => {
      if (!enabled) return false;
      previewEnabled = true;
      return true;
    },
    resetPreview: () => {
      previewEnabled = false;
    },
  };
}
