alter table public.members_sprint_scores
add column if not exists weighted_story_points double precision not null default 0;

update public.members_sprint_scores mss
set weighted_story_points = coalesce(totals.weighted_story_points, 0)
from (
  select
    t.sprint_id,
    t.assigned_to as member_id,
    sum(coalesce(t.weighted_story_points, 0)) as weighted_story_points
  from public.tasks t
  where t.assigned_to is not null
    and t.sp_type in ('planned', 'adhoc')
    and lower(trim(t.trello_list_name)) not in (
      'for planning',
      'planning',
      'current sprint',
      'in development'
    )
  group by t.sprint_id, t.assigned_to
) totals
where mss.sprint_id = totals.sprint_id
  and mss.member_id = totals.member_id;
