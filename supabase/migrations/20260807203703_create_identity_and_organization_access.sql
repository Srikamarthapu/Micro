create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Neighbor'
    check (char_length(display_name) between 1 and 80),
  bio text check (bio is null or char_length(bio) <= 500),
  service_area text check (service_area is null or char_length(service_area) <= 120),
  standards_accepted_at timestamptz,
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'User-controlled public identity only. Authorization is derived from database memberships, never profile fields or user metadata.';

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique
    check (
      char_length(slug) between 3 and 63
      and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
  description text check (description is null or char_length(description) <= 1000),
  website_url text check (website_url is null or char_length(website_url) <= 2048),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'suspended')),
  sponsorship_enabled boolean not null default false,
  verified_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_sponsorship_requires_verification
    check (not sponsorship_enabled or verification_status = 'verified')
);

comment on column public.organizations.verification_status is
  'Backend-managed nonprofit verification state. Authenticated clients have no INSERT or UPDATE privilege on this column.';
comment on column public.organizations.sponsorship_enabled is
  'Backend-managed operational gate. Sponsorship also requires a verified organization and active owner or admin membership.';

create index organizations_created_by_idx
  on public.organizations (created_by)
  where created_by is not null;

create index organizations_verified_idx
  on public.organizations (id)
  where verification_status = 'verified';

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  member_role text not null default 'member'
    check (member_role in ('owner', 'admin', 'member')),
  membership_status text not null default 'active'
    check (membership_status in ('invited', 'active', 'suspended', 'removed')),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

comment on table public.organization_members is
  'Authoritative organization access records. Authenticated clients can read eligible rows but cannot assign roles or membership status.';

create index organization_members_user_access_idx
  on public.organization_members (user_id, membership_status, member_role, organization_id);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();

create trigger organization_members_set_updated_at
before update on public.organization_members
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_display_name text;
  requested_service_area text;
begin
  -- Display metadata is copied as untrusted presentation data only. It never
  -- controls account type, membership, verification, or any RLS decision.
  requested_display_name := left(btrim(new.raw_user_meta_data ->> 'display_name'), 80);
  requested_service_area := left(btrim(new.raw_user_meta_data ->> 'service_area'), 120);

  insert into public.profiles (
    id,
    display_name,
    service_area,
    standards_accepted_at
  )
  values (
    new.id,
    coalesce(nullif(requested_display_name, ''), 'Neighbor'),
    nullif(requested_service_area, ''),
    case
      when new.raw_user_meta_data ->> 'standards_accepted' = 'true' then now()
      else null
    end
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is null then
    raise exception 'An organization requires an authenticated creator';
  end if;

  insert into public.organization_members (
    organization_id,
    user_id,
    member_role,
    membership_status
  )
  values (new.id, new.created_by, 'owner', 'active');

  return new;
end;
$$;

create trigger on_organization_created
after insert on public.organizations
for each row execute function private.handle_new_organization();

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.handle_new_organization() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy profiles_authenticated_read
on public.profiles
for select
to authenticated
using (true);

create policy profiles_owner_update
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy organization_members_self_read
on public.organization_members
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy organizations_member_or_verified_read
on public.organizations
for select
to authenticated
using (
  verification_status = 'verified'
  or created_by = (select auth.uid())
  or id in (
    select organization_id
    from public.organization_members
    where user_id = (select auth.uid())
  )
);

create policy organizations_authenticated_create
on public.organizations
for insert
to authenticated
with check (created_by = (select auth.uid()));

create policy organizations_admin_update
on public.organizations
for update
to authenticated
using (
  id in (
    select organization_id
    from public.organization_members
    where user_id = (select auth.uid())
      and membership_status = 'active'
      and member_role in ('owner', 'admin')
  )
)
with check (
  id in (
    select organization_id
    from public.organization_members
    where user_id = (select auth.uid())
      and membership_status = 'active'
      and member_role in ('owner', 'admin')
  )
);

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.organizations from anon, authenticated;
revoke all on table public.organization_members from anon, authenticated;

grant select (id, display_name, bio, service_area, avatar_url, created_at, updated_at)
  on table public.profiles to authenticated;
grant update (display_name, bio, service_area, avatar_url)
  on table public.profiles to authenticated;

grant select (id, name, slug, description, website_url, verification_status, sponsorship_enabled, verified_at, created_at, updated_at)
  on table public.organizations to authenticated;
grant insert (name, slug, description, website_url)
  on table public.organizations to authenticated;
grant update (name, slug, description, website_url)
  on table public.organizations to authenticated;

grant select on table public.organization_members to authenticated;

grant all privileges on table public.profiles to service_role;
grant all privileges on table public.organizations to service_role;
grant all privileges on table public.organization_members to service_role;

create or replace function public.current_user_capabilities()
returns table (
  can_post_tasks boolean,
  can_accept_tasks boolean,
  can_receive_sponsorship_requests boolean,
  can_sponsor_tasks boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with current_identity as (
    select
      (select auth.uid()) as user_id,
      coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' as is_anonymous
  ),
  verified_admin_memberships as (
    select o.sponsorship_enabled
    from public.organization_members as m
    join public.organizations as o on o.id = m.organization_id
    cross join current_identity as identity
    where m.user_id = identity.user_id
      and m.membership_status = 'active'
      and m.member_role in ('owner', 'admin')
      and o.verification_status = 'verified'
  )
  select
    identity.user_id is not null and not identity.is_anonymous,
    identity.user_id is not null and not identity.is_anonymous,
    identity.user_id is not null
      and not identity.is_anonymous
      and exists (select 1 from verified_admin_memberships),
    identity.user_id is not null
      and not identity.is_anonymous
      and exists (
        select 1
        from verified_admin_memberships
        where sponsorship_enabled
      )
  from current_identity as identity;
$$;

comment on function public.current_user_capabilities() is
  'Returns baseline task capabilities for signed-in users and sponsor capabilities only for active owner or admin membership in a verified organization.';

revoke all on function public.current_user_capabilities() from public, anon;
grant execute on function public.current_user_capabilities() to authenticated, service_role;
