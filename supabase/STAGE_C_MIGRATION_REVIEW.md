# Finance Hub Stage C — Database Migration Review

**Status:** Static review and source hardening complete. The live migration has not been run.

## Scope and live-project status

- Target is the new Frankfurt Supabase project in the Ctrl Studios organization. Use only its newly issued keys; the retired Tokyo project's exposed credentials are off-limits.
- The owner reports that the project is connected to Replit, both auth redirects are allowlisted, and Email confirmation is enabled.
- The four required Replit Secrets are present. Their values were not read, copied, or added to this repository.
- No live SQL preflight was run. Replit's SQL query tool targets Replit's managed PostgreSQL, not this external Supabase project. No Supabase SQL-management connection is available in the workspace.
- No migration, test-user creation, data write, bootstrap, purchase setup, or Stage D/E work was performed.

## Migration contents reviewed

The migration creates five metadata-only tables; it creates no financial-record tables:

| Table | Integrity and access notes |
| --- | --- |
| `user_roles` | `auth.users` foreign keys; role check limited to `USER`, `ADMIN`, `SUPER_ADMIN`; `(user_id, role)` primary key; partial unique index permits at most one `SUPER_ADMIN`. Authenticated clients receive only a self-row `SELECT` policy. |
| `promotional_grants` | User/grantor/revoker foreign keys; non-empty bounded reason; expiry/revocation metadata; partial index for active grants. No client policy or client table grant. |
| `revenuecat_identity_links` | User foreign key; unique RevenueCat app-user ID; verification timestamp and method constrained to the supported values. No client policy or client table grant. |
| `admin_audit_logs` | Actor/target foreign keys use `ON DELETE SET NULL` to preserve audit records; outcome is constrained; metadata must be a JSON object; recent-event index. |
| `webhook_inbox` | Stores event ID and processing metadata only, not provider payloads; provider, status, and field lengths are constrained. No client policy or client table grant. |

RLS is enabled on all five tables. Direct table privileges are revoked from `PUBLIC`, `anon`, and `authenticated`; `service_role` receives full table privileges. `user_roles` then receives only a narrow authenticated `SELECT` grant, guarded by `auth.uid() = user_id`. Authenticated users cannot directly insert, update, or delete their own roles or promotional grants.

The modern Supabase `sb_secret_...` key maps to the privileged `service_role` and bypasses RLS. The API must continue to authenticate the user JWT independently and authorize the caller before using its server client. The migration's grants do not make the secret key safe for client use.

## Security-definer functions

### `bootstrap_super_admin(uuid, uuid)`

- `SECURITY DEFINER`, with an empty `search_path`; table and JSON function references are schema-qualified or PostgreSQL built-ins.
- A partial unique index and the function's existence check prevent two Super Admin assignments. The role insert and success audit insert run in one function transaction.
- `PUBLIC`, `anon`, `authenticated`, and any pre-existing `service_role` function grant are revoked; `EXECUTE` is then granted to `service_role` (the function owner retains inherent owner privileges).
- Owner approval, verified email, and a verified MFA factor are enforced by the current server-side bootstrap command before it calls the RPC. There is no HTTP bootstrap route. The SQL RPC itself trusts `service_role`; a holder of the server secret can bypass those application-level checks, just as that role can directly write the protected tables. Keep the secret confined to the API server and run only the explicit bootstrap command after separate approval.
- The migration does not hard-code an owner. The function owner is the role that applies the DDL (normally `postgres` when run in the Supabase SQL Editor). Verify it with the preflight query before relying on the definer's table privileges.

### `assign_default_user_role()`

- `SECURITY DEFINER`, with an empty `search_path`; the table reference is schema-qualified.
- It inserts only `USER` for a newly inserted `auth.users` row and uses `ON CONFLICT` to avoid duplicate role rows.
- `PUBLIC`, `anon`, `authenticated`, and `service_role` execution privileges are revoked. The `auth.users` trigger invokes it; it is not an RPC entry point.
- The trigger runs in the signup transaction. If the role insertion fails, signup should fail rather than leave a user without the expected default role.

Both functions explicitly revoke PostgreSQL's default `PUBLIC EXECUTE` grant. The migration does not change database-wide default privileges for functions created by other or future migrations; those functions must be reviewed and granted deliberately.

## Source correction made

The table loop previously revoked table privileges from `anon` and `authenticated` but not the pseudo-role `PUBLIC`. Although Supabase's normal defaults grant to the named API roles, a pre-existing or custom `PUBLIC` grant would remain effective. The migration now revokes from `PUBLIC` as well.

The two function ACL blocks now also remove any pre-existing `service_role` grant from the trigger function and from the bootstrap RPC before granting the bootstrap RPC back to `service_role`. This makes the intended allowlist explicit on an existing object as well as on a fresh project. Migration-safety tests were updated to assert these ACLs.

No schema or live database was changed by this correction.

## Fresh-project compatibility and operational caveats

- Supabase provides `auth.users`, the `anon`, `authenticated`, and `service_role` roles, and the `auth.uid()` helper used here. `gen_random_uuid()` is available on supported Supabase PostgreSQL versions.
- Explicit `ENABLE ROW LEVEL SECURITY` is safe if the platform has already enabled RLS.
- The migration is intended to run once on the target project. `CREATE TABLE/INDEX IF NOT EXISTS` does not validate the shape of a pre-existing object, and `CREATE POLICY` is not idempotent. Check the preflight results first; do not blindly rerun after a partial or successful application.
- The preflight below checks for conflicting tables, columns, constraints, indexes, policies, triggers, functions, grants, and migration-history state. If any target object exists, review its definition and owner before applying.
- The SQL migration history table may not exist until migrations have been applied through the CLI; the initial `to_regclass` check handles that case.

## Read-only preflight SQL

Run these `SELECT` statements in the SQL Editor of the Frankfurt project before migration approval. They inspect metadata only; they do not alter schema or data.

### Migration ledger presence

```sql
select to_regclass('supabase_migrations.schema_migrations') as migration_ledger;
```

If the ledger exists, check whether this migration version is already recorded:

```sql
select version, name
from supabase_migrations.schema_migrations
where version = '20261115000000';
```

### Existing target tables, ownership, and RLS

```sql
with expected(table_name) as (
  values
    ('user_roles'),
    ('promotional_grants'),
    ('revenuecat_identity_links'),
    ('admin_audit_logs'),
    ('webhook_inbox')
)
select
  e.table_name,
  c.relkind,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls,
  pg_get_userbyid(c.relowner) as owner
from expected e
left join pg_namespace n on n.nspname = 'public'
left join pg_class c on c.relnamespace = n.oid and c.relname = e.table_name
order by e.table_name;
```

### Existing columns and constraints

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'user_roles', 'promotional_grants', 'revenuecat_identity_links',
    'admin_audit_logs', 'webhook_inbox'
  )
order by table_name, ordinal_position;
```

```sql
select conrelid::regclass as table_name, conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
  select c.oid
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'user_roles', 'promotional_grants', 'revenuecat_identity_links',
      'admin_audit_logs', 'webhook_inbox'
    )
)
order by table_name, conname;
```

### Existing target indexes

```sql
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'user_roles', 'promotional_grants', 'revenuecat_identity_links',
    'admin_audit_logs', 'webhook_inbox'
  )
order by tablename, indexname;
```

### Existing RLS policies and table grants

```sql
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'user_roles', 'promotional_grants', 'revenuecat_identity_links',
    'admin_audit_logs', 'webhook_inbox'
  )
order by tablename, policyname;
```

```sql
select table_name, grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in (
    'user_roles', 'promotional_grants', 'revenuecat_identity_links',
    'admin_audit_logs', 'webhook_inbox'
  )
order by table_name, grantee, privilege_type;
```

### Existing functions, owner, search path, and effective execute access

```sql
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer,
  p.proconfig as function_settings,
  coalesce((
    select bool_or(a.grantee = 0 and a.privilege_type = 'EXECUTE')
    from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  ), false) as public_can_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('bootstrap_super_admin', 'assign_default_user_role')
order by p.proname, identity_arguments;
```

### Existing signup triggers and function default ACLs

```sql
select
  t.tgname,
  t.tgrelid::regclass as table_name,
  p.proname as function_name,
  pg_get_userbyid(p.proowner) as function_owner,
  p.prosecdef as security_definer,
  p.proconfig as function_settings,
  t.tgenabled
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal
  and (
    t.tgname = 'assign_default_user_role_on_signup'
    or p.proname in ('bootstrap_super_admin', 'assign_default_user_role')
  )
order by t.tgname;
```

```sql
select
  d.defaclrole::regrole as grantor,
  coalesce(n.nspname, '<all schemas>') as schema_name,
  d.defaclobjtype,
  d.defaclacl
from pg_default_acl d
left join pg_namespace n on n.oid = d.defaclnamespace
where d.defaclobjtype = 'f'
order by grantor, schema_name;
```

Review any existing object with a target name before running the migration. A clean result is no target tables, policies, functions, or signup trigger, and no migration version already recorded.

The default-ACL query reports configured overrides. If it returns no row for a role/schema, PostgreSQL's built-in default applies; the migration's per-function `REVOKE` statements remain the authoritative check for these two functions.

## Exact application instructions (after separate approval only)

1. Confirm the selected Supabase project is the new Frankfurt project and that the read-only preflight showed no conflicting objects or prior migration version.
2. Open that project's **SQL Editor**. Review the committed `supabase/migrations/20261115000000_optional_accounts_security.sql`; do not use the retired Tokyo project or its credentials.
3. Run the complete file once as a single script. Do not split it into separate statements or re-run it blindly if the result is uncertain.
4. Confirm the SQL Editor reports success. If it reports an error, stop and capture the error text without exposing any credentials; do not retry until the database state is reviewed.
5. Run the post-migration metadata checks below. Do not run the Super Admin bootstrap as part of migration application.

## Post-migration verification checklist

1. All five target tables exist; each reports `relrowsecurity = true`.
2. Each table has the expected primary/foreign/check constraints and indexes; the unique partial index permits no more than one `SUPER_ADMIN`.
3. The only `user_roles` client policy is self-read. There are no client policies or client table grants for promotional grants, RevenueCat links, audit logs, or webhook inbox.
4. No `PUBLIC`, `anon`, or `authenticated` role has `EXECUTE` on either security-definer function. Only `service_role` among application roles can execute `bootstrap_super_admin`; no API role can directly execute the signup trigger function. The function owner retains owner privileges.
5. The functions are owned by the expected trusted role and retain an empty `search_path`. The signup trigger is enabled on `auth.users`.
6. After separate approval to create temporary test accounts, verify each signup receives exactly one `USER` role. A user JWT can read only its own role; anonymous reads and all client-side writes to protected tables are denied.
7. With approved test accounts, verify user-role and promotional-grant isolation, admin denial for `USER` and for `ADMIN` without `aal2`, and successful admin checks only for a verified admin at `aal2`.
8. Confirm each allowed or denied admin access check produces the intended audit record and that an audit write failure fails closed.
9. Test bootstrap only after separate explicit owner approval, verified email, and verified MFA. Confirm it writes the role and audit row atomically, is idempotent for the same user, and rejects a different second Super Admin. Do not expose or pass the server key to a client.

**Approval gate:** this review does not approve migration execution or Super Admin bootstrap. Stop here until the owner explicitly approves the SQL migration.
