create table if not exists public.grading_set (
  id uuid primary key default gen_random_uuid(),
  name varchar not null,
  grading_code varchar not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grading_set_grading_code_key unique (grading_code)
);

create index if not exists grading_set_grading_code_idx
on public.grading_set (grading_code);

create or replace function public.set_grading_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_grading_set_updated_at
on public.grading_set;

create trigger set_grading_set_updated_at
before update on public.grading_set
for each row
execute function public.set_grading_set_updated_at();

alter table public.grading_set enable row level security;

drop policy if exists "Grading sets are readable by authenticated users"
on public.grading_set;
drop policy if exists "Grading sets are insertable by authenticated users"
on public.grading_set;
drop policy if exists "Grading sets are updatable by authenticated users"
on public.grading_set;
drop policy if exists "Grading sets are deletable by authenticated users"
on public.grading_set;

create policy "Grading sets are readable by authenticated users"
on public.grading_set
for select
to authenticated
using (true);

create policy "Grading sets are insertable by authenticated users"
on public.grading_set
for insert
to authenticated
with check (true);

create policy "Grading sets are updatable by authenticated users"
on public.grading_set
for update
to authenticated
using (true)
with check (true);

create policy "Grading sets are deletable by authenticated users"
on public.grading_set
for delete
to authenticated
using (true);

insert into public.grading_set (name, grading_code)
values ('Default', 'default')
on conflict (grading_code) do update
set
  name = excluded.name,
  updated_at = now();
