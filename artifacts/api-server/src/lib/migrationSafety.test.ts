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
const bootstrapReadinessAclFixMigration = readFileSync(
  new URL("../../../../supabase/migrations/20261117000000_fix_super_admin_readiness_empty_column_acl.sql", import.meta.url),
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
    /revoke all privileges on table public\.admin_audit_logs from service_role/i,
  );
  assert.match(
    bootstrapSafeguardsMigration,
    /grant select, insert on table public\.admin_audit_logs to service_role/i,
  );
  assert.match(
    bootstrapSafeguardsMigration,
    /grant execute on function public\.bootstrap_super_admin\(uuid, uuid, uuid\)\s+to service_role/i,
  );
  assert.doesNotMatch(
    bootstrapSafeguardsMigration,
    /grant execute on function public\.bootstrap_super_admin\(uuid, uuid, uuid\)\s+to authenticated/i,
  );
  assert.match(
    bootstrapSafeguardsMigration,
    /create or replace function public\.check_super_admin_bootstrap_readiness\(\)\s+returns jsonb/i,
  );
  assert.match(
    bootstrapSafeguardsMigration,
    /revoke all on function public\.check_super_admin_bootstrap_readiness\(\)\s+from public, anon, authenticated, service_role/i,
  );
  assert.match(
    bootstrapSafeguardsMigration,
    /grant execute on function public\.check_super_admin_bootstrap_readiness\(\)\s+to service_role/i,
  );
  assert.match(bootstrapSafeguardsMigration, /has_table_privilege/i);
  assert.match(bootstrapSafeguardsMigration, /has_column_privilege/i);
  assert.match(bootstrapSafeguardsMigration, /audit_column_privileges_ok/i);
  assert.match(bootstrapSafeguardsMigration, /pg_attribute/i);
  assert.match(
    bootstrapSafeguardsMigration,
    /aclexplode\(\s*coalesce\(\s*column_attribute\.attacl/i,
  );
  assert.match(bootstrapSafeguardsMigration, /pg_has_role/i);
  assert.match(bootstrapSafeguardsMigration, /when privilege\.grantee = 0 then true/i);
  assert.match(bootstrapSafeguardsMigration, /when column_privilege\.grantee = 0 then true/i);
  assert.match(
    bootstrapSafeguardsMigration,
    /revoke update \(%i\)[\s\S]*revoke references \(%i\)/i,
  );
  for (const privilege of [
    "UPDATE",
    "DELETE",
    "TRUNCATE",
    "REFERENCES",
    "TRIGGER",
    "MAINTAIN",
  ]) {
    assert.match(
      bootstrapSafeguardsMigration,
      new RegExp(`has_table_privilege\\([\\s\\S]*'${privilege}'`, "i"),
    );
  }
  assert.match(bootstrapSafeguardsMigration, /single_super_admin_guard_ok/i);
  assert.match(bootstrapSafeguardsMigration, /i\.indrelid[\s\S]*public\.user_roles/i);
  assert.match(bootstrapSafeguardsMigration, /i\.indisready[\s\S]*i\.indisvalid/i);
  assert.match(bootstrapSafeguardsMigration, /i\.indnatts = 1[\s\S]*i\.indnkeyatts = 1/i);
  assert.match(
    bootstrapSafeguardsMigration,
    /pg_get_indexdef\(i\.indexrelid, 1, true\)[\s\S]*= 'role'/i,
  );
  assert.match(
    bootstrapSafeguardsMigration,
    /pg_get_expr\(i\.indpred, i\.indrelid\)[\s\S]*'role=''super_admin''::text'/i,
  );
  assert.doesNotMatch(
    bootstrapSafeguardsMigration,
    /pg_get_expr\(i\.indpred, i\.indrelid\)\s+ilike/i,
  );
  const readinessFunction = bootstrapSafeguardsMigration.slice(
    bootstrapSafeguardsMigration.indexOf(
      "create or replace function public.check_super_admin_bootstrap_readiness()",
    ),
  );
  assert.doesNotMatch(
    readinessFunction,
    /\b(?:perform|select)\s+public\.bootstrap_super_admin\s*\(/i,
  );
  assert.doesNotMatch(
    bootstrapSafeguardsMigration,
    /grant all on table public\.admin_audit_logs to service_role/i,
  );
});

test("readiness ACL fix treats NULL column ACLs as having no ACL entries", () => {
  assert.match(
    bootstrapReadinessAclFixMigration,
    /create or replace function public\.check_super_admin_bootstrap_readiness\(\)/i,
  );
  assert.match(
    bootstrapReadinessAclFixMigration,
    /when column_attribute\.attacl is null\s+or pg_catalog\.cardinality\(column_attribute\.attacl\) = 0\s+then false/i,
  );
});

test("readiness ACL fix skips aclexplode for empty column ACL arrays", () => {
  assert.match(
    bootstrapReadinessAclFixMigration,
    /pg_catalog\.cardinality\(column_attribute\.attacl\) = 0\s+then false/i,
  );
  assert.match(
    bootstrapReadinessAclFixMigration,
    /else exists\s*\([\s\S]*?pg_catalog\.aclexplode\(column_attribute\.attacl\)/i,
  );
  assert.doesNotMatch(
    bootstrapReadinessAclFixMigration,
    /aclexplode\(\s*coalesce\(\s*column_attribute\.attacl/i,
  );
});

test("readiness ACL fix preserves the fail-closed privilege checks", () => {
  assert.match(
    bootstrapReadinessAclFixMigration,
    /privilege\.privilege_type not in \('SELECT', 'INSERT'\)/i,
  );
  assert.match(
    bootstrapReadinessAclFixMigration,
    /when privilege\.grantee = 0 then true/i,
  );
  assert.match(
    bootstrapReadinessAclFixMigration,
    /column_privilege\.grantee = 0 then true[\s\S]*?pg_catalog\.pg_has_role\([\s\S]*?column_privilege\.grantee,[\s\S]*?'USAGE'/i,
  );
  assert.match(
    bootstrapReadinessAclFixMigration,
    /has_table_privilege\([\s\S]*?'MAINTAIN'/i,
  );
  assert.match(
    bootstrapReadinessAclFixMigration,
    /has_column_privilege\([\s\S]*?'UPDATE'/i,
  );
  assert.match(
    bootstrapReadinessAclFixMigration,
    /has_column_privilege\([\s\S]*?'REFERENCES'/i,
  );
  assert.doesNotMatch(
    bootstrapReadinessAclFixMigration,
    /create function public\.bootstrap_super_admin/i,
  );
});
