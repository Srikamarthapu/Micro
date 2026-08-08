begin;

-- Two retained assignment threads make the read-cursor test independent of
-- task catalog fixtures while preserving the same participant authorization
-- and transcript-retention model as a completed live match.
do $$
declare
  requester_id constant uuid := 'a0000000-0000-4000-8000-000000000001';
  helper_id constant uuid := 'a0000000-0000-4000-8000-000000000002';
  intruder_id constant uuid := 'a0000000-0000-4000-8000-000000000003';
  other_helper_id constant uuid := 'a0000000-0000-4000-8000-000000000004';
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (requester_id, 'thread-read-requester@micro.test', '{"display_name":"Read Requester","service_area":"downtown"}'),
    (helper_id, 'thread-read-helper@micro.test', '{"display_name":"Read Helper","service_area":"temescal"}'),
    (intruder_id, 'thread-read-intruder@micro.test', '{"display_name":"Read Intruder","service_area":"alameda"}'),
    (other_helper_id, 'thread-read-other-helper@micro.test', '{"display_name":"Other Helper","service_area":"fruitvale"}');

  insert into auth.sessions (id, user_id)
  values
    ('a1000000-0000-4000-8000-000000000001', requester_id),
    ('a1000000-0000-4000-8000-000000000002', helper_id),
    ('a1000000-0000-4000-8000-000000000003', intruder_id),
    ('a1000000-0000-4000-8000-000000000004', other_helper_id);

  insert into public.task_assignments (
    id,
    task_id,
    requester_id,
    helper_id,
    task_title,
    status,
    created_at,
    settled_at
  )
  values
    (
      'a2000000-0000-4000-8000-000000000001',
      null,
      requester_id,
      helper_id,
      'Retained read-cursor task',
      'completed',
      now() - interval '1 hour',
      now() - interval '30 minutes'
    ),
    (
      'a2000000-0000-4000-8000-000000000002',
      null,
      requester_id,
      other_helper_id,
      'Unrelated retained task',
      'completed',
      now() - interval '1 hour',
      now() - interval '30 minutes'
    );

  insert into public.task_messages (
    id,
    assignment_id,
    sender_id,
    client_nonce,
    body,
    created_at
  )
  values
    (
      'a3000000-0000-4000-8000-000000000001',
      'a2000000-0000-4000-8000-000000000001',
      requester_id,
      'a4000000-0000-4000-8000-000000000001',
      'First retained message',
      now() - interval '50 minutes'
    ),
    (
      'a3000000-0000-4000-8000-000000000002',
      'a2000000-0000-4000-8000-000000000001',
      helper_id,
      'a4000000-0000-4000-8000-000000000002',
      'Second retained message',
      now() - interval '45 minutes'
    ),
    (
      'a3000000-0000-4000-8000-000000000003',
      'a2000000-0000-4000-8000-000000000001',
      requester_id,
      'a4000000-0000-4000-8000-000000000003',
      'Newest retained message',
      now() - interval '40 minutes'
    ),
    (
      'a3000000-0000-4000-8000-000000000004',
      'a2000000-0000-4000-8000-000000000002',
      requester_id,
      'a4000000-0000-4000-8000-000000000004',
      'Message from another assignment',
      now() - interval '35 minutes'
    );
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  'a0000000-0000-4000-8000-000000000002',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'a0000000-0000-4000-8000-000000000002',
    'role', 'authenticated',
    'session_id', 'a1000000-0000-4000-8000-000000000002',
    'is_anonymous', false
  )::text,
  true
);

set local role authenticated;

do $$
declare
  marked public.task_thread_reads;
  first_mark_at timestamptz;
  mark_started_at timestamptz;
begin
  if exists (select 1 from public.task_thread_reads) then
    raise exception 'thread read test failed: helper began with a cursor';
  end if;

  -- No browser role can spoof reader identity, timestamp, or message position by
  -- writing the table directly.
  begin
    insert into public.task_thread_reads (
      assignment_id,
      reader_id,
      last_read_at,
      last_read_message_id
    ) values (
      'a2000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000003',
      now() + interval '1 year',
      'a3000000-0000-4000-8000-000000000003'
    );
    raise exception 'thread read test failed: authenticated inserted a cursor';
  exception
    when insufficient_privilege then null;
  end;

  mark_started_at := clock_timestamp();
  marked := public.mark_task_thread_read(
    'a2000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000002'
  );

  if marked.assignment_id <> 'a2000000-0000-4000-8000-000000000001'
    or marked.reader_id <> 'a0000000-0000-4000-8000-000000000002'
    or marked.last_read_message_id <> 'a3000000-0000-4000-8000-000000000002'
    or marked.last_read_at < mark_started_at
    or marked.last_read_at > clock_timestamp()
  then
    raise exception 'thread read test failed: first RPC cursor was not server-derived';
  end if;

  first_mark_at := marked.last_read_at;

  if (select count(*) from public.task_thread_reads) <> 1 then
    raise exception 'thread read test failed: helper did not see exactly its cursor';
  end if;

  -- Reporting an older message later can refresh server receipt time but never
  -- moves the message position backwards.
  marked := public.mark_task_thread_read(
    'a2000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001'
  );

  if marked.last_read_message_id <> 'a3000000-0000-4000-8000-000000000002'
    or marked.last_read_at < first_mark_at
  then
    raise exception 'thread read test failed: cursor moved backwards';
  end if;

  -- The next message advances both the returned row and authoritative table.
  marked := public.mark_task_thread_read(
    'a2000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000003'
  );

  if marked.last_read_message_id <> 'a3000000-0000-4000-8000-000000000003'
    or not exists (
      select 1
      from public.task_thread_reads
      where assignment_id = marked.assignment_id
        and reader_id = marked.reader_id
        and last_read_message_id = marked.last_read_message_id
        and last_read_at = marked.last_read_at
    )
  then
    raise exception 'thread read test failed: newer message did not advance cursor';
  end if;

  begin
    update public.task_thread_reads
    set last_read_at = now() + interval '1 year';
    raise exception 'thread read test failed: authenticated updated a cursor';
  exception
    when insufficient_privilege then null;
  end;

  begin
    delete from public.task_thread_reads;
    raise exception 'thread read test failed: authenticated deleted a cursor';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.mark_task_thread_read(
      'a2000000-0000-4000-8000-000000000001',
      'a3000000-0000-4000-8000-000000000004'
    );
    raise exception 'thread read test failed: cross-assignment message advanced cursor';
  exception
    when invalid_parameter_value then
      if sqlerrm <> 'thread_message_not_found' then
        raise exception 'thread read test failed: unstable cross-thread error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.mark_task_thread_read(
      'a2000000-0000-4000-8000-000000000002',
      'a3000000-0000-4000-8000-000000000004'
    );
    raise exception 'thread read test failed: nonparticipant advanced cursor';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'not_a_task_participant' then
        raise exception 'thread read test failed: unstable participant error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.mark_task_thread_read(
      'a2000000-0000-4000-8000-000000000001',
      'afffffff-ffff-4fff-8fff-ffffffffffff'
    );
    raise exception 'thread read test failed: missing message advanced cursor';
  exception
    when invalid_parameter_value then
      if sqlerrm <> 'thread_message_not_found' then
        raise exception 'thread read test failed: unstable missing-message error: %', sqlerrm;
      end if;
  end;
end;
$$;

reset role;

-- The requester is a participant but still cannot see the helper's per-user
-- row. Marking the same message creates a separate requester cursor.
select set_config(
  'request.jwt.claim.sub',
  'a0000000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'a0000000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'session_id', 'a1000000-0000-4000-8000-000000000001',
    'is_anonymous', false
  )::text,
  true
);

set local role authenticated;

do $$
declare
  marked public.task_thread_reads;
begin
  if exists (select 1 from public.task_thread_reads) then
    raise exception 'thread read test failed: requester saw helper cursor';
  end if;

  marked := public.mark_task_thread_read(
    'a2000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001'
  );

  if marked.reader_id <> 'a0000000-0000-4000-8000-000000000001'
    or (select count(*) from public.task_thread_reads) <> 1
  then
    raise exception 'thread read test failed: requester cursor isolation failed';
  end if;
end;
$$;

reset role;

-- An unrelated live account cannot read either participant cursor or call the
-- RPC for this assignment.
select set_config(
  'request.jwt.claim.sub',
  'a0000000-0000-4000-8000-000000000003',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'a0000000-0000-4000-8000-000000000003',
    'role', 'authenticated',
    'session_id', 'a1000000-0000-4000-8000-000000000003',
    'is_anonymous', false
  )::text,
  true
);

set local role authenticated;

do $$
begin
  if exists (select 1 from public.task_thread_reads) then
    raise exception 'thread read test failed: unrelated account read cursors';
  end if;

  begin
    perform public.mark_task_thread_read(
      'a2000000-0000-4000-8000-000000000001',
      'a3000000-0000-4000-8000-000000000003'
    );
    raise exception 'thread read test failed: unrelated account marked thread';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'not_a_task_participant' then
        raise exception 'thread read test failed: unstable intruder error: %', sqlerrm;
      end if;
  end;
end;
$$;

reset role;

-- Revoking only the helper's backing Auth session immediately closes cursor
-- reads and RPC writes while its JWT remains otherwise unchanged.
delete from auth.sessions
where id = 'a1000000-0000-4000-8000-000000000002';

select set_config(
  'request.jwt.claim.sub',
  'a0000000-0000-4000-8000-000000000002',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'a0000000-0000-4000-8000-000000000002',
    'role', 'authenticated',
    'session_id', 'a1000000-0000-4000-8000-000000000002',
    'is_anonymous', false
  )::text,
  true
);

set local role authenticated;

do $$
begin
  if exists (select 1 from public.task_thread_reads) then
    raise exception 'thread read test failed: revoked session retained cursor read';
  end if;

  begin
    perform public.mark_task_thread_read(
      'a2000000-0000-4000-8000-000000000001',
      'a3000000-0000-4000-8000-000000000003'
    );
    raise exception 'thread read test failed: revoked session marked thread';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'live_authenticated_session_required' then
        raise exception 'thread read test failed: unstable revoked-session error: %', sqlerrm;
      end if;
  end;
end;
$$;

reset role;

-- Trusted writes still cannot violate the same-assignment message invariant,
-- and a message serving as a live cursor anchor cannot be removed.
set local role service_role;

do $$
begin
  begin
    insert into public.task_thread_reads (
      assignment_id,
      reader_id,
      last_read_at,
      last_read_message_id
    ) values (
      'a2000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000003',
      now(),
      'a3000000-0000-4000-8000-000000000004'
    );
    raise exception 'thread read test failed: trusted mismatched message was stored';
  exception
    when foreign_key_violation then null;
  end;

  begin
    delete from public.task_messages
    where id = 'a3000000-0000-4000-8000-000000000003';
    raise exception 'thread read test failed: cursor anchor message was deleted';
  exception
    when foreign_key_violation or restrict_violation then null;
  end;
end;
$$;

reset role;

-- Restore the helper session, then delete the settled helper account. The user
-- FK cascades only that person's cursor; the requester's cursor remains.
insert into auth.sessions (id, user_id)
values (
  'a1000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000002'
);

delete from auth.users
where id = 'a0000000-0000-4000-8000-000000000002';

set local role service_role;

do $$
begin
  if exists (
    select 1 from public.task_thread_reads
    where reader_id = 'a0000000-0000-4000-8000-000000000002'
  ) or not exists (
    select 1 from public.task_thread_reads
    where reader_id = 'a0000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'thread read test failed: reader deletion cascade was not isolated';
  end if;
end;
$$;

reset role;

-- Structural inventory catches future privilege, policy, FK, index, function,
-- or publication regressions even if the behavioral path still passes.
do $$
declare
  live_policy record;
  read_policy record;
  rpc_definition record;
  realtime_count integer;
begin
  if not exists (
    select 1 from pg_class
    where oid = 'public.task_thread_reads'::regclass
      and relrowsecurity
  ) then
    raise exception 'thread read test failed: RLS is not enabled';
  end if;

  select * into live_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'task_thread_reads'
    and policyname = 'task_thread_reads_require_live_auth_session';

  if not found
    or lower(coalesce(live_policy.permissive, '')) <> 'restrictive'
    or lower(coalesce(live_policy.cmd, '')) <> 'all'
    or not ('authenticated' = any(live_policy.roles))
    or position('current_auth_session_is_live' in coalesce(live_policy.qual, '')) = 0
    or position('current_auth_session_is_live' in coalesce(live_policy.with_check, '')) = 0
  then
    raise exception 'thread read test failed: live-session policy is missing or weak';
  end if;

  select * into read_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'task_thread_reads'
    and policyname = 'task_thread_reads_self_participant_read';

  if not found
    or lower(coalesce(read_policy.cmd, '')) <> 'select'
    or not ('authenticated' = any(read_policy.roles))
    or position('reader_id' in coalesce(read_policy.qual, '')) = 0
    or position('current_user_is_assignment_participant' in coalesce(read_policy.qual, '')) = 0
  then
    raise exception 'thread read test failed: participant self-read policy is missing or weak';
  end if;

  if not has_table_privilege('authenticated', 'public.task_thread_reads', 'SELECT')
    or has_table_privilege('authenticated', 'public.task_thread_reads', 'INSERT')
    or has_table_privilege('authenticated', 'public.task_thread_reads', 'UPDATE')
    or has_table_privilege('authenticated', 'public.task_thread_reads', 'DELETE')
    or has_table_privilege('anon', 'public.task_thread_reads', 'SELECT')
  then
    raise exception 'thread read test failed: table grants are unsafe or incomplete';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.mark_task_thread_read(uuid,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.mark_task_thread_read(uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'thread read test failed: RPC execute grants are incorrect';
  end if;

  select
    procedure.prosecdef,
    procedure.proconfig,
    procedure.proargnames
  into rpc_definition
  from pg_proc as procedure
  where procedure.oid = 'public.mark_task_thread_read(uuid,uuid)'::regprocedure;

  if not rpc_definition.prosecdef
    or not coalesce(rpc_definition.proconfig, array[]::text[]) @> array['search_path=""']
    or rpc_definition.proargnames[1] <> 'p_assignment_id'
    or rpc_definition.proargnames[2] <> 'p_message_id'
  then
    raise exception 'thread read test failed: RPC signature or fixed authority is incorrect';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'task_thread_reads_reader_updated_idx'
  ) or not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'task_thread_reads_assignment_message_idx'
      and indexdef ilike '%(assignment_id, last_read_message_id)%'
  ) or not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'task_messages_assignment_message_key'
      and indexdef ilike 'create unique index%'
  ) then
    raise exception 'thread read test failed: required cursor indexes are missing';
  end if;

  if not exists (
    select 1
    from information_schema.referential_constraints
    where constraint_schema = 'public'
      and constraint_name = 'task_thread_reads_assignment_fk'
      and delete_rule = 'CASCADE'
  ) or not exists (
    select 1
    from information_schema.referential_constraints
    where constraint_schema = 'public'
      and constraint_name = 'task_thread_reads_reader_fk'
      and delete_rule = 'CASCADE'
  ) or not exists (
    select 1
    from information_schema.referential_constraints
    where constraint_schema = 'public'
      and constraint_name = 'task_thread_reads_message_in_assignment_fk'
      and delete_rule = 'RESTRICT'
  ) then
    raise exception 'thread read test failed: FK cascade/retention semantics changed';
  end if;

  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    select count(*) into realtime_count
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'task_thread_reads';

    if realtime_count <> 1 then
      raise exception 'thread read test failed: cursor table is missing from Realtime';
    end if;
  end if;
end;
$$;

rollback;
