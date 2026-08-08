-- Live task assignment and participant-only messaging.
--
-- One assignment is one historical match and one private thread. A task may be
-- matched again after a withdrawal, but partial unique indexes allow only one
-- active helper per task and one active task per helper. All state transitions
-- happen through row-locking RPCs; clients never write assignment identity or
-- status columns directly.

alter table public.tasks
  add column if not exists starts_at timestamptz;

-- Browser-authored rows fail closed. A follow-up trusted publisher composes an
-- exact reviewed catalog variant and is the only path that may create a row
-- with custom_pending=false. A browser cannot set this flag through its column
-- grant below.
alter table public.tasks
  alter column custom_pending set default true;

comment on column public.tasks.starts_at is
  'Structured start time used to reject stale accepts. Flexible tasks leave this null; time_label remains presentation text.';

create table public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks (id) on delete set null,
  requester_id uuid references auth.users (id) on delete set null,
  helper_id uuid references auth.users (id) on delete set null,
  task_title text not null check (char_length(task_title) between 4 and 120),
  status text not null default 'accepted'
    check (status in ('accepted', 'withdrawn', 'completed')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  constraint task_assignments_status_is_consistent check (
    (
      status = 'accepted'
      and task_id is not null
      and requester_id is not null
      and helper_id is not null
      and settled_at is null
    )
    or (
      status in ('withdrawn', 'completed')
      and settled_at is not null
    )
  )
);

comment on table public.task_assignments is
  'Authoritative match history. Identity and status are written only by trusted RPCs; one assignment ID owns one private thread.';

create unique index task_assignments_one_active_helper_per_task_idx
  on public.task_assignments (task_id)
  where status = 'accepted';

create unique index task_assignments_one_active_task_per_helper_idx
  on public.task_assignments (helper_id)
  where status = 'accepted';

create index task_assignments_requester_created_idx
  on public.task_assignments (requester_id, created_at desc);

create index task_assignments_helper_created_idx
  on public.task_assignments (helper_id, created_at desc);

create table public.task_messages (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null
    references public.task_assignments (id) on delete restrict,
  sender_id uuid default auth.uid()
    references auth.users (id) on delete set null,
  client_nonce uuid not null,
  body text not null,
  kind text not null default 'human'
    check (kind in ('human', 'system')),
  created_at timestamptz not null default now(),
  constraint task_messages_body_is_bounded check (
    char_length(body) <= 2000
    and char_length(btrim(body)) >= 1
  ),
  constraint task_messages_sender_nonce_unique
    unique (sender_id, client_nonce)
);

comment on table public.task_messages is
  'Append-only assignment thread. Browser sends omit sender_id and kind; auth.uid() and the human default are database-derived, while client_nonce deduplicates retries.';

create index task_messages_assignment_created_idx
  on public.task_messages (assignment_id, created_at, id);

alter table public.task_assignments enable row level security;
alter table public.task_messages enable row level security;

-- Fixed-search-path SECURITY DEFINER predicates avoid recursive RLS while
-- exposing only booleans about the live caller. The schema is not exposed by
-- the Data API, and execution remains tightly granted.
create or replace function private_authorization.task_has_active_assignment(
  subject_task_id uuid
)
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
      and assignment.status = 'accepted'
  );
$$;

create or replace function private_authorization.current_user_holds_active_task_assignment(
  subject_task_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private_authorization.current_auth_session_is_live())
    and exists (
      select 1
      from public.task_assignments as assignment
      where assignment.task_id = subject_task_id
        and assignment.helper_id = (select auth.uid())
        and assignment.status = 'accepted'
    );
$$;

create or replace function private_authorization.current_user_is_assignment_participant(
  subject_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private_authorization.current_auth_session_is_live())
    and exists (
      select 1
      from public.task_assignments as assignment
      where assignment.id = subject_assignment_id
        and (
          assignment.requester_id = (select auth.uid())
          or assignment.helper_id = (select auth.uid())
        )
    );
$$;

create or replace function private_authorization.current_user_can_message_assignment(
  subject_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private_authorization.current_auth_session_is_live())
    and exists (
      select 1
      from public.task_assignments as assignment
      where assignment.id = subject_assignment_id
        and assignment.status = 'accepted'
        and (
          assignment.requester_id = (select auth.uid())
          or assignment.helper_id = (select auth.uid())
        )
    );
$$;

revoke all on function private_authorization.task_has_active_assignment(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private_authorization.current_user_holds_active_task_assignment(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private_authorization.current_user_is_assignment_participant(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private_authorization.current_user_can_message_assignment(uuid)
  from public, anon, authenticated, service_role;

grant execute on function private_authorization.task_has_active_assignment(uuid)
  to authenticated, service_role;
grant execute on function private_authorization.current_user_holds_active_task_assignment(uuid)
  to authenticated, service_role;
grant execute on function private_authorization.current_user_is_assignment_participant(uuid)
  to authenticated, service_role;
grant execute on function private_authorization.current_user_can_message_assignment(uuid)
  to authenticated, service_role;

create policy task_assignments_participants_read
on public.task_assignments
for select
to authenticated
using (
  (
    select private_authorization.current_user_is_assignment_participant(
      task_assignments.id
    )
  )
);

create policy task_messages_participants_read
on public.task_messages
for select
to authenticated
using (
  (
    select private_authorization.current_user_is_assignment_participant(
      task_messages.assignment_id
    )
  )
);

create policy task_messages_participants_send
on public.task_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and kind = 'human'
  and (
    select private_authorization.current_user_can_message_assignment(
      task_messages.assignment_id
    )
  )
);

-- One restrictive policy per exposed live table is ANDed with every current or
-- future permissive business policy. Revoking an Auth session therefore closes
-- reads and writes immediately, before JWT expiry.
create policy task_assignments_require_live_auth_session
on public.task_assignments
as restrictive
for all
to authenticated
using ((select private_authorization.current_auth_session_is_live()))
with check ((select private_authorization.current_auth_session_is_live()));

create policy task_messages_require_live_auth_session
on public.task_messages
as restrictive
for all
to authenticated
using ((select private_authorization.current_auth_session_is_live()))
with check ((select private_authorization.current_auth_session_is_live()));

-- Minimum Data API grants. Assignments have no authenticated INSERT, UPDATE,
-- or DELETE privilege. Message clients cannot supply sender_id or kind.
revoke all on table public.task_assignments from anon, authenticated;
revoke all on table public.task_messages from anon, authenticated;
grant select on table public.task_assignments to authenticated;
grant select on table public.task_messages to authenticated;
grant insert (assignment_id, client_nonce, body)
  on table public.task_messages to authenticated;
grant all privileges on table public.task_assignments to service_role;
grant all privileges on table public.task_messages to service_role;

-- Existing task tables inherited broad grants on older projects. Replace them
-- with a stable, explicit surface. Direct browser posts cannot set review or
-- paused state and are pending until a trusted catalog publisher creates the
-- reviewed row. Owners may pause only an unmatched listing.
revoke all on table public.tasks from anon, authenticated;
grant select, delete on table public.tasks to authenticated;
grant insert (
  owner_id,
  template_id,
  title,
  description,
  included,
  excluded,
  completion,
  category,
  category_id,
  mode,
  earning,
  lat,
  lng,
  area_id,
  area,
  time_label,
  starts_at,
  duration,
  youth_eligible
) on table public.tasks to authenticated;
grant update (listing_paused) on table public.tasks to authenticated;

revoke all on table public.task_private_details from anon, authenticated;
grant select on table public.task_private_details to authenticated;
grant insert (task_id, private_address)
  on table public.task_private_details to authenticated;
grant all privileges on table public.tasks to service_role;
grant all privileges on table public.task_private_details to service_role;

-- Discovery contains only unmatched, unpaused work. Requesters retain their
-- own task, and the active helper retains the matched task by direct query.
drop policy if exists "tasks are readable by signed-in neighbors" on public.tasks;
drop policy if exists "assigned helpers keep reading their task" on public.tasks;
create policy "available tasks and matched participants read"
on public.tasks
for select
to authenticated
using (
  owner_id = (select auth.uid())
  or (
    select private_authorization.current_user_holds_active_task_assignment(
      tasks.id
    )
  )
  or (
    not listing_paused
    and not custom_pending
    and not (
      select private_authorization.task_has_active_assignment(tasks.id)
    )
  )
);

drop policy if exists "owners update their own tasks" on public.tasks;
create policy "owners pause their own unmatched tasks"
on public.tasks
for update
to authenticated
using (
  owner_id = (select auth.uid())
  and not (
    select private_authorization.task_has_active_assignment(tasks.id)
  )
)
with check (
  owner_id = (select auth.uid())
  and not (
    select private_authorization.task_has_active_assignment(tasks.id)
  )
);

drop policy if exists "owners delete their own tasks" on public.tasks;
create policy "owners delete their own unmatched tasks"
on public.tasks
for delete
to authenticated
using (
  owner_id = (select auth.uid())
  and not (
    select private_authorization.task_has_active_assignment(tasks.id)
  )
);

-- The requester always sees their address. Only the current accepted helper
-- gains it; a withdrawn or completed helper retains the thread but not the
-- exact location. No authenticated UPDATE or DELETE grant exists.
drop policy if exists "owners read their own task address"
  on public.task_private_details;
create policy "requester and active helper read task address"
on public.task_private_details
for select
to authenticated
using (
  exists (
    select 1
    from public.tasks as task
    where task.id = task_private_details.task_id
      and task.owner_id = (select auth.uid())
  )
  or (
    select private_authorization.current_user_holds_active_task_assignment(
      task_private_details.task_id
    )
  )
);

drop policy if exists "owners change their own task address"
  on public.task_private_details;

-- Atomic, idempotent acceptance. The caller and requester Auth rows are locked
-- in UUID order before the task row so concurrent account deletion cannot
-- deadlock with or slip through the assignment FKs.
create or replace function public.accept_task(p_task_id uuid)
returns public.task_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  preliminary_owner_id uuid;
  task_owner_id uuid;
  task_is_paused boolean;
  task_is_custom_pending boolean;
  task_start timestamptz;
  task_title_value text;
  caller_can_accept boolean;
  accepted_assignment public.task_assignments;
  violated_constraint text;
begin
  if caller_id is null
    or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true'
    or not coalesce(
      (select private_authorization.current_auth_session_is_live()),
      false
    )
  then
    raise insufficient_privilege using
      message = 'live_authenticated_session_required';
  end if;

  if p_task_id is null then
    raise check_violation using message = 'task_id_required';
  end if;

  select task.owner_id
  into preliminary_owner_id
  from public.tasks as task
  where task.id = p_task_id;

  if not found then
    raise no_data_found using message = 'task_not_found';
  end if;

  perform locked_user.id
  from auth.users as locked_user
  where locked_user.id in (caller_id, preliminary_owner_id)
  order by locked_user.id
  for key share;

  select
    task.owner_id,
    task.listing_paused,
    task.custom_pending,
    task.starts_at,
    task.title
  into
    task_owner_id,
    task_is_paused,
    task_is_custom_pending,
    task_start,
    task_title_value
  from public.tasks as task
  where task.id = p_task_id
  for update;

  if not found then
    raise no_data_found using message = 'task_not_found';
  end if;

  if task_owner_id <> preliminary_owner_id then
    raise serialization_failure using message = 'task_owner_changed';
  end if;

  select coalesce(capability.can_accept_tasks, false)
  into caller_can_accept
  from public.current_user_capabilities() as capability;

  if not coalesce(caller_can_accept, false) then
    raise insufficient_privilege using message = 'task_acceptance_not_allowed';
  end if;

  if task_owner_id = caller_id then
    raise insufficient_privilege using message = 'task_owner_cannot_accept';
  end if;

  if task_is_paused then
    raise check_violation using message = 'task_is_paused';
  end if;

  if task_is_custom_pending then
    raise check_violation using message = 'custom_task_awaiting_review';
  end if;

  if task_start is not null and task_start <= now() then
    raise check_violation using message = 'task_start_has_passed';
  end if;

  perform 1
  from public.task_private_details as details
  where details.task_id = p_task_id
  for update;

  if not found then
    raise check_violation using message = 'task_private_address_required';
  end if;

  select assignment.*
  into accepted_assignment
  from public.task_assignments as assignment
  where assignment.task_id = p_task_id
    and assignment.status = 'accepted';

  if found then
    if accepted_assignment.helper_id = caller_id then
      return accepted_assignment;
    end if;

    raise unique_violation using message = 'task_already_accepted';
  end if;

  begin
    insert into public.task_assignments (
      task_id,
      requester_id,
      helper_id,
      task_title,
      status
    )
    values (
      p_task_id,
      task_owner_id,
      caller_id,
      task_title_value,
      'accepted'
    )
    returning * into accepted_assignment;
  exception
    when unique_violation then
      get stacked diagnostics violated_constraint = constraint_name;

      if violated_constraint = 'task_assignments_one_active_task_per_helper_idx' then
        raise unique_violation using message = 'helper_already_has_active_task';
      end if;

      if violated_constraint = 'task_assignments_one_active_helper_per_task_idx' then
        select assignment.*
        into accepted_assignment
        from public.task_assignments as assignment
        where assignment.task_id = p_task_id
          and assignment.status = 'accepted';

        if accepted_assignment.helper_id = caller_id then
          return accepted_assignment;
        end if;

        raise unique_violation using message = 'task_already_accepted';
      end if;

      raise;
  end;

  return accepted_assignment;
end;
$$;

comment on function public.accept_task(uuid) is
  'Atomically accepts one reviewed, available task for the live caller. A retry by the winning helper returns the original assignment.';

revoke all on function public.accept_task(uuid) from public, anon, service_role;
grant execute on function public.accept_task(uuid) to authenticated;

-- The helper may end their own active commitment. The historical assignment
-- and its thread remain readable to both parties, but become append-closed.
create or replace function public.withdraw_task_assignment(
  p_assignment_id uuid
)
returns public.task_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  subject_task_id uuid;
  subject_assignment public.task_assignments;
begin
  if caller_id is null
    or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true'
    or not coalesce(
      (select private_authorization.current_auth_session_is_live()),
      false
    )
  then
    raise insufficient_privilege using
      message = 'live_authenticated_session_required';
  end if;

  select assignment.task_id
  into subject_task_id
  from public.task_assignments as assignment
  where assignment.id = p_assignment_id;

  if not found then
    raise no_data_found using message = 'assignment_not_found';
  end if;

  perform 1
  from auth.users as withdrawing_user
  where withdrawing_user.id = caller_id
  for key share;

  perform 1
  from public.tasks as task
  where task.id = subject_task_id
  for update;

  select assignment.*
  into subject_assignment
  from public.task_assignments as assignment
  where assignment.id = p_assignment_id
  for update;

  if subject_assignment.status <> 'accepted'
    or subject_assignment.helper_id <> caller_id
  then
    raise insufficient_privilege using
      message = 'assignment_withdrawal_not_allowed';
  end if;

  update public.task_assignments
  set status = 'withdrawn', settled_at = now()
  where id = p_assignment_id
  returning * into subject_assignment;

  return subject_assignment;
end;
$$;

revoke all on function public.withdraw_task_assignment(uuid)
  from public, anon, service_role;
grant execute on function public.withdraw_task_assignment(uuid)
  to authenticated;

-- Only the requester closes an active assignment as completed. Completion also
-- pauses the original listing so it cannot silently return to discovery.
create or replace function public.complete_task_assignment(
  p_assignment_id uuid
)
returns public.task_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  subject_task_id uuid;
  subject_assignment public.task_assignments;
begin
  if caller_id is null
    or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true'
    or not coalesce(
      (select private_authorization.current_auth_session_is_live()),
      false
    )
  then
    raise insufficient_privilege using
      message = 'live_authenticated_session_required';
  end if;

  select assignment.task_id
  into subject_task_id
  from public.task_assignments as assignment
  where assignment.id = p_assignment_id;

  if not found then
    raise no_data_found using message = 'assignment_not_found';
  end if;

  perform 1
  from auth.users as completing_user
  where completing_user.id = caller_id
  for key share;

  perform 1
  from public.tasks as task
  where task.id = subject_task_id
  for update;

  select assignment.*
  into subject_assignment
  from public.task_assignments as assignment
  where assignment.id = p_assignment_id
  for update;

  if subject_assignment.status <> 'accepted'
    or subject_assignment.requester_id <> caller_id
  then
    raise insufficient_privilege using
      message = 'assignment_completion_not_allowed';
  end if;

  update public.tasks
  set listing_paused = true
  where id = subject_task_id;

  update public.task_assignments
  set status = 'completed', settled_at = now()
  where id = p_assignment_id
  returning * into subject_assignment;

  return subject_assignment;
end;
$$;

revoke all on function public.complete_task_assignment(uuid)
  from public, anon, service_role;
grant execute on function public.complete_task_assignment(uuid)
  to authenticated;

-- Active commitments block both account and task deletion. Settled rows are
-- retained: Auth deletion anonymizes requester/helper/sender foreign keys, and
-- task deletion nulls task_id while task_title and the transcript remain.
create or replace function private.protect_active_task_commitments_on_account_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform task.id
  from public.tasks as task
  left join public.task_assignments as assignment
    on assignment.task_id = task.id
  where task.owner_id = old.id
    or (
      assignment.status = 'accepted'
      and (
        assignment.requester_id = old.id
        or assignment.helper_id = old.id
      )
    )
  order by task.id
  for update of task;

  if exists (
    select 1
    from public.task_assignments as assignment
    where assignment.status = 'accepted'
      and (
        assignment.requester_id = old.id
        or assignment.helper_id = old.id
      )
  ) then
    raise integrity_constraint_violation using
      message = 'active_task_commitment_requires_settlement';
  end if;

  return old;
end;
$$;

create trigger protect_active_tasks_before_account_deletion
before delete on auth.users
for each row
execute function private.protect_active_task_commitments_on_account_deletion();

revoke all on function private.protect_active_task_commitments_on_account_deletion()
  from public, anon, authenticated, service_role;

create or replace function private.protect_active_assignment_on_task_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.task_assignments as assignment
    where assignment.task_id = old.id
      and assignment.status = 'accepted'
  ) then
    raise integrity_constraint_violation using
      message = 'active_task_commitment_requires_settlement';
  end if;

  return old;
end;
$$;

create trigger protect_active_assignment_before_task_deletion
before delete on public.tasks
for each row
execute function private.protect_active_assignment_on_task_deletion();

revoke all on function private.protect_active_assignment_on_task_deletion()
  from public, anon, authenticated, service_role;

-- Accepted tasks leave public discovery. Assignment participants use the
-- participant views or direct task reads. Drop/recreate is required because
-- adding starts_at changes the position of requester_name in the old `t.*`
-- view definition.
drop view public.task_listings;
create view public.task_listings
with (security_invoker = true) as
  select
    task.*,
    requester.display_name as requester_name
  from public.tasks as task
  left join public.profiles as requester on requester.id = task.owner_id
  where (
      not task.custom_pending
      or task.owner_id = (select auth.uid())
    )
    and not (
      select private_authorization.task_has_active_assignment(task.id)
    );

revoke all on public.task_listings from public, anon, authenticated;
grant select on public.task_listings to authenticated;
grant select on public.task_listings to service_role;

-- Compatibility views preserve the collaborator-facing shape without letting
-- clients bypass underlying participant RLS. One assignment ID is one thread.
create view public.task_assignment_details
with (security_invoker = true) as
  select
    assignment.id,
    assignment.task_id,
    assignment.requester_id,
    assignment.helper_id,
    assignment.task_title,
    assignment.status,
    assignment.created_at,
    assignment.settled_at,
    coalesce(requester.display_name, 'Deleted neighbor') as requester_name,
    coalesce(helper.display_name, 'Deleted neighbor') as helper_name
  from public.task_assignments as assignment
  left join public.profiles as requester
    on requester.id = assignment.requester_id
  left join public.profiles as helper
    on helper.id = assignment.helper_id;

create view public.task_conversation_participants
with (security_invoker = true) as
  select
    assignment.id as assignment_id,
    assignment.task_id,
    assignment.requester_id as owner_id,
    coalesce(requester.display_name, 'Deleted neighbor') as requester_name,
    assignment.helper_id,
    coalesce(helper.display_name, 'Deleted neighbor') as helper_name,
    assignment.status,
    assignment.created_at as accepted_at,
    assignment.settled_at
  from public.task_assignments as assignment
  left join public.profiles as requester
    on requester.id = assignment.requester_id
  left join public.profiles as helper
    on helper.id = assignment.helper_id;

create view public.task_message_details
with (security_invoker = true) as
  select
    message.id,
    message.assignment_id,
    assignment.task_id,
    message.sender_id,
    coalesce(sender.display_name, 'Deleted neighbor') as sender_name,
    message.body,
    message.kind,
    message.client_nonce,
    message.created_at
  from public.task_messages as message
  join public.task_assignments as assignment
    on assignment.id = message.assignment_id
  left join public.profiles as sender on sender.id = message.sender_id;

revoke all on public.task_assignment_details
  from public, anon, authenticated;
revoke all on public.task_conversation_participants
  from public, anon, authenticated;
revoke all on public.task_message_details
  from public, anon, authenticated;
grant select on public.task_assignment_details to authenticated;
grant select on public.task_conversation_participants to authenticated;
grant select on public.task_message_details to authenticated;
grant select on public.task_assignment_details to service_role;
grant select on public.task_conversation_participants to service_role;
grant select on public.task_message_details to service_role;

-- Realtime is delivery, not authority. Postgres Changes rechecks SELECT RLS for
-- each subscriber, and clients still reconcile on focus/reconnect.
alter table public.task_assignments replica identity full;
alter table public.task_messages replica identity full;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'tasks'
    ) then
      alter publication supabase_realtime add table public.tasks;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'task_assignments'
    ) then
      alter publication supabase_realtime add table public.task_assignments;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'task_messages'
    ) then
      alter publication supabase_realtime add table public.task_messages;
    end if;
  end if;
end;
$$;
