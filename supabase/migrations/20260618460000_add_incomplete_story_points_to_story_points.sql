alter table public.story_points
add column if not exists incomplete_story_points double precision not null default 0;
