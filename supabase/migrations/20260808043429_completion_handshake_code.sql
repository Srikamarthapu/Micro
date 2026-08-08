-- Finishing a job is a handshake, not a claim.
--
-- Completion used to be one unilateral tap by the requester, which meant the
-- person requesting the work decided alone whether the work happened. This
-- replaces it with the pattern a rider and driver already use: the helper says
-- they are finished and receives a four-digit code, and the task closes only
-- when the requester types that code in. Neither side can finish it alone.
--
-- The code lives in its own table for the same reason the private address does:
-- RLS is row-level, not column-level, so a column on `task_assignments` would
-- be readable by the requester who can already read that row — and a requester
-- who can read the code can close the task without the helper ever being there.
-- Its own table with a helper-only select policy is what actually enforces this.

-- Visible to both sides: the requester has to know a code is waiting without
-- being able to see what it is.
alter table public.task_assignments
  add column if not exists completion_requested_at timestamptz;

comment on column public.task_assignments.completion_requested_at is
  'Set when the helper reports the work finished. The code itself lives in task_completion_codes, which the requester cannot read.';

create table if not exists public.task_completion_codes (
  assignment_id uuid primary key
    references public.task_assignments (id) on delete cascade,
  code text not null check (code ~ '^[0-9]{4}$'),
  issued_at timestamptz not null default now(),
  -- Four digits is 10,000 guesses, which is nothing for a script. The attempt
  -- ceiling, not the code length, is what makes this safe to type in person.
  failed_attempts integer not null default 0,
  locked_until timestamptz
);

comment on table public.task_completion_codes is
  'Helper-held completion codes. Readable only by the helper who was issued one; verified server-side so the code is never returned to the requester.';

alter table public.task_completion_codes enable row level security;

-- The helper reads their own code and nothing else. No insert, update, or
-- delete policy exists for anyone: the RPCs below are the only writers.
create policy task_completion_codes_helper_reads_own
on public.task_completion_codes
for select
to authenticated
using (
  exists (
    select 1
    from public.task_assignments as assignment
    where assignment.id = task_completion_codes.assignment_id
      and assignment.helper_id = (select auth.uid())
      and assignment.status = 'accepted'
  )
);

create policy task_completion_codes_require_live_auth_session
on public.task_completion_codes
as restrictive
for all
to authenticated
using ((select private_authorization.current_auth_session_is_live()))
with check ((select private_authorization.current_auth_session_is_live()));

revoke all on table public.task_completion_codes from anon, authenticated;
grant select on table public.task_completion_codes to authenticated;
grant all privileges on table public.task_completion_codes to service_role;

-- The helper reports the work done and is issued the code to read out. Calling
-- it twice returns the same code rather than a new one, so a retry or a second
-- device never leaves the requester holding a stale number.
create or replace function public.request_task_completion(
  p_assignment_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  subject_assignment public.task_assignments;
  existing_code text;
  issued_code text;
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

  select assignment.*
  into subject_assignment
  from public.task_assignments as assignment
  where assignment.id = p_assignment_id
  for update;

  if not found then
    raise no_data_found using message = 'assignment_not_found';
  end if;

  if subject_assignment.status <> 'accepted'
    or subject_assignment.helper_id <> caller_id
  then
    raise insufficient_privilege using
      message = 'completion_request_not_allowed';
  end if;

  select existing.code
  into existing_code
  from public.task_completion_codes as existing
  where existing.assignment_id = p_assignment_id;

  if existing_code is not null then
    return existing_code;
  end if;

  -- random() is not a cryptographic source. It is adequate here only because
  -- the code is read aloud in person and guessing is capped at five tries.
  issued_code := lpad((floor(random() * 10000))::integer::text, 4, '0');

  insert into public.task_completion_codes (assignment_id, code)
  values (p_assignment_id, issued_code);

  update public.task_assignments
  set completion_requested_at = now()
  where id = p_assignment_id;

  return issued_code;
end;
$$;

comment on function public.request_task_completion(uuid) is
  'Helper-only. Reports the work finished and returns the four-digit code the requester must type to close the task. Repeat calls return the same code.';

revoke all on function public.request_task_completion(uuid)
  from public, anon, service_role;
grant execute on function public.request_task_completion(uuid)
  to authenticated;

-- The requester types the code. Expected wrong/locked outcomes are structured
-- results rather than exceptions: raising after an attempt update would roll
-- that update back and make the five-try ceiling ineffective.
create or replace function public.confirm_task_completion(
  p_assignment_id uuid,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  request_time timestamptz := clock_timestamp();
  subject_task_id uuid;
  subject_assignment public.task_assignments;
  stored public.task_completion_codes;
  next_failed_attempts integer;
  next_locked_until timestamptz;
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

  -- Match cancellation and withdrawal exactly: actor, task, assignment. This
  -- avoids the assignment -> task / task -> assignment deadlock in concurrent
  -- settling calls.
  perform confirming_user.id
  from auth.users as confirming_user
  where confirming_user.id = caller_id
  for key share;

  if not found then
    raise insufficient_privilege using
      message = 'live_authenticated_session_required';
  end if;

  perform task.id
  from public.tasks as task
  where task.id = subject_task_id
  for update;

  if not found then
    raise no_data_found using message = 'assignment_task_not_found';
  end if;

  select assignment.*
  into subject_assignment
  from public.task_assignments as assignment
  where assignment.id = p_assignment_id
  for update;

  if not found then
    raise no_data_found using message = 'assignment_not_found';
  end if;

  if subject_assignment.task_id is distinct from subject_task_id then
    raise serialization_failure using message = 'assignment_task_changed';
  end if;

  if subject_assignment.status <> 'accepted'
    or subject_assignment.requester_id <> caller_id
  then
    raise insufficient_privilege using
      message = 'completion_confirmation_not_allowed';
  end if;

  select code_row.*
  into stored
  from public.task_completion_codes as code_row
  where code_row.assignment_id = p_assignment_id
  for update;

  if not found then
    raise check_violation using message = 'completion_not_requested_yet';
  end if;

  if stored.locked_until is not null and stored.locked_until > request_time then
    return jsonb_build_object(
      'ok', false,
      'error_code', 'completion_code_locked',
      'failed_attempts', stored.failed_attempts,
      'locked_until', stored.locked_until
    );
  end if;

  if stored.code is distinct from btrim(coalesce(p_code, '')) then
    next_failed_attempts := stored.failed_attempts + 1;
    next_locked_until := case
      when next_failed_attempts >= 5
        then request_time + interval '15 minutes'
      else null
    end;

    update public.task_completion_codes
    set
      failed_attempts = next_failed_attempts,
      locked_until = next_locked_until
    where assignment_id = p_assignment_id;

    return jsonb_build_object(
      'ok', false,
      'error_code', case
        when next_locked_until is not null then 'completion_code_locked'
        else 'completion_code_incorrect'
      end,
      'failed_attempts', next_failed_attempts,
      'locked_until', next_locked_until
    );
  end if;

  update public.tasks
  set listing_paused = true
  where id = subject_task_id;

  update public.task_assignments
  set status = 'completed', settled_at = request_time
  where id = p_assignment_id
  returning * into subject_assignment;

  insert into public.task_messages (
    assignment_id,
    sender_id,
    client_nonce,
    body,
    kind
  )
  values (
    p_assignment_id,
    caller_id,
    gen_random_uuid(),
    'Completion was confirmed. This task is closed and the thread is now a read-only record.',
    'system'
  );

  -- The one-time code has no purpose after the assignment closes.
  delete from public.task_completion_codes
  where assignment_id = p_assignment_id;

  return jsonb_build_object(
    'ok', true,
    'error_code', null,
    'assignment', to_jsonb(subject_assignment)
  );
end;
$$;

comment on function public.confirm_task_completion(uuid, text) is
  'Requester-only completion confirmation. Returns {ok,error_code,...}; expected wrong or locked codes are results so rate-limit state commits.';

revoke all on function public.confirm_task_completion(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.confirm_task_completion(uuid, text)
  to authenticated;

-- The unilateral path is withdrawn. Leaving it callable would let a requester
-- close a task from the API without the code, which is the one thing this
-- handshake exists to prevent. Cancelling remains their way out.
revoke execute on function public.complete_task_assignment(uuid) from authenticated;

comment on function public.complete_task_assignment(uuid) is
  'Superseded by confirm_task_completion. No longer callable by authenticated clients: completion now requires the helper''s code.';

-- The requester is told a code is waiting, in the thread they already watch.
create or replace function private_authorization.announce_completion_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  helper_name text;
begin
  select coalesce(nullif(profile.display_name, ''), 'The helper')
  into helper_name
  from public.profiles as profile
  where profile.id = new.helper_id;

  insert into public.task_messages (
    assignment_id,
    sender_id,
    client_nonce,
    body,
    kind
  )
  values (
    new.id,
    new.helper_id,
    gen_random_uuid(),
    format(
      '%s marked this task finished and has a four-digit code. Ask for it and enter it on the task to confirm the work and close this activity.',
      coalesce(helper_name, 'The helper')
    ),
    'system'
  );

  return new;
end;
$$;

comment on function private_authorization.announce_completion_request() is
  'Posts the system line telling the requester a completion code is waiting, without claiming a payment capability.';

revoke all on function private_authorization.announce_completion_request()
  from public, anon, authenticated, service_role;

drop trigger if exists announce_completion_request on public.task_assignments;
create trigger announce_completion_request
  after update of completion_requested_at on public.task_assignments
  for each row
  when (old.completion_requested_at is null and new.completion_requested_at is not null)
  execute function private_authorization.announce_completion_request();

-- The participant view predates completion_requested_at. Recreate it with the
-- same security-invoker boundary so requesters can see that a code is waiting
-- without gaining access to the helper-only code table.
create or replace view public.task_assignment_details
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
    coalesce(helper.display_name, 'Deleted neighbor') as helper_name,
    assignment.completion_requested_at
  from public.task_assignments as assignment
  left join public.profiles as requester
    on requester.id = assignment.requester_id
  left join public.profiles as helper
    on helper.id = assignment.helper_id;

revoke all on public.task_assignment_details
  from public, anon, authenticated;
grant select on public.task_assignment_details to authenticated;
grant select on public.task_assignment_details to service_role;

-- A completion code is useful only while the match is active. Cancellation,
-- withdrawal, or confirmation removes it in the same settlement transaction.
create or replace function private_authorization.clear_task_completion_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.task_completion_codes
  where assignment_id = new.id;

  return new;
end;
$$;

comment on function private_authorization.clear_task_completion_code() is
  'Deletes the one-time helper code whenever an accepted assignment settles.';

revoke all on function private_authorization.clear_task_completion_code()
  from public, anon, authenticated, service_role;

drop trigger if exists clear_task_completion_code_on_settlement
  on public.task_assignments;
create trigger clear_task_completion_code_on_settlement
  after update of status on public.task_assignments
  for each row
  when (old.status = 'accepted' and new.status <> 'accepted')
  execute function private_authorization.clear_task_completion_code();
