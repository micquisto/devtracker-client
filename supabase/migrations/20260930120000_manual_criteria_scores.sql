-- Generic "manual" criteria: any new criterion whose 0-100 score is entered
-- by a lead per member per sprint instead of being calculated.

alter type public.criteria_type add value if not exists 'manual';

create table if not exists public.member_sprint_manual_criteria_scores (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  sprint_id uuid not null references public.sprints(id) on delete cascade,
  criteria_id uuid not null references public.criteria(id) on delete cascade,
  score double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_sprint_manual_criteria_scores_key unique (member_id, sprint_id, criteria_id),
  constraint member_sprint_manual_criteria_scores_score_range check (score >= 0 and score <= 100)
);

create index if not exists member_sprint_manual_criteria_scores_sprint_id_idx
on public.member_sprint_manual_criteria_scores (sprint_id);

create index if not exists member_sprint_manual_criteria_scores_criteria_id_idx
on public.member_sprint_manual_criteria_scores (criteria_id);

create or replace function public.set_member_sprint_manual_criteria_scores_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_member_sprint_manual_criteria_scores_updated_at
on public.member_sprint_manual_criteria_scores;

create trigger set_member_sprint_manual_criteria_scores_updated_at
before update on public.member_sprint_manual_criteria_scores
for each row
execute function public.set_member_sprint_manual_criteria_scores_updated_at();

-- RLS: authenticated + anon full access, matching the other scoring tables.
do $$
declare
  tbl text := 'member_sprint_manual_criteria_scores';
begin
  execute format('alter table public.%I enable row level security', tbl);
  execute format('grant select, insert, update, delete on public.%I to anon, authenticated', tbl);

  execute format('drop policy if exists "Authenticated can select" on public.%I', tbl);
  execute format('drop policy if exists "Authenticated can insert" on public.%I', tbl);
  execute format('drop policy if exists "Authenticated can update" on public.%I', tbl);
  execute format('drop policy if exists "Authenticated can delete" on public.%I', tbl);
  execute format('drop policy if exists "Anon can select" on public.%I', tbl);
  execute format('drop policy if exists "Anon can insert" on public.%I', tbl);
  execute format('drop policy if exists "Anon can update" on public.%I', tbl);
  execute format('drop policy if exists "Anon can delete" on public.%I', tbl);

  execute format('create policy "Authenticated can select" on public.%I for select to authenticated using (true)', tbl);
  execute format('create policy "Authenticated can insert" on public.%I for insert to authenticated with check (true)', tbl);
  execute format('create policy "Authenticated can update" on public.%I for update to authenticated using (true) with check (true)', tbl);
  execute format('create policy "Authenticated can delete" on public.%I for delete to authenticated using (true)', tbl);
  execute format('create policy "Anon can select" on public.%I for select to anon using (true)', tbl);
  execute format('create policy "Anon can insert" on public.%I for insert to anon with check (true)', tbl);
  execute format('create policy "Anon can update" on public.%I for update to anon using (true) with check (true)', tbl);
  execute format('create policy "Anon can delete" on public.%I for delete to anon using (true)', tbl);
end $$;
