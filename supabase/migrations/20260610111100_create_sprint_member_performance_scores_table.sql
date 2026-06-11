create table if not exists public.sprint_member_performance_scores (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references public.sprints(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  sprint_planned_sp integer,
  sprint_completed_sp integer,
  sprint_velocity integer,
  hours double precision,
  required_hours_min double precision,
  required_hours_max double precision,
  hours_rate double precision,
  velocity_per_hour double precision,
  sprint_performance_rate double precision,
  sprint_tasks_accumulated integer,
  sprint_efficiency_rate double precision,
  sprint_quality_score double precision,
  sprint_quality_rate double precision,
  sprint_collaboration_rate double precision,
  required_story_points integer,
  extra_points double precision,
  constraint sprint_member_performance_scores_hours_rate_check
    check (hours_rate is null or (hours_rate >= 0 and hours_rate <= 100))
);

create index if not exists sprint_member_performance_scores_sprint_id_idx
on public.sprint_member_performance_scores (sprint_id);

create index if not exists sprint_member_performance_scores_member_id_idx
on public.sprint_member_performance_scores (member_id);

create index if not exists sprint_member_performance_scores_sprint_member_idx
on public.sprint_member_performance_scores (sprint_id, member_id);

alter table public.sprint_member_performance_scores enable row level security;

drop policy if exists "Sprint member performance scores are readable by authenticated users"
on public.sprint_member_performance_scores;
drop policy if exists "Sprint member performance scores are insertable by authenticated users"
on public.sprint_member_performance_scores;
drop policy if exists "Sprint member performance scores are updatable by authenticated users"
on public.sprint_member_performance_scores;
drop policy if exists "Sprint member performance scores are deletable by authenticated users"
on public.sprint_member_performance_scores;

create policy "Sprint member performance scores are readable by authenticated users"
on public.sprint_member_performance_scores
for select
to authenticated
using (true);

create policy "Sprint member performance scores are insertable by authenticated users"
on public.sprint_member_performance_scores
for insert
to authenticated
with check (true);

create policy "Sprint member performance scores are updatable by authenticated users"
on public.sprint_member_performance_scores
for update
to authenticated
using (true)
with check (true);

create policy "Sprint member performance scores are deletable by authenticated users"
on public.sprint_member_performance_scores
for delete
to authenticated
using (true);
