-- Auth access tokens can remain cryptographically valid until their JWT expiry
-- even after the backing session is explicitly revoked. Bind authenticated
-- database access to the live session row and the user's extant profile.

-- Keep the SECURITY DEFINER lookup out of every exposed Data API schema and
-- separate from Micro's broader trigger-only `private` schema. Default function
-- execution is removed here so future helpers in this schema fail closed too.
create schema if not exists private_authorization;

revoke all on schema private_authorization
  from public, anon, authenticated, service_role;

alter default privileges in schema private_authorization
  revoke execute on functions from public;

create or replace function private_authorization.current_auth_session_is_live()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid;
  claimed_session_id_text text;
  claimed_session_id uuid;
begin
  requesting_user_id := auth.uid();
  claimed_session_id_text := nullif(auth.jwt() ->> 'session_id', '');

  if requesting_user_id is null or claimed_session_id_text is null then
    return false;
  end if;

  begin
    claimed_session_id := claimed_session_id_text::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  return exists (
    select 1
    from auth.sessions as session
    join public.profiles as profile on profile.id = session.user_id
    where session.id = claimed_session_id
      and session.user_id = requesting_user_id
  );
end;
$$;

comment on function private_authorization.current_auth_session_is_live() is
  'Returns true only when auth.uid(), the JWT session_id, a live auth.sessions row, and an extant profile all belong to the same caller.';

-- SECURITY DEFINER is required to inspect auth.sessions, which client roles
-- cannot read. The helper binds every lookup to auth.uid() and exposes only a
-- boolean about the caller's own session.
revoke all on function private_authorization.current_auth_session_is_live()
  from public, anon, authenticated, service_role;
grant usage on schema private_authorization to authenticated, service_role;
grant execute on function private_authorization.current_auth_session_is_live()
  to authenticated, service_role;

-- Existing Micro policies remain the permissive business rules. One
-- restrictive policy per live table is ANDed with every current and future
-- permissive policy for the authenticated role, across reads and writes.
drop policy if exists profiles_require_live_auth_session on public.profiles;
create policy profiles_require_live_auth_session
on public.profiles
as restrictive
for all
to authenticated
using ((select private_authorization.current_auth_session_is_live()))
with check ((select private_authorization.current_auth_session_is_live()));

drop policy if exists organizations_require_live_auth_session on public.organizations;
create policy organizations_require_live_auth_session
on public.organizations
as restrictive
for all
to authenticated
using ((select private_authorization.current_auth_session_is_live()))
with check ((select private_authorization.current_auth_session_is_live()));

drop policy if exists organization_members_require_live_auth_session
  on public.organization_members;
create policy organization_members_require_live_auth_session
on public.organization_members
as restrictive
for all
to authenticated
using ((select private_authorization.current_auth_session_is_live()))
with check ((select private_authorization.current_auth_session_is_live()));

drop policy if exists tasks_require_live_auth_session on public.tasks;
create policy tasks_require_live_auth_session
on public.tasks
as restrictive
for all
to authenticated
using ((select private_authorization.current_auth_session_is_live()))
with check ((select private_authorization.current_auth_session_is_live()));

drop policy if exists task_private_details_require_live_auth_session
  on public.task_private_details;
create policy task_private_details_require_live_auth_session
on public.task_private_details
as restrictive
for all
to authenticated
using ((select private_authorization.current_auth_session_is_live()))
with check ((select private_authorization.current_auth_session_is_live()));

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
      coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' as is_anonymous,
      (
        select private_authorization.current_auth_session_is_live()
      ) as session_is_live
  ),
  verified_admin_memberships as (
    select organization.sponsorship_enabled
    from public.organization_members as membership
    join public.organizations as organization
      on organization.id = membership.organization_id
    cross join current_identity as identity
    where identity.session_is_live
      and membership.user_id = identity.user_id
      and membership.membership_status = 'active'
      and membership.member_role in ('owner', 'admin')
      and organization.verification_status = 'verified'
  )
  select
    identity.session_is_live
      and identity.user_id is not null
      and not identity.is_anonymous,
    identity.session_is_live
      and identity.user_id is not null
      and not identity.is_anonymous,
    identity.session_is_live
      and identity.user_id is not null
      and not identity.is_anonymous
      and exists (select 1 from verified_admin_memberships),
    identity.session_is_live
      and identity.user_id is not null
      and not identity.is_anonymous
      and exists (
        select 1
        from verified_admin_memberships
        where sponsorship_enabled
      )
  from current_identity as identity;
$$;

comment on function public.current_user_capabilities() is
  'Returns task capabilities only for a live non-anonymous Auth session with an extant profile, and sponsor capabilities only for active owner or admin membership in a verified organization.';

revoke all on function public.current_user_capabilities() from public, anon;
grant execute on function public.current_user_capabilities()
  to authenticated, service_role;
