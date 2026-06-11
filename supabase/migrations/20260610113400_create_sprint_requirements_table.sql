create table if not exists public.sprint_requirements (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references public.sprints(id) on delete cascade,
  name varchar not null,
  code varchar not null,
  level public.requirement_level not null,
  min double precision,
  max double precision,
  value double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sprint_requirements_sprint_code_level_key unique (sprint_id, code, level)
);

create index if not exists sprint_requirements_sprint_id_idx
on public.sprint_requirements (sprint_id);

create index if not exists sprint_requirements_code_idx
on public.sprint_requirements (code);

create index if not exists sprint_requirements_level_idx
on public.sprint_requirements (level);

create or replace function public.set_sprint_requirements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_sprint_requirements_updated_at
on public.sprint_requirements;

create trigger set_sprint_requirements_updated_at
before update on public.sprint_requirements
for each row
execute function public.set_sprint_requirements_updated_at();

alter table public.sprint_requirements enable row level security;

drop policy if exists "Sprint requirements are readable by authenticated users"
on public.sprint_requirements;
drop policy if exists "Sprint requirements are insertable by authenticated users"
on public.sprint_requirements;
drop policy if exists "Sprint requirements are updatable by authenticated users"
on public.sprint_requirements;
drop policy if exists "Sprint requirements are deletable by authenticated users"
on public.sprint_requirements;

create policy "Sprint requirements are readable by authenticated users"
on public.sprint_requirements
for select
to authenticated
using (true);

create policy "Sprint requirements are insertable by authenticated users"
on public.sprint_requirements
for insert
to authenticated
with check (true);

create policy "Sprint requirements are updatable by authenticated users"
on public.sprint_requirements
for update
to authenticated
using (true)
with check (true);

create policy "Sprint requirements are deletable by authenticated users"
on public.sprint_requirements
for delete
to authenticated
using (true);
