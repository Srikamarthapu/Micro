begin;

-- Four live identities plus six trusted fixtures exercise the smallest real
-- two-person interaction. The fixture inserts run as the migration owner so
-- they model reviewed catalog output, not the fail-closed browser path.
do $$
declare
  owner_id constant uuid := '80000000-0000-4000-8000-000000000001';
  helper_id constant uuid := '80000000-0000-4000-8000-000000000002';
  intruder_id constant uuid := '80000000-0000-4000-8000-000000000003';
  second_helper_id constant uuid := '80000000-0000-4000-8000-000000000004';
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (owner_id, 'interaction-owner@micro.test', '{"display_name":"Task Owner","service_area":"downtown"}'),
    (helper_id, 'interaction-helper@micro.test', '{"display_name":"Accepted Helper","service_area":"temescal"}'),
    (intruder_id, 'interaction-intruder@micro.test', '{"display_name":"Unrelated Neighbor","service_area":"alameda"}'),
    (second_helper_id, 'interaction-helper-two@micro.test', '{"display_name":"Second Helper","service_area":"fruitvale"}');

  insert into auth.sessions (id, user_id)
  values
    ('81000000-0000-4000-8000-000000000001', owner_id),
    ('81000000-0000-4000-8000-000000000002', helper_id),
    ('81000000-0000-4000-8000-000000000003', intruder_id),
    ('81000000-0000-4000-8000-000000000004', second_helper_id);

  if to_regclass('private.task_catalog_variants') is not null then
    -- The later trusted-publisher migration installs a durable provenance
    -- trigger. Use exact catalog rows here so this interaction suite remains
    -- valid both before and after that boundary is installed.
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
      listing_paused,
      created_at
    )
    select
      fixture.id,
      owner_id,
      fixture.template_id,
      fixture.variant_id,
      fixture.custom_pending,
      coalesce(variant.title, fixture.custom_title),
      coalesce(variant.description, fixture.custom_description),
      coalesce(variant.included, 'One bounded errand'),
      coalesce(variant.excluded, 'No prohibited work'),
      coalesce(variant.completion, 'Requester confirmation'),
      coalesce(variant.category, 'Errands & pickup'),
      coalesce(variant.category_id, 'errands'),
      'community',
      null,
      fixture.lat,
      fixture.lng,
      'downtown',
      'Downtown & Lake Merritt',
      fixture.time_label,
      fixture.starts_at,
      coalesce(variant.duration_minutes || ' min', '60 min'),
      coalesce(variant.youth_eligible, false),
      fixture.listing_paused,
      fixture.created_at
    from (
      values
        (
          '82000000-0000-4000-8000-000000000001'::uuid,
          'err-library'::text,
          'distanceBand=close'::text,
          false,
          null::text,
          null::text,
          'Tomorrow at 10:00 AM'::text,
          now() + interval '1 day',
          now(),
          false,
          37.8044::double precision,
          -122.2712::double precision
        ),
        (
          '82000000-0000-4000-8000-000000000002'::uuid,
          'yard-water'::text,
          'default'::text,
          false,
          null::text,
          null::text,
          'Flexible'::text,
          null::timestamptz,
          now(),
          false,
          37.8046::double precision,
          -122.2714::double precision
        ),
        (
          '82000000-0000-4000-8000-000000000003'::uuid,
          null::text,
          null::text,
          true,
          'Custom pending errand'::text,
          'A custom request that must remain unavailable until human review.'::text,
          'Tomorrow at 1:00 PM'::text,
          now() + interval '1 day 3 hours',
          now(),
          false,
          37.8048::double precision,
          -122.2716::double precision
        ),
        (
          '82000000-0000-4000-8000-000000000004'::uuid,
          'yard-water'::text,
          'default'::text,
          false,
          null::text,
          null::text,
          'Earlier today'::text,
          now() - interval '1 hour',
          now() - interval '2 days',
          false,
          37.8050::double precision,
          -122.2718::double precision
        ),
        (
          '82000000-0000-4000-8000-000000000005'::uuid,
          'yard-water'::text,
          'default'::text,
          false,
          null::text,
          null::text,
          'Tomorrow at 2:00 PM'::text,
          now() + interval '1 day 4 hours',
          now(),
          true,
          37.8052::double precision,
          -122.2720::double precision
        ),
        (
          '82000000-0000-4000-8000-000000000006'::uuid,
          'yard-water'::text,
          'default'::text,
          false,
          null::text,
          null::text,
          'Tomorrow at 3:00 PM'::text,
          now() + interval '1 day 5 hours',
          now(),
          false,
          37.8054::double precision,
          -122.2722::double precision
        )
    ) as fixture (
      id,
      template_id,
      variant_id,
      custom_pending,
      custom_title,
      custom_description,
      time_label,
      starts_at,
      created_at,
      listing_paused,
      lat,
      lng
    )
    left join private.task_catalog_variants as variant
      on variant.template_id = fixture.template_id
      and variant.variant_id = fixture.variant_id;
  else
  insert into public.tasks (
    id,
    owner_id,
    template_id,
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
  values
    (
      '82000000-0000-4000-8000-000000000001', owner_id,
      'interaction-future-one', false,
      'Deliver library books',
      'Return a bounded bag of library books at the neighborhood branch.',
      'One labeled tote', 'No purchases', 'Return receipt photo',
      'Errands', 'errands', 'community', null,
      37.8044, -122.2712, 'downtown', 'Downtown & Lake Merritt',
      'Tomorrow at 10:00 AM', now() + interval '1 day', '45 minutes', false, false
    ),
    (
      '82000000-0000-4000-8000-000000000002', owner_id,
      'interaction-future-two', false,
      'Water porch plants',
      'Water the labeled pots on the front porch using the supplied can.',
      'Front porch pots', 'No indoor access', 'Photo of watered pots',
      'Garden & Outdoor', 'garden-outdoor', 'community', null,
      37.8046, -122.2714, 'downtown', 'Downtown & Lake Merritt',
      'Flexible', null, '30 minutes', false, false
    ),
    (
      '82000000-0000-4000-8000-000000000003', owner_id,
      null, true,
      'Custom pending errand',
      'A custom request that must remain unavailable until human review.',
      'One bounded errand', 'No prohibited work', 'Requester confirmation',
      'Errands', 'errands', 'community', null,
      37.8048, -122.2716, 'downtown', 'Downtown & Lake Merritt',
      'Tomorrow at 1:00 PM', now() + interval '1 day 3 hours', '1 hour', false, false
    ),
    (
      '82000000-0000-4000-8000-000000000004', owner_id,
      'interaction-past', false,
      'Past scheduled task',
      'A reviewed task whose structured start time has already elapsed.',
      'One bounded task', 'No unsafe work', 'Requester confirmation',
      'Errands', 'errands', 'community', null,
      37.8050, -122.2718, 'downtown', 'Downtown & Lake Merritt',
      'Earlier today', now() - interval '1 hour', '30 minutes', false, false
    ),
    (
      '82000000-0000-4000-8000-000000000005', owner_id,
      'interaction-paused', false,
      'Paused reviewed task',
      'A reviewed task that its requester has intentionally paused.',
      'One bounded task', 'No unsafe work', 'Requester confirmation',
      'Errands', 'errands', 'community', null,
      37.8052, -122.2720, 'downtown', 'Downtown & Lake Merritt',
      'Tomorrow at 2:00 PM', now() + interval '1 day 4 hours', '30 minutes', false, true
    ),
    (
      '82000000-0000-4000-8000-000000000006', owner_id,
      'interaction-no-address', false,
      'Task without an address',
      'A reviewed task whose private match address has not been saved.',
      'One bounded task', 'No unsafe work', 'Requester confirmation',
      'Errands', 'errands', 'community', null,
      37.8054, -122.2722, 'downtown', 'Downtown & Lake Merritt',
      'Tomorrow at 3:00 PM', now() + interval '1 day 5 hours', '30 minutes', false, false
    );
  end if;

  perform set_config(
    'test.task_one_title',
    (select title from public.tasks where id = '82000000-0000-4000-8000-000000000001'),
    true
  );
  perform set_config(
    'test.task_two_title',
    (select title from public.tasks where id = '82000000-0000-4000-8000-000000000002'),
    true
  );

  insert into public.task_private_details (task_id, private_address)
  values
    (
      '82000000-0000-4000-8000-000000000001',
      '100 Private Match Street, Oakland, CA'
    ),
    (
      '82000000-0000-4000-8000-000000000002',
      '200 Flexible Match Street, Oakland, CA'
    ),
    (
      '82000000-0000-4000-8000-000000000003',
      '300 Pending Match Street, Oakland, CA'
    ),
    (
      '82000000-0000-4000-8000-000000000004',
      '400 Past Match Street, Oakland, CA'
    ),
    (
      '82000000-0000-4000-8000-000000000005',
      '500 Paused Match Street, Oakland, CA'
    );
end;
$$;

-- The first helper accepts through the only assignment write path. A retry is
-- idempotent, the assignment ID is the thread ID, and sender identity is
-- derived rather than accepted from the browser.
select set_config(
  'request.jwt.claim.sub',
  '80000000-0000-4000-8000-000000000002',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '80000000-0000-4000-8000-000000000002',
    'role', 'authenticated',
    'session_id', '81000000-0000-4000-8000-000000000002',
    'is_anonymous', false
  )::text,
  true
);

set local role authenticated;

do $$
declare
  accepted public.task_assignments;
  retried public.task_assignments;
begin
  if not exists (
    select 1 from public.task_listings
    where id = '82000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'task interaction test failed: available listing was not discoverable';
  end if;

  if exists (
    select 1 from public.tasks
    where id = '82000000-0000-4000-8000-000000000003'
  ) or exists (
    select 1 from public.task_listings
    where id = '82000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'task interaction test failed: unrelated helper discovered pending custom task';
  end if;

  accepted := public.accept_task('82000000-0000-4000-8000-000000000001');
  perform set_config('test.assignment_one', accepted.id::text, true);

  if accepted.task_id <> '82000000-0000-4000-8000-000000000001'
    or accepted.requester_id <> '80000000-0000-4000-8000-000000000001'
    or accepted.helper_id <> '80000000-0000-4000-8000-000000000002'
    or accepted.task_title <> current_setting('test.task_one_title')
    or accepted.status <> 'accepted'
    or accepted.settled_at is not null
  then
    raise exception 'task interaction test failed: accept_task returned the wrong assignment';
  end if;

  retried := public.accept_task('82000000-0000-4000-8000-000000000001');
  if retried.id <> accepted.id or retried.created_at <> accepted.created_at then
    raise exception 'task interaction test failed: acceptance retry created a new assignment';
  end if;

  if (
    select count(*) from public.task_assignments
    where task_id = accepted.task_id and status = 'accepted'
  ) <> 1 then
    raise exception 'task interaction test failed: acceptance retry duplicated the assignment';
  end if;

  if exists (
    select 1 from public.task_listings
    where id = accepted.task_id
  ) then
    raise exception 'task interaction test failed: accepted listing remained in discovery';
  end if;

  if not exists (
    select 1 from public.tasks
    where id = accepted.task_id
  ) then
    raise exception 'task interaction test failed: active helper could not fetch the accepted task';
  end if;

  if not exists (
    select 1 from public.task_assignment_details
    where id = accepted.id
      and requester_name = 'Task Owner'
      and helper_name = 'Accepted Helper'
  ) or not exists (
    select 1 from public.task_conversation_participants
    where assignment_id = accepted.id
      and requester_name = 'Task Owner'
      and helper_name = 'Accepted Helper'
  ) then
    raise exception 'task interaction test failed: participant-safe name views were incomplete';
  end if;

  if not exists (
    select 1 from public.task_private_details
    where task_id = accepted.task_id
      and private_address = '100 Private Match Street, Oakland, CA'
  ) then
    raise exception 'task interaction test failed: accepted helper could not read the match address';
  end if;

  insert into public.task_messages (assignment_id, client_nonce, body)
  values (
    accepted.id,
    '83000000-0000-4000-8000-000000000001',
    'I can return these before noon.'
  );

  if not exists (
    select 1 from public.task_messages
    where assignment_id = accepted.id
      and sender_id = '80000000-0000-4000-8000-000000000002'
      and kind = 'human'
      and body = 'I can return these before noon.'
  ) then
    raise exception 'task interaction test failed: helper message did not derive sender and kind';
  end if;

  begin
    insert into public.task_messages (assignment_id, client_nonce, body)
    values (
      accepted.id,
      '83000000-0000-4000-8000-000000000001',
      'Duplicate network retry'
    );
    raise exception 'task interaction test failed: duplicate message nonce was accepted';
  exception
    when unique_violation then null;
  end;

  if (
    select count(*) from public.task_messages
    where sender_id = '80000000-0000-4000-8000-000000000002'
      and client_nonce = '83000000-0000-4000-8000-000000000001'
  ) <> 1 then
    raise exception 'task interaction test failed: message retry created a duplicate';
  end if;

  begin
    insert into public.task_messages (
      assignment_id, sender_id, client_nonce, body
    ) values (
      accepted.id,
      '80000000-0000-4000-8000-000000000001',
      '83000000-0000-4000-8000-000000000002',
      'Spoofed owner message'
    );
    raise exception 'task interaction test failed: client supplied sender_id';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.task_messages (
      assignment_id, client_nonce, body, kind
    ) values (
      accepted.id,
      '83000000-0000-4000-8000-000000000002',
      'Spoofed system message',
      'system'
    );
    raise exception 'task interaction test failed: client supplied system kind';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.accept_task('82000000-0000-4000-8000-000000000002');
    raise exception 'task interaction test failed: helper accepted a second active task';
  exception
    when unique_violation then
      if sqlerrm <> 'helper_already_has_active_task' then
        raise exception 'task interaction test failed: unstable helper-conflict message: %', sqlerrm;
      end if;
  end;

  begin
    perform public.accept_task('82000000-0000-4000-8000-000000000003');
    raise exception 'task interaction test failed: pending custom task was accepted';
  exception
    when check_violation then
      if sqlerrm <> 'custom_task_awaiting_review' then
        raise exception 'task interaction test failed: unstable custom-task message: %', sqlerrm;
      end if;
  end;

  begin
    perform public.accept_task('82000000-0000-4000-8000-000000000004');
    raise exception 'task interaction test failed: past task was accepted';
  exception
    when check_violation then
      if sqlerrm <> 'task_start_has_passed' then
        raise exception 'task interaction test failed: unstable past-task message: %', sqlerrm;
      end if;
  end;

  begin
    perform public.accept_task('82000000-0000-4000-8000-000000000005');
    raise exception 'task interaction test failed: paused task was accepted';
  exception
    when check_violation then
      if sqlerrm <> 'task_is_paused' then
        raise exception 'task interaction test failed: unstable paused-task message: %', sqlerrm;
      end if;
  end;

  begin
    perform public.accept_task('82000000-0000-4000-8000-000000000006');
    raise exception 'task interaction test failed: addressless task was accepted';
  exception
    when check_violation then
      if sqlerrm <> 'task_private_address_required' then
        raise exception 'task interaction test failed: unstable missing-address message: %', sqlerrm;
      end if;
  end;
end;
$$;

reset role;

-- A second helper loses the serialized accept and cannot bypass the RPC with
-- a direct assignment insert.
select set_config(
  'request.jwt.claim.sub',
  '80000000-0000-4000-8000-000000000004',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '80000000-0000-4000-8000-000000000004',
    'role', 'authenticated',
    'session_id', '81000000-0000-4000-8000-000000000004',
    'is_anonymous', false
  )::text,
  true
);

set local role authenticated;

do $$
begin
  begin
    perform public.accept_task('82000000-0000-4000-8000-000000000001');
    raise exception 'task interaction test failed: task was accepted twice';
  exception
    when unique_violation then
      if sqlerrm <> 'task_already_accepted' then
        raise exception 'task interaction test failed: unstable task-conflict message: %', sqlerrm;
      end if;
  end;

  begin
    insert into public.task_assignments (
      task_id, requester_id, helper_id, task_title
    ) values (
      '82000000-0000-4000-8000-000000000002',
      '80000000-0000-4000-8000-000000000001',
      '80000000-0000-4000-8000-000000000004',
      'Water porch plants'
    );
    raise exception 'task interaction test failed: client inserted assignment directly';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

-- The requester is the other participant. They can read and reply, but broad
-- scope/schedule/review/address changes are privilege errors and pausing or
-- deleting a matched listing is blocked by RLS.
select set_config(
  'request.jwt.claim.sub',
  '80000000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '80000000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'session_id', '81000000-0000-4000-8000-000000000001',
    'is_anonymous', false
  )::text,
  true
);

set local role authenticated;

do $$
declare
  assignment_one uuid := current_setting('test.assignment_one')::uuid;
  changed_rows integer;
begin
  if not exists (
    select 1 from public.task_message_details
    where assignment_id = assignment_one
      and sender_id = '80000000-0000-4000-8000-000000000002'
      and sender_name = 'Accepted Helper'
  ) then
    raise exception 'task interaction test failed: requester could not read helper message';
  end if;

  insert into public.task_messages (assignment_id, client_nonce, body)
  values (
    assignment_one,
    '83000000-0000-4000-8000-000000000003',
    'Thank you. The tote is beside the door.'
  );

  begin
    perform public.accept_task('82000000-0000-4000-8000-000000000002');
    raise exception 'task interaction test failed: owner accepted their own task';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'task_owner_cannot_accept' then
        raise exception 'task interaction test failed: unstable self-accept message: %', sqlerrm;
      end if;
  end;

  begin
    update public.tasks
    set title = 'Changed after acceptance'
    where id = '82000000-0000-4000-8000-000000000001';
    raise exception 'task interaction test failed: authenticated updated task title';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.tasks
    set starts_at = now() + interval '2 days'
    where id = '82000000-0000-4000-8000-000000000001';
    raise exception 'task interaction test failed: authenticated updated task schedule';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.tasks
    set custom_pending = true
    where id = '82000000-0000-4000-8000-000000000001';
    raise exception 'task interaction test failed: authenticated updated review state';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.task_private_details
    set private_address = 'Changed address'
    where task_id = '82000000-0000-4000-8000-000000000001';
    raise exception 'task interaction test failed: authenticated updated private address';
  exception
    when insufficient_privilege then null;
  end;

  update public.tasks
  set listing_paused = true
  where id = '82000000-0000-4000-8000-000000000001';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'task interaction test failed: requester paused an accepted task';
  end if;

  delete from public.tasks
  where id = '82000000-0000-4000-8000-000000000001';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'task interaction test failed: requester deleted an accepted task';
  end if;

  -- The interim direct browser path fails closed: omitted review/paused flags
  -- become pending/unpaused. Once publish_task is installed, the same branch
  -- instead verifies that all direct inserts have been removed.
  if has_column_privilege(
    'authenticated', 'public.tasks', 'title', 'INSERT'
  ) then
    insert into public.tasks (
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
    ) values (
      '80000000-0000-4000-8000-000000000001',
      'untrusted-browser-copy',
      'Browser-authored pending task',
      'This row proves that direct browser inserts cannot self-approve copy.',
      'One bounded task',
      'No unsafe work',
      'Requester confirmation',
      'Errands',
      'errands',
      'community',
      null,
      37.8044,
      -122.2712,
      'downtown',
      'Downtown & Lake Merritt',
      'Flexible',
      null,
      '30 minutes',
      false
    ) returning id into assignment_one;

    perform set_config('test.browser_task', assignment_one::text, true);

    if not exists (
      select 1 from public.tasks
      where id = assignment_one
        and custom_pending
        and not listing_paused
    ) or not exists (
      select 1 from public.task_listings
      where id = assignment_one
        and custom_pending
    ) then
      raise exception 'task interaction test failed: owner could not manage fail-closed browser task';
    end if;
  else
    perform set_config(
      'test.browser_task',
      '82000000-0000-4000-8000-000000000007',
      true
    );

    begin
      insert into public.tasks (owner_id)
      values ('80000000-0000-4000-8000-000000000001');
      raise exception 'task interaction test failed: publisher boundary allowed direct insert';
    exception
      when insufficient_privilege then null;
    end;
  end if;

  begin
    insert into public.tasks (
      owner_id, custom_pending, title, description, category, category_id,
      mode, lat, lng, area_id, area, time_label, duration
    ) values (
      '80000000-0000-4000-8000-000000000001', false,
      'Client-approved task',
      'A browser must not be able to approve its own listing copy.',
      'Errands', 'errands', 'community',
      37.8044, -122.2712, 'downtown', 'Downtown & Lake Merritt',
      'Flexible', '30 minutes'
    );
    raise exception 'task interaction test failed: browser inserted custom_pending=false';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

-- An unrelated live account sees no accepted task, assignment, participant
-- names, transcript, or address, and cannot append to the known assignment ID.
select set_config(
  'request.jwt.claim.sub',
  '80000000-0000-4000-8000-000000000003',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '80000000-0000-4000-8000-000000000003',
    'role', 'authenticated',
    'session_id', '81000000-0000-4000-8000-000000000003',
    'is_anonymous', false
  )::text,
  true
);

set local role authenticated;

do $$
declare
  assignment_one uuid := current_setting('test.assignment_one')::uuid;
begin
  if exists (
    select 1 from public.task_assignments where id = assignment_one
  ) or exists (
    select 1 from public.task_assignment_details where id = assignment_one
  ) or exists (
    select 1 from public.task_conversation_participants
    where assignment_id = assignment_one
  ) or exists (
    select 1 from public.task_messages where assignment_id = assignment_one
  ) or exists (
    select 1 from public.task_message_details where assignment_id = assignment_one
  ) or exists (
    select 1 from public.task_private_details
    where task_id = '82000000-0000-4000-8000-000000000001'
  ) or exists (
    select 1 from public.tasks
    where id = '82000000-0000-4000-8000-000000000001'
  ) or exists (
    select 1 from public.task_listings
    where id = '82000000-0000-4000-8000-000000000001'
  ) or exists (
    select 1 from public.tasks
    where id = current_setting('test.browser_task')::uuid
  ) or exists (
    select 1 from public.task_listings
    where id = current_setting('test.browser_task')::uuid
  ) then
    raise exception 'task interaction test failed: unrelated account read participant-only data';
  end if;

  begin
    insert into public.task_messages (assignment_id, client_nonce, body)
    values (
      assignment_one,
      '83000000-0000-4000-8000-000000000004',
      'Unauthorized message'
    );
    raise exception 'task interaction test failed: unrelated account sent a message';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

-- Revoking only the helper's backing session closes reads, sends, and accepts
-- immediately while the modeled JWT remains otherwise unchanged.
delete from auth.sessions
where id = '81000000-0000-4000-8000-000000000002';

select set_config(
  'request.jwt.claim.sub',
  '80000000-0000-4000-8000-000000000002',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '80000000-0000-4000-8000-000000000002',
    'role', 'authenticated',
    'session_id', '81000000-0000-4000-8000-000000000002',
    'is_anonymous', false
  )::text,
  true
);

set local role authenticated;

do $$
declare
  assignment_one uuid := current_setting('test.assignment_one')::uuid;
begin
  if exists (
    select 1 from public.task_assignments where id = assignment_one
  ) or exists (
    select 1 from public.task_messages where assignment_id = assignment_one
  ) then
    raise exception 'task interaction test failed: revoked session retained participant data';
  end if;

  begin
    insert into public.task_messages (assignment_id, client_nonce, body)
    values (
      assignment_one,
      '83000000-0000-4000-8000-000000000005',
      'Revoked session message'
    );
    raise exception 'task interaction test failed: revoked session sent a message';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.accept_task('82000000-0000-4000-8000-000000000002');
    raise exception 'task interaction test failed: revoked session accepted a task';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'live_authenticated_session_required' then
        raise exception 'task interaction test failed: unstable revoked-session message: %', sqlerrm;
      end if;
  end;
end;
$$;

reset role;

-- Active participants cannot delete themselves out from under the other
-- participant. Both stable blockers fire before any FK cascade.
do $$
begin
  begin
    delete from auth.users
    where id = '80000000-0000-4000-8000-000000000001';
    raise exception 'task interaction test failed: owner deleted an active commitment';
  exception
    when integrity_constraint_violation then
      if sqlerrm <> 'active_task_commitment_requires_settlement' then
        raise exception 'task interaction test failed: unstable owner-deletion message: %', sqlerrm;
      end if;
  end;

  begin
    delete from auth.users
    where id = '80000000-0000-4000-8000-000000000002';
    raise exception 'task interaction test failed: helper deleted an active commitment';
  exception
    when integrity_constraint_violation then
      if sqlerrm <> 'active_task_commitment_requires_settlement' then
        raise exception 'task interaction test failed: unstable helper-deletion message: %', sqlerrm;
      end if;
  end;
end;
$$;

-- Restore the helper session, withdraw the first assignment, and prove that
-- settled threads remain readable but append-closed. The task can be matched
-- again and the helper is free to accept one new active commitment.
insert into auth.sessions (id, user_id)
values (
  '81000000-0000-4000-8000-000000000002',
  '80000000-0000-4000-8000-000000000002'
);

set local role authenticated;

do $$
declare
  assignment_one uuid := current_setting('test.assignment_one')::uuid;
  withdrawn public.task_assignments;
  accepted_two public.task_assignments;
begin
  withdrawn := public.withdraw_task_assignment(assignment_one);

  if withdrawn.status <> 'withdrawn' or withdrawn.settled_at is null then
    raise exception 'task interaction test failed: helper withdrawal did not settle assignment';
  end if;

  if not exists (
    select 1 from public.task_assignments
    where id = assignment_one and status = 'withdrawn'
  ) or not exists (
    select 1 from public.task_messages
    where assignment_id = assignment_one
  ) then
    raise exception 'task interaction test failed: settled thread was not retained';
  end if;

  if exists (
    select 1 from public.task_private_details
    where task_id = '82000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'task interaction test failed: withdrawn helper retained exact address';
  end if;

  if not exists (
    select 1 from public.task_listings
    where id = '82000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'task interaction test failed: withdrawn task did not return to discovery';
  end if;

  begin
    insert into public.task_messages (assignment_id, client_nonce, body)
    values (
      assignment_one,
      '83000000-0000-4000-8000-000000000006',
      'Message after withdrawal'
    );
    raise exception 'task interaction test failed: withdrawn thread accepted a message';
  exception
    when insufficient_privilege then null;
  end;

  accepted_two := public.accept_task('82000000-0000-4000-8000-000000000002');
  perform set_config('test.assignment_two', accepted_two.id::text, true);

  if accepted_two.status <> 'accepted'
    or accepted_two.id = assignment_one
    or accepted_two.task_id <> '82000000-0000-4000-8000-000000000002'
  then
    raise exception 'task interaction test failed: helper could not take a new settled commitment';
  end if;

  begin
    perform public.complete_task_assignment(accepted_two.id);
    raise exception 'task interaction test failed: helper completed requester-only transition';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'assignment_completion_not_allowed' then
        raise exception 'task interaction test failed: unstable completion denial: %', sqlerrm;
      end if;
  end;
end;
$$;

reset role;

-- The requester completes the second match. Completion closes the thread and
-- pauses the listing, while the original withdrawn history stays intact.
select set_config(
  'request.jwt.claim.sub',
  '80000000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '80000000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'session_id', '81000000-0000-4000-8000-000000000001',
    'is_anonymous', false
  )::text,
  true
);

set local role authenticated;

do $$
declare
  assignment_one uuid := current_setting('test.assignment_one')::uuid;
  assignment_two uuid := current_setting('test.assignment_two')::uuid;
  completed public.task_assignments;
begin
  completed := public.complete_task_assignment(assignment_two);

  if completed.status <> 'completed' or completed.settled_at is null then
    raise exception 'task interaction test failed: requester completion did not settle assignment';
  end if;

  if not exists (
    select 1 from public.tasks
    where id = '82000000-0000-4000-8000-000000000002'
      and listing_paused
  ) or not exists (
    select 1 from public.task_listings
    where id = '82000000-0000-4000-8000-000000000002'
      and listing_paused
  ) then
    raise exception 'task interaction test failed: completed task was not retained as requester-paused';
  end if;

  if not exists (
    select 1 from public.task_assignments where id = assignment_one
  ) or not exists (
    select 1 from public.task_assignments where id = assignment_two
  ) then
    raise exception 'task interaction test failed: requester lost settled history';
  end if;

  begin
    insert into public.task_messages (assignment_id, client_nonce, body)
    values (
      assignment_two,
      '83000000-0000-4000-8000-000000000007',
      'Message after completion'
    );
    raise exception 'task interaction test failed: completed thread accepted a message';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

-- Policy, grant, view, uniqueness, and Realtime inventory. This catches a
-- future permissive shortcut even if the behavioral happy path still works.
do $$
declare
  bad_live_policy_count integer;
  realtime_table_count integer;
begin
  select count(*)
  into bad_live_policy_count
  from (
    values
      ('task_assignments', 'task_assignments_require_live_auth_session'),
      ('task_messages', 'task_messages_require_live_auth_session')
  ) as expected_policy (table_name, policy_name)
  left join pg_policies as installed_policy
    on installed_policy.schemaname = 'public'
    and installed_policy.tablename = expected_policy.table_name
    and installed_policy.policyname = expected_policy.policy_name
  where installed_policy.policyname is null
    or lower(coalesce(installed_policy.permissive, '')) <> 'restrictive'
    or lower(coalesce(installed_policy.cmd, '')) <> 'all'
    or not ('authenticated' = any(installed_policy.roles))
    or position(
      'current_auth_session_is_live'
      in coalesce(installed_policy.qual, '')
    ) = 0
    or position(
      'current_auth_session_is_live'
      in coalesce(installed_policy.with_check, '')
    ) = 0;

  if bad_live_policy_count <> 0 then
    raise exception
      'task interaction test failed: % live-session policies missing or weak',
      bad_live_policy_count;
  end if;

  if has_table_privilege('authenticated', 'public.task_assignments', 'INSERT')
    or has_table_privilege('authenticated', 'public.task_assignments', 'UPDATE')
    or has_table_privilege('authenticated', 'public.task_assignments', 'DELETE')
  then
    raise exception 'task interaction test failed: authenticated can mutate assignments directly';
  end if;

  if has_column_privilege('authenticated', 'public.task_messages', 'sender_id', 'INSERT')
    or has_column_privilege('authenticated', 'public.task_messages', 'kind', 'INSERT')
    or not has_column_privilege('authenticated', 'public.task_messages', 'assignment_id', 'INSERT')
    or not has_column_privilege('authenticated', 'public.task_messages', 'client_nonce', 'INSERT')
    or not has_column_privilege('authenticated', 'public.task_messages', 'body', 'INSERT')
  then
    raise exception 'task interaction test failed: message column grants are unsafe or incomplete';
  end if;

  if has_column_privilege('authenticated', 'public.tasks', 'title', 'UPDATE')
    or has_column_privilege('authenticated', 'public.tasks', 'custom_pending', 'UPDATE')
    or has_column_privilege('authenticated', 'public.tasks', 'starts_at', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.tasks', 'listing_paused', 'UPDATE')
  then
    raise exception 'task interaction test failed: task update grants are unsafe or incomplete';
  end if;

  if has_column_privilege('authenticated', 'public.tasks', 'custom_pending', 'INSERT')
    or has_column_privilege('authenticated', 'public.tasks', 'listing_paused', 'INSERT')
  then
    raise exception 'task interaction test failed: task insert grants do not fail closed';
  end if;

  if to_regclass('private.task_catalog_variants') is null then
    if not has_column_privilege('authenticated', 'public.tasks', 'title', 'INSERT')
      or not has_column_privilege('authenticated', 'public.tasks', 'starts_at', 'INSERT')
    then
      raise exception 'task interaction test failed: interim pending insert grant is incomplete';
    end if;
  elsif has_column_privilege('authenticated', 'public.tasks', 'title', 'INSERT')
    or has_column_privilege('authenticated', 'public.tasks', 'starts_at', 'INSERT')
  then
    raise exception 'task interaction test failed: trusted publisher left direct inserts open';
  end if;

  if has_column_privilege(
    'authenticated', 'public.task_private_details', 'private_address', 'UPDATE'
  ) then
    raise exception 'task interaction test failed: authenticated may update private address';
  end if;

  if not has_function_privilege(
    'authenticated', 'public.accept_task(uuid)', 'EXECUTE'
  ) or not has_function_privilege(
    'authenticated', 'public.withdraw_task_assignment(uuid)', 'EXECUTE'
  ) or not has_function_privilege(
    'authenticated', 'public.complete_task_assignment(uuid)', 'EXECUTE'
  ) or has_function_privilege(
    'anon', 'public.accept_task(uuid)', 'EXECUTE'
  ) then
    raise exception 'task interaction test failed: RPC execute grants are incorrect';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'task_assignments_one_active_helper_per_task_idx'
      and indexdef ilike 'create unique index%where (status = ''accepted''%'
  ) or not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'task_assignments_one_active_task_per_helper_idx'
      and indexdef ilike 'create unique index%where (status = ''accepted''%'
  ) then
    raise exception 'task interaction test failed: active assignment uniqueness is missing';
  end if;

  if not exists (
    select 1
    from pg_class
    where oid = 'public.task_assignment_details'::regclass
      and coalesce(reloptions, array[]::text[]) @> array['security_invoker=true']
  ) or not exists (
    select 1
    from pg_class
    where oid = 'public.task_message_details'::regclass
      and coalesce(reloptions, array[]::text[]) @> array['security_invoker=true']
  ) then
    raise exception 'task interaction test failed: participant views are not security invoker';
  end if;

  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    select count(*)
    into realtime_table_count
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename in ('tasks', 'task_assignments', 'task_messages');

    if realtime_table_count <> 3 then
      raise exception 'task interaction test failed: Realtime publication is incomplete';
    end if;
  end if;
end;
$$;

-- Once every commitment is settled, deletion succeeds without erasing the
-- immutable assignment/thread history. Foreign keys anonymize both people and
-- task rows while task_title and transcript content survive for retention.
delete from auth.users
where id = '80000000-0000-4000-8000-000000000002';

do $$
begin
  if exists (
    select 1 from auth.users
    where id = '80000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'task interaction test failed: settled helper deletion was blocked';
  end if;

  if (
    select count(*) from public.task_assignments
    where helper_id is null and status in ('withdrawn', 'completed')
  ) <> 2 then
    raise exception 'task interaction test failed: helper history was not anonymized';
  end if;

  if not exists (
    select 1 from public.task_messages
    where body = 'I can return these before noon.' and sender_id is null
  ) then
    raise exception 'task interaction test failed: helper message history was not anonymized';
  end if;
end;
$$;

delete from auth.users
where id = '80000000-0000-4000-8000-000000000001';

set local role service_role;

do $$
begin
  if (
    select count(*) from public.task_assignments
    where task_id is null
      and requester_id is null
      and helper_id is null
      and task_title in (
        current_setting('test.task_one_title'),
        current_setting('test.task_two_title')
      )
  ) <> 2 then
    raise exception 'task interaction test failed: settled assignment history did not survive deletion';
  end if;

  if (
    select count(*) from public.task_messages
    where assignment_id in (
      current_setting('test.assignment_one')::uuid,
      current_setting('test.assignment_two')::uuid
    )
  ) <> 2 then
    raise exception 'task interaction test failed: transcript did not survive account deletion';
  end if;
end;
$$;

reset role;

rollback;
