create table if not exists public.access_control_lists (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  page_id text not null,
  page_label text not null,
  can_access boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_control_lists_role_page_key unique (role, page_id)
);

create index if not exists access_control_lists_role_idx
on public.access_control_lists (role);

create or replace function public.set_access_control_lists_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_access_control_lists_updated_at
on public.access_control_lists;

create trigger set_access_control_lists_updated_at
before update on public.access_control_lists
for each row
execute function public.set_access_control_lists_updated_at();

alter table public.access_control_lists enable row level security;

drop policy if exists "ACLs are readable by authenticated users"
on public.access_control_lists;
drop policy if exists "ACLs are insertable by authenticated users"
on public.access_control_lists;
drop policy if exists "ACLs are updatable by authenticated users"
on public.access_control_lists;
drop policy if exists "ACLs are deletable by authenticated users"
on public.access_control_lists;

create policy "ACLs are readable by authenticated users"
on public.access_control_lists
for select
to authenticated
using (true);

create policy "ACLs are insertable by authenticated users"
on public.access_control_lists
for insert
to authenticated
with check (true);

create policy "ACLs are updatable by authenticated users"
on public.access_control_lists
for update
to authenticated
using (true)
with check (true);

create policy "ACLs are deletable by authenticated users"
on public.access_control_lists
for delete
to authenticated
using (true);
