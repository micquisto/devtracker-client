create table if not exists public.planning_poker_trello_story_point_queue (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references public.sprints(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  trello_card_id text not null,
  story_points integer not null check (story_points >= 0),
  status text not null default 'pending' check (status in ('pending', 'applied', 'failed')),
  last_error text,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create index if not exists planning_poker_trello_story_point_queue_card_status_idx
on public.planning_poker_trello_story_point_queue (trello_card_id, status);

create unique index if not exists planning_poker_trello_story_point_queue_pending_task_idx
on public.planning_poker_trello_story_point_queue (task_id)
where status = 'pending';

alter table public.planning_poker_trello_story_point_queue enable row level security;

drop policy if exists "Planning poker trello queue readable by authenticated users"
on public.planning_poker_trello_story_point_queue;
drop policy if exists "Planning poker trello queue insertable by authenticated users"
on public.planning_poker_trello_story_point_queue;
drop policy if exists "Planning poker trello queue updatable by authenticated users"
on public.planning_poker_trello_story_point_queue;
drop policy if exists "Planning poker trello queue deletable by authenticated users"
on public.planning_poker_trello_story_point_queue;

create policy "Planning poker trello queue readable by authenticated users"
on public.planning_poker_trello_story_point_queue
for select
to authenticated
using (true);

create policy "Planning poker trello queue insertable by authenticated users"
on public.planning_poker_trello_story_point_queue
for insert
to authenticated
with check (true);

create policy "Planning poker trello queue updatable by authenticated users"
on public.planning_poker_trello_story_point_queue
for update
to authenticated
using (true)
with check (true);

create policy "Planning poker trello queue deletable by authenticated users"
on public.planning_poker_trello_story_point_queue
for delete
to authenticated
using (true);

grant select, insert, update, delete on public.planning_poker_trello_story_point_queue to anon;

drop policy if exists "Anon can select" on public.planning_poker_trello_story_point_queue;
drop policy if exists "Anon can insert" on public.planning_poker_trello_story_point_queue;
drop policy if exists "Anon can update" on public.planning_poker_trello_story_point_queue;
drop policy if exists "Anon can delete" on public.planning_poker_trello_story_point_queue;

create policy "Anon can select"
on public.planning_poker_trello_story_point_queue
for select
to anon
using (true);

create policy "Anon can insert"
on public.planning_poker_trello_story_point_queue
for insert
to anon
with check (true);

create policy "Anon can update"
on public.planning_poker_trello_story_point_queue
for update
to anon
using (true)
with check (true);

create policy "Anon can delete"
on public.planning_poker_trello_story_point_queue
for delete
to anon
using (true);

do $$
begin
  alter publication supabase_realtime add table public.planning_poker_trello_story_point_queue;
exception
  when duplicate_object then null;
end $$;

alter table public.planning_poker_trello_story_point_queue replica identity full;
