-- Owner-only listing management for the live Manage Listing screen.
--
-- Reviewed scope and provenance remain immutable. These RPCs expose only the
-- logistics that may safely change before a match, plus pause and delete. Each
-- mutation takes the task row lock used by accept_task, so an acceptance and a
-- management action cannot both cross the unmatched boundary concurrently.

create or replace function public.update_task_listing(
  p_task_id uuid,
  p_starts_at timestamptz,
  p_earning integer,
  p_private_address text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  request_time timestamptz := clock_timestamp();
  normalized_address text := btrim(p_private_address);
  subject_owner_id uuid;
  subject_mode text;
  subject_area_id text;
  subject_time_zone text;
  local_start timestamp;
  chosen_time_label text;
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

  if normalized_address is null
    or char_length(normalized_address) not between 3 and 300
    or normalized_address ~ '[[:cntrl:]]'
  then
    raise check_violation using message = 'private_address_invalid';
  end if;

  -- Keep the Auth row alive until the task transaction commits. This follows
  -- the same lock order as accept_task: Auth identity, task, private details.
  perform locked_user.id
  from auth.users as locked_user
  where locked_user.id = caller_id
  for key share;

  if not found then
    raise insufficient_privilege using
      message = 'live_authenticated_session_required';
  end if;

  select task.owner_id, task.mode, task.area_id
  into subject_owner_id, subject_mode, subject_area_id
  from public.tasks as task
  where task.id = p_task_id
  for update;

  if not found then
    raise no_data_found using message = 'task_not_found';
  end if;

  if subject_owner_id <> caller_id then
    raise insufficient_privilege using
      message = 'task_listing_management_not_allowed';
  end if;

  if exists (
    select 1
    from public.task_assignments as assignment
    where assignment.task_id = p_task_id
      and assignment.status = 'accepted'
  ) then
    raise check_violation using message = 'task_has_active_assignment';
  end if;

  if (subject_mode = 'community' and p_earning is not null)
    or (
      subject_mode in ('paid', 'sponsored')
      and (p_earning is null or p_earning not between 15 and 500)
    )
    or subject_mode not in ('paid', 'community', 'sponsored')
  then
    raise check_violation using message = 'task_earning_invalid';
  end if;

  select area.time_zone
  into subject_time_zone
  from private.task_service_areas as area
  where area.area_id = subject_area_id;

  if not found then
    raise check_violation using message = 'task_area_invalid';
  end if;

  if p_starts_at is null then
    chosen_time_label := 'Flexible';
  else
    if p_starts_at < request_time + interval '60 minutes'
      or p_starts_at > request_time + interval '8 days'
    then
      raise check_violation using message = 'task_start_out_of_range';
    end if;

    local_start := p_starts_at at time zone subject_time_zone;
    if extract(second from local_start) <> 0
      or extract(minute from local_start) not in (0, 30)
      or local_start::time < time '07:00'
      or local_start::time > time '19:00'
    then
      raise check_violation using message = 'task_start_not_an_allowed_slot';
    end if;

    chosen_time_label := to_char(
      local_start,
      'FMDay, Mon FMDD · FMHH12:MI AM'
    );
  end if;

  perform details.task_id
  from public.task_private_details as details
  where details.task_id = p_task_id
  for update;

  if not found then
    raise check_violation using message = 'task_private_address_required';
  end if;

  update public.task_private_details
  set private_address = normalized_address
  where task_id = p_task_id;

  -- Updating only these columns preserves template_id, catalog_variant_id,
  -- custom_pending, reviewed wording, category, duration, and eligibility.
  update public.tasks
  set
    starts_at = p_starts_at,
    time_label = chosen_time_label,
    earning = p_earning
  where id = p_task_id;

  return p_task_id;
end;
$$;

comment on function public.update_task_listing(uuid, timestamptz, integer, text) is
  'Atomically updates an unmatched owner listing schedule, mode-consistent earning, and protected address while preserving catalog or custom-review provenance.';

create or replace function public.set_task_listing_paused(
  p_task_id uuid,
  p_paused boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  subject_owner_id uuid;
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

  if p_paused is null then
    raise check_violation using message = 'listing_paused_state_required';
  end if;

  perform locked_user.id
  from auth.users as locked_user
  where locked_user.id = caller_id
  for key share;

  if not found then
    raise insufficient_privilege using
      message = 'live_authenticated_session_required';
  end if;

  select task.owner_id
  into subject_owner_id
  from public.tasks as task
  where task.id = p_task_id
  for update;

  if not found then
    raise no_data_found using message = 'task_not_found';
  end if;

  if subject_owner_id <> caller_id then
    raise insufficient_privilege using
      message = 'task_listing_management_not_allowed';
  end if;

  if exists (
    select 1
    from public.task_assignments as assignment
    where assignment.task_id = p_task_id
      and assignment.status = 'accepted'
  ) then
    raise check_violation using message = 'task_has_active_assignment';
  end if;

  update public.tasks
  set listing_paused = p_paused
  where id = p_task_id;

  return p_task_id;
end;
$$;

comment on function public.set_task_listing_paused(uuid, boolean) is
  'Sets an unmatched owner listing paused state under the same live-session and row-lock boundary as acceptance.';

create or replace function public.delete_task_listing(p_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  subject_owner_id uuid;
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

  perform locked_user.id
  from auth.users as locked_user
  where locked_user.id = caller_id
  for key share;

  if not found then
    raise insufficient_privilege using
      message = 'live_authenticated_session_required';
  end if;

  select task.owner_id
  into subject_owner_id
  from public.tasks as task
  where task.id = p_task_id
  for update;

  if not found then
    raise no_data_found using message = 'task_not_found';
  end if;

  if subject_owner_id <> caller_id then
    raise insufficient_privilege using
      message = 'task_listing_management_not_allowed';
  end if;

  if exists (
    select 1
    from public.task_assignments as assignment
    where assignment.task_id = p_task_id
      and assignment.status = 'accepted'
  ) then
    raise check_violation using message = 'task_has_active_assignment';
  end if;

  -- task_private_details cascades in this statement. Settled assignment and
  -- transcript history keep their snapshots and are detached by their FKs.
  delete from public.tasks
  where id = p_task_id;

  return p_task_id;
end;
$$;

comment on function public.delete_task_listing(uuid) is
  'Atomically deletes an unmatched owner listing; its protected address is removed by the task_private_details cascade.';

-- Functions bypass table RLS by design, so execution is the API boundary.
-- Keep direct table grants exactly as narrow as the prior migrations made them;
-- these RPCs add no table privilege to browser roles.
revoke all on function public.update_task_listing(uuid, timestamptz, integer, text)
  from public, anon, authenticated, service_role;
revoke all on function public.set_task_listing_paused(uuid, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_task_listing(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.update_task_listing(uuid, timestamptz, integer, text)
  to authenticated;
grant execute on function public.set_task_listing_paused(uuid, boolean)
  to authenticated;
grant execute on function public.delete_task_listing(uuid)
  to authenticated;
