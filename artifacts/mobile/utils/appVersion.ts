import Constants from "expo-constants";
import appConfig from "../app.json";

/**
 * Expo Go exposes the resolved config version. The bundled app.json keeps the
 * displayed version available in development if that runtime field is absent.
 */
export function getApplicationVersion(): string {
  const runtimeVersion = Constants.expoConfig?.version;
  if (typeof runtimeVersion === "string" && runtimeVersion.trim()) return runtimeVersion;
  return appConfig.expo.version;
}
