import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../../../supabase/migrations/20261115000000_optional_accounts_security.sql", import.meta.url),
  "utf8",
);
const bootstrapSafeguardsMigration = readFileSync(
  new URL("../../../../supabase/migrations/20261116000000_super_admin_bootstrap_safeguards.sql", import.meta.url),
  "utf8",
);

test("Stage C migration contains only account metadata and enables RLS on every table", () => {
  const tableNames = [
    "user_roles",
    "promotional_grants",
    "revenuecat_identity_links",
    "admin_audit_logs",
    "webhook_inbox",
  ];
  for (const table of tableNames) {
    assert.match(migration, new RegExp(`'${table}'`));
    assert.match(migration, new RegExp(`public\\.${table}`));
  }
  assert.match(migration, /enable row level security/i);
  assert.doesNotMatch(migration, /create table[^;]*\b(transactions|wallets|accounts|ledger|financial_records)\b/i);
});

test("role assignment is server controlled and the bootstrap audit is atomic", () => {
  assert.match(migration, /revoke all on table public\.%I from public, anon, authenticated/i);
  assert.match(migration, /Users can read only their own role labels[\s\S]*auth\.uid\(\) = user_id/i);
  assert.match(migration, /values \(new\.id, 'USER'\)/);
  assert.match(migration, /unique index if not exists user_roles_single_super_admin/i);
  assert.match(migration, /revoke all on function public\.assign_default_user_role\(\)[\s\S]*from public, anon, authenticated, service_role/i);
  assert.match(migration, /revoke all on function public\.bootstrap_super_admin\(uuid, uuid\)[\s\S]*from public, anon, authenticated, service_role/i);
  assert.match(migration, /grant execute on function public\.bootstrap_super_admin\(uuid, uuid\) to service_role/i);
  assert.match(migration, /insert into public\.user_roles[\s\S]*insert into public\.admin_audit_logs/i);
});

test("follow-up bootstrap migration binds the confirmed target and avoids false actor attribution", () => {
  assert.match(
    bootstrapSafeguardsMigration,
    /drop function if exists public\.bootstrap_super_admin\(uuid, uuid\)/i,
  );
  assert.match(
    bootstrapSafeguardsMigration,
    /bootstrap_super_admin\([\s\S]*target_user_id uuid,[\s\S]*confirmed_target_user_id uuid,[\s\S]*operation_id uuid/i,
  );
  assert.match(
    bootstrapSafeguardsMigration,
    /target_user_id is null[\s\S]*confirmed_target_user_id is distinct from target_user_id/i,
  );
  assert.match(
    bootstrapSafeguardsMigration,
    /if existing_user_id = target_user_id then\s*return 'already-configured'/i,
  );
  assert.match(
    bootstrapSafeguardsMigration,
    /raise exception 'A Super Admin is already configured'/i,
  );
  assert.match(
    bootstrapSafeguardsMigration,
    /values\s*\(\s*target_user_id\s*,\s*'SUPER_ADMIN'\s*,\s*null\s*\)/i,
  );
  assert.match(
    bootstrapSafeguardsMigration,
    /values\s*\(\s*null\s*,\s*target_user_id\s*,\s*'bootstrap_super_admin'\s*,\s*'succeeded'/i,
  );
  assert.match(bootstrapSafeguardsMigration, /'source',\s*'service_role_bootstrap_rpc'/i);
  assert.match(bootstrapSafeguardsMigration, /'approval_mode',\s*'exact_target_uuid_confirmation'/i);
  assert.match(bootstrapSafeguardsMigration, /'approved_target_user_id',\s*target_user_id/i);
  assert.match(
    bootstrapSafeguardsMigration,
    /revoke update, delete, truncate on table public\.admin_audit_logs\s+from service_role/i,
  );
  assert.match(
    bootstrapSafeguardsMigration,
    /grant execute on function public\.bootstrap_super_admin\(uuid, uuid, uuid\)\s+to service_role/i,
  );
  assert.doesNotMatch(
    bootstrapSafeguardsMigration,
    /grant execute on function public\.bootstrap_super_admin\(uuid, uuid, uuid\)\s+to authenticated/i,
  );
});
