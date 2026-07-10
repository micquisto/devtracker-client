create table if not exists public.criteria (
  id uuid primary key default gen_random_uuid(),
  level public.requirement_level not null,
  name varchar not null,
  code varchar not null,
  min double precision,
  max double precision,
  value double precision,
  weight double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint criteria_code_key unique (code)
);

create index if not exists criteria_level_idx
on public.criteria (level);

create index if not exists criteria_code_idx
on public.criteria (code);

create or replace function public.set_criteria_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_criteria_updated_at
on public.criteria;

create trigger set_criteria_updated_at
before update on public.criteria
for each row
execute function public.set_criteria_updated_at();

alter table public.criteria enable row level security;

drop policy if exists "Criteria are readable by authenticated users"
on public.criteria;
drop policy if exists "Criteria are insertable by authenticated users"
on public.criteria;
drop policy if exists "Criteria are updatable by authenticated users"
on public.criteria;
drop policy if exists "Criteria are deletable by authenticated users"
on public.criteria;

create policy "Criteria are readable by authenticated users"
on public.criteria
for select
to authenticated
using (true);

create policy "Criteria are insertable by authenticated users"
on public.criteria
for insert
to authenticated
with check (true);

create policy "Criteria are updatable by authenticated users"
on public.criteria
for update
to authenticated
using (true)
with check (true);

create policy "Criteria are deletable by authenticated users"
on public.criteria
for delete
to authenticated
using (true);

insert into public.criteria (level, name, code, min, max, value, weight)
values
  ('intern'::public.requirement_level, 'Productivity', 'productivity_intern_default', 6, 15, 75, 30),
  ('intern'::public.requirement_level, 'Efficiency', 'efficiency_intern_default', 80, 100, 75, 30),
  ('intern'::public.requirement_level, 'Quality', 'quality_intern_default', 5, 5, 75, 30),
  ('intern'::public.requirement_level, 'Collaboration', 'collaboration_intern_default', 75, 100, 75, 10),
  ('junior'::public.requirement_level, 'Productivity', 'productivity_junior_default', 8, 30, 75, 30),
  ('junior'::public.requirement_level, 'Efficiency', 'efficiency_junior_default', 80, 100, 75, 30),
  ('junior'::public.requirement_level, 'Quality', 'quality_junior_default', 3, 3, 75, 30),
  ('junior'::public.requirement_level, 'Collaboration', 'collaboration_junior_default', 75, 100, 75, 10),
  ('senior'::public.requirement_level, 'Productivity', 'productivity_senior_default', 10, 40, 75, 30),
  ('senior'::public.requirement_level, 'Efficiency', 'efficiency_senior_default', 80, 100, 75, 30),
  ('senior'::public.requirement_level, 'Quality', 'quality_senior_default', 1, 1, 75, 30),
  ('senior'::public.requirement_level, 'Collaboration', 'collaboration_senior_default', 75, 100, 75, 10),
  ('lead'::public.requirement_level, 'Productivity', 'productivity_lead_default', 10, 40, 75, 30),
  ('lead'::public.requirement_level, 'Efficiency', 'efficiency_lead_default', 80, 100, 75, 30),
  ('lead'::public.requirement_level, 'Quality', 'quality_lead_default', 1, 1, 75, 30),
  ('lead'::public.requirement_level, 'Collaboration', 'collaboration_lead_default', 75, 100, 75, 10)
on conflict (code) do update
set
  level = excluded.level,
  name = excluded.name,
  min = excluded.min,
  max = excluded.max,
  value = excluded.value,
  weight = excluded.weight,
  updated_at = now();
