do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'project_type_category'
  ) then
    create type public.project_type_category as enum ('admin', 'bugs', 'feature');
  end if;
end $$;

alter table public.project_type
add column if not exists category public.project_type_category;

update public.project_type
set category = 'feature'
where category is null;

alter table public.project_type
alter column category set not null;

insert into public.project_type (name, status, category)
values
  ('Bugs', 'active', 'bugs'),
  ('Code Review', 'active', 'admin'),
  ('Research & Documentation', 'active', 'admin'),
  ('Architecture', 'active', 'admin')
on conflict (name) do update
set
  status = excluded.status,
  category = excluded.category,
  date_updated = now();
