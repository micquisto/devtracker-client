create table if not exists public.accountabilities_challenges (
  id uuid primary key default gen_random_uuid(),
  sprint_year integer not null,
  sprint_month integer not null,
  comment_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accountabilities_challenges_month_check
    check (sprint_month >= 1 and sprint_month <= 12),
  constraint accountabilities_challenges_text_check
    check (char_length(btrim(comment_text)) > 0)
);

create index if not exists accountabilities_challenges_period_idx
on public.accountabilities_challenges (sprint_year, sprint_month, created_at);

create or replace function public.set_accountabilities_challenges_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_accountabilities_challenges_updated_at
on public.accountabilities_challenges;

create trigger set_accountabilities_challenges_updated_at
before update on public.accountabilities_challenges
for each row
execute function public.set_accountabilities_challenges_updated_at();

alter table public.accountabilities_challenges enable row level security;

drop policy if exists "Accountabilities challenges are readable by authenticated users"
on public.accountabilities_challenges;
drop policy if exists "Accountabilities challenges are insertable by authenticated users"
on public.accountabilities_challenges;
drop policy if exists "Accountabilities challenges are updatable by authenticated users"
on public.accountabilities_challenges;
drop policy if exists "Accountabilities challenges are deletable by authenticated users"
on public.accountabilities_challenges;
drop policy if exists "Anon can select"
on public.accountabilities_challenges;
drop policy if exists "Anon can insert"
on public.accountabilities_challenges;
drop policy if exists "Anon can update"
on public.accountabilities_challenges;
drop policy if exists "Anon can delete"
on public.accountabilities_challenges;

create policy "Accountabilities challenges are readable by authenticated users"
on public.accountabilities_challenges
for select
to authenticated
using (true);

create policy "Accountabilities challenges are insertable by authenticated users"
on public.accountabilities_challenges
for insert
to authenticated
with check (true);

create policy "Accountabilities challenges are updatable by authenticated users"
on public.accountabilities_challenges
for update
to authenticated
using (true)
with check (true);

create policy "Accountabilities challenges are deletable by authenticated users"
on public.accountabilities_challenges
for delete
to authenticated
using (true);

create policy "Anon can select"
on public.accountabilities_challenges
for select
to anon
using (true);

create policy "Anon can insert"
on public.accountabilities_challenges
for insert
to anon
with check (true);

create policy "Anon can update"
on public.accountabilities_challenges
for update
to anon
using (true)
with check (true);

create policy "Anon can delete"
on public.accountabilities_challenges
for delete
to anon
using (true);

grant select, insert, update, delete on public.accountabilities_challenges to anon;
grant select, insert, update, delete on public.accountabilities_challenges to authenticated;
