alter table public.sprints
add column if not exists planned_tasks_count integer default 0,
add column if not exists adhoc_tasks_count integer default 0,
add column if not exists total_tasks_count integer default 0;

update public.sprints s
set
  planned_tasks_count = coalesce(counts.planned_tasks_count, 0),
  adhoc_tasks_count = coalesce(counts.adhoc_tasks_count, 0),
  total_tasks_count =
    coalesce(counts.planned_tasks_count, 0) + coalesce(counts.adhoc_tasks_count, 0)
from (
  select
    sprint_id,
    count(*) filter (where sp_type = 'planned') as planned_tasks_count,
    count(*) filter (where sp_type = 'adhoc') as adhoc_tasks_count
  from public.tasks
  group by sprint_id
) counts
where s.id = counts.sprint_id;

update public.sprints
set
  planned_tasks_count = 0,
  adhoc_tasks_count = 0,
  total_tasks_count = 0
where planned_tasks_count is null
   or adhoc_tasks_count is null
   or total_tasks_count is null;

alter table public.sprints
alter column planned_tasks_count set default 0,
alter column adhoc_tasks_count set default 0,
alter column total_tasks_count set default 0;

alter table public.sprints
alter column planned_tasks_count set not null,
alter column adhoc_tasks_count set not null,
alter column total_tasks_count set not null;

create or replace function public.refresh_sprint_task_counts(p_sprint_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_planned integer;
  v_adhoc integer;
begin
  if p_sprint_id is null then
    return;
  end if;

  select
    count(*) filter (where sp_type = 'planned'),
    count(*) filter (where sp_type = 'adhoc')
  into v_planned, v_adhoc
  from public.tasks
  where sprint_id = p_sprint_id;

  update public.sprints
  set
    planned_tasks_count = coalesce(v_planned, 0),
    adhoc_tasks_count = coalesce(v_adhoc, 0),
    total_tasks_count = coalesce(v_planned, 0) + coalesce(v_adhoc, 0)
  where id = p_sprint_id;
end;
$$;

create or replace function public.tasks_refresh_sprint_task_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_sprint_task_counts(old.sprint_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.sprint_id is distinct from new.sprint_id then
    perform public.refresh_sprint_task_counts(old.sprint_id);
  end if;

  perform public.refresh_sprint_task_counts(new.sprint_id);
  return new;
end;
$$;

drop trigger if exists tasks_refresh_sprint_task_counts on public.tasks;

create trigger tasks_refresh_sprint_task_counts
after insert or update or delete on public.tasks
for each row
execute function public.tasks_refresh_sprint_task_counts();
