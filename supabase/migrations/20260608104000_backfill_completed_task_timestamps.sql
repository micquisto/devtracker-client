update public.tasks
set completed_at = coalesce(trello_last_synced_at, now())
where is_completed = true
  and completed_at is null;
