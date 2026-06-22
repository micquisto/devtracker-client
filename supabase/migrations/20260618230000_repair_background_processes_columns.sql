do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'background_processes'
      and column_name = 'label'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'background_processes'
      and column_name = 'name'
  ) then
    alter table public.background_processes rename column label to name;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'background_processes'
      and column_name = 'interval_label'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'background_processes'
      and column_name = 'frequency'
  ) then
    alter table public.background_processes rename column interval_label to frequency;
  end if;
end $$;

alter table public.background_processes
  add column if not exists name text,
  add column if not exists description text not null default '',
  add column if not exists frequency text,
  add column if not exists frequency_interval_ms integer,
  add column if not exists last_run_at timestamptz,
  add column if not exists last_completed_at timestamptz,
  add column if not exists last_error text,
  add column if not exists is_enabled boolean not null default true;

do $$
begin
  create type public.background_process_state_enum as enum (
    'idle',
    'processing',
    'success',
    'failed'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.background_processes
  add column if not exists state public.background_process_state_enum;

update public.background_processes
set state = 'idle'
where state is null;

alter table public.background_processes
  alter column state set default 'idle';

update public.background_processes
set
  name = coalesce(nullif(trim(name), ''), 'Sprint Trello Sync'),
  frequency = coalesce(nullif(trim(frequency), ''), 'Every 5 minutes'),
  frequency_interval_ms = coalesce(nullif(frequency_interval_ms, 0), 300000),
  is_enabled = coalesce(is_enabled, true),
  state = coalesce(state, 'idle'::public.background_process_state_enum)
where process_key = 'sprint_trello_sync';

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
