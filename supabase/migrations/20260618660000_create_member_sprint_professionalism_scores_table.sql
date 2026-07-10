create table if not exists public.member_sprint_professionalism_scores (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  sprint_id uuid not null references public.sprints(id) on delete cascade,
  item_id uuid not null references public.professionalism_items(id) on delete cascade,
  score double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_sprint_professionalism_scores_member_sprint_item_key
    unique (member_id, sprint_id, item_id)
);

create index if not exists member_sprint_professionalism_scores_member_id_idx
on public.member_sprint_professionalism_scores (member_id);

create index if not exists member_sprint_professionalism_scores_sprint_id_idx
on public.member_sprint_professionalism_scores (sprint_id);

create index if not exists member_sprint_professionalism_scores_item_id_idx
on public.member_sprint_professionalism_scores (item_id);

create or replace function public.set_member_sprint_professionalism_scores_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_member_sprint_professionalism_scores_updated_at
on public.member_sprint_professionalism_scores;

create trigger set_member_sprint_professionalism_scores_updated_at
before update on public.member_sprint_professionalism_scores
for each row
execute function public.set_member_sprint_professionalism_scores_updated_at();

alter table public.member_sprint_professionalism_scores enable row level security;

drop policy if exists "Member sprint professionalism scores are readable by authenticated users"
on public.member_sprint_professionalism_scores;
drop policy if exists "Member sprint professionalism scores are insertable by authenticated users"
on public.member_sprint_professionalism_scores;
drop policy if exists "Member sprint professionalism scores are updatable by authenticated users"
on public.member_sprint_professionalism_scores;
drop policy if exists "Member sprint professionalism scores are deletable by authenticated users"
on public.member_sprint_professionalism_scores;

create policy "Member sprint professionalism scores are readable by authenticated users"
on public.member_sprint_professionalism_scores
for select
to authenticated
using (true);

create policy "Member sprint professionalism scores are insertable by authenticated users"
on public.member_sprint_professionalism_scores
for insert
to authenticated
with check (true);

create policy "Member sprint professionalism scores are updatable by authenticated users"
on public.member_sprint_professionalism_scores
for update
to authenticated
using (true)
with check (true);

create policy "Member sprint professionalism scores are deletable by authenticated users"
on public.member_sprint_professionalism_scores
for delete
to authenticated
using (true);
