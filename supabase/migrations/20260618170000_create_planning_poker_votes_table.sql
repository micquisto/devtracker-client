create table if not exists public.planning_poker_votes (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references public.sprints(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  story_points double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planning_poker_votes_task_member_key unique (task_id, member_id)
);

create index if not exists planning_poker_votes_sprint_id_idx
on public.planning_poker_votes (sprint_id);

create index if not exists planning_poker_votes_task_id_idx
on public.planning_poker_votes (task_id);

create index if not exists planning_poker_votes_member_id_idx
on public.planning_poker_votes (member_id);

create or replace function public.set_planning_poker_votes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_planning_poker_votes_updated_at
on public.planning_poker_votes;

create trigger set_planning_poker_votes_updated_at
before update on public.planning_poker_votes
for each row
execute function public.set_planning_poker_votes_updated_at();

alter table public.planning_poker_votes enable row level security;

drop policy if exists "Planning poker votes are readable by authenticated users"
on public.planning_poker_votes;
drop policy if exists "Planning poker votes are insertable by authenticated users"
on public.planning_poker_votes;
drop policy if exists "Planning poker votes are updatable by authenticated users"
on public.planning_poker_votes;
drop policy if exists "Planning poker votes are deletable by authenticated users"
on public.planning_poker_votes;

create policy "Planning poker votes are readable by authenticated users"
on public.planning_poker_votes
for select
to authenticated
using (true);

create policy "Planning poker votes are insertable by authenticated users"
on public.planning_poker_votes
for insert
to authenticated
with check (true);

create policy "Planning poker votes are updatable by authenticated users"
on public.planning_poker_votes
for update
to authenticated
using (true)
with check (true);

create policy "Planning poker votes are deletable by authenticated users"
on public.planning_poker_votes
for delete
to authenticated
using (true);
