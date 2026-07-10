alter table public.tasks
add column if not exists weighted_story_points double precision;

update public.tasks
set weighted_story_points = coalesce(real_story_points, 0) * coalesce(severity, 1.0)
where weighted_story_points is null
  and real_story_points is not null;

update public.tasks
set weighted_story_points = 0
where weighted_story_points is null;

alter table public.tasks
alter column weighted_story_points set default 0;

alter table public.tasks
alter column weighted_story_points set not null;
