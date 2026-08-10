create table if not exists public.accountabilities_notable_highlights (
  id uuid primary key default gen_random_uuid(),
  sprint_year integer not null,
  sprint_month integer not null,
  comment_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accountabilities_notable_highlights_month_check
    check (sprint_month >= 1 and sprint_month <= 12),
  constraint accountabilities_notable_highlights_text_check
    check (char_length(btrim(comment_text)) > 0)
);

create index if not exists accountabilities_notable_highlights_period_idx
on public.accountabilities_notable_highlights (sprint_year, sprint_month, created_at);

create or replace function public.set_accountabilities_notable_highlights_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_accountabilities_notable_highlights_updated_at
on public.accountabilities_notable_highlights;

create trigger set_accountabilities_notable_highlights_updated_at
before update on public.accountabilities_notable_highlights
for each row
execute function public.set_accountabilities_notable_highlights_updated_at();

alter table public.accountabilities_notable_highlights enable row level security;

drop policy if exists "Notable highlights readable by authenticated"
on public.accountabilities_notable_highlights;
drop policy if exists "Notable highlights insertable by authenticated"
on public.accountabilities_notable_highlights;
drop policy if exists "Notable highlights updatable by authenticated"
on public.accountabilities_notable_highlights;
drop policy if exists "Notable highlights deletable by authenticated"
on public.accountabilities_notable_highlights;
drop policy if exists "Anon can select"
on public.accountabilities_notable_highlights;
drop policy if exists "Anon can insert"
on public.accountabilities_notable_highlights;
drop policy if exists "Anon can update"
on public.accountabilities_notable_highlights;
drop policy if exists "Anon can delete"
on public.accountabilities_notable_highlights;

create policy "Notable highlights readable by authenticated"
on public.accountabilities_notable_highlights
for select
to authenticated
using (true);

create policy "Notable highlights insertable by authenticated"
on public.accountabilities_notable_highlights
for insert
to authenticated
with check (true);

create policy "Notable highlights updatable by authenticated"
on public.accountabilities_notable_highlights
for update
to authenticated
using (true)
with check (true);

create policy "Notable highlights deletable by authenticated"
on public.accountabilities_notable_highlights
for delete
to authenticated
using (true);

create policy "Anon can select"
on public.accountabilities_notable_highlights
for select
to anon
using (true);

create policy "Anon can insert"
on public.accountabilities_notable_highlights
for insert
to anon
with check (true);

create policy "Anon can update"
on public.accountabilities_notable_highlights
for update
to anon
using (true)
with check (true);

create policy "Anon can delete"
on public.accountabilities_notable_highlights
for delete
to anon
using (true);

grant select, insert, update, delete on public.accountabilities_notable_highlights to anon;
grant select, insert, update, delete on public.accountabilities_notable_highlights to authenticated;
