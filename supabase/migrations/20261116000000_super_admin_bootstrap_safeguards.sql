-- Prepared for separate review and approval; do not apply automatically.
-- Replace the earlier two-argument bootstrap RPC with exact target confirmation,
-- non-fabricated audit attribution, least-privilege audit access, and a read-only
-- readiness check for the trusted bootstrap CLI.

drop function if exists public.bootstrap_super_admin(uuid, uuid);

create function public.bootstrap_super_admin(
  target_user_id uuid,
  confirmed_target_user_id uuid,
  operation_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_user_id uuid;
begin
  if target_user_id is null
     or confirmed_target_user_id is distinct from target_user_id
     or operation_id is null then
    raise exception 'Bootstrap target confirmation is invalid';
  end if;

  select user_id
    into existing_user_id
    from public.user_roles
    where role = 'SUPER_ADMIN'
    limit 1;

  if existing_user_id is not null then
    if existing_user_id = target_user_id then
      return 'already-configured';
    end if;
    raise exception 'A Super Admin is already configured';
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (target_user_id, 'SUPER_ADMIN', null);

  insert into public.admin_audit_logs (
    actor_user_id,
    target_user_id,
    action,
    outcome,
    metadata
  ) values (
    null,
    target_user_id,
    'bootstrap_super_admin',
    'succeeded',
    jsonb_build_object(
      'operation_id', operation_id,
      'source', 'service_role_bootstrap_rpc',
      'approval_mode', 'exact_target_uuid_confirmation',
      'approved_target_user_id', target_user_id
    )
  );

  return 'created';
end;
$$;

revoke all on function public.bootstrap_super_admin(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.bootstrap_super_admin(uuid, uuid, uuid)
  to service_role;

-- Reset the direct service-role grants rather than assuming which privileges
-- were left by the earlier Stage C GRANT ALL statement.
revoke all privileges on table public.admin_audit_logs from service_role;
grant select, insert on table public.admin_audit_logs to service_role;

-- This helper is a read-only readiness assertion, not a bootstrap operation.
-- It deliberately returns only booleans and is callable only by the trusted
-- server role. A missing or altered safeguard produces ready=false.
create or replace function public.check_super_admin_bootstrap_readiness()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  service_role_oid oid;
  bootstrap_rpc_oid oid;
  legacy_bootstrap_rpc_oid oid;
  audit_table_oid oid;
  audit_acl aclitem[];
  audit_owner oid;
  bootstrap_rpc pg_catalog.pg_proc%rowtype;
  bootstrap_definition text;
  rpc_signature_ok boolean := false;
  rpc_security_ok boolean := false;
  single_super_admin_guard_ok boolean := false;
  audit_privileges_ok boolean := false;
  ready boolean := false;
begin
  select oid
    into service_role_oid
    from pg_catalog.pg_roles
    where rolname = 'service_role';

  if service_role_oid is null then
    return jsonb_build_object(
      'ready', false,
      'rpc_signature_ok', false,
      'rpc_security_ok', false,
      'single_super_admin_guard_ok', false,
      'audit_privileges_ok', false
    );
  end if;

  bootstrap_rpc_oid :=
    pg_catalog.to_regprocedure(
      'public.bootstrap_super_admin(uuid,uuid,uuid)'
    )::oid;
  legacy_bootstrap_rpc_oid :=
    pg_catalog.to_regprocedure(
      'public.bootstrap_super_admin(uuid,uuid)'
    )::oid;
  audit_table_oid := pg_catalog.to_regclass('public.admin_audit_logs')::oid;

  if bootstrap_rpc_oid is not null then
    select p.*
      into bootstrap_rpc
      from pg_catalog.pg_proc as p
      where p.oid = bootstrap_rpc_oid;

    rpc_signature_ok :=
      legacy_bootstrap_rpc_oid is null
      and bootstrap_rpc.proargnames =
        array[
          'target_user_id',
          'confirmed_target_user_id',
          'operation_id'
        ]::text[]
      and bootstrap_rpc.prorettype = pg_catalog.to_regtype('pg_catalog.text')::oid;

    bootstrap_definition := lower(
      pg_catalog.regexp_replace(
        pg_catalog.pg_get_functiondef(bootstrap_rpc_oid),
        '\s+',
        ' ',
        'g'
      )
    );

    rpc_security_ok :=
      bootstrap_rpc.prosecdef
      and exists (
        select 1
          from pg_catalog.unnest(
            coalesce(bootstrap_rpc.proconfig, '{}'::text[])
          ) as config(setting)
          where config.setting in ('search_path=""', 'search_path=')
      )
      and bootstrap_rpc.proacl is not null
      and not exists (
        select 1
          from pg_catalog.aclexplode(bootstrap_rpc.proacl) as privilege
          where privilege.grantee = 0
            and privilege.privilege_type = 'EXECUTE'
      )
      and not exists (
        select 1
          from pg_catalog.aclexplode(bootstrap_rpc.proacl) as privilege
          where privilege.privilege_type = 'EXECUTE'
            and privilege.grantee not in (
              bootstrap_rpc.proowner,
              service_role_oid
            )
      )
      and pg_catalog.has_function_privilege(
        'service_role',
        bootstrap_rpc_oid,
        'EXECUTE'
      )
      and not pg_catalog.has_function_privilege(
        'anon',
        bootstrap_rpc_oid,
        'EXECUTE'
      )
      and not pg_catalog.has_function_privilege(
        'authenticated',
        bootstrap_rpc_oid,
        'EXECUTE'
      )
      and position(
        'confirmed_target_user_id is distinct from target_user_id'
        in bootstrap_definition
      ) > 0
      and position('operation_id is null' in bootstrap_definition) > 0
      and position(
        'if existing_user_id = target_user_id then return ''already-configured'''
        in bootstrap_definition
      ) > 0
      and position(
        'a super admin is already configured'
        in bootstrap_definition
      ) > 0
      and position('insert into public.user_roles' in bootstrap_definition) > 0
      and position(
        'values (target_user_id, ''super_admin'', null)'
        in bootstrap_definition
      ) > 0
      and position(
        'insert into public.admin_audit_logs'
        in bootstrap_definition
      ) > 0
      and position(
        'values ( null, target_user_id, ''bootstrap_super_admin'', ''succeeded'''
        in bootstrap_definition
      ) > 0;
  end if;

  single_super_admin_guard_ok := exists (
    select 1
      from pg_catalog.pg_index as i
      join pg_catalog.pg_class as index_relation
        on index_relation.oid = i.indexrelid
      join pg_catalog.pg_namespace as index_schema
        on index_schema.oid = index_relation.relnamespace
      where index_schema.nspname = 'public'
        and index_relation.relname = 'user_roles_single_super_admin'
        and i.indisunique
        and i.indisvalid
        and i.indpred is not null
        and pg_catalog.pg_get_expr(i.indpred, i.indrelid) ilike '%SUPER_ADMIN%'
        and pg_catalog.pg_get_indexdef(i.indexrelid) ilike '%(role)%'
  );

  if audit_table_oid is not null then
    select c.relacl, c.relowner
      into audit_acl, audit_owner
      from pg_catalog.pg_class as c
      where c.oid = audit_table_oid;

    audit_privileges_ok :=
      pg_catalog.has_table_privilege(
        'service_role',
        audit_table_oid,
        'SELECT'
      )
      and pg_catalog.has_table_privilege(
        'service_role',
        audit_table_oid,
        'INSERT'
      )
      and not exists (
        select 1
          from pg_catalog.aclexplode(
            coalesce(
              audit_acl,
              pg_catalog.acldefault('r'::"char", audit_owner)
            )
          ) as privilege
          where (
              privilege.privilege_type not in ('SELECT', 'INSERT')
              or privilege.is_grantable
            )
            and case
              when privilege.grantee = 0 then true
              when privilege.grantee = service_role_oid then true
              else pg_catalog.pg_has_role(
                service_role_oid,
                privilege.grantee,
                'USAGE'
              )
            end
      )
      and not pg_catalog.has_table_privilege(
        'service_role',
        audit_table_oid,
        'UPDATE'
      )
      and not pg_catalog.has_table_privilege(
        'service_role',
        audit_table_oid,
        'DELETE'
      )
      and not pg_catalog.has_table_privilege(
        'service_role',
        audit_table_oid,
        'TRUNCATE'
      )
      and not pg_catalog.has_table_privilege(
        'service_role',
        audit_table_oid,
        'REFERENCES'
      )
      and not pg_catalog.has_table_privilege(
        'service_role',
        audit_table_oid,
        'TRIGGER'
      );
  end if;

  ready :=
    rpc_signature_ok
    and rpc_security_ok
    and single_super_admin_guard_ok
    and audit_privileges_ok;

  return jsonb_build_object(
    'ready', ready,
    'rpc_signature_ok', rpc_signature_ok,
    'rpc_security_ok', rpc_security_ok,
    'single_super_admin_guard_ok', single_super_admin_guard_ok,
    'audit_privileges_ok', audit_privileges_ok
  );
exception
  when others then
    return jsonb_build_object(
      'ready', false,
      'rpc_signature_ok', false,
      'rpc_security_ok', false,
      'single_super_admin_guard_ok', false,
      'audit_privileges_ok', false
    );
end;
$$;

revoke all on function public.check_super_admin_bootstrap_readiness()
  from public, anon, authenticated, service_role;
grant execute on function public.check_super_admin_bootstrap_readiness()
  to service_role;
