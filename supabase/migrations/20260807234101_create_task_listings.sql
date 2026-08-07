-- Task listings.
--
-- Until now a published task lived only in the poster's browser, so no other
-- neighbor could ever see it. These tables give a listing a real home.
--
-- The split is the point: `tasks` holds what a listing shows publicly before a
-- match, and every signed-in neighbor may read it. `task_private_details` holds
-- the exact address, and only the owner may read it. RLS is row-level, not
-- column-level, so keeping the address in its own table is what actually
-- enforces Micro's promise that the street address stays private until a
-- confirmed match — a promise a single table with a hidden column could not keep.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,

  -- Provenance: which reviewed catalog entry this came from, or null when the
  -- requester described it themselves. `custom_pending` follows it to every
  -- surface so an unreviewed listing can never read as a reviewed one.
  template_id text,
  custom_pending boolean not null default false,

  title text not null check (char_length(title) between 4 and 120),
  description text not null check (char_length(description) between 10 and 2000),
  included text not null default '',
  excluded text not null default '',
  completion text not null default '',

  category text not null,
  category_id text not null,

  mode text not null check (mode in ('paid', 'community', 'sponsored')),
  -- Volunteer listings must not carry an amount at all, rather than a zero that
  -- could later be rendered as "$0 earned".
  earning integer check (earning is null or earning >= 15),

  -- Approximate, public-safe coordinates. The exact address is never here.
  lat double precision not null,
  lng double precision not null,
  area_id text not null,
  area text not null,

  time_label text not null,
  duration text not null,

  youth_eligible boolean not null default false,
  listing_paused boolean not null default false,

  created_at timestamptz not null default now(),

  constraint tasks_volunteer_has_no_earning check (mode <> 'community' or earning is null)
);

create index if not exists tasks_area_created_idx on public.tasks (area_id, created_at desc);
create index if not exists tasks_owner_idx on public.tasks (owner_id);

create table if not exists public.task_private_details (
  task_id uuid primary key references public.tasks (id) on delete cascade,
  private_address text not null check (char_length(private_address) between 3 and 300)
);

alter table public.tasks enable row level security;
alter table public.task_private_details enable row level security;

-- Any signed-in neighbor can browse listings that are not paused; owners keep
-- seeing their own while paused so they can resume them.
drop policy if exists "tasks are readable by signed-in neighbors" on public.tasks;
create policy "tasks are readable by signed-in neighbors"
  on public.tasks for select
  to authenticated
  using (not listing_paused or owner_id = (select auth.uid()));

-- Posting requires the capability the account already carries, so the database
-- enforces the same rule the interface shows rather than trusting the client.
drop policy if exists "neighbors post their own tasks" on public.tasks;
create policy "neighbors post their own tasks"
  on public.tasks for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and coalesce((select c.can_post_tasks from public.current_user_capabilities() c), false)
    and (
      mode <> 'sponsored'
      or coalesce((select c.can_sponsor_tasks from public.current_user_capabilities() c), false)
    )
  );

drop policy if exists "owners update their own tasks" on public.tasks;
create policy "owners update their own tasks"
  on public.tasks for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "owners delete their own tasks" on public.tasks;
create policy "owners delete their own tasks"
  on public.tasks for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- The address is owner-only. No select policy exists for anyone else, so a
-- helper reading `tasks` simply gets no row back from this table.
drop policy if exists "owners read their own task address" on public.task_private_details;
create policy "owners read their own task address"
  on public.task_private_details for select
  to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and t.owner_id = (select auth.uid())));

drop policy if exists "owners write their own task address" on public.task_private_details;
create policy "owners write their own task address"
  on public.task_private_details for insert
  to authenticated
  with check (exists (select 1 from public.tasks t where t.id = task_id and t.owner_id = (select auth.uid())));

drop policy if exists "owners change their own task address" on public.task_private_details;
create policy "owners change their own task address"
  on public.task_private_details for update
  to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and t.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.tasks t where t.id = task_id and t.owner_id = (select auth.uid())));

-- The listing shows a poster's display name, which lives in `profiles` behind
-- its own RLS. This view exposes only that one field alongside the task so a
-- helper can see who is asking without the client querying profiles directly.
create or replace view public.task_listings
with (security_invoker = true) as
  select
    t.*,
    p.display_name as requester_name
  from public.tasks t
  left join public.profiles p on p.id = t.owner_id;

grant select on public.task_listings to authenticated;
