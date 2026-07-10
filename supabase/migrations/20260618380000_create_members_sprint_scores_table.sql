create table if not exists public.members_sprint_scores (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references public.sprints(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  planned_story_points double precision not null default 0,
  completed_story_points double precision not null default 0,
  adhoc_story_points double precision not null default 0,
  velocity double precision,
  accumulated_hours double precision,
  quality_rate double precision,
  collaboration double precision,
  planned_tasks_count integer not null default 0,
  total_reject_count integer not null default 0,
  total_adhoc_count integer not null default 0,
  adhoc_rate double precision not null default 0,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_sprint_scores_sprint_member_key unique (sprint_id, member_id)
);

create index if not exists members_sprint_scores_sprint_id_idx
on public.members_sprint_scores (sprint_id);

create index if not exists members_sprint_scores_member_id_idx
on public.members_sprint_scores (member_id);

create index if not exists members_sprint_scores_sprint_member_idx
on public.members_sprint_scores (sprint_id, member_id);

create or replace function public.set_members_sprint_scores_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_members_sprint_scores_updated_at
on public.members_sprint_scores;

create trigger set_members_sprint_scores_updated_at
before update on public.members_sprint_scores
for each row
execute function public.set_members_sprint_scores_updated_at();

alter table public.members_sprint_scores enable row level security;

drop policy if exists "Members sprint scores are readable by authenticated users"
on public.members_sprint_scores;
drop policy if exists "Members sprint scores are insertable by authenticated users"
on public.members_sprint_scores;
drop policy if exists "Members sprint scores are updatable by authenticated users"
on public.members_sprint_scores;
drop policy if exists "Members sprint scores are deletable by authenticated users"
on public.members_sprint_scores;

create policy "Members sprint scores are readable by authenticated users"
on public.members_sprint_scores
for select
to authenticated
using (true);

create policy "Members sprint scores are insertable by authenticated users"
on public.members_sprint_scores
for insert
to authenticated
with check (true);

create policy "Members sprint scores are updatable by authenticated users"
on public.members_sprint_scores
for update
to authenticated
using (true)
with check (true);

create policy "Members sprint scores are deletable by authenticated users"
on public.members_sprint_scores
for delete
to authenticated
using (true);
