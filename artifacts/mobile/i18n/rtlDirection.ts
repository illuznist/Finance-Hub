import { isRightToLeftLanguage, type AppLanguage } from "./localization.ts";

export type DirectionPlatform = "native" | "web";

export interface NativeDirectionStatus {
  targetIsRTL: boolean;
  restartRequired: boolean;
}

/**
 * Native layout-direction changes take effect only after the host app restarts.
 * Web can update its document direction immediately.
 */
export function getNativeDirectionStatus(
  language: AppLanguage,
  platform: DirectionPlatform,
  currentIsRTL: boolean,
): NativeDirectionStatus {
  const targetIsRTL = isRightToLeftLanguage(language);
  return {
    targetIsRTL,
    restartRequired: platform === "native" && currentIsRTL !== targetIsRTL,
  };
}

export function applyDirectionPreference(
  language: AppLanguage,
  platform: DirectionPlatform,
  currentIsRTL: boolean,
  applyNativeDirection: (targetIsRTL: boolean) => void,
): NativeDirectionStatus {
  const status = getNativeDirectionStatus(language, platform, currentIsRTL);
  if (platform === "native") applyNativeDirection(status.targetIsRTL);
  return status;
}
