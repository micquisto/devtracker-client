create table if not exists public.professionalism_items (
  id uuid primary key default gen_random_uuid(),
  name varchar not null,
  code varchar not null,
  description text,
  value double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professionalism_items_code_key unique (code)
);

create index if not exists professionalism_items_code_idx
on public.professionalism_items (code);

create or replace function public.set_professionalism_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_professionalism_items_updated_at
on public.professionalism_items;

create trigger set_professionalism_items_updated_at
before update on public.professionalism_items
for each row
execute function public.set_professionalism_items_updated_at();

alter table public.professionalism_items enable row level security;

drop policy if exists "Professionalism items are readable by authenticated users"
on public.professionalism_items;
drop policy if exists "Professionalism items are insertable by authenticated users"
on public.professionalism_items;
drop policy if exists "Professionalism items are updatable by authenticated users"
on public.professionalism_items;
drop policy if exists "Professionalism items are deletable by authenticated users"
on public.professionalism_items;

create policy "Professionalism items are readable by authenticated users"
on public.professionalism_items
for select
to authenticated
using (true);

create policy "Professionalism items are insertable by authenticated users"
on public.professionalism_items
for insert
to authenticated
with check (true);

create policy "Professionalism items are updatable by authenticated users"
on public.professionalism_items
for update
to authenticated
using (true)
with check (true);

create policy "Professionalism items are deletable by authenticated users"
on public.professionalism_items
for delete
to authenticated
using (true);
