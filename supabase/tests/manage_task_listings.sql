begin;

-- Fixed identities keep failures readable. The transaction rolls every
-- fixture back, including Auth rows and private addresses.
do $$
declare
  fixture_owner_id constant uuid := 'a6000000-0000-4000-8000-000000000001';
  fixture_intruder_id constant uuid := 'a6000000-0000-4000-8000-000000000002';
  fixture_helper_id constant uuid := 'a6000000-0000-4000-8000-000000000003';
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (
      fixture_owner_id,
      'listing-owner@micro.test',
      jsonb_build_object(
        'display_name', 'Listing Owner',
        'service_area', 'downtown',
        'account_type', 'regular',
        'standards_accepted', true
      )
    ),
    (
      fixture_intruder_id,
      'listing-intruder@micro.test',
      jsonb_build_object(
        'display_name', 'Other Neighbor',
        'service_area', 'temescal',
        'account_type', 'regular',
        'standards_accepted', true
      )
    ),
    (
      fixture_helper_id,
      'listing-helper@micro.test',
      jsonb_build_object(
        'display_name', 'Matched Helper',
        'service_area', 'alameda',
        'account_type', 'regular',
        'standards_accepted', true
      )
    );

  insert into auth.sessions (id, user_id)
  values
    ('a6100000-0000-4000-8000-000000000001', fixture_owner_id),
    ('a6100000-0000-4000-8000-000000000002', fixture_intruder_id),
    ('a6100000-0000-4000-8000-000000000003', fixture_helper_id);

  -- Three reviewed listings use exact catalog rows. The fourth remains a
  -- bounded custom-review task so management can prove it never changes that
  -- provenance or its pending state.
  insert into public.tasks (
    id,
    owner_id,
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
  select
    fixture.id,
    fixture_owner_id,
    variant.template_id,
    variant.variant_id,
    false,
    variant.title,
    variant.description,
    variant.included,
    variant.excluded,
    variant.completion,
    variant.category,
    variant.category_id,
    fixture.mode,
    fixture.earning,
    37.8044,
    -122.2712,
    'downtown',
    'Downtown & Lake Merritt',
    'Flexible',
    null,
    variant.duration_minutes || ' min',
    variant.youth_eligible,
    false
  from private.task_catalog_variants as variant
  join (
    values
      (
        'a6200000-0000-4000-8000-000000000001'::uuid,
        'yard-leaves'::text,
        'yardSize=medium|bagCount=some|tools=provided|greenBin=yes'::text,
        'paid'::text,
        35::integer
      ),
      (
        'a6200000-0000-4000-8000-000000000002'::uuid,
        'yard-water'::text,
        'default'::text,
        'community'::text,
        null::integer
      ),
      (
        'a6200000-0000-4000-8000-000000000004'::uuid,
        'yard-leaves'::text,
        'yardSize=small|bagCount=few|tools=provided|greenBin=yes'::text,
        'paid'::text,
        25::integer
      )
  ) as fixture(id, template_id, variant_id, mode, earning)
    on variant.template_id = fixture.template_id
   and variant.variant_id = fixture.variant_id;

  insert into public.tasks (
    id,
    owner_id,
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
    'a6200000-0000-4000-8000-000000000003',
    fixture_owner_id,
    null,
    null,
    true,
    'Organize the entry closet',
    'Sort the shoes and coats into the labeled bins already provided.',
    'What is described above, and nothing beyond it.',
    'No electrical, gas, plumbing, or structural work, and no ladder use above shoulder height.',
    'You send a photo of the finished work in the thread.',
    'Home help',
    'home',
    'paid',
    31,
    37.8044,
    -122.2712,
    'downtown',
    'Downtown & Lake Merritt',
    'Flexible',
    null,
    '45 min',
    false,
    false
  );

  insert into public.task_private_details (task_id, private_address)
  values
    ('a6200000-0000-4000-8000-000000000001', '100 Original Paid Street'),
    ('a6200000-0000-4000-8000-000000000002', '200 Original Community Street'),
    ('a6200000-0000-4000-8000-000000000003', '300 Original Custom Street'),
    ('a6200000-0000-4000-8000-000000000004', '400 Matched Task Street');

  insert into public.task_assignments (
    id,
    task_id,
    requester_id,
    helper_id,
    task_title,
    status
  )
  select
    'a6300000-0000-4000-8000-000000000001',
    task.id,
    fixture_owner_id,
    fixture_helper_id,
    task.title,
    'accepted'
  from public.tasks as task
  where task.id = 'a6200000-0000-4000-8000-000000000004';
end;
$$;

do $$
declare
  unsafe_function_count integer;
begin
  select count(*)
  into unsafe_function_count
  from pg_proc as procedure
  join pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname in (
      'update_task_listing',
      'set_task_listing_paused',
      'delete_task_listing'
    )
    and (
      not procedure.prosecdef
      or not ('search_path=""' = any(coalesce(procedure.proconfig, '{}')))
    );

  if unsafe_function_count <> 0 then
    raise exception
      'manage listing test failed: % RPCs lack SECURITY DEFINER or a fixed empty search_path',
      unsafe_function_count;
  end if;

  if not has_function_privilege(
      'authenticated',
      'public.update_task_listing(uuid,timestamptz,integer,text)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'authenticated',
      'public.set_task_listing_paused(uuid,boolean)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'authenticated',
      'public.delete_task_listing(uuid)',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.update_task_listing(uuid,timestamptz,integer,text)',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.delete_task_listing(uuid)',
      'EXECUTE'
    )
  then
    raise exception 'manage listing test failed: RPC execution grants are unsafe or incomplete';
  end if;

  if has_column_privilege('authenticated', 'public.tasks', 'starts_at', 'UPDATE')
    or has_column_privilege('authenticated', 'public.tasks', 'time_label', 'UPDATE')
    or has_column_privilege('authenticated', 'public.tasks', 'earning', 'UPDATE')
    or has_column_privilege(
      'authenticated',
      'public.task_private_details',
      'private_address',
      'UPDATE'
    )
  then
    raise exception 'manage listing test failed: RPC migration widened direct table writes';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  'a6000000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'a6000000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'session_id', 'a6100000-0000-4000-8000-000000000001',
    'is_anonymous', false
  )::text,
  true
);

set local role authenticated;

do $$
declare
  paid_task_id constant uuid := 'a6200000-0000-4000-8000-000000000001';
  community_task_id constant uuid := 'a6200000-0000-4000-8000-000000000002';
  custom_task_id constant uuid := 'a6200000-0000-4000-8000-000000000003';
  matched_task_id constant uuid := 'a6200000-0000-4000-8000-000000000004';
  scheduled_start timestamptz := (
    (
      date_trunc('day', clock_timestamp() at time zone 'America/Los_Angeles')
      + interval '2 days 10 hours'
    ) at time zone 'America/Los_Angeles'
  );
  bad_slot timestamptz := (
    (
      date_trunc('day', clock_timestamp() at time zone 'America/Los_Angeles')
      + interval '2 days 10 hours 15 minutes'
    ) at time zone 'America/Los_Angeles'
  );
  original_title text;
  original_template_id text;
  original_variant_id text;
  original_custom_title text;
begin
  select title, template_id, catalog_variant_id
  into original_title, original_template_id, original_variant_id
  from public.tasks
  where id = paid_task_id;

  if public.update_task_listing(
    paid_task_id,
    scheduled_start,
    44,
    '  101 Updated Paid Street  '
  ) <> paid_task_id then
    raise exception 'manage listing test failed: update returned the wrong task ID';
  end if;

  if not exists (
    select 1
    from public.tasks as task
    join public.task_private_details as details on details.task_id = task.id
    where task.id = paid_task_id
      and task.starts_at = scheduled_start
      and task.time_label = to_char(
        scheduled_start at time zone 'America/Los_Angeles',
        'FMDay, Mon FMDD · FMHH12:MI AM'
      )
      and task.earning = 44
      and details.private_address = '101 Updated Paid Street'
      and task.title = original_title
      and task.template_id = original_template_id
      and task.catalog_variant_id = original_variant_id
      and not task.custom_pending
  ) then
    raise exception 'manage listing test failed: logistics update was incomplete or changed reviewed provenance';
  end if;

  select title into original_custom_title
  from public.tasks
  where id = custom_task_id;

  perform public.update_task_listing(
    custom_task_id,
    null,
    33,
    '303 Updated Custom Street'
  );

  if not exists (
    select 1
    from public.tasks as task
    join public.task_private_details as details on details.task_id = task.id
    where task.id = custom_task_id
      and task.custom_pending
      and task.template_id is null
      and task.catalog_variant_id is null
      and task.title = original_custom_title
      and task.time_label = 'Flexible'
      and task.starts_at is null
      and task.earning = 33
      and details.private_address = '303 Updated Custom Street'
  ) then
    raise exception 'manage listing test failed: custom-review provenance changed';
  end if;

  begin
    perform public.update_task_listing(paid_task_id, scheduled_start, 14, 'Valid Address');
    raise exception 'manage listing test failed: below-floor earning was accepted';
  exception
    when check_violation then
      if sqlerrm <> 'task_earning_invalid' then
        raise exception 'manage listing test failed: unstable earning error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.update_task_listing(community_task_id, null, 15, 'Valid Address');
    raise exception 'manage listing test failed: Community Help gained an earning';
  exception
    when check_violation then
      if sqlerrm <> 'task_earning_invalid' then
        raise exception 'manage listing test failed: unstable Community Help earning error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.update_task_listing(paid_task_id, scheduled_start, 44, ' ');
    raise exception 'manage listing test failed: blank private address was accepted';
  exception
    when check_violation then
      if sqlerrm <> 'private_address_invalid' then
        raise exception 'manage listing test failed: unstable address error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.update_task_listing(paid_task_id, bad_slot, 44, 'Valid Address');
    raise exception 'manage listing test failed: off-rail schedule was accepted';
  exception
    when check_violation then
      if sqlerrm <> 'task_start_not_an_allowed_slot' then
        raise exception 'manage listing test failed: unstable slot error: %', sqlerrm;
      end if;
  end;

  perform public.set_task_listing_paused(custom_task_id, true);
  if not (select listing_paused from public.tasks where id = custom_task_id) then
    raise exception 'manage listing test failed: owner could not pause unmatched task';
  end if;

  perform public.set_task_listing_paused(custom_task_id, false);
  if (select listing_paused from public.tasks where id = custom_task_id) then
    raise exception 'manage listing test failed: owner could not resume unmatched task';
  end if;

  begin
    perform public.update_task_listing(matched_task_id, null, 25, 'Changed Match Address');
    raise exception 'manage listing test failed: matched logistics changed';
  exception
    when check_violation then
      if sqlerrm <> 'task_has_active_assignment' then
        raise exception 'manage listing test failed: unstable matched-update error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.set_task_listing_paused(matched_task_id, true);
    raise exception 'manage listing test failed: matched listing paused';
  exception
    when check_violation then
      if sqlerrm <> 'task_has_active_assignment' then
        raise exception 'manage listing test failed: unstable matched-pause error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.delete_task_listing(matched_task_id);
    raise exception 'manage listing test failed: matched listing deleted';
  exception
    when check_violation then
      if sqlerrm <> 'task_has_active_assignment' then
        raise exception 'manage listing test failed: unstable matched-delete error: %', sqlerrm;
      end if;
  end;

  if public.delete_task_listing(community_task_id) <> community_task_id then
    raise exception 'manage listing test failed: delete returned the wrong task ID';
  end if;
end;
$$;

reset role;

-- A different live account can know a public listing UUID but cannot mutate it.
select set_config(
  'request.jwt.claim.sub',
  'a6000000-0000-4000-8000-000000000002',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'a6000000-0000-4000-8000-000000000002',
    'role', 'authenticated',
    'session_id', 'a6100000-0000-4000-8000-000000000002',
    'is_anonymous', false
  )::text,
  true
);

set local role authenticated;

do $$
begin
  begin
    perform public.update_task_listing(
      'a6200000-0000-4000-8000-000000000001',
      null,
      44,
      'Unauthorized Address'
    );
    raise exception 'manage listing test failed: another user updated the listing';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'task_listing_management_not_allowed' then
        raise exception 'manage listing test failed: unstable owner error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.set_task_listing_paused(
      'a6200000-0000-4000-8000-000000000001',
      true
    );
    raise exception 'manage listing test failed: another user paused the listing';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.delete_task_listing(
      'a6200000-0000-4000-8000-000000000001'
    );
    raise exception 'manage listing test failed: another user deleted the listing';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

-- A still-signed JWT immediately loses every management RPC when its backing
-- Auth session is revoked.
delete from auth.sessions
where id = 'a6100000-0000-4000-8000-000000000001';

select set_config(
  'request.jwt.claim.sub',
  'a6000000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'a6000000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'session_id', 'a6100000-0000-4000-8000-000000000001',
    'is_anonymous', false
  )::text,
  true
);

set local role authenticated;

do $$
begin
  begin
    perform public.set_task_listing_paused(
      'a6200000-0000-4000-8000-000000000003',
      true
    );
    raise exception 'manage listing test failed: revoked session managed a listing';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'live_authenticated_session_required' then
        raise exception 'manage listing test failed: unstable revoked-session error: %', sqlerrm;
      end if;
  end;
end;
$$;

reset role;

do $$
begin
  if exists (
    select 1 from public.tasks
    where id = 'a6200000-0000-4000-8000-000000000002'
  ) then
    raise exception 'manage listing test failed: unmatched task survived delete';
  end if;

  if exists (
    select 1 from public.task_private_details
    where task_id = 'a6200000-0000-4000-8000-000000000002'
  ) then
    raise exception 'manage listing test failed: private address survived task cascade';
  end if;

  if not exists (
    select 1 from public.tasks
    where id = 'a6200000-0000-4000-8000-000000000004'
  ) then
    raise exception 'manage listing test failed: active matched task was removed';
  end if;
end;
$$;

rollback;
