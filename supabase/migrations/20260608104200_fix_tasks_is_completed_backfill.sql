do $$
begin
  if to_regclass('public.tasks') is null then
    return;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'is_completed'
  ) then
    alter table public.tasks
    add column is_completed boolean not null default false;
  end if;

  update public.tasks
  set
    completed_at = case
      when lower(trim(coalesce(trello_list_name, ''))) not in (
        'current sprint',
        'in development'
      ) then coalesce(completed_at, trello_last_synced_at, now())
      else null
    end,
    is_completed = lower(trim(coalesce(trello_list_name, ''))) not in (
      'current sprint',
      'in development'
    ),
    completion_percentage = case
      when lower(trim(coalesce(trello_list_name, ''))) not in (
        'current sprint',
        'in development'
      ) then 100
      else 0
    end;
end $$;
