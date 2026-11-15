import test from "node:test";
import assert from "node:assert/strict";

import { createSupabaseAdminClient, isSupabaseSecretKey } from "./supabase";

test("only a modern Supabase secret key can create the privileged server client", () => {
  const secretKey = `sb_secret_${"test".repeat(16)}`;
  assert.equal(isSupabaseSecretKey(secretKey), true);
  assert.equal(isSupabaseSecretKey("sb_secret_"), false);
  assert.equal(isSupabaseSecretKey("sb_publishable_test"), false);
  assert.equal(isSupabaseSecretKey("legacy-service-role-placeholder"), false);
  assert.equal(createSupabaseAdminClient("https://example.supabase.co", secretKey) !== null, true);
  assert.equal(createSupabaseAdminClient("https://example.supabase.co", "legacy-placeholder"), null);
  assert.equal(createSupabaseAdminClient("", secretKey), null);
});
