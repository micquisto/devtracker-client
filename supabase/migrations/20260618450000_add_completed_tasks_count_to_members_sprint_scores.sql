alter table public.members_sprint_scores
add column if not exists completed_tasks_count integer not null default 0;

update public.members_sprint_scores mss
set completed_tasks_count = task_counts.completed_tasks_count
from (
  select
    t.sprint_id,
    t.assigned_to as member_id,
    count(*)::integer as completed_tasks_count
  from public.tasks t
  where t.assigned_to is not null
    and t.sp_type in ('planned', 'adhoc')
    and lower(trim(coalesce(t.trello_list_name, ''))) not in (
      'for planning',
      'planning',
      'current sprint',
      'in development'
    )
  group by t.sprint_id, t.assigned_to
) task_counts
where mss.sprint_id = task_counts.sprint_id
  and mss.member_id = task_counts.member_id;
