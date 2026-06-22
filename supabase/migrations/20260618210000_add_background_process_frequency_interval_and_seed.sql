alter table public.background_processes
  add column if not exists frequency_interval_ms integer;

update public.background_processes
set frequency_interval_ms = 300000
where frequency_interval_ms is null;

alter table public.background_processes
  alter column frequency_interval_ms set default 300000;

alter table public.background_processes
  alter column frequency_interval_ms set not null;

create or replace function public.ensure_background_processes()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.background_processes (
    process_key,
    name,
    description,
    frequency,
    frequency_interval_ms,
    is_enabled,
    state
  )
  values (
    'sprint_trello_sync',
    'Sprint Trello Sync',
    'Automatically syncs current sprint task data from Trello after page load and on a recurring schedule.',
    'Every 5 minutes',
    300000,
    true,
    'idle'
  )
  on conflict (process_key) do nothing;
end;
$$;

grant execute on function public.ensure_background_processes() to authenticated;

insert into public.background_processes (
  process_key,
  name,
  description,
  frequency,
  frequency_interval_ms,
  is_enabled,
  state
)
values (
  'sprint_trello_sync',
  'Sprint Trello Sync',
  'Automatically syncs current sprint task data from Trello after page load and on a recurring schedule.',
  'Every 5 minutes',
  300000,
  true,
  'idle'
)
on conflict (process_key) do update
set
  name = excluded.name,
  description = excluded.description,
  frequency = coalesce(background_processes.frequency, excluded.frequency),
  frequency_interval_ms = coalesce(
    nullif(background_processes.frequency_interval_ms, 0),
    excluded.frequency_interval_ms
  );
