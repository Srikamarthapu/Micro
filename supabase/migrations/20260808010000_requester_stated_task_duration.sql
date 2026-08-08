-- Duration belongs to the requester, not to the catalog.
--
-- A reviewed listing had its duration pinned to the approved catalog variant,
-- so two neighbors posting the same task had to claim it takes the same time.
-- That is the one field the person who owns the job knows better than the
-- reviewer: the same leaf cleanup is twenty minutes on one lot and two hours on
-- the next, and forcing the reviewed figure made the listing lie.
--
-- Scope, title, category, completion, eligibility and allowed modes stay pinned
-- to the approved variant. Only duration moves, and only within the same 15-240
-- minute band the catalog itself is held to, so a fifteen-minute errand still
-- cannot be published as a four-hour job.

-- The durable invariant, minus duration. Everything else a variant approves is
-- still matched exactly, so an approved variant ID cannot be attached to
-- different scope, category, mode, or eligibility.
create or replace function private.enforce_task_catalog_review_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  approved private.task_catalog_variants%rowtype;
  claimed_duration_minutes integer;
begin
  -- Duration is requester-set now, so it is bounded here rather than matched.
  -- The trigger is the last gate before storage: a privileged write that
  -- bypassed the RPC must still not be able to store an unbounded duration.
  claimed_duration_minutes := nullif(substring(new.duration from '^([0-9]+) min$'), '')::integer;

  if claimed_duration_minutes is null
    or claimed_duration_minutes not between 15 and 240
  then
    raise check_violation using message = 'task_duration_out_of_range';
  end if;

  if new.custom_pending then
    if new.catalog_variant_id is not null or new.youth_eligible then
      raise check_violation using
        message = 'pending_task_cannot_claim_reviewed_state';
    end if;

    return new;
  end if;

  select variant.*
  into approved
  from private.task_catalog_variants as variant
  where variant.template_id = new.template_id
    and variant.variant_id = new.catalog_variant_id;

  if not found then
    raise check_violation using
      message = 'reviewed_task_variant_not_approved';
  end if;

  if new.title is distinct from approved.title
    or new.description is distinct from approved.description
    or new.included is distinct from approved.included
    or new.excluded is distinct from approved.excluded
    or new.completion is distinct from approved.completion
    or new.category_id is distinct from approved.category_id
    or new.category is distinct from approved.category
    or new.youth_eligible is distinct from approved.youth_eligible
    or not (new.mode = any(approved.allowed_modes))
  then
    raise check_violation using
      message = 'reviewed_task_does_not_match_catalog_variant';
  end if;

  if (new.mode = 'community' and new.earning is not null)
    or (
      new.mode in ('paid', 'sponsored')
      and (new.earning is null or new.earning not between 15 and 500)
    )
  then
    raise check_violation using message = 'reviewed_task_earning_invalid';
  end if;

  return new;
end;
$$;

comment on function private.enforce_task_catalog_review_state() is
  'Durable catalog invariant: an approved variant ID cannot be attached to different scope, category, mode, or eligibility. Duration is requester-set and only bounded.';

-- Adding a parameter means a new signature, so the old one is dropped rather
-- than left behind as an overload the client could still resolve to.
drop function if exists public.publish_task(
  uuid, text, jsonb, text, integer, timestamptz, text, text, text, text, integer, text
);

create or replace function public.publish_task(
  p_client_nonce uuid,
  p_template_id text,
  p_selections jsonb,
  p_mode text,
  p_earning integer,
  p_starts_at timestamptz,
  p_private_address text,
  p_custom_title text,
  p_custom_description text,
  p_custom_category_id text,
  p_custom_minutes integer,
  p_custom_completion_id text,
  p_duration_minutes integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_can_post boolean := false;
  caller_can_sponsor boolean := false;
  caller_area_id text;
  selected_area private.task_service_areas%rowtype;
  selected_variant private.task_catalog_variants%rowtype;
  selected_category private.task_catalog_categories%rowtype;
  selected_completion private.task_custom_completions%rowtype;
  normalized_address text := btrim(p_private_address);
  normalized_custom_title text := btrim(p_custom_title);
  normalized_custom_description text := btrim(p_custom_description);
  chosen_title text;
  chosen_description text;
  chosen_included text;
  chosen_excluded text;
  chosen_completion text;
  chosen_category_id text;
  chosen_category text;
  chosen_template_id text;
  chosen_variant_id text;
  chosen_duration_minutes integer;
  chosen_earning integer;
  chosen_youth_eligible boolean;
  chosen_custom_pending boolean;
  chosen_time_label text;
  local_start timestamp;
  new_task_id uuid := gen_random_uuid();
  lat_hash bigint;
  lng_hash bigint;
  public_lat double precision;
  public_lng double precision;
  existing_task_id uuid;
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

  select
    coalesce(capability.can_post_tasks, false),
    coalesce(capability.can_sponsor_tasks, false)
  into caller_can_post, caller_can_sponsor
  from public.current_user_capabilities() as capability;

  if not caller_can_post then
    raise insufficient_privilege using message = 'task_publishing_not_allowed';
  end if;

  if p_client_nonce is null then
    raise check_violation using message = 'publish_nonce_required';
  end if;

  -- A retry is scoped to the authenticated owner. Reusing another account's
  -- UUID can neither discover nor return that account's task; it is simply a
  -- distinct owner/nonce pair. Returning before payload validation preserves
  -- the original committed request when a client retries after losing its
  -- response or failing the authoritative refresh.
  select task.id
  into existing_task_id
  from public.tasks as task
  where task.owner_id = caller_id
    and task.publish_nonce = p_client_nonce;

  if found then
    return existing_task_id;
  end if;

  if p_mode is null
    or p_mode not in ('paid', 'community', 'sponsored')
  then
    raise check_violation using message = 'task_mode_invalid';
  end if;

  if p_mode = 'sponsored' and not caller_can_sponsor then
    raise insufficient_privilege using message = 'task_sponsorship_not_allowed';
  end if;

  if (p_mode = 'community' and p_earning is not null)
    or (
      p_mode in ('paid', 'sponsored')
      and (p_earning is null or p_earning not between 15 and 500)
    )
  then
    raise check_violation using message = 'task_earning_invalid';
  end if;

  if normalized_address is null
    or char_length(normalized_address) not between 3 and 300
    or normalized_address ~ '[[:cntrl:]]'
  then
    raise check_violation using message = 'private_address_invalid';
  end if;

  select coalesce(profile.service_area, 'all')
  into caller_area_id
  from public.profiles as profile
  where profile.id = caller_id;

  select area.*
  into selected_area
  from private.task_service_areas as area
  where area.area_id = caller_area_id;

  if not found then
    raise check_violation using message = 'profile_service_area_invalid';
  end if;

  if p_starts_at is null then
    chosen_time_label := 'Flexible';
  else
    if p_starts_at < clock_timestamp() + interval '60 minutes'
      or p_starts_at > clock_timestamp() + interval '8 days'
    then
      raise check_violation using message = 'task_start_out_of_range';
    end if;

    local_start := p_starts_at at time zone selected_area.time_zone;
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

  if p_template_id is not null then
    if jsonb_typeof(p_selections) is distinct from 'object' then
      raise check_violation using message = 'catalog_selections_invalid';
    end if;

    if p_custom_title is not null
      or p_custom_description is not null
      or p_custom_category_id is not null
      or p_custom_minutes is not null
      or p_custom_completion_id is not null
    then
      raise check_violation using message = 'catalog_request_contains_custom_fields';
    end if;

    select variant.*
    into selected_variant
    from private.task_catalog_variants as variant
    where variant.template_id = p_template_id
      and variant.selections = p_selections;

    if not found then
      raise check_violation using message = 'catalog_variant_not_approved';
    end if;

    if not (p_mode = any(selected_variant.allowed_modes)) then
      raise check_violation using message = 'task_mode_not_allowed_for_template';
    end if;

    chosen_title := selected_variant.title;
    chosen_description := selected_variant.description;
    chosen_included := selected_variant.included;
    chosen_excluded := selected_variant.excluded;
    chosen_completion := selected_variant.completion;
    chosen_category_id := selected_variant.category_id;
    chosen_category := selected_variant.category;
    chosen_template_id := selected_variant.template_id;
    chosen_variant_id := selected_variant.variant_id;
    chosen_duration_minutes := selected_variant.duration_minutes;
    chosen_earning := p_earning;
    chosen_youth_eligible := selected_variant.youth_eligible;
    chosen_custom_pending := false;
  else
    if p_selections is distinct from '{}'::jsonb then
      raise check_violation using message = 'custom_task_selections_must_be_empty';
    end if;

    if normalized_custom_title is null
      or char_length(normalized_custom_title) not between 8 and 120
      or normalized_custom_title ~ '[[:cntrl:]]'
    then
      raise check_violation using message = 'custom_task_title_invalid';
    end if;

    if normalized_custom_description is null
      or char_length(normalized_custom_description) not between 25 and 2000
      or normalized_custom_description ~ '[[:cntrl:]]'
    then
      raise check_violation using message = 'custom_task_description_invalid';
    end if;

    if (normalized_custom_title || ' ' || normalized_custom_description) ~*
      '(^|[^[:alnum:]_])(electrical|wiring|gas[[:space:]]+line|gas[[:space:]]+fitting|roof|roofing|ladder|scaffold|chimney|weapon|gun|firearm|ammo|medication|prescription|medical[[:space:]]+care|nursing|injection|childcare|babysit|babysitting|nanny|demolition|asbestos|mould[[:space:]]+remediation|mold[[:space:]]+remediation|pest[[:space:]]+control|tow|towing)([^[:alnum:]_]|$)'
    then
      raise check_violation using message = 'custom_task_contains_prohibited_work';
    end if;

    select category.*
    into selected_category
    from private.task_catalog_categories as category
    where category.category_id = p_custom_category_id;

    if not found then
      raise check_violation using message = 'custom_task_category_invalid';
    end if;

    if p_custom_minutes is null
      or p_custom_minutes not in (30, 45, 60, 90, 120, 180)
    then
      raise check_violation using message = 'custom_task_duration_invalid';
    end if;

    select completion.*
    into selected_completion
    from private.task_custom_completions as completion
    where completion.completion_id = p_custom_completion_id;

    if not found then
      raise check_violation using message = 'custom_task_completion_invalid';
    end if;

    chosen_title := normalized_custom_title;
    chosen_description := normalized_custom_description;
    chosen_included := 'What is described above, and nothing beyond it.';
    chosen_excluded := selected_category.base_excluded;
    chosen_completion := selected_completion.completion;
    chosen_category_id := selected_category.category_id;
    chosen_category := selected_category.category;
    chosen_template_id := null;
    chosen_variant_id := null;
    chosen_duration_minutes := p_custom_minutes;
    chosen_earning := p_earning;
    chosen_youth_eligible := false;
    chosen_custom_pending := true;
  end if;

  -- How long the job takes is the requester's to state. The catalog still
  -- fixes scope, category, eligibility and allowed modes; duration is the one
  -- field the person who owns the task knows better than the reviewer, so it
  -- is accepted here and only bounded, never matched against the variant.
  if p_duration_minutes is not null then
    if p_duration_minutes not between 15 and 240 then
      raise check_violation using message = 'task_duration_out_of_range';
    end if;

    chosen_duration_minutes := p_duration_minutes;
  end if;


  -- Derive a stable, area-bounded public marker from the new task ID. The
  -- browser never sends coordinates, so the public map cannot accidentally
  -- publish the exact private address or device location.
  lat_hash := hashtextextended(new_task_id::text, 101);
  lng_hash := hashtextextended(new_task_id::text, 211);
  public_lat := selected_area.center_lat + (
    (
      mod(mod(lat_hash, 1000000) + 1000000, 1000000)::double precision
      / 999999
    ) - 0.5
  ) * selected_area.lat_span * 0.7;
  public_lng := selected_area.center_lng + (
    (
      mod(mod(lng_hash, 1000000) + 1000000, 1000000)::double precision
      / 999999
    ) - 0.5
  ) * selected_area.lng_span * 0.7;

  -- Lock the caller's Auth row across both inserts. Account deletion takes a
  -- conflicting key lock, so a publish cannot become ownerless between the
  -- live-session check and the task foreign key.
  perform 1
  from auth.users as publishing_user
  where publishing_user.id = caller_id
  for key share;

  if not found then
    raise insufficient_privilege using
      message = 'live_authenticated_session_required';
  end if;

  begin
    insert into public.tasks (
      id,
      owner_id,
      publish_nonce,
      template_id,
      catalog_variant_id,
      custom_pending,
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
      youth_eligible,
      listing_paused
    )
    values (
      new_task_id,
      caller_id,
      p_client_nonce,
      chosen_template_id,
      chosen_variant_id,
      chosen_custom_pending,
      chosen_title,
      chosen_description,
      chosen_included,
      chosen_excluded,
      chosen_completion,
      chosen_category,
      chosen_category_id,
      p_mode,
      chosen_earning,
      public_lat,
      public_lng,
      selected_area.area_id,
      selected_area.area,
      chosen_time_label,
      p_starts_at,
      chosen_duration_minutes || ' min',
      chosen_youth_eligible,
      false
    );
  exception
    when unique_violation then
      get stacked diagnostics violated_constraint = constraint_name;

      if violated_constraint <> 'tasks_owner_publish_nonce_key' then
        raise;
      end if;

      select task.id
      into existing_task_id
      from public.tasks as task
      where task.owner_id = caller_id
        and task.publish_nonce = p_client_nonce;

      if not found then
        raise;
      end if;

      return existing_task_id;
  end;

  insert into public.task_private_details (task_id, private_address)
  values (new_task_id, normalized_address);

  return new_task_id;
end;
$$;

comment on function public.publish_task(
  uuid, text, jsonb, text, integer, timestamptz, text, text, text, text, integer, text, integer
) is
  'Atomically publishes one server-composed catalog variant or a bounded review-pending custom request for the live authenticated caller, at a requester-stated duration.';

revoke all on function public.publish_task(
  uuid, text, jsonb, text, integer, timestamptz, text, text, text, text, integer, text, integer
) from public, anon, authenticated, service_role;
grant execute on function public.publish_task(
  uuid, text, jsonb, text, integer, timestamptz, text, text, text, text, integer, text, integer
) to authenticated;
