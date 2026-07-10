update public.tasks t
set weighted_story_points = 0
from public.sprints s
cross join (
  select start_date
  from public.sprints
  where id = '2589f9a4-4c73-4500-aabe-7d460a20378d'
) cutoff
where t.sprint_id = s.id
  and cutoff.start_date is not null
  and s.id <> '2589f9a4-4c73-4500-aabe-7d460a20378d'
  and s.start_date < cutoff.start_date;

update public.members_sprint_scores mss
set weighted_story_points = 0
from public.sprints s
cross join (
  select start_date
  from public.sprints
  where id = '2589f9a4-4c73-4500-aabe-7d460a20378d'
) cutoff
where mss.sprint_id = s.id
  and cutoff.start_date is not null
  and s.id <> '2589f9a4-4c73-4500-aabe-7d460a20378d'
  and s.start_date < cutoff.start_date;
