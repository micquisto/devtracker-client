alter table public.sprints
add column if not exists month integer;

alter table public.tasks
add column if not exists project varchar;
