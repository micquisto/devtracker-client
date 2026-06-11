do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'members_performance_coverage'
  ) then
    create type public.members_performance_coverage as enum (
      'year',
      'quarter',
      'month'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'members_performance_score_grade'
  ) then
    create type public.members_performance_score_grade as enum (
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

create table if not exists public.members_performance_score (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  coverage public.members_performance_coverage not null,
  coverage_flag integer not null,
  productivity_score_average integer,
  productivity_rate double precision,
  productivity_weight double precision,
  hours_average double precision,
  efficiency_rate double precision,
  efficiency_weight double precision,
  quality_score_average double precision,
  quality_rate double precision,
  quality_weight double precision,
  collab_rate_average double precision,
  collab_weight double precision,
  total_score_weight double precision,
  story_points_average double precision,
  best_story_points integer,
  assigned_sp_average integer,
  bonus_total double precision,
  score_grade public.members_performance_score_grade
);

create index if not exists members_performance_score_member_id_idx
on public.members_performance_score (member_id);

create index if not exists members_performance_score_coverage_idx
on public.members_performance_score (coverage, coverage_flag);

create index if not exists members_performance_score_member_coverage_idx
on public.members_performance_score (member_id, coverage, coverage_flag);

alter table public.members_performance_score enable row level security;

drop policy if exists "Members performance scores are readable by authenticated users"
on public.members_performance_score;
drop policy if exists "Members performance scores are insertable by authenticated users"
on public.members_performance_score;
drop policy if exists "Members performance scores are updatable by authenticated users"
on public.members_performance_score;
drop policy if exists "Members performance scores are deletable by authenticated users"
on public.members_performance_score;

create policy "Members performance scores are readable by authenticated users"
on public.members_performance_score
for select
to authenticated
using (true);

create policy "Members performance scores are insertable by authenticated users"
on public.members_performance_score
for insert
to authenticated
with check (true);

create policy "Members performance scores are updatable by authenticated users"
on public.members_performance_score
for update
to authenticated
using (true)
with check (true);

create policy "Members performance scores are deletable by authenticated users"
on public.members_performance_score
for delete
to authenticated
using (true);
