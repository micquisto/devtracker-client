create table if not exists public.planning_poker_sprint_focus (
  sprint_id uuid primary key references public.sprints(id) on delete cascade,
  active_task_id uuid references public.tasks(id) on delete set null,
  opened_by_member_id uuid references public.members(id) on delete set null,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planning_poker_sprint_focus_active_task_id_idx
on public.planning_poker_sprint_focus (active_task_id);

create or replace function public.set_planning_poker_sprint_focus_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_planning_poker_sprint_focus_updated_at
on public.planning_poker_sprint_focus;

create trigger set_planning_poker_sprint_focus_updated_at
before update on public.planning_poker_sprint_focus
for each row
execute function public.set_planning_poker_sprint_focus_updated_at();

alter table public.planning_poker_sprint_focus enable row level security;

drop policy if exists "Planning poker sprint focus is readable by authenticated users"
on public.planning_poker_sprint_focus;
drop policy if exists "Planning poker sprint focus is insertable by authenticated users"
on public.planning_poker_sprint_focus;
drop policy if exists "Planning poker sprint focus is updatable by authenticated users"
on public.planning_poker_sprint_focus;
drop policy if exists "Planning poker sprint focus is deletable by authenticated users"
on public.planning_poker_sprint_focus;

create policy "Planning poker sprint focus is readable by authenticated users"
on public.planning_poker_sprint_focus
for select
to authenticated
using (true);

create policy "Planning poker sprint focus is insertable by authenticated users"
on public.planning_poker_sprint_focus
for insert
to authenticated
with check (true);

create policy "Planning poker sprint focus is updatable by authenticated users"
on public.planning_poker_sprint_focus
for update
to authenticated
using (true)
with check (true);

create policy "Planning poker sprint focus is deletable by authenticated users"
on public.planning_poker_sprint_focus
for delete
to authenticated
using (true);

grant select, insert, update, delete on public.planning_poker_sprint_focus to anon;

drop policy if exists "Anon can select" on public.planning_poker_sprint_focus;
drop policy if exists "Anon can insert" on public.planning_poker_sprint_focus;
drop policy if exists "Anon can update" on public.planning_poker_sprint_focus;
drop policy if exists "Anon can delete" on public.planning_poker_sprint_focus;

create policy "Anon can select"
on public.planning_poker_sprint_focus
for select
to anon
using (true);

create policy "Anon can insert"
on public.planning_poker_sprint_focus
for insert
to anon
with check (true);

create policy "Anon can update"
on public.planning_poker_sprint_focus
for update
to anon
using (true)
with check (true);

create policy "Anon can delete"
on public.planning_poker_sprint_focus
for delete
to anon
using (true);

do $$
begin
  alter publication supabase_realtime add table public.planning_poker_sprint_focus;
exception
  when duplicate_object then null;
end $$;

alter table public.planning_poker_sprint_focus replica identity full;
