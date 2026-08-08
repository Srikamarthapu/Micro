-- Cover the composite child side of the cursor-to-message foreign key.
-- The earlier single-column index is redundant once assignment_id leads this
-- lookup, and removing it avoids paying for two indexes on every cursor move.

drop index if exists public.task_thread_reads_last_message_idx;

create index if not exists task_thread_reads_assignment_message_idx
  on public.task_thread_reads (assignment_id, last_read_message_id);
