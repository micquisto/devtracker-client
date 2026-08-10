create table if not exists public.accountabilities_ongoing_projects (
  id uuid primary key default gen_random_uuid(),
  sprint_year integer not null,
  sprint_month integer not null,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accountabilities_ongoing_projects_month_check
    check (sprint_month >= 1 and sprint_month <= 12),
  constraint accountabilities_ongoing_projects_name_check
    check (char_length(btrim(name)) > 0)
);

create index if not exists accountabilities_ongoing_projects_period_idx
on public.accountabilities_ongoing_projects (sprint_year, sprint_month, sort_order, created_at);

create table if not exists public.accountabilities_ongoing_project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.accountabilities_ongoing_projects (id)
    on delete cascade,
  comment_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accountabilities_ongoing_project_comments_text_check
    check (char_length(btrim(comment_text)) > 0)
);

create index if not exists accountabilities_ongoing_project_comments_project_idx
on public.accountabilities_ongoing_project_comments (project_id, created_at);

create or replace function public.set_accountabilities_ongoing_projects_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_accountabilities_ongoing_projects_updated_at
on public.accountabilities_ongoing_projects;

create trigger set_accountabilities_ongoing_projects_updated_at
before update on public.accountabilities_ongoing_projects
for each row
execute function public.set_accountabilities_ongoing_projects_updated_at();

create or replace function public.set_accountabilities_ongoing_project_comments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_accountabilities_ongoing_project_comments_updated_at
on public.accountabilities_ongoing_project_comments;

create trigger set_accountabilities_ongoing_project_comments_updated_at
before update on public.accountabilities_ongoing_project_comments
for each row
execute function public.set_accountabilities_ongoing_project_comments_updated_at();

alter table public.accountabilities_ongoing_projects enable row level security;
alter table public.accountabilities_ongoing_project_comments enable row level security;

drop policy if exists "Accountabilities ongoing projects are readable by authenticated users"
on public.accountabilities_ongoing_projects;
drop policy if exists "Accountabilities ongoing projects are insertable by authenticated users"
on public.accountabilities_ongoing_projects;
drop policy if exists "Accountabilities ongoing projects are updatable by authenticated users"
on public.accountabilities_ongoing_projects;
drop policy if exists "Accountabilities ongoing projects are deletable by authenticated users"
on public.accountabilities_ongoing_projects;
drop policy if exists "Anon can select"
on public.accountabilities_ongoing_projects;
drop policy if exists "Anon can insert"
on public.accountabilities_ongoing_projects;
drop policy if exists "Anon can update"
on public.accountabilities_ongoing_projects;
drop policy if exists "Anon can delete"
on public.accountabilities_ongoing_projects;

create policy "Accountabilities ongoing projects are readable by authenticated users"
on public.accountabilities_ongoing_projects
for select
to authenticated
using (true);

create policy "Accountabilities ongoing projects are insertable by authenticated users"
on public.accountabilities_ongoing_projects
for insert
to authenticated
with check (true);

create policy "Accountabilities ongoing projects are updatable by authenticated users"
on public.accountabilities_ongoing_projects
for update
to authenticated
using (true)
with check (true);

create policy "Accountabilities ongoing projects are deletable by authenticated users"
on public.accountabilities_ongoing_projects
for delete
to authenticated
using (true);

create policy "Anon can select"
on public.accountabilities_ongoing_projects
for select
to anon
using (true);

create policy "Anon can insert"
on public.accountabilities_ongoing_projects
for insert
to anon
with check (true);

create policy "Anon can update"
on public.accountabilities_ongoing_projects
for update
to anon
using (true)
with check (true);

create policy "Anon can delete"
on public.accountabilities_ongoing_projects
for delete
to anon
using (true);

drop policy if exists "Accountabilities ongoing project comments are readable by authenticated users"
on public.accountabilities_ongoing_project_comments;
drop policy if exists "Accountabilities ongoing project comments are insertable by authenticated users"
on public.accountabilities_ongoing_project_comments;
drop policy if exists "Accountabilities ongoing project comments are updatable by authenticated users"
on public.accountabilities_ongoing_project_comments;
drop policy if exists "Accountabilities ongoing project comments are deletable by authenticated users"
on public.accountabilities_ongoing_project_comments;
drop policy if exists "Anon can select"
on public.accountabilities_ongoing_project_comments;
drop policy if exists "Anon can insert"
on public.accountabilities_ongoing_project_comments;
drop policy if exists "Anon can update"
on public.accountabilities_ongoing_project_comments;
drop policy if exists "Anon can delete"
on public.accountabilities_ongoing_project_comments;

create policy "Accountabilities ongoing project comments are readable by authenticated users"
on public.accountabilities_ongoing_project_comments
for select
to authenticated
using (true);

create policy "Accountabilities ongoing project comments are insertable by authenticated users"
on public.accountabilities_ongoing_project_comments
for insert
to authenticated
with check (true);

create policy "Accountabilities ongoing project comments are updatable by authenticated users"
on public.accountabilities_ongoing_project_comments
for update
to authenticated
using (true)
with check (true);

create policy "Accountabilities ongoing project comments are deletable by authenticated users"
on public.accountabilities_ongoing_project_comments
for delete
to authenticated
using (true);

create policy "Anon can select"
on public.accountabilities_ongoing_project_comments
for select
to anon
using (true);

create policy "Anon can insert"
on public.accountabilities_ongoing_project_comments
for insert
to anon
with check (true);

create policy "Anon can update"
on public.accountabilities_ongoing_project_comments
for update
to anon
using (true)
with check (true);

create policy "Anon can delete"
on public.accountabilities_ongoing_project_comments
for delete
to anon
using (true);

grant select, insert, update, delete on public.accountabilities_ongoing_projects to anon;
grant select, insert, update, delete on public.accountabilities_ongoing_projects to authenticated;
grant select, insert, update, delete on public.accountabilities_ongoing_project_comments to anon;
grant select, insert, update, delete on public.accountabilities_ongoing_project_comments to authenticated;
