-- Server-backed, per-account read cursors for assignment-scoped task threads.
-- The browser may read only its own cursor and advances it only through the
-- authenticated RPC below; reader identity and receipt time are server-derived.

-- A composite key lets the cursor prove that its message belongs to the same
-- assignment even for trusted/service writes outside the RPC.
create unique index task_messages_assignment_message_key
  on public.task_messages (assignment_id, id);

create table public.task_thread_reads (
  assignment_id uuid not null,
  reader_id uuid not null,
  last_read_at timestamptz not null,
  last_read_message_id uuid not null,
  primary key (assignment_id, reader_id),
  constraint task_thread_reads_assignment_fk
    foreign key (assignment_id)
    references public.task_assignments (id)
    on delete cascade,
  constraint task_thread_reads_reader_fk
    foreign key (reader_id)
    references auth.users (id)
    on delete cascade,
  constraint task_thread_reads_message_in_assignment_fk
    foreign key (assignment_id, last_read_message_id)
    references public.task_messages (assignment_id, id)
    on delete restrict
);

comment on table public.task_thread_reads is
  'One server-derived read cursor per assignment participant. Assignment or reader deletion removes the cursor; retained transcript messages cannot be deleted out from under it.';
comment on column public.task_thread_reads.last_read_at is
  'Database time when the caller most recently marked this thread read; never accepted from a client.';
comment on column public.task_thread_reads.last_read_message_id is
  'Furthest message reached in deterministic (created_at, id) thread order.';

-- The primary key serves assignment lookups and assignment cascades. These two
-- indexes serve the self-only RLS/query path and FK checks for message deletion.
create index task_thread_reads_reader_updated_idx
  on public.task_thread_reads (reader_id, last_read_at desc);

create index task_thread_reads_last_message_idx
  on public.task_thread_reads (last_read_message_id);

alter table public.task_thread_reads enable row level security;

create policy task_thread_reads_self_participant_read
on public.task_thread_reads
for select
to authenticated
using (
  reader_id = (select auth.uid())
  and (
    select private_authorization.current_user_is_assignment_participant(
      task_thread_reads.assignment_id
    )
  )
);

-- This restrictive gate is deliberately separate from the participant policy:
-- any future business policy must still prove the JWT session exists in Auth.
create policy task_thread_reads_require_live_auth_session
on public.task_thread_reads
as restrictive
for all
to authenticated
using ((select private_authorization.current_auth_session_is_live()))
with check ((select private_authorization.current_auth_session_is_live()));

revoke all on table public.task_thread_reads from public, anon, authenticated;
grant select on table public.task_thread_reads to authenticated;
grant all privileges on table public.task_thread_reads to service_role;

create or replace function public.mark_task_thread_read(
  p_assignment_id uuid,
  p_message_id uuid
)
returns public.task_thread_reads
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  candidate_message_created_at timestamptz;
  current_message_id uuid;
  current_message_created_at timestamptz;
  marked_cursor public.task_thread_reads;
begin
  if not coalesce(
    (select private_authorization.current_auth_session_is_live()),
    false
  ) then
    raise insufficient_privilege using
      message = 'live_authenticated_session_required';
  end if;

  if p_assignment_id is null or p_message_id is null then
    raise invalid_parameter_value using
      message = 'thread_read_cursor_input_required';
  end if;

  -- Keep an extant caller from being deleted between the live-session check and
  -- the reader FK write. Active-account deletion already uses compatible locks.
  perform locked_user.id
  from auth.users as locked_user
  where locked_user.id = caller_id
  for key share;

  if not found then
    raise insufficient_privilege using
      message = 'live_authenticated_session_required';
  end if;

  -- Do not reveal whether an unrelated assignment exists. Settled participants
  -- may still mark their retained, read-only transcript as read.
  perform assignment.id
  from public.task_assignments as assignment
  where assignment.id = p_assignment_id
    and (
      assignment.requester_id = caller_id
      or assignment.helper_id = caller_id
    )
  for key share;

  if not found then
    raise insufficient_privilege using
      message = 'not_a_task_participant';
  end if;

  select message.created_at
  into candidate_message_created_at
  from public.task_messages as message
  where message.assignment_id = p_assignment_id
    and message.id = p_message_id
  for key share;

  if not found then
    raise invalid_parameter_value using
      message = 'thread_message_not_found';
  end if;

  -- The row lock serializes established cursors. Concurrent first reads race on
  -- the primary key; the loser catches that one conflict and re-enters through
  -- the locked path. Message order and server time can therefore never move
  -- backwards, even when devices report older messages out of order.
  loop
    select cursor.last_read_message_id, message.created_at
    into current_message_id, current_message_created_at
    from public.task_thread_reads as cursor
    join public.task_messages as message
      on message.assignment_id = cursor.assignment_id
      and message.id = cursor.last_read_message_id
    where cursor.assignment_id = p_assignment_id
      and cursor.reader_id = caller_id
    for update of cursor;

    if found then
      update public.task_thread_reads as cursor
      set
        last_read_at = greatest(cursor.last_read_at, clock_timestamp()),
        last_read_message_id = case
          when (candidate_message_created_at, p_message_id)
            > (current_message_created_at, current_message_id)
          then p_message_id
          else cursor.last_read_message_id
        end
      where cursor.assignment_id = p_assignment_id
        and cursor.reader_id = caller_id
      returning cursor.* into marked_cursor;

      return marked_cursor;
    end if;

    begin
      insert into public.task_thread_reads (
        assignment_id,
        reader_id,
        last_read_at,
        last_read_message_id
      )
      values (
        p_assignment_id,
        caller_id,
        clock_timestamp(),
        p_message_id
      )
      returning * into marked_cursor;

      return marked_cursor;
    exception
      when unique_violation then
        -- Another request created this caller's cursor. Loop once through the
        -- locked update path and keep whichever message is furthest ahead.
        null;
    end;
  end loop;
end;
$$;

comment on function public.mark_task_thread_read(uuid, uuid) is
  'Advances the live caller own assignment read cursor to a validated thread message, monotonically in message order and server receipt time.';

revoke all on function public.mark_task_thread_read(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.mark_task_thread_read(uuid, uuid)
  to authenticated;

-- Realtime is delivery only; SELECT RLS remains authoritative for each cursor.
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'task_thread_reads'
  ) then
    alter publication supabase_realtime add table public.task_thread_reads;
  end if;
end;
$$;
