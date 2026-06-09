insert into public.project_type (name, status)
values ('General', 'active')
on conflict (name) do update
set
  status = excluded.status,
  date_updated = now();

alter table public.tasks
add column if not exists project_type uuid;

update public.tasks
set project_type = (
  select id
  from public.project_type
  where name = 'General'
  limit 1
)
where project_type is null;

alter table public.tasks
alter column project_type set not null;

alter table public.tasks
drop constraint if exists tasks_project_type_fkey;

alter table public.tasks
add constraint tasks_project_type_fkey
foreign key (project_type)
references public.project_type(id);

create index if not exists tasks_project_type_idx
on public.tasks(project_type);
