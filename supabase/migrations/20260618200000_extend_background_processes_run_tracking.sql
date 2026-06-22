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

do $$
begin
  alter table public.background_processes
    rename column label to name;
exception
  when undefined_table then null;
  when undefined_column then null;
end $$;

do $$
begin
  alter table public.background_processes
    rename column interval_label to frequency;
exception
  when undefined_table then null;
  when undefined_column then null;
end $$;

alter table public.background_processes
  add column if not exists last_run_at timestamptz,
  add column if not exists last_completed_at timestamptz,
  add column if not exists last_error text;

alter table public.background_processes
  add column if not exists state public.background_process_state_enum;

update public.background_processes
set state = 'idle'
where state is null;

alter table public.background_processes
  alter column state set default 'idle';

alter table public.background_processes
  alter column state set not null;

create or replace function public.update_background_process_run(
  p_process_key text,
  p_state public.background_process_state_enum,
  p_last_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.background_processes
  set
    state = p_state,
    last_run_at = case
      when p_state = 'processing' then now()
      else last_run_at
    end,
    last_completed_at = case
      when p_state in ('success', 'failed') then now()
      else last_completed_at
    end,
    last_error = case
      when p_state = 'failed' then nullif(trim(p_last_error), '')
      when p_state = 'success' then null
      else last_error
    end
  where process_key = p_process_key;

  if not found then
    raise exception 'Background process % not found', p_process_key;
  end if;
end;
$$;

grant execute on function public.update_background_process_run(
  text,
  public.background_process_state_enum,
  text
) to authenticated;
