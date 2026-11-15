import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../../../supabase/migrations/20261115000000_optional_accounts_security.sql", import.meta.url),
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
  assert.match(migration, /revoke all on table public\.%I from anon, authenticated/i);
  assert.match(migration, /Users can read only their own role labels[\s\S]*auth\.uid\(\) = user_id/i);
  assert.match(migration, /values \(new\.id, 'USER'\)/);
  assert.match(migration, /unique index if not exists user_roles_single_super_admin/i);
  assert.match(migration, /grant execute on function public\.bootstrap_super_admin\(uuid, uuid\) to service_role/i);
  assert.match(migration, /insert into public\.user_roles[\s\S]*insert into public\.admin_audit_logs/i);
});
