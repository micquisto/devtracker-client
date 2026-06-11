create table if not exists public.member_merit (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  performance_score double precision,
  merit_rate double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists member_merit_member_id_idx
on public.member_merit (member_id);

create or replace function public.set_member_merit_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_member_merit_updated_at
on public.member_merit;

create trigger set_member_merit_updated_at
before update on public.member_merit
for each row
execute function public.set_member_merit_updated_at();

alter table public.member_merit enable row level security;

drop policy if exists "Member merit rows are readable by authenticated users"
on public.member_merit;
drop policy if exists "Member merit rows are insertable by authenticated users"
on public.member_merit;
drop policy if exists "Member merit rows are updatable by authenticated users"
on public.member_merit;
drop policy if exists "Member merit rows are deletable by authenticated users"
on public.member_merit;

create policy "Member merit rows are readable by authenticated users"
on public.member_merit
for select
to authenticated
using (true);

create policy "Member merit rows are insertable by authenticated users"
on public.member_merit
for insert
to authenticated
with check (true);

create policy "Member merit rows are updatable by authenticated users"
on public.member_merit
for update
to authenticated
using (true)
with check (true);

create policy "Member merit rows are deletable by authenticated users"
on public.member_merit
for delete
to authenticated
using (true);
