-- Assignments and task threads.
--
-- Accepting a job used to live only in the helper's browser, so the requester
-- had no way to learn it had happened. These tables give an acceptance and the
-- conversation that follows it a real home, and put both on the realtime
-- publication so the other side hears about them without polling.
--
-- The greeting is written by the database rather than the client on purpose. A
-- helper's introduction is the requester's first evidence that a match exists,
-- so it must appear exactly once for every acceptance, even if the accepting
-- client crashes between the two writes.

create table if not exists public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  helper_id uuid not null references auth.users (id) on delete cascade,

  status text not null default 'accepted'
    check (status in ('accepted', 'withdrawn', 'completed')),

  created_at timestamptz not null default now(),

  constraint task_assignments_unique_helper unique (task_id, helper_id)
);

-- A task has at most one live helper. Withdrawn and completed rows stay as
-- history, so the constraint is partial rather than a plain unique on task_id.
create unique index if not exists task_assignments_one_live_helper
  on public.task_assignments (task_id)
  where status = 'accepted';

create index if not exists task_assignments_helper_idx
  on public.task_assignments (helper_id, created_at desc);

create table if not exists public.task_messages (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,

  body text not null check (char_length(body) between 1 and 2000),

  -- 'system' marks a line Micro composed on a participant's behalf, so the
  -- interface can render it as a record rather than as something they typed.
  kind text not null default 'human' check (kind in ('human', 'system')),

  created_at timestamptz not null default now()
);

create index if not exists task_messages_thread_idx
  on public.task_messages (task_id, created_at);

alter table public.task_assignments enable row level security;
alter table public.task_messages enable row level security;

-- Participation is the access rule for a thread, and answering it means reading
-- both `tasks` and `task_assignments`. Doing that inline in a policy on
-- `task_messages` would re-enter those tables' own policies, so the check lives
-- in one SECURITY DEFINER helper that takes the caller's identity as given.
create or replace function private_authorization.is_task_participant(subject_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks as task
    where task.id = subject_task_id
      and task.owner_id = (select auth.uid())
  ) or exists (
    select 1
    from public.task_assignments as assignment
    where assignment.task_id = subject_task_id
      and assignment.helper_id = (select auth.uid())
      and assignment.status = 'accepted'
  );
$$;

comment on function private_authorization.is_task_participant(uuid) is
  'Returns true only when the caller owns the task or holds its live assignment.';

revoke all on function private_authorization.is_task_participant(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private_authorization.is_task_participant(uuid)
  to authenticated, service_role;

-- Whether the caller holds a task's live assignment, answered without going
-- back through `task_assignments`' own policies. The `tasks` policy below needs
-- this and `task_assignments` needs `tasks`, so one side has to be the
-- definer-owned helper or the two would recurse into each other.
create or replace function private_authorization.holds_task_assignment(subject_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.task_assignments as assignment
    where assignment.task_id = subject_task_id
      and assignment.helper_id = (select auth.uid())
      and assignment.status = 'accepted'
  );
$$;

comment on function private_authorization.holds_task_assignment(uuid) is
  'Returns true only when the caller holds the live assignment on the given task.';

revoke all on function private_authorization.holds_task_assignment(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private_authorization.holds_task_assignment(uuid)
  to authenticated, service_role;

-- A match outlives the listing. Pausing a task hides it from Nearby, and the
-- original read policy would have hidden it from the matched helper too —
-- taking their own accepted job off their device. Permissive policies are OR'd,
-- so this restores that one row without widening anything else.
drop policy if exists "assigned helpers keep reading their task" on public.tasks;
create policy "assigned helpers keep reading their task"
  on public.tasks for select
  to authenticated
  using ((select private_authorization.holds_task_assignment(id)));

-- Assignments are visible to the two people they concern and nobody else.
drop policy if exists "assignments are readable by the two parties" on public.task_assignments;
create policy "assignments are readable by the two parties"
  on public.task_assignments for select
  to authenticated
  using (
    helper_id = (select auth.uid())
    or exists (
      select 1 from public.tasks as task
      where task.id = task_id and task.owner_id = (select auth.uid())
    )
  );

-- Accepting requires the capability the account already carries, and a
-- requester may not accept their own listing. Both rules are enforced here
-- rather than in the client, which is the only place they cannot be bypassed.
drop policy if exists "neighbors accept other neighbors' tasks" on public.task_assignments;
create policy "neighbors accept other neighbors' tasks"
  on public.task_assignments for insert
  to authenticated
  with check (
    helper_id = (select auth.uid())
    and status = 'accepted'
    and coalesce((select c.can_accept_tasks from public.current_user_capabilities() c), false)
    and exists (
      select 1 from public.tasks as task
      where task.id = task_id
        and task.owner_id <> (select auth.uid())
        and not task.listing_paused
    )
  );

-- Either party can move an assignment on: the helper withdraws, the requester
-- closes it out. Neither can reassign it to someone else.
drop policy if exists "both parties settle an assignment" on public.task_assignments;
create policy "both parties settle an assignment"
  on public.task_assignments for update
  to authenticated
  using (
    helper_id = (select auth.uid())
    or exists (
      select 1 from public.tasks as task
      where task.id = task_id and task.owner_id = (select auth.uid())
    )
  )
  with check (
    helper_id = (select auth.uid())
    or exists (
      select 1 from public.tasks as task
      where task.id = task_id and task.owner_id = (select auth.uid())
    )
  );

drop policy if exists "participants read their task thread" on public.task_messages;
create policy "participants read their task thread"
  on public.task_messages for select
  to authenticated
  using ((select private_authorization.is_task_participant(task_id)));

drop policy if exists "participants write to their task thread" on public.task_messages;
create policy "participants write to their task thread"
  on public.task_messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and (select private_authorization.is_task_participant(task_id))
  );

-- Threads are a safety record. Editing and deletion are deliberately absent:
-- no policy means no one can rewrite what was said.

-- Every live table carries the same restrictive session gate, ANDed with the
-- permissive rules above. See 20260807234108_require_live_auth_sessions.sql.
drop policy if exists task_assignments_require_live_auth_session on public.task_assignments;
create policy task_assignments_require_live_auth_session
on public.task_assignments
as restrictive
for all
to authenticated
using ((select private_authorization.current_auth_session_is_live()))
with check ((select private_authorization.current_auth_session_is_live()));

drop policy if exists task_messages_require_live_auth_session on public.task_messages;
create policy task_messages_require_live_auth_session
on public.task_messages
as restrictive
for all
to authenticated
using ((select private_authorization.current_auth_session_is_live()))
with check ((select private_authorization.current_auth_session_is_live()));

-- The helper's introduction. SECURITY DEFINER because the row is written on the
-- helper's behalf during their own insert, before any client has a chance to
-- fail; it still attributes the message to them, not to a service identity.
create or replace function private_authorization.announce_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  helper_name text;
  task_title text;
begin
  select coalesce(nullif(profile.display_name, ''), 'A neighbor')
    into helper_name
    from public.profiles as profile
   where profile.id = new.helper_id;

  select task.title
    into task_title
    from public.tasks as task
   where task.id = new.task_id;

  insert into public.task_messages (task_id, sender_id, body, kind)
  values (
    new.task_id,
    new.helper_id,
    format(
      'Hi, my name is %s and I will be helping you with %s.',
      coalesce(helper_name, 'A neighbor'),
      coalesce(task_title, 'your task')
    ),
    'system'
  );

  return new;
end;
$$;

comment on function private_authorization.announce_task_assignment() is
  'Writes the helper introduction that opens a task thread, exactly once per acceptance.';

revoke all on function private_authorization.announce_task_assignment()
  from public, anon, authenticated, service_role;

drop trigger if exists announce_task_assignment on public.task_assignments;
create trigger announce_task_assignment
  after insert on public.task_assignments
  for each row
  when (new.status = 'accepted')
  execute function private_authorization.announce_task_assignment();

-- The requester's device learns about all of this by subscription rather than by
-- polling. Realtime applies the select policies above per subscriber, and
-- `replica identity full` gives it the whole row to run them against.
alter table public.task_assignments replica identity full;
alter table public.task_messages replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'task_assignments'
  ) then
    alter publication supabase_realtime add table public.task_assignments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'task_messages'
  ) then
    alter publication supabase_realtime add table public.task_messages;
  end if;
end;
$$;

-- A thread needs the other person's name, which lives in `profiles` behind its
-- own RLS. These views expose only that one field, matching how
-- `task_listings` already surfaces a requester's name.
create or replace view public.task_assignment_details
with (security_invoker = true) as
  select
    assignment.*,
    helper.display_name as helper_name,
    task.title as task_title,
    task.owner_id as requester_id
  from public.task_assignments assignment
  join public.tasks task on task.id = assignment.task_id
  left join public.profiles helper on helper.id = assignment.helper_id;

grant select on public.task_assignment_details to authenticated;

create or replace view public.task_message_details
with (security_invoker = true) as
  select
    message.*,
    sender.display_name as sender_name
  from public.task_messages message
  left join public.profiles sender on sender.id = message.sender_id;

grant select on public.task_message_details to authenticated;
