alter table public.members
add column if not exists sprint_approved boolean;

update public.members
set sprint_approved = false
where sprint_approved is null;

alter table public.members
alter column sprint_approved set default false,
alter column sprint_approved set not null;
