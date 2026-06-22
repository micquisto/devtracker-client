create table if not exists public.planning_poker_sessions (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references public.sprints(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  is_revealed boolean not null default false,
  revealed_at timestamptz,
  revealed_by_member_id uuid references public.members(id) on delete set null,
  is_confirmed boolean not null default false,
  confirmed_story_points double precision,
  confirmed_at timestamptz,
  confirmed_by_member_id uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planning_poker_sessions_task_id_key unique (task_id)
);

create index if not exists planning_poker_sessions_sprint_id_idx
on public.planning_poker_sessions (sprint_id);

create index if not exists planning_poker_sessions_task_id_idx
on public.planning_poker_sessions (task_id);

create or replace function public.set_planning_poker_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_planning_poker_sessions_updated_at
on public.planning_poker_sessions;

create trigger set_planning_poker_sessions_updated_at
before update on public.planning_poker_sessions
for each row
execute function public.set_planning_poker_sessions_updated_at();

alter table public.planning_poker_sessions enable row level security;

drop policy if exists "Planning poker sessions are readable by authenticated users"
on public.planning_poker_sessions;
drop policy if exists "Planning poker sessions are insertable by authenticated users"
on public.planning_poker_sessions;
drop policy if exists "Planning poker sessions are updatable by authenticated users"
on public.planning_poker_sessions;
drop policy if exists "Planning poker sessions are deletable by authenticated users"
on public.planning_poker_sessions;

create policy "Planning poker sessions are readable by authenticated users"
on public.planning_poker_sessions
for select
to authenticated
using (true);

create policy "Planning poker sessions are insertable by authenticated users"
on public.planning_poker_sessions
for insert
to authenticated
with check (true);

create policy "Planning poker sessions are updatable by authenticated users"
on public.planning_poker_sessions
for update
to authenticated
using (true)
with check (true);

create policy "Planning poker sessions are deletable by authenticated users"
on public.planning_poker_sessions
for delete
to authenticated
using (true);

grant select, insert, update, delete on public.planning_poker_sessions to anon;

drop policy if exists "Anon can select" on public.planning_poker_sessions;
drop policy if exists "Anon can insert" on public.planning_poker_sessions;
drop policy if exists "Anon can update" on public.planning_poker_sessions;
drop policy if exists "Anon can delete" on public.planning_poker_sessions;

create policy "Anon can select"
on public.planning_poker_sessions
for select
to anon
using (true);

create policy "Anon can insert"
on public.planning_poker_sessions
for insert
to anon
with check (true);

create policy "Anon can update"
on public.planning_poker_sessions
for update
to anon
using (true)
with check (true);

create policy "Anon can delete"
on public.planning_poker_sessions
for delete
to anon
using (true);

do $$
begin
  alter publication supabase_realtime add table public.planning_poker_sessions;
exception
  when duplicate_object then null;
end $$;

alter table public.planning_poker_sessions replica identity full;
