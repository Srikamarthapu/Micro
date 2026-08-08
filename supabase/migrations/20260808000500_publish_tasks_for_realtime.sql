-- Publish task listings for realtime.
--
-- `task_assignments` and `task_messages` were added to the realtime publication
-- so both sides of a match hear about it without polling. Listings themselves
-- were not, so a device only ever saw the listings that existed when it signed
-- in: post on one phone and the other never learned about it.
--
-- Row-level security still decides what each subscriber receives, so this
-- publishes the change feed without widening who can read a listing.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end;
$$;
