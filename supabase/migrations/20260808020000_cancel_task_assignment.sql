-- Calling off a match, and saying so in the thread.
--
-- A requester could mark a match complete or wait for the helper to withdraw,
-- but had no way to call the task off themselves. Completion was the only exit
-- they controlled, which meant an abandoned task had to be recorded as finished
-- work — a false record of what happened.
--
-- Cancellation is its own outcome, and it is announced in the thread by the
-- database. The other participant learns a match ended from the conversation
-- they were already having, not by noticing a status badge change; and because
-- sending is closed the moment an assignment settles, the client could not have
-- written this line for itself even if it tried.

-- 'canceled' joins the settled statuses. Both status constraints are rebuilt:
-- the inline one is anonymous, so it is found by definition rather than name.
do $$
declare
  status_constraint_name text;
begin
  select constraint_entry.conname
  into status_constraint_name
  from pg_constraint as constraint_entry
  join pg_class as table_entry on table_entry.oid = constraint_entry.conrelid
  join pg_namespace as schema_entry on schema_entry.oid = table_entry.relnamespace
  where schema_entry.nspname = 'public'
    and table_entry.relname = 'task_assignments'
    and constraint_entry.contype = 'c'
    and pg_get_constraintdef(constraint_entry.oid) like '%withdrawn%'
    and pg_get_constraintdef(constraint_entry.oid) not like '%settled_at%';

  if status_constraint_name is not null then
    execute format(
      'alter table public.task_assignments drop constraint %I',
      status_constraint_name
    );
  end if;
end;
$$;

alter table public.task_assignments
  add constraint task_assignments_status_is_known
  check (status in ('accepted', 'withdrawn', 'completed', 'canceled'));

alter table public.task_assignments
  drop constraint task_assignments_status_is_consistent;

alter table public.task_assignments
  add constraint task_assignments_status_is_consistent check (
    (
      status = 'accepted'
      and task_id is not null
      and requester_id is not null
      and helper_id is not null
      and settled_at is null
    )
    or (
      status in ('withdrawn', 'completed', 'canceled')
      and settled_at is not null
    )
  );

-- Only the requester cancels: the helper's equivalent exit is a withdrawal,
-- which reopens the listing instead of taking the task off the board.
-- Cancelling pauses the listing, because a called-off task must not quietly
-- return to discovery looking for a replacement.
create or replace function public.cancel_task_assignment(
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

  -- Same lock order as the withdrawal and completion paths: the acting user,
  -- then the task, then the assignment. Diverging here would let two exits
  -- taken at once deadlock against each other.
  perform 1
  from auth.users as canceling_user
  where canceling_user.id = caller_id
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
      message = 'assignment_cancellation_not_allowed';
  end if;

  update public.tasks
  set listing_paused = true
  where id = subject_task_id;

  update public.task_assignments
  set status = 'canceled', settled_at = now()
  where id = p_assignment_id
  returning * into subject_assignment;

  return subject_assignment;
end;
$$;

comment on function public.cancel_task_assignment(uuid) is
  'Requester-only cancellation of an active match. Pauses the listing so a called-off task does not return to discovery.';

revoke all on function public.cancel_task_assignment(uuid)
  from public, anon, service_role;
grant execute on function public.cancel_task_assignment(uuid)
  to authenticated;

-- The thread says what happened. Written by the database because sending is
-- closed to clients the moment an assignment leaves 'accepted', so this line
-- can only be added from inside the transaction that settles it.
create or replace function private_authorization.announce_assignment_ending()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_id uuid;
  acting_name text;
begin
  acting_id := case
    when new.status = 'canceled' then new.requester_id
    else new.helper_id
  end;

  select coalesce(nullif(profile.display_name, ''), 'A neighbor')
  into acting_name
  from public.profiles as profile
  where profile.id = acting_id;

  insert into public.task_messages (assignment_id, sender_id, client_nonce, body, kind)
  values (
    new.id,
    acting_id,
    gen_random_uuid(),
    case
      when new.status = 'canceled' then format(
        '%s canceled this activity. The task has been called off and this thread is now a read-only record.',
        coalesce(acting_name, 'The requester')
      )
      else format(
        '%s canceled this activity and withdrew from the commitment. The listing is open to another helper.',
        coalesce(acting_name, 'The helper')
      )
    end,
    'system'
  );

  return new;
end;
$$;

comment on function private_authorization.announce_assignment_ending() is
  'Posts the system line that closes a thread when a match is canceled or withdrawn from.';

revoke all on function private_authorization.announce_assignment_ending()
  from public, anon, authenticated, service_role;

drop trigger if exists announce_assignment_ending on public.task_assignments;
create trigger announce_assignment_ending
  after update of status on public.task_assignments
  for each row
  when (old.status = 'accepted' and new.status in ('canceled', 'withdrawn'))
  execute function private_authorization.announce_assignment_ending();
