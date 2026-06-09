do $$
begin
  if to_regclass('public.tasks') is null then
    return;
  end if;

  alter table public.tasks
  drop constraint if exists chk_completed_has_timestamp;

  alter table public.tasks
  drop constraint if exists chk_completion_percentage;

  alter table public.tasks
  drop constraint if exists tasks_is_completed_allowed_values;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'is_completed'
  ) then
    alter table public.tasks
    add column is_completed text not null default 'pending';
  else
    alter table public.tasks
    alter column is_completed drop default;

    alter table public.tasks
    alter column is_completed type text
    using case
      when is_completed::text in ('true', 'completed') then 'completed'
      when is_completed::text in ('incompleted', 'incomplete') then 'incompleted'
      else 'pending'
    end;

    alter table public.tasks
    alter column is_completed set default 'pending';

    alter table public.tasks
    alter column is_completed set not null;
  end if;

  update public.tasks
  set
    is_completed = case
      when lower(trim(coalesce(trello_list_name, ''))) in (
        'current sprint',
        'in development',
        'for dev deployment'
      ) then 'pending'
      else 'completed'
    end,
    completed_at = case
      when lower(trim(coalesce(trello_list_name, ''))) in (
        'current sprint',
        'in development',
        'for dev deployment'
      ) then null
      else coalesce(completed_at, trello_last_synced_at, now())
    end,
    completion_percentage = case
      when lower(trim(coalesce(trello_list_name, ''))) in (
        'current sprint',
        'in development',
        'for dev deployment'
      ) then 0
      else 100
    end;

  alter table public.tasks
  add constraint tasks_is_completed_allowed_values
  check (is_completed in ('pending', 'completed', 'incompleted'));

  alter table public.tasks
  add constraint chk_completed_has_timestamp
  check (is_completed <> 'completed' or completed_at is not null);

  alter table public.tasks
  add constraint chk_completion_percentage
  check (completion_percentage between 0 and 100);
end $$;
