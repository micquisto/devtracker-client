create table if not exists public.sprint_task_scores (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references public.sprints(id) on delete cascade,
  trello_card_id text not null,
  short_id integer,
  trello_name text not null,
  short_url text,
  story_points double precision not null default 0,
  completion_rate double precision not null default 100,
  accumulated_story_points double precision generated always as (
    coalesce(story_points, 0::double precision)
    * (coalesce(completion_rate, 100::double precision) / 100.0)
  ) stored,
  severity_multiplier double precision not null default 1.0,
  story_points_total double precision generated always as (
    coalesce(story_points, 0::double precision)
    * (coalesce(completion_rate, 100::double precision) / 100.0)
    * coalesce(severity_multiplier, 1.0::double precision)
  ) stored,
  reject_count integer,
  project text,
  month integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sprint_task_scores_sprint_trello_card_key unique (sprint_id, trello_card_id)
);

create index if not exists sprint_task_scores_sprint_id_idx
on public.sprint_task_scores (sprint_id);

create index if not exists sprint_task_scores_trello_card_id_idx
on public.sprint_task_scores (trello_card_id);

create index if not exists sprint_task_scores_month_idx
on public.sprint_task_scores (month);

create or replace function public.set_sprint_task_scores_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_sprint_task_scores_updated_at
on public.sprint_task_scores;

create trigger set_sprint_task_scores_updated_at
before update on public.sprint_task_scores
for each row
execute function public.set_sprint_task_scores_updated_at();

alter table public.sprint_task_scores enable row level security;

drop policy if exists "Sprint task scores are readable by authenticated users"
on public.sprint_task_scores;
drop policy if exists "Sprint task scores are insertable by authenticated users"
on public.sprint_task_scores;
drop policy if exists "Sprint task scores are updatable by authenticated users"
on public.sprint_task_scores;
drop policy if exists "Sprint task scores are deletable by authenticated users"
on public.sprint_task_scores;

create policy "Sprint task scores are readable by authenticated users"
on public.sprint_task_scores
for select
to authenticated
using (true);

create policy "Sprint task scores are insertable by authenticated users"
on public.sprint_task_scores
for insert
to authenticated
with check (true);

create policy "Sprint task scores are updatable by authenticated users"
on public.sprint_task_scores
for update
to authenticated
using (true)
with check (true);

create policy "Sprint task scores are deletable by authenticated users"
on public.sprint_task_scores
for delete
to authenticated
using (true);
