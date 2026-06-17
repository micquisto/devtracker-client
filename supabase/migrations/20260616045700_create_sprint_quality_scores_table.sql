create table if not exists public.sprint_quality_scores (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references public.sprints(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  total_score double precision,
  average_score double precision,
  tasks_count integer,
  base_score double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sprint_quality_scores_sprint_id_idx
on public.sprint_quality_scores (sprint_id);

create index if not exists sprint_quality_scores_member_id_idx
on public.sprint_quality_scores (member_id);

create index if not exists sprint_quality_scores_sprint_member_idx
on public.sprint_quality_scores (sprint_id, member_id);

create or replace function public.set_sprint_quality_scores_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_sprint_quality_scores_updated_at
on public.sprint_quality_scores;

create trigger set_sprint_quality_scores_updated_at
before update on public.sprint_quality_scores
for each row
execute function public.set_sprint_quality_scores_updated_at();

alter table public.sprint_quality_scores enable row level security;

drop policy if exists "Sprint quality scores are readable by authenticated users"
on public.sprint_quality_scores;
drop policy if exists "Sprint quality scores are insertable by authenticated users"
on public.sprint_quality_scores;
drop policy if exists "Sprint quality scores are updatable by authenticated users"
on public.sprint_quality_scores;
drop policy if exists "Sprint quality scores are deletable by authenticated users"
on public.sprint_quality_scores;

create policy "Sprint quality scores are readable by authenticated users"
on public.sprint_quality_scores
for select
to authenticated
using (true);

create policy "Sprint quality scores are insertable by authenticated users"
on public.sprint_quality_scores
for insert
to authenticated
with check (true);

create policy "Sprint quality scores are updatable by authenticated users"
on public.sprint_quality_scores
for update
to authenticated
using (true)
with check (true);

create policy "Sprint quality scores are deletable by authenticated users"
on public.sprint_quality_scores
for delete
to authenticated
using (true);
