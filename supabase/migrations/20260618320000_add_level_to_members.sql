alter table public.members
add column if not exists level public.requirement_level;

create index if not exists members_level_idx
on public.members (level);
