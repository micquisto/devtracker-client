create table if not exists public.accountabilities_team_goals (
  id uuid primary key default gen_random_uuid(),
  sprint_year integer not null,
  sprint_month integer not null,
  comment_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accountabilities_team_goals_month_check
    check (sprint_month >= 1 and sprint_month <= 12),
  constraint accountabilities_team_goals_text_check
    check (char_length(btrim(comment_text)) > 0)
);

create index if not exists accountabilities_team_goals_period_idx
on public.accountabilities_team_goals (sprint_year, sprint_month, created_at);

create or replace function public.set_accountabilities_team_goals_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_accountabilities_team_goals_updated_at
on public.accountabilities_team_goals;

create trigger set_accountabilities_team_goals_updated_at
before update on public.accountabilities_team_goals
for each row
execute function public.set_accountabilities_team_goals_updated_at();

alter table public.accountabilities_team_goals enable row level security;

drop policy if exists "Team goals readable by authenticated"
on public.accountabilities_team_goals;
drop policy if exists "Team goals insertable by authenticated"
on public.accountabilities_team_goals;
drop policy if exists "Team goals updatable by authenticated"
on public.accountabilities_team_goals;
drop policy if exists "Team goals deletable by authenticated"
on public.accountabilities_team_goals;
drop policy if exists "Anon can select"
on public.accountabilities_team_goals;
drop policy if exists "Anon can insert"
on public.accountabilities_team_goals;
drop policy if exists "Anon can update"
on public.accountabilities_team_goals;
drop policy if exists "Anon can delete"
on public.accountabilities_team_goals;

create policy "Team goals readable by authenticated"
on public.accountabilities_team_goals
for select
to authenticated
using (true);

create policy "Team goals insertable by authenticated"
on public.accountabilities_team_goals
for insert
to authenticated
with check (true);

create policy "Team goals updatable by authenticated"
on public.accountabilities_team_goals
for update
to authenticated
using (true)
with check (true);

create policy "Team goals deletable by authenticated"
on public.accountabilities_team_goals
for delete
to authenticated
using (true);

create policy "Anon can select"
on public.accountabilities_team_goals
for select
to anon
using (true);

create policy "Anon can insert"
on public.accountabilities_team_goals
for insert
to anon
with check (true);

create policy "Anon can update"
on public.accountabilities_team_goals
for update
to anon
using (true)
with check (true);

create policy "Anon can delete"
on public.accountabilities_team_goals
for delete
to anon
using (true);

grant select, insert, update, delete on public.accountabilities_team_goals to anon;
grant select, insert, update, delete on public.accountabilities_team_goals to authenticated;
