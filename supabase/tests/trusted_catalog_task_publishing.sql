begin;

-- This test deliberately exercises publish_task as the browser role. Setup
-- uses the migration owner only to create Auth fixtures; every task write below
-- is either the public RPC or an explicitly rejected direct-table attempt.
do $$
declare
  publisher_id constant uuid := '90000000-0000-4000-8000-000000000001';
  second_publisher_id constant uuid := '90000000-0000-4000-8000-000000000002';
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (
      publisher_id,
      'trusted-publisher@micro.test',
      jsonb_build_object(
        'display_name', 'Catalog Publisher',
        'service_area', 'downtown',
        'account_type', 'regular',
        'standards_accepted', true
      )
    ),
    (
      second_publisher_id,
      'second-publisher@micro.test',
      jsonb_build_object(
        'display_name', 'Second Publisher',
        'service_area', 'temescal',
        'account_type', 'regular',
        'standards_accepted', true
      )
    );

  insert into auth.sessions (id, user_id)
  values
    ('91000000-0000-4000-8000-000000000001', publisher_id),
    ('91000000-0000-4000-8000-000000000002', second_publisher_id);
end;
$$;

do $$
begin
  if (select count(*) from private.task_catalog_categories) <> 12 then
    raise exception 'trusted publishing test failed: expected 12 catalog categories';
  end if;

  if (select count(distinct template_id) from private.task_catalog_variants) <> 200 then
    raise exception 'trusted publishing test failed: expected 200 catalog templates';
  end if;

  if (select count(*) from private.task_catalog_variants) <> 858 then
    raise exception 'trusted publishing test failed: expected 858 finite catalog variants';
  end if;

  -- The database invariant also protects against a buggy privileged backend,
  -- not only against the browser grants tested below.
  begin
    insert into public.tasks (
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
      '90000000-0000-4000-8000-000000000001',
      variant.template_id,
      variant.variant_id,
      false,
      variant.title || ' forged',
      variant.description,
      variant.included,
      variant.excluded,
      variant.completion,
      variant.category,
      variant.category_id,
      'paid',
      28,
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
    where variant.template_id = 'yard-leaves'
      and variant.variant_id = 'yardSize=medium|bagCount=some|tools=provided|greenBin=yes';

    raise exception 'trusted publishing test failed: privileged write forged approved copy';
  exception
    when check_violation then
      if sqlerrm <> 'reviewed_task_does_not_match_catalog_variant' then
        raise exception 'trusted publishing test failed: unstable catalog-invariant error: %', sqlerrm;
      end if;
  end;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '90000000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'session_id', '91000000-0000-4000-8000-000000000001',
    'is_anonymous', false
  )::text,
  true
);

set local role authenticated;

do $$
declare
  catalog_task_id uuid;
  retry_task_id uuid;
  custom_task_id uuid;
  scheduled_task_id uuid;
  row_count_before bigint;
  changed_rows integer;
  scheduled_start timestamptz := (
    (current_date + 1 + time '10:00') at time zone 'America/Los_Angeles'
  );
begin
  catalog_task_id := public.publish_task(
    p_client_nonce => '92000000-0000-4000-8000-000000000001',
    p_template_id => 'yard-leaves',
    p_selections => '{
      "yardSize": "medium",
      "bagCount": "some",
      "tools": "provided",
      "greenBin": "yes"
    }'::jsonb,
    p_mode => 'paid',
    p_earning => 35,
    p_starts_at => null,
    p_private_address => '  100 Private Catalog Street  ',
    p_custom_title => null,
    p_custom_description => null,
    p_custom_category_id => null,
    p_custom_minutes => null,
    p_custom_completion_id => null,
    p_duration_minutes => 75
  );

  if not exists (
    select 1
    from public.tasks as task
    where task.id = catalog_task_id
      and task.owner_id = '90000000-0000-4000-8000-000000000001'
      and task.template_id = 'yard-leaves'
      and task.catalog_variant_id = 'yardSize=medium|bagCount=some|tools=provided|greenBin=yes'
      and not task.custom_pending
      and task.title = 'Front yard leaf cleanup'
      and task.description = 'Rake and bag the fallen leaves across the front yard. It is a medium yard. Expect about 3–5 bags of debris. Hand tools are provided. The green bin is available on site.'
      and task.included = 'Raking the front yard and bagging what comes up. Use of the provided hand tools. Loading debris into the green bin.'
      and task.excluded = 'No ladder work, roof access, tree climbing, chemical spraying, or work above shoulder height.'
      and task.completion = 'The front yard is clear and the bags are where we agreed.'
      and task.category_id = 'yard'
      and task.category = 'Yard & garden'
      and task.mode = 'paid'
      and task.earning = 35
      and task.duration = '75 min'
      and task.youth_eligible
      and task.area_id = 'downtown'
      and task.area = 'Downtown & Lake Merritt'
      and task.time_label = 'Flexible'
      and task.starts_at is null
      and not task.listing_paused
      and task.lat between 37.8044 - (0.072463768115942 * 0.35)
                       and 37.8044 + (0.072463768115942 * 0.35)
      and task.lng between -122.2712 - (0.091713757385562 * 0.35)
                       and -122.2712 + (0.091713757385562 * 0.35)
  ) then
    raise exception 'trusted publishing test failed: approved catalog row was not fully server-composed';
  end if;

  if not exists (
    select 1
    from public.task_private_details as details
    where details.task_id = catalog_task_id
      and details.private_address = '100 Private Catalog Street'
  ) then
    raise exception 'trusted publishing test failed: private address was not atomically stored and trimmed';
  end if;

  retry_task_id := public.publish_task(
    p_client_nonce => '92000000-0000-4000-8000-000000000001',
    p_template_id => 'yard-leaves',
    p_selections => '{
      "yardSize": "medium",
      "bagCount": "some",
      "tools": "provided",
      "greenBin": "yes"
    }'::jsonb,
    p_mode => 'paid',
    p_earning => 35,
    p_starts_at => null,
    p_private_address => '100 Private Catalog Street',
    p_custom_title => null,
    p_custom_description => null,
    p_custom_category_id => null,
    p_custom_minutes => null,
    p_custom_completion_id => null,
    p_duration_minutes => 75
  );

  if retry_task_id <> catalog_task_id
    or (
      select count(*)
      from public.tasks
      where owner_id = '90000000-0000-4000-8000-000000000001'
        and publish_nonce = '92000000-0000-4000-8000-000000000001'
    ) <> 1
    or (
      select count(*)
      from public.task_private_details
      where task_id = catalog_task_id
    ) <> 1
  then
    raise exception 'trusted publishing test failed: same-owner retry created a duplicate task';
  end if;

  -- The owner can still use the deliberately narrow listing-paused control.
  update public.tasks
  set listing_paused = true
  where id = catalog_task_id;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'trusted publishing test failed: owner could not pause the RPC-created task';
  end if;

  -- But browser SQL has no authority to create a row or rewrite reviewed copy.
  begin
    insert into public.tasks (owner_id)
    values ('90000000-0000-4000-8000-000000000001');
    raise exception 'trusted publishing test failed: direct task insert was allowed';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.tasks
    set title = 'Browser-forged reviewed title'
    where id = catalog_task_id;
    raise exception 'trusted publishing test failed: reviewed scope was directly mutable';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.task_private_details (task_id, private_address)
    values (gen_random_uuid(), 'Direct address insert');
    raise exception 'trusted publishing test failed: direct private-address insert was allowed';
  exception
    when insufficient_privilege then null;
  end;

  -- A custom request is accepted only through its bounded branch. The title
  -- and description remain visibly pending; every other field is derived.
  custom_task_id := public.publish_task(
    p_client_nonce => '92000000-0000-4000-8000-000000000002',
    p_template_id => null,
    p_selections => '{}'::jsonb,
    p_mode => 'paid',
    p_earning => 31,
    p_starts_at => null,
    p_private_address => '200 Pending Review Avenue',
    p_custom_title => 'Organize the entry closet',
    p_custom_description => 'Sort the shoes and coats into the labeled bins already provided.',
    p_custom_category_id => 'home',
    p_custom_minutes => 45,
    p_custom_completion_id => 'photo',
    p_duration_minutes => null
  );

  if not exists (
    select 1
    from public.tasks as task
    where task.id = custom_task_id
      and task.owner_id = '90000000-0000-4000-8000-000000000001'
      and task.template_id is null
      and task.catalog_variant_id is null
      and task.custom_pending
      and task.title = 'Organize the entry closet'
      and task.description = 'Sort the shoes and coats into the labeled bins already provided.'
      and task.included = 'What is described above, and nothing beyond it.'
      and task.excluded = 'No electrical, gas, plumbing, or structural work, and no ladder use above shoulder height.'
      and task.completion = 'You send a photo of the finished work in the thread.'
      and task.category_id = 'home'
      and task.category = 'Home help'
      and task.mode = 'paid'
      and task.earning = 31
      and task.duration = '45 min'
      and not task.youth_eligible
  ) then
    raise exception 'trusted publishing test failed: custom task escaped bounded pending composition';
  end if;

  -- A structured schedule is bounded to the launch area's timezone and the
  -- same half-hour rail used by the client. Its public label is database-made.
  scheduled_task_id := public.publish_task(
    p_client_nonce => '92000000-0000-4000-8000-000000000003',
    p_template_id => 'yard-water',
    p_selections => '{}'::jsonb,
    p_mode => 'community',
    p_earning => null,
    p_starts_at => scheduled_start,
    p_private_address => '300 Scheduled Garden Lane',
    p_custom_title => null,
    p_custom_description => null,
    p_custom_category_id => null,
    p_custom_minutes => null,
    p_custom_completion_id => null,
    p_duration_minutes => null
  );

  if not exists (
    select 1
    from public.tasks as task
    where task.id = scheduled_task_id
      and task.starts_at = scheduled_start
      and task.time_label = to_char(
        scheduled_start at time zone 'America/Los_Angeles',
        'FMDay, Mon FMDD · FMHH12:MI AM'
      )
      and task.mode = 'community'
      and task.earning is null
  ) then
    raise exception 'trusted publishing test failed: structured schedule was not server-validated';
  end if;

  -- Rejected calls are subtransactions: neither the public row nor its private
  -- counterpart may survive any validation failure.
  select count(*) into row_count_before from public.tasks;

  begin
    perform public.publish_task(
      p_client_nonce => '92000000-0000-4000-8000-000000000010',
      p_template_id => 'yard-leaves',
      p_selections => '{"yardSize":"medium"}'::jsonb,
      p_mode => 'paid',
      p_earning => 25,
      p_starts_at => null,
      p_private_address => '400 Forgery Way',
      p_custom_title => null,
      p_custom_description => null,
      p_custom_category_id => null,
      p_custom_minutes => null,
      p_custom_completion_id => null,
      p_duration_minutes => null
    );
    raise exception 'trusted publishing test failed: incomplete catalog selection was accepted';
  exception
    when check_violation then
      if sqlerrm <> 'catalog_variant_not_approved' then
        raise exception 'trusted publishing test failed: unstable variant error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.publish_task(
      p_client_nonce => '92000000-0000-4000-8000-000000000011',
      p_template_id => 'yard-garden-share',
      p_selections => '{}'::jsonb,
      p_mode => 'paid',
      p_earning => 25,
      p_starts_at => null,
      p_private_address => '500 Wrong Mode Road',
      p_custom_title => null,
      p_custom_description => null,
      p_custom_category_id => null,
      p_custom_minutes => null,
      p_custom_completion_id => null,
      p_duration_minutes => null
    );
    raise exception 'trusted publishing test failed: disallowed catalog mode was accepted';
  exception
    when check_violation then
      if sqlerrm <> 'task_mode_not_allowed_for_template' then
        raise exception 'trusted publishing test failed: unstable mode error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.publish_task(
      p_client_nonce => '92000000-0000-4000-8000-000000000012',
      p_template_id => 'yard-water',
      p_selections => '{}'::jsonb,
      p_mode => 'sponsored',
      p_earning => 25,
      p_starts_at => null,
      p_private_address => '600 Sponsor Bypass Boulevard',
      p_custom_title => null,
      p_custom_description => null,
      p_custom_category_id => null,
      p_custom_minutes => null,
      p_custom_completion_id => null,
      p_duration_minutes => null
    );
    raise exception 'trusted publishing test failed: regular account created sponsored task';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'task_sponsorship_not_allowed' then
        raise exception 'trusted publishing test failed: unstable sponsor error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.publish_task(
      p_client_nonce => '92000000-0000-4000-8000-000000000013',
      p_template_id => 'yard-water',
      p_selections => '{}'::jsonb,
      p_mode => 'community',
      p_earning => 15,
      p_starts_at => null,
      p_private_address => '610 Volunteer Pay Bypass',
      p_custom_title => null,
      p_custom_description => null,
      p_custom_category_id => null,
      p_custom_minutes => null,
      p_custom_completion_id => null,
      p_duration_minutes => null
    );
    raise exception 'trusted publishing test failed: volunteer task carried pay';
  exception
    when check_violation then
      if sqlerrm <> 'task_earning_invalid' then
        raise exception 'trusted publishing test failed: unstable volunteer-pay error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.publish_task(
      p_client_nonce => '92000000-0000-4000-8000-000000000014',
      p_template_id => 'yard-water',
      p_selections => '{}'::jsonb,
      p_mode => 'paid',
      p_earning => 501,
      p_starts_at => null,
      p_private_address => '620 Excess Pay Bypass',
      p_custom_title => null,
      p_custom_description => null,
      p_custom_category_id => null,
      p_custom_minutes => null,
      p_custom_completion_id => null,
      p_duration_minutes => null
    );
    raise exception 'trusted publishing test failed: out-of-range pay was accepted';
  exception
    when check_violation then
      if sqlerrm <> 'task_earning_invalid' then
        raise exception 'trusted publishing test failed: unstable pay-range error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.publish_task(
      p_client_nonce => '92000000-0000-4000-8000-000000000018',
      p_template_id => 'yard-water',
      p_selections => '{}'::jsonb,
      p_mode => 'community',
      p_earning => null,
      p_starts_at => null,
      p_private_address => '625 Excess Duration Bypass',
      p_custom_title => null,
      p_custom_description => null,
      p_custom_category_id => null,
      p_custom_minutes => null,
      p_custom_completion_id => null,
      p_duration_minutes => 241
    );
    raise exception 'trusted publishing test failed: out-of-range duration was accepted';
  exception
    when check_violation then
      if sqlerrm <> 'task_duration_out_of_range' then
        raise exception 'trusted publishing test failed: unstable duration-range error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.publish_task(
      p_client_nonce => '92000000-0000-4000-8000-000000000015',
      p_template_id => null,
      p_selections => '{}'::jsonb,
      p_mode => 'community',
      p_earning => null,
      p_starts_at => null,
      p_private_address => '700 Unsafe Custom Court',
      p_custom_title => 'Repair electrical wiring',
      p_custom_description => 'Replace the electrical wiring behind the kitchen wall this afternoon.',
      p_custom_category_id => 'home',
      p_custom_minutes => 60,
      p_custom_completion_id => 'confirm',
      p_duration_minutes => null
    );
    raise exception 'trusted publishing test failed: prohibited custom work was accepted';
  exception
    when check_violation then
      if sqlerrm <> 'custom_task_contains_prohibited_work' then
        raise exception 'trusted publishing test failed: unstable custom safety error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.publish_task(
      p_client_nonce => '92000000-0000-4000-8000-000000000016',
      p_template_id => 'yard-water',
      p_selections => '{}'::jsonb,
      p_mode => 'community',
      p_earning => null,
      p_starts_at => clock_timestamp() - interval '1 hour',
      p_private_address => '800 Past Start Place',
      p_custom_title => null,
      p_custom_description => null,
      p_custom_category_id => null,
      p_custom_minutes => null,
      p_custom_completion_id => null,
      p_duration_minutes => null
    );
    raise exception 'trusted publishing test failed: past start was accepted';
  exception
    when check_violation then
      if sqlerrm <> 'task_start_out_of_range' then
        raise exception 'trusted publishing test failed: unstable schedule error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.publish_task(
      p_client_nonce => '92000000-0000-4000-8000-000000000017',
      p_template_id => 'yard-water',
      p_selections => '{}'::jsonb,
      p_mode => 'community',
      p_earning => null,
      p_starts_at => null,
      p_private_address => ' ',
      p_custom_title => null,
      p_custom_description => null,
      p_custom_category_id => null,
      p_custom_minutes => null,
      p_custom_completion_id => null,
      p_duration_minutes => null
    );
    raise exception 'trusted publishing test failed: empty private address was accepted';
  exception
    when check_violation then
      if sqlerrm <> 'private_address_invalid' then
        raise exception 'trusted publishing test failed: unstable address error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.publish_task(
      p_client_nonce => null,
      p_template_id => 'yard-water',
      p_selections => '{}'::jsonb,
      p_mode => 'community',
      p_earning => null,
      p_starts_at => null,
      p_private_address => '810 Missing Nonce Place',
      p_custom_title => null,
      p_custom_description => null,
      p_custom_category_id => null,
      p_custom_minutes => null,
      p_custom_completion_id => null,
      p_duration_minutes => null
    );
    raise exception 'trusted publishing test failed: null publish nonce was accepted';
  exception
    when check_violation then
      if sqlerrm <> 'publish_nonce_required' then
        raise exception 'trusted publishing test failed: unstable nonce error: %', sqlerrm;
      end if;
  end;

  if (select count(*) from public.tasks) <> row_count_before
    or (select count(*) from public.task_private_details) <> row_count_before
  then
    raise exception 'trusted publishing test failed: rejected publish left a partial row';
  end if;
end;
$$;

reset role;

-- The nonce is an idempotency key, not a bearer capability. A second account
-- using the same random UUID must create its own task and must never receive
-- the first owner's task ID.
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-4000-8000-000000000002',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '90000000-0000-4000-8000-000000000002',
    'role', 'authenticated',
    'session_id', '91000000-0000-4000-8000-000000000002',
    'is_anonymous', false
  )::text,
  true
);

set local role authenticated;

do $$
declare
  second_owner_task_id uuid;
begin
  second_owner_task_id := public.publish_task(
    p_client_nonce => '92000000-0000-4000-8000-000000000001',
    p_template_id => 'yard-water',
    p_selections => '{}'::jsonb,
    p_mode => 'community',
    p_earning => null,
    p_starts_at => null,
    p_private_address => '100 Second Owner Street',
    p_custom_title => null,
    p_custom_description => null,
    p_custom_category_id => null,
    p_custom_minutes => null,
    p_custom_completion_id => null,
    p_duration_minutes => null
  );

  if not exists (
      select 1
      from public.tasks as task
      where task.id = second_owner_task_id
        and task.owner_id = '90000000-0000-4000-8000-000000000002'
        and task.publish_nonce = '92000000-0000-4000-8000-000000000001'
        and task.area_id = 'temescal'
    )
  then
    raise exception 'trusted publishing test failed: nonce crossed owner boundary';
  end if;
end;
$$;

reset role;

-- A still-signed JWT loses the RPC as soon as its backing Auth session is gone.
delete from auth.sessions
where id = '91000000-0000-4000-8000-000000000001';

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '90000000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'session_id', '91000000-0000-4000-8000-000000000001',
    'is_anonymous', false
  )::text,
  true
);

set local role authenticated;

do $$
begin
  begin
    perform public.publish_task(
      p_client_nonce => '92000000-0000-4000-8000-000000000099',
      p_template_id => 'yard-water',
      p_selections => '{}'::jsonb,
      p_mode => 'community',
      p_earning => null,
      p_starts_at => null,
      p_private_address => '900 Revoked Session Street',
      p_custom_title => null,
      p_custom_description => null,
      p_custom_category_id => null,
      p_custom_minutes => null,
      p_custom_completion_id => null,
      p_duration_minutes => null
    );
    raise exception 'trusted publishing test failed: revoked session published a task';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'live_authenticated_session_required' then
        raise exception 'trusted publishing test failed: unstable session error: %', sqlerrm;
      end if;
  end;
end;
$$;

reset role;
rollback;
