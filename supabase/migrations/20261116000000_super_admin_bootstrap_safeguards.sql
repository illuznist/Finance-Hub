-- Prepared for separate review and approval; do not apply automatically.
-- Replace the earlier two-argument bootstrap RPC with exact target confirmation,
-- non-fabricated audit attribution, and append-only service-role audit access.

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

-- The trusted API continues to read and append audit entries, but cannot
-- rewrite, delete, or truncate the audit trail.
revoke update, delete, truncate on table public.admin_audit_logs
  from service_role;
