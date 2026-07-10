alter table public.sprint_scores
add column if not exists planned_story_points integer not null default 0,
add column if not exists adhoc_story_points integer not null default 0;

update public.sprint_scores
set planned_story_points = round(total_story_points)::integer
where planned_story_points = 0
  and total_story_points <> 0;

update public.sprint_scores ss
set adhoc_story_points = member_totals.adhoc_story_points
from (
  select
    mss.sprint_id,
    round(coalesce(sum(mss.adhoc_story_points), 0))::integer as adhoc_story_points
  from public.members_sprint_scores mss
  group by mss.sprint_id
) member_totals
where ss.sprint_id = member_totals.sprint_id
  and ss.adhoc_story_points = 0
  and member_totals.adhoc_story_points <> 0;
