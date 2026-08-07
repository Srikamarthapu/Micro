begin;

do $$
declare
  empty_owner_id constant uuid := '10000000-0000-4000-8000-000000000001';
  transferring_owner_id constant uuid := '10000000-0000-4000-8000-000000000002';
  successor_owner_id constant uuid := '10000000-0000-4000-8000-000000000003';
  blocked_owner_id constant uuid := '10000000-0000-4000-8000-000000000004';
  linked_member_id constant uuid := '10000000-0000-4000-8000-000000000005';
  creator_owner_id constant uuid := '10000000-0000-4000-8000-000000000006';
  secondary_owner_id constant uuid := '10000000-0000-4000-8000-000000000007';
  empty_organization_id uuid;
  transferring_organization_id uuid;
  blocked_organization_id uuid;
  shared_organization_id uuid;
  deletion_was_blocked boolean := false;
  capabilities record;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (empty_owner_id, 'delete-empty-owner@micro.test', '{}'),
    (transferring_owner_id, 'delete-transferring-owner@micro.test', '{}'),
    (successor_owner_id, 'delete-successor-owner@micro.test', '{}'),
    (blocked_owner_id, 'delete-blocked-owner@micro.test', '{}'),
    (linked_member_id, 'delete-linked-member@micro.test', '{}'),
    (creator_owner_id, 'delete-creator-owner@micro.test', '{}'),
    (secondary_owner_id, 'delete-secondary-owner@micro.test', '{}');

  insert into public.organizations (name, slug, created_by)
  values ('Empty owner test', 'empty-owner-test', empty_owner_id)
  returning id into empty_organization_id;

  delete from auth.users where id = empty_owner_id;

  if exists (
    select 1 from public.organizations where id = empty_organization_id
  ) then
    raise exception 'account deletion test failed: empty organization remained';
  end if;

  if exists (
    select 1 from public.profiles where id = empty_owner_id
  ) then
    raise exception 'account deletion test failed: profile did not cascade';
  end if;

  perform set_config('request.jwt.claim.sub', empty_owner_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', empty_owner_id, 'is_anonymous', false)::text,
    true
  );

  select *
  into capabilities
  from public.current_user_capabilities();

  if capabilities.can_post_tasks
    or capabilities.can_accept_tasks
    or capabilities.can_receive_sponsorship_requests
    or capabilities.can_sponsor_tasks
  then
    raise exception 'account deletion test failed: deleted profile retained capabilities';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);

  insert into public.organizations (name, slug, created_by)
  values ('Successor owner test', 'successor-owner-test', transferring_owner_id)
  returning id into transferring_organization_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    member_role,
    membership_status
  )
  values (
    transferring_organization_id,
    successor_owner_id,
    'owner',
    'active'
  );

  delete from auth.users where id = transferring_owner_id;

  if not exists (
    select 1
    from public.organizations
    where id = transferring_organization_id
      and created_by = successor_owner_id
  ) then
    raise exception 'account deletion test failed: successor owner was not assigned';
  end if;

  insert into public.organizations (name, slug, created_by)
  values ('Creator provenance test', 'creator-provenance-test', creator_owner_id)
  returning id into shared_organization_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    member_role,
    membership_status
  )
  values (
    shared_organization_id,
    secondary_owner_id,
    'owner',
    'active'
  );

  delete from auth.users where id = secondary_owner_id;

  if not exists (
    select 1
    from public.organizations
    where id = shared_organization_id
      and created_by = creator_owner_id
  ) then
    raise exception 'account deletion test failed: deleting a non-creator owner changed creator provenance';
  end if;

  if not exists (
    select 1
    from public.organization_members
    where organization_id = shared_organization_id
      and user_id = creator_owner_id
      and member_role = 'owner'
      and membership_status = 'active'
  ) then
    raise exception 'account deletion test failed: surviving creator owner was not preserved';
  end if;

  insert into public.organizations (name, slug, created_by)
  values ('Blocked owner test', 'blocked-owner-test', blocked_owner_id)
  returning id into blocked_organization_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    member_role,
    membership_status
  )
  values (
    blocked_organization_id,
    linked_member_id,
    'member',
    'active'
  );

  begin
    delete from auth.users where id = blocked_owner_id;
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'organization_owner_transfer_required' then
        raise;
      end if;
      deletion_was_blocked := true;
  end;

  if not deletion_was_blocked then
    raise exception 'account deletion test failed: linked people were orphaned';
  end if;

  if not exists (
    select 1 from auth.users where id = blocked_owner_id
  ) then
    raise exception 'account deletion test failed: blocked owner was deleted';
  end if;

  if not exists (
    select 1 from public.organizations where id = blocked_organization_id
  ) then
    raise exception 'account deletion test failed: blocked organization was deleted';
  end if;
end;
$$;

rollback;
