create table if not exists public.passing_scores (
  id uuid primary key default gen_random_uuid(),
  grading_set_id uuid not null references public.grading_set(id) on delete cascade,
  level public.requirement_level not null,
  value double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint passing_scores_grading_set_id_level_key unique (grading_set_id, level)
);

create index if not exists passing_scores_grading_set_id_idx
on public.passing_scores (grading_set_id);

create index if not exists passing_scores_level_idx
on public.passing_scores (level);

create or replace function public.set_passing_scores_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_passing_scores_updated_at
on public.passing_scores;

create trigger set_passing_scores_updated_at
before update on public.passing_scores
for each row
execute function public.set_passing_scores_updated_at();

alter table public.passing_scores enable row level security;

drop policy if exists "Passing scores are readable by authenticated users"
on public.passing_scores;
drop policy if exists "Passing scores are insertable by authenticated users"
on public.passing_scores;
drop policy if exists "Passing scores are updatable by authenticated users"
on public.passing_scores;
drop policy if exists "Passing scores are deletable by authenticated users"
on public.passing_scores;

create policy "Passing scores are readable by authenticated users"
on public.passing_scores
for select
to authenticated
using (true);

create policy "Passing scores are insertable by authenticated users"
on public.passing_scores
for insert
to authenticated
with check (true);

create policy "Passing scores are updatable by authenticated users"
on public.passing_scores
for update
to authenticated
using (true)
with check (true);

create policy "Passing scores are deletable by authenticated users"
on public.passing_scores
for delete
to authenticated
using (true);

insert into public.passing_scores (grading_set_id, level, value)
select
  gs.id,
  seeded.level,
  seeded.value
from public.grading_set gs
cross join (
  values
    ('intern'::public.requirement_level, 75::double precision),
    ('junior'::public.requirement_level, 75::double precision),
    ('middle'::public.requirement_level, 75::double precision),
    ('senior'::public.requirement_level, 75::double precision),
    ('lead'::public.requirement_level, 75::double precision)
) as seeded(level, value)
where gs.grading_code = 'default'
on conflict (grading_set_id, level) do update
set
  value = excluded.value,
  updated_at = now();
