-- Finance Hub optional online accounts. Financial records remain device-local.
-- The service role is the only writer for roles, grants, links, audits and inbox.

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('USER', 'ADMIN', 'SUPER_ADMIN')),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  primary key (user_id, role)
);

create unique index if not exists user_roles_single_super_admin
  on public.user_roles (role)
  where role = 'SUPER_ADMIN';

create table if not exists public.promotional_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  reason text not null check (char_length(trim(reason)) between 1 and 300),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null
);

create index if not exists promotional_grants_active_by_user
  on public.promotional_grants (user_id, expires_at)
  where revoked_at is null;

create table if not exists public.revenuecat_identity_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  revenuecat_app_user_id text not null unique,
  linked_at timestamptz not null default now(),
  verified_at timestamptz not null,
  verification_method text not null check (
    verification_method in ('authenticated_explicit_link', 'verified_purchase_transfer')
  )
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(trim(action)) between 1 and 100),
  target_user_id uuid references auth.users(id) on delete set null,
  outcome text not null check (outcome in ('allowed', 'denied', 'succeeded', 'failed')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists admin_audit_logs_recent
  on public.admin_audit_logs (occurred_at desc);

-- Store only an event identifier and processing state; never retain provider payloads.
create table if not exists public.webhook_inbox (
  event_id text primary key check (char_length(event_id) between 1 and 200),
  provider text not null check (provider in ('revenuecat')),
  event_type text not null check (char_length(event_type) between 1 and 100),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'failed')),
  error_code text
);

-- Role assignment and its audit entry must commit or roll back together.
create or replace function public.bootstrap_super_admin(
  target_user_id uuid,
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
  values (target_user_id, 'SUPER_ADMIN', target_user_id);

  insert into public.admin_audit_logs (
    actor_user_id,
    target_user_id,
    action,
    outcome,
    metadata
  ) values (
    target_user_id,
    target_user_id,
    'bootstrap_super_admin',
    'succeeded',
    jsonb_build_object('operation_id', operation_id)
  );

  return 'created';
end;
$$;

-- This RPC is restricted to the trusted server role. The application bootstrap
-- command separately requires owner approval, verified email, and verified MFA.
revoke all on function public.bootstrap_super_admin(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.bootstrap_super_admin(uuid, uuid) to service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'user_roles',
    'promotional_grants',
    'revenuecat_identity_links',
    'admin_audit_logs',
    'webhook_inbox'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end
$$;

-- Users may inspect only their own role labels; no client may assign or change roles.
grant select on table public.user_roles to authenticated;
create policy "Users can read only their own role labels"
  on public.user_roles
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.assign_default_user_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'USER')
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;

revoke all on function public.assign_default_user_role()
  from public, anon, authenticated, service_role;

drop trigger if exists assign_default_user_role_on_signup on auth.users;
create trigger assign_default_user_role_on_signup
  after insert on auth.users
  for each row execute function public.assign_default_user_role();
