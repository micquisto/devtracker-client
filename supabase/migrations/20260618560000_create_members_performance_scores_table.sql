do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'members_performance_scores_grade'
  ) then
    create type public.members_performance_scores_grade as enum (
      'S',
      'A',
      'B',
      'C',
      'D',
      'E',
      'F'
    );
  end if;
end $$;

create table if not exists public.members_performance_scores (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  sprint_id uuid not null references public.sprints(id) on delete cascade,
  average_score double precision not null default 0,
  tasks_count integer not null default 0,
  assigned_story_points integer not null default 0,
  total_story_points integer not null default 0,
  modified_story_points double precision not null default 0,
  hours_accumulated double precision not null default 0,
  extra_points double precision not null default 0,
  negative_accumulated_rate double precision not null default 0,
  velocity_by_hour double precision not null default 0,
  score_grade public.members_performance_scores_grade,
  actual_story_points double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_performance_scores_member_sprint_key unique (member_id, sprint_id)
);

create index if not exists members_performance_scores_member_id_idx
on public.members_performance_scores (member_id);

create index if not exists members_performance_scores_sprint_id_idx
on public.members_performance_scores (sprint_id);

create index if not exists members_performance_scores_score_grade_idx
on public.members_performance_scores (score_grade);

create or replace function public.set_members_performance_scores_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_members_performance_scores_updated_at
on public.members_performance_scores;

create trigger set_members_performance_scores_updated_at
before update on public.members_performance_scores
for each row
execute function public.set_members_performance_scores_updated_at();

alter table public.members_performance_scores enable row level security;

drop policy if exists "Members performance scores rows are readable by authenticated users"
on public.members_performance_scores;
drop policy if exists "Members performance scores rows are insertable by authenticated users"
on public.members_performance_scores;
drop policy if exists "Members performance scores rows are updatable by authenticated users"
on public.members_performance_scores;
drop policy if exists "Members performance scores rows are deletable by authenticated users"
on public.members_performance_scores;

create policy "Members performance scores rows are readable by authenticated users"
on public.members_performance_scores
for select
to authenticated
using (true);

create policy "Members performance scores rows are insertable by authenticated users"
on public.members_performance_scores
for insert
to authenticated
with check (true);

create policy "Members performance scores rows are updatable by authenticated users"
on public.members_performance_scores
for update
to authenticated
using (true)
with check (true);

create policy "Members performance scores rows are deletable by authenticated users"
on public.members_performance_scores
for delete
to authenticated
using (true);

grant select, insert, update, delete on public.members_performance_scores to anon;

drop policy if exists "Anon can select" on public.members_performance_scores;
drop policy if exists "Anon can insert" on public.members_performance_scores;
drop policy if exists "Anon can update" on public.members_performance_scores;
drop policy if exists "Anon can delete" on public.members_performance_scores;

create policy "Anon can select"
on public.members_performance_scores
for select
to anon
using (true);

create policy "Anon can insert"
on public.members_performance_scores
for insert
to anon
with check (true);

create policy "Anon can update"
on public.members_performance_scores
for update
to anon
using (true)
with check (true);

create policy "Anon can delete"
on public.members_performance_scores
for delete
to anon
using (true);
