do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'sprint_story_points_model'
  ) then
    create type public.sprint_story_points_model as enum (
      'sprint',
      'member',
      'project_type'
    );
  end if;
end $$;

create table if not exists public.sprint_story_points (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references public.sprints(id) on delete cascade,
  model public.sprint_story_points_model not null,
  model_id uuid not null,
  points double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sprint_story_points_sprint_id_idx
on public.sprint_story_points (sprint_id);

create index if not exists sprint_story_points_model_model_id_idx
on public.sprint_story_points (model, model_id);

create or replace function public.set_sprint_story_points_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_sprint_story_points_updated_at
on public.sprint_story_points;

create trigger set_sprint_story_points_updated_at
before update on public.sprint_story_points
for each row
execute function public.set_sprint_story_points_updated_at();

alter table public.sprint_story_points enable row level security;

drop policy if exists "Sprint story points are readable by authenticated users"
on public.sprint_story_points;
drop policy if exists "Sprint story points are insertable by authenticated users"
on public.sprint_story_points;
drop policy if exists "Sprint story points are updatable by authenticated users"
on public.sprint_story_points;
drop policy if exists "Sprint story points are deletable by authenticated users"
on public.sprint_story_points;

create policy "Sprint story points are readable by authenticated users"
on public.sprint_story_points
for select
to authenticated
using (true);

create policy "Sprint story points are insertable by authenticated users"
on public.sprint_story_points
for insert
to authenticated
with check (true);

create policy "Sprint story points are updatable by authenticated users"
on public.sprint_story_points
for update
to authenticated
using (true)
with check (true);

create policy "Sprint story points are deletable by authenticated users"
on public.sprint_story_points
for delete
to authenticated
using (true);
