alter table public.tasks
alter column real_story_points type double precision
using real_story_points::double precision;
