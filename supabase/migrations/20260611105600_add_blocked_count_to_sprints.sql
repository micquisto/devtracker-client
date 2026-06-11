alter table public.sprints
add column if not exists blocked_count integer default 0;

update public.sprints
set blocked_count = 0
where blocked_count is null;

alter table public.sprints
alter column blocked_count set default 0;

alter table public.sprints
alter column blocked_count set not null;
