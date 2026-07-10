alter table public.sprint_scores
add column if not exists blocked_tasks_count integer not null default 0;

update public.sprint_scores ss
set blocked_tasks_count = s.blocked_count
from public.sprints s
where ss.sprint_id = s.id
  and ss.blocked_tasks_count = 0
  and coalesce(s.blocked_count, 0) > 0;
