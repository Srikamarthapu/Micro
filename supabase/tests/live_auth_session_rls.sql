begin;

do $$
declare
  caller_id constant uuid := '50000000-0000-4000-8000-000000000001';
  neighbor_id constant uuid := '50000000-0000-4000-8000-000000000002';
  session_id constant uuid := '60000000-0000-4000-8000-000000000001';
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (
      caller_id,
      'live-session-caller@micro.test',
      '{"display_name":"Session Caller","service_area":"downtown"}'
    ),
    (
      neighbor_id,
      'live-session-neighbor@micro.test',
      '{"display_name":"Session Neighbor","service_area":"temescal"}'
    );

  insert into auth.sessions (id, user_id)
  values
    (session_id, caller_id),
    ('60000000-0000-4000-8000-000000000002', neighbor_id);

  insert into public.tasks (
    id,
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
    duration,
    youth_eligible,
    listing_paused
  )
  values
    (
      '70000000-0000-4000-8000-000000000001',
      caller_id,
      'session-owner-task',
      'Caller session task',
      'A caller-owned task used to verify live and revoked write access.',
      'One bounded task',
      'No unsafe work',
      'Photo confirmation',
      'Errands',
      'errands',
      'paid',
      25,
      37.8044,
      -122.2712,
      'downtown',
      'Downtown & Lake Merritt',
      'Tomorrow at 10:00 AM',
      '1 hour',
      false,
      false
    ),
    (
      '70000000-0000-4000-8000-000000000002',
      neighbor_id,
      'session-neighbor-task',
      'Neighbor session task',
      'A neighbor-owned task used to verify authenticated listing access.',
      'One bounded task',
      'No unsafe work',
      'Photo confirmation',
      'Errands',
      'errands',
      'paid',
      30,
      37.8120,
      -122.2580,
      'temescal',
      'Temescal',
      'Flexible',
      '1 hour',
      false,
      false
    );

  insert into public.task_private_details (task_id, private_address)
  values (
    '70000000-0000-4000-8000-000000000001',
    '100 Session Test Street'
  );
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '50000000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'session_id', '60000000-0000-4000-8000-000000000001',
    'is_anonymous', false
  )::text,
  true
);

set local role authenticated;

do $$
declare
  capabilities record;
begin
  if not private_authorization.current_auth_session_is_live() then
    raise exception 'live-session RLS test failed: a matching live session was rejected';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = '50000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'live-session RLS test failed: live caller could not read neighbor profile';
  end if;

  if not exists (
    select 1
    from public.tasks
    where id = '70000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'live-session RLS test failed: live caller could not read neighbor task';
  end if;

  if not exists (
    select 1
    from public.task_listings
    where id = '70000000-0000-4000-8000-000000000002'
      and requester_name = 'Session Neighbor'
  ) then
    raise exception 'live-session RLS test failed: live caller could not read task listing view';
  end if;

  if not exists (
    select 1
    from public.task_private_details
    where task_id = '70000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'live-session RLS test failed: live owner could not read private address';
  end if;

  update public.profiles
  set bio = 'Updated by a live session'
  where id = '50000000-0000-4000-8000-000000000001';

  if not found then
    raise exception 'live-session RLS test failed: live owner could not update profile';
  end if;

  select *
  into capabilities
  from public.current_user_capabilities();

  if not capabilities.can_post_tasks
    or not capabilities.can_accept_tasks
    or capabilities.can_receive_sponsorship_requests
    or capabilities.can_sponsor_tasks
  then
    raise exception 'live-session RLS test failed: regular-user capabilities were incorrect';
  end if;
end;
$$;

reset role;

-- A caller cannot borrow another user's otherwise-live session identifier.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '50000000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'session_id', '60000000-0000-4000-8000-000000000002',
    'is_anonymous', false
  )::text,
  true
);

set local role authenticated;

do $$
begin
  if private_authorization.current_auth_session_is_live() then
    raise exception 'live-session RLS test failed: another user''s session_id was accepted';
  end if;

  if exists (
    select 1
    from public.profiles
    where id = '50000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'live-session RLS test failed: mismatched session owner retained profile access';
  end if;
end;
$$;

reset role;

-- A malformed session claim must fail closed instead of aborting the request.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '50000000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'session_id', 'not-a-uuid',
    'is_anonymous', false
  )::text,
  true
);

set local role authenticated;

do $$
begin
  if private_authorization.current_auth_session_is_live() then
    raise exception 'live-session RLS test failed: malformed session_id was accepted';
  end if;

  if exists (
    select 1
    from public.profiles
    where id = '50000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'live-session RLS test failed: malformed session_id retained profile access';
  end if;
end;
$$;

reset role;

-- Restore the valid claim, then remove only its backing session. The user and
-- profile still exist, so these checks isolate explicit session revocation.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '50000000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'session_id', '60000000-0000-4000-8000-000000000001',
    'is_anonymous', false
  )::text,
  true
);

delete from auth.sessions
where id = '60000000-0000-4000-8000-000000000001';

set local role authenticated;

do $$
declare
  capabilities record;
  updated_rows integer;
begin
  if private_authorization.current_auth_session_is_live() then
    raise exception 'live-session RLS test failed: revoked session was accepted';
  end if;

  if exists (
    select 1
    from public.profiles
    where id = '50000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'live-session RLS test failed: revoked session retained profile access';
  end if;

  if exists (
    select 1
    from public.tasks
    where id = '70000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'live-session RLS test failed: revoked session retained task access';
  end if;

  if exists (
    select 1
    from public.task_listings
    where id = '70000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'live-session RLS test failed: revoked session retained view access';
  end if;

  if exists (
    select 1
    from public.task_private_details
    where task_id = '70000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'live-session RLS test failed: revoked session retained private-address access';
  end if;

  select *
  into capabilities
  from public.current_user_capabilities();

  if capabilities.can_post_tasks
    or capabilities.can_accept_tasks
    or capabilities.can_receive_sponsorship_requests
    or capabilities.can_sponsor_tasks
  then
    raise exception 'live-session RLS test failed: revoked session retained capabilities';
  end if;

  update public.tasks
  set title = 'Revoked session update'
  where id = '70000000-0000-4000-8000-000000000001';
  get diagnostics updated_rows = row_count;

  if updated_rows <> 0 then
    raise exception 'live-session RLS test failed: revoked session updated its task';
  end if;
end;
$$;

reset role;

-- Recreate the session, then delete the Auth user. The modeled unexpired JWT
-- remains in request GUCs while both the session and profile cascade away.
insert into auth.sessions (id, user_id)
values (
  '60000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001'
);

delete from auth.users
where id = '50000000-0000-4000-8000-000000000001';

set local role authenticated;

do $$
declare
  capabilities record;
begin
  if private_authorization.current_auth_session_is_live() then
    raise exception 'live-session RLS test failed: deleted account was accepted';
  end if;

  if exists (
    select 1
    from public.profiles
    where id = '50000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'live-session RLS test failed: deleted account retained profile access';
  end if;

  if exists (
    select 1
    from public.tasks
    where id = '70000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'live-session RLS test failed: deleted account retained task access';
  end if;

  if exists (
    select 1
    from public.task_listings
    where id = '70000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'live-session RLS test failed: deleted account retained view access';
  end if;

  select *
  into capabilities
  from public.current_user_capabilities();

  if capabilities.can_post_tasks
    or capabilities.can_accept_tasks
    or capabilities.can_receive_sponsorship_requests
    or capabilities.can_sponsor_tasks
  then
    raise exception 'live-session RLS test failed: deleted account retained capabilities';
  end if;
end;
$$;

reset role;

-- The new predicates target only the authenticated client role. Administrative
-- service-role maintenance must keep its intentional RLS bypass.
set local role service_role;

do $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = '50000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'live-session RLS test failed: service role lost profile access';
  end if;

  if not exists (
    select 1
    from public.task_listings
    where id = '70000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'live-session RLS test failed: service role lost task listing access';
  end if;
end;
$$;

reset role;

-- Keep the policy inventory closed: every live table must have one restrictive
-- authenticated policy that gates both existing-row access and new row values.
do $$
declare
  ungated_policy_count integer;
begin
  select count(*)
  into ungated_policy_count
  from (
    values
      ('profiles', 'profiles_require_live_auth_session'),
      ('organization_members', 'organization_members_require_live_auth_session'),
      ('organizations', 'organizations_require_live_auth_session'),
      ('tasks', 'tasks_require_live_auth_session'),
      ('task_private_details', 'task_private_details_require_live_auth_session')
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

  if ungated_policy_count <> 0 then
    raise exception
      'live-session RLS test failed: % expected policies are missing or ungated',
      ungated_policy_count;
  end if;
end;
$$;

rollback;
