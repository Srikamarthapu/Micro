alter table public.profiles
add column account_type text not null default 'regular'
  check (account_type in ('regular', 'nonprofit'));

comment on column public.profiles.account_type is
  'Signup account class captured once by the protected auth trigger. Users cannot update this column; sponsor authority still comes only from verified organization membership.';

grant select (account_type) on table public.profiles to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_display_name text;
  requested_service_area text;
  requested_account_type text;
begin
  -- These values are captured once at signup as presentation/onboarding data.
  -- The client cannot update account_type later, and sponsor authority never
  -- derives from metadata or this column.
  requested_display_name := left(btrim(new.raw_user_meta_data ->> 'display_name'), 80);
  requested_service_area := left(btrim(new.raw_user_meta_data ->> 'service_area'), 120);
  requested_account_type := case
    when new.raw_user_meta_data ->> 'account_type' = 'nonprofit' then 'nonprofit'
    else 'regular'
  end;

  insert into public.profiles (
    id,
    display_name,
    service_area,
    standards_accepted_at,
    account_type
  )
  values (
    new.id,
    coalesce(nullif(requested_display_name, ''), 'Neighbor'),
    nullif(requested_service_area, ''),
    case
      when new.raw_user_meta_data ->> 'standards_accepted' = 'true' then now()
      else null
    end,
    requested_account_type
  );

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop policy organizations_authenticated_create on public.organizations;

create policy organizations_nonprofit_create
on public.organizations
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and account_type = 'nonprofit'
  )
);

create unique index organization_members_one_active_org_per_user_idx
  on public.organization_members (user_id)
  where membership_status = 'active';
