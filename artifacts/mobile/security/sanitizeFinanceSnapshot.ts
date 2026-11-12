/**
 * Remove a device-only legacy PIN from a migration/recovery snapshot without
 * changing financial values. `null` means the snapshot was not rewritten.
 */
export function sanitizeLegacyFinanceSnapshot(raw: string): string | null {
  let snapshot: unknown;
  try {
    snapshot = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const record = snapshot as Record<string, unknown>;
  const settings = record.securitySettings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings) || !("pin" in settings)) {
    return null;
  }
  const cleanSettings = { ...(settings as Record<string, unknown>) };
  delete cleanSettings.pin;
  return JSON.stringify({ ...record, securitySettings: cleanSettings });
}
