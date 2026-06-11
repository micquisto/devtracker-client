do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'requirement_level'
  ) then
    create type public.requirement_level as enum (
      'intern',
      'junior',
      'middle',
      'senior',
      'lead',
      'all'
    );
  end if;
end $$;

create table if not exists public.requirements (
  id uuid primary key default gen_random_uuid(),
  name varchar not null,
  code varchar not null,
  level public.requirement_level not null,
  min double precision,
  max double precision,
  value double precision,
  date_created timestamptz not null default now(),
  date_updated timestamptz not null default now(),
  constraint requirements_code_level_key unique (code, level)
);

create index if not exists requirements_code_idx
on public.requirements (code);

create index if not exists requirements_level_idx
on public.requirements (level);

create or replace function public.set_requirements_date_updated()
returns trigger
language plpgsql
as $$
begin
  new.date_updated = now();
  return new;
end;
$$;

drop trigger if exists set_requirements_date_updated
on public.requirements;

create trigger set_requirements_date_updated
before update on public.requirements
for each row
execute function public.set_requirements_date_updated();

alter table public.requirements enable row level security;

drop policy if exists "Requirements are readable by authenticated users"
on public.requirements;
drop policy if exists "Requirements are insertable by authenticated users"
on public.requirements;
drop policy if exists "Requirements are updatable by authenticated users"
on public.requirements;
drop policy if exists "Requirements are deletable by authenticated users"
on public.requirements;

create policy "Requirements are readable by authenticated users"
on public.requirements
for select
to authenticated
using (true);

create policy "Requirements are insertable by authenticated users"
on public.requirements
for insert
to authenticated
with check (true);

create policy "Requirements are updatable by authenticated users"
on public.requirements
for update
to authenticated
using (true)
with check (true);

create policy "Requirements are deletable by authenticated users"
on public.requirements
for delete
to authenticated
using (true);
