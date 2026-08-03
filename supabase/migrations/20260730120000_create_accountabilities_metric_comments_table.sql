create table if not exists public.accountabilities_metric_comments (
  id uuid primary key default gen_random_uuid(),
  sprint_year integer not null,
  sprint_month integer not null,
  metric_key text not null,
  comment_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accountabilities_metric_comments_month_check
    check (sprint_month >= 1 and sprint_month <= 12),
  constraint accountabilities_metric_comments_metric_key_check
    check (
      metric_key in (
        'productivity',
        'efficiency',
        'quality',
        'collaboration',
        'velocity',
        'professionalism'
      )
    ),
  constraint accountabilities_metric_comments_text_check
    check (char_length(btrim(comment_text)) > 0)
);

create index if not exists accountabilities_metric_comments_period_idx
on public.accountabilities_metric_comments (sprint_year, sprint_month, metric_key);

create or replace function public.set_accountabilities_metric_comments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_accountabilities_metric_comments_updated_at
on public.accountabilities_metric_comments;

create trigger set_accountabilities_metric_comments_updated_at
before update on public.accountabilities_metric_comments
for each row
execute function public.set_accountabilities_metric_comments_updated_at();

alter table public.accountabilities_metric_comments enable row level security;

drop policy if exists "Accountabilities metric comments are readable by authenticated users"
on public.accountabilities_metric_comments;
drop policy if exists "Accountabilities metric comments are insertable by authenticated users"
on public.accountabilities_metric_comments;
drop policy if exists "Accountabilities metric comments are updatable by authenticated users"
on public.accountabilities_metric_comments;
drop policy if exists "Accountabilities metric comments are deletable by authenticated users"
on public.accountabilities_metric_comments;
drop policy if exists "Anon can select"
on public.accountabilities_metric_comments;
drop policy if exists "Anon can insert"
on public.accountabilities_metric_comments;
drop policy if exists "Anon can update"
on public.accountabilities_metric_comments;
drop policy if exists "Anon can delete"
on public.accountabilities_metric_comments;

create policy "Accountabilities metric comments are readable by authenticated users"
on public.accountabilities_metric_comments
for select
to authenticated
using (true);

create policy "Accountabilities metric comments are insertable by authenticated users"
on public.accountabilities_metric_comments
for insert
to authenticated
with check (true);

create policy "Accountabilities metric comments are updatable by authenticated users"
on public.accountabilities_metric_comments
for update
to authenticated
using (true)
with check (true);

create policy "Accountabilities metric comments are deletable by authenticated users"
on public.accountabilities_metric_comments
for delete
to authenticated
using (true);

create policy "Anon can select"
on public.accountabilities_metric_comments
for select
to anon
using (true);

create policy "Anon can insert"
on public.accountabilities_metric_comments
for insert
to anon
with check (true);

create policy "Anon can update"
on public.accountabilities_metric_comments
for update
to anon
using (true)
with check (true);

create policy "Anon can delete"
on public.accountabilities_metric_comments
for delete
to anon
using (true);

grant select, insert, update, delete on public.accountabilities_metric_comments to anon;
grant select, insert, update, delete on public.accountabilities_metric_comments to authenticated;
