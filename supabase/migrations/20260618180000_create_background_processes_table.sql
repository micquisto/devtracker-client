create table if not exists public.background_processes (
  id uuid primary key default gen_random_uuid(),
  process_key text not null unique,
  label text not null,
  description text not null default '',
  interval_label text,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists background_processes_process_key_idx
on public.background_processes (process_key);

create or replace function public.set_background_processes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_background_processes_updated_at
on public.background_processes;

create trigger set_background_processes_updated_at
before update on public.background_processes
for each row
execute function public.set_background_processes_updated_at();

insert into public.background_processes (
  process_key,
  label,
  description,
  interval_label,
  is_enabled
)
values (
  'sprint_trello_sync',
  'Sprint Trello Sync',
  'Automatically syncs current sprint task data from Trello after page load and every 5 minutes.',
  'Every 5 minutes',
  true
)
on conflict (process_key) do nothing;

alter table public.background_processes enable row level security;

drop policy if exists "Background processes are readable by authenticated users"
on public.background_processes;
drop policy if exists "Background processes are updatable by tech lead and super admin"
on public.background_processes;

create policy "Background processes are readable by authenticated users"
on public.background_processes
for select
to authenticated
using (true);

create policy "Background processes are updatable by tech lead and super admin"
on public.background_processes
for update
to authenticated
using (
  exists (
    select 1
    from public.members
    where members.auth_user_id = auth.uid()
      and members.role::text in ('tech_lead', 'super_admin')
  )
)
with check (
  exists (
    select 1
    from public.members
    where members.auth_user_id = auth.uid()
      and members.role::text in ('tech_lead', 'super_admin')
  )
);
