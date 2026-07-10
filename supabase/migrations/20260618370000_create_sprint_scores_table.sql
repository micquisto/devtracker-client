create table if not exists public.sprint_scores (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references public.sprints(id) on delete cascade,
  total_story_points double precision not null default 0,
  sprint_velocity_average double precision not null default 0,
  total_completed_story_points double precision not null default 0,
  planned_tasks_count integer not null default 0,
  total_reject_count integer not null default 0,
  total_adhoc_count integer not null default 0,
  adhoc_rate double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sprint_scores_sprint_id_key unique (sprint_id)
);

create index if not exists sprint_scores_sprint_id_idx
on public.sprint_scores (sprint_id);

create or replace function public.set_sprint_scores_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_sprint_scores_updated_at
on public.sprint_scores;

create trigger set_sprint_scores_updated_at
before update on public.sprint_scores
for each row
execute function public.set_sprint_scores_updated_at();

alter table public.sprint_scores enable row level security;

drop policy if exists "Sprint scores are readable by authenticated users"
on public.sprint_scores;
drop policy if exists "Sprint scores are insertable by authenticated users"
on public.sprint_scores;
drop policy if exists "Sprint scores are updatable by authenticated users"
on public.sprint_scores;
drop policy if exists "Sprint scores are deletable by authenticated users"
on public.sprint_scores;

create policy "Sprint scores are readable by authenticated users"
on public.sprint_scores
for select
to authenticated
using (true);

create policy "Sprint scores are insertable by authenticated users"
on public.sprint_scores
for insert
to authenticated
with check (true);

create policy "Sprint scores are updatable by authenticated users"
on public.sprint_scores
for update
to authenticated
using (true)
with check (true);

create policy "Sprint scores are deletable by authenticated users"
on public.sprint_scores
for delete
to authenticated
using (true);
