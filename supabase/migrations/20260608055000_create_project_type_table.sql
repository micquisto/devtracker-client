create table if not exists public.project_type (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active',
  date_created timestamptz not null default now(),
  date_updated timestamptz not null default now(),
  constraint project_type_name_key unique (name),
  constraint project_type_status_check check (status in ('active', 'inactive'))
);

create or replace function public.set_project_type_date_updated()
returns trigger
language plpgsql
as $$
begin
  new.date_updated = now();
  return new;
end;
$$;

drop trigger if exists set_project_type_date_updated on public.project_type;

create trigger set_project_type_date_updated
before update on public.project_type
for each row
execute function public.set_project_type_date_updated();

alter table public.project_type enable row level security;

drop policy if exists "Project types are readable by authenticated users"
on public.project_type;
drop policy if exists "Project types are insertable by authenticated users"
on public.project_type;
drop policy if exists "Project types are updatable by authenticated users"
on public.project_type;
drop policy if exists "Project types are deletable by authenticated users"
on public.project_type;

create policy "Project types are readable by authenticated users"
on public.project_type
for select
to authenticated
using (true);

create policy "Project types are insertable by authenticated users"
on public.project_type
for insert
to authenticated
with check (true);

create policy "Project types are updatable by authenticated users"
on public.project_type
for update
to authenticated
using (true)
with check (true);

create policy "Project types are deletable by authenticated users"
on public.project_type
for delete
to authenticated
using (true);

insert into public.project_type (name, status)
values
  ('General', 'active'),
  ('Business Logic / Back-end Pstock', 'active'),
  ('Business Logic / Back-end - Marketplaces (Amazon, Shopify)', 'active'),
  ('Plumbersstock & SW Plumbing (SEO, images & bugs)', 'active'),
  ('Marketplace Frontend', 'active'),
  ('Go Green', 'active')
on conflict (name) do update
set
  status = excluded.status,
  date_updated = now();
