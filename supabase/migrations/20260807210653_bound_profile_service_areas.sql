create or replace function private.normalize_service_area(requested text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when requested is null or btrim(requested) = '' then null
    when lower(btrim(requested)) in ('all', 'downtown', 'temescal', 'fruitvale', 'westoak', 'alameda', 'montreal')
      then lower(btrim(requested))
    when lower(btrim(requested)) = 'oakland & alameda' then 'all'
    when lower(btrim(requested)) = 'downtown & lake merritt' then 'downtown'
    when lower(btrim(requested)) = 'temescal & rockridge' then 'temescal'
    when lower(btrim(requested)) = 'fruitvale & san antonio' then 'fruitvale'
    when lower(btrim(requested)) = 'west oakland & jack london' then 'westoak'
    when lower(btrim(requested)) = 'alameda island' then 'alameda'
    when lower(btrim(requested)) = 'island of montréal' then 'montreal'
    else 'all'
  end
$$;

revoke all on function private.normalize_service_area(text) from public, anon, authenticated;

update public.profiles
set service_area = private.normalize_service_area(service_area)
where service_area is distinct from private.normalize_service_area(service_area);

create or replace function private.normalize_profile_service_area()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.service_area := private.normalize_service_area(new.service_area);
  return new;
end;
$$;

revoke all on function private.normalize_profile_service_area() from public, anon, authenticated;

create trigger profiles_normalize_service_area
before insert or update of service_area on public.profiles
for each row execute function private.normalize_profile_service_area();

alter table public.profiles
add constraint profiles_service_area_allowed
check (
  service_area is null
  or service_area in ('all', 'downtown', 'temescal', 'fruitvale', 'westoak', 'alameda', 'montreal')
);

comment on column public.profiles.service_area is
  'Bounded approximate discovery area. Exact addresses are never stored here.';
