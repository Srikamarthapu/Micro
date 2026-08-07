create or replace function private.handle_auth_user_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_organization record;
  successor_owner_id uuid;
  has_linked_people boolean;
begin
  -- Serialize ownership decisions per organization. Without this lock, two
  -- owners deleting concurrently could each observe the other and leave the
  -- organization without an owner.
  for affected_organization in
    select o.id
    from public.organizations as o
    where o.created_by = old.id
      or exists (
        select 1
        from public.organization_members as deleting_membership
        where deleting_membership.organization_id = o.id
          and deleting_membership.user_id = old.id
          and deleting_membership.member_role = 'owner'
          and deleting_membership.membership_status = 'active'
      )
    order by o.id
  loop
    perform 1
    from public.organizations
    where id = affected_organization.id
    for update;

    -- The organization may already have been removed by an earlier action in
    -- this transaction. There is nothing left to transfer in that case.
    if not found then
      continue;
    end if;

    -- Lock every existing membership in a stable order before reading roles or
    -- statuses. This serializes deletion against backend membership updates;
    -- the organization lock separately blocks new FK-backed memberships.
    perform locked_membership.user_id
    from public.organization_members as locked_membership
    where locked_membership.organization_id = affected_organization.id
    order by locked_membership.user_id
    for update;

    successor_owner_id := null;

    select candidate.user_id
    into successor_owner_id
    from public.organization_members as candidate
    where candidate.organization_id = affected_organization.id
      and candidate.user_id <> old.id
      and candidate.member_role = 'owner'
      and candidate.membership_status = 'active'
    order by candidate.joined_at, candidate.user_id
    limit 1;

    if successor_owner_id is not null then
      update public.organizations
      set created_by = successor_owner_id
      where id = affected_organization.id
        and created_by = old.id;

      continue;
    end if;

    select exists (
      select 1
      from public.organization_members as linked_person
      where linked_person.organization_id = affected_organization.id
        and linked_person.user_id <> old.id
        and linked_person.membership_status <> 'removed'
    )
    into has_linked_people;

    if has_linked_people then
      raise exception using
        errcode = 'P0001',
        message = 'organization_owner_transfer_required',
        detail = affected_organization.id::text,
        hint = 'Assign another active owner before deleting this account.';
    end if;

    -- An organization with no other linked people is private account residue,
    -- so removing it with its sole owner is safer than leaving an empty shell.
    delete from public.organizations
    where id = affected_organization.id;
  end loop;

  return old;
end;
$$;

comment on function private.handle_auth_user_deletion() is
  'Atomically transfers a deleting creator to a successor owner, deletes empty sole-owner organizations, or blocks account deletion when linked people would be orphaned.';

comment on column public.organizations.created_by is
  'Account of record at creation. On account deletion only, it transfers to an active successor owner; deleting a non-creator owner never overwrites it.';

revoke all on function private.handle_auth_user_deletion()
  from public, anon, authenticated, service_role;

create trigger before_auth_user_deleted_manage_organizations
before delete on auth.users
for each row execute function private.handle_auth_user_deletion();

-- A deleted Auth user can retain a cryptographically valid access token until
-- its expiry. Requiring the cascading profile row to still exist makes the
-- currently exposed capability RPC fail closed during that residual window.
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
  active_profile as (
    select exists (
      select 1
      from public.profiles as p
      cross join current_identity as identity
      where p.id = identity.user_id
    ) as profile_exists
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
    profile.profile_exists
      and identity.user_id is not null
      and not identity.is_anonymous,
    profile.profile_exists
      and identity.user_id is not null
      and not identity.is_anonymous,
    profile.profile_exists
      and identity.user_id is not null
      and not identity.is_anonymous
      and exists (select 1 from verified_admin_memberships),
    profile.profile_exists
      and identity.user_id is not null
      and not identity.is_anonymous
      and exists (
        select 1
        from verified_admin_memberships
        where sponsorship_enabled
      )
  from current_identity as identity
  cross join active_profile as profile;
$$;

comment on function public.current_user_capabilities() is
  'Returns task capabilities only while the Auth user still has a profile, and sponsor capabilities only for active owner or admin membership in a verified organization.';

revoke all on function public.current_user_capabilities() from public, anon;
grant execute on function public.current_user_capabilities() to authenticated, service_role;
