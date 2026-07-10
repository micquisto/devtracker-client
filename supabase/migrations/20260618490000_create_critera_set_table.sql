create table if not exists public.critera_set (
  id uuid primary key default gen_random_uuid(),
  set_name varchar not null,
  set_code varchar not null,
  version varchar not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint critera_set_set_code_key unique (set_code)
);

create index if not exists critera_set_set_code_idx
on public.critera_set (set_code);

create or replace function public.set_critera_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_critera_set_updated_at
on public.critera_set;

create trigger set_critera_set_updated_at
before update on public.critera_set
for each row
execute function public.set_critera_set_updated_at();

alter table public.critera_set enable row level security;

drop policy if exists "Critera sets are readable by authenticated users"
on public.critera_set;
drop policy if exists "Critera sets are insertable by authenticated users"
on public.critera_set;
drop policy if exists "Critera sets are updatable by authenticated users"
on public.critera_set;
drop policy if exists "Critera sets are deletable by authenticated users"
on public.critera_set;

create policy "Critera sets are readable by authenticated users"
on public.critera_set
for select
to authenticated
using (true);

create policy "Critera sets are insertable by authenticated users"
on public.critera_set
for insert
to authenticated
with check (true);

create policy "Critera sets are updatable by authenticated users"
on public.critera_set
for update
to authenticated
using (true)
with check (true);

create policy "Critera sets are deletable by authenticated users"
on public.critera_set
for delete
to authenticated
using (true);

insert into public.critera_set (set_name, set_code, version)
values ('Default', 'default', '1.0.0.1')
on conflict (set_code) do update
set
  set_name = excluded.set_name,
  version = excluded.version,
  updated_at = now();
