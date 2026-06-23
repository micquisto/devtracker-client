do $$
begin
  if exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'requirement_category'
  ) and not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'requirement_criteria'
  ) then
    alter type public.requirement_category rename to requirement_criteria;
  end if;

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'requirement_criteria'
  ) then
    create type public.requirement_criteria as enum (
      'productivity',
      'efficiency',
      'quality',
      'professionalism',
      'collaboration'
    );
  end if;
end $$;

alter table public.requirements
add column if not exists criteria public.requirement_criteria;

alter table public.sprint_requirements
add column if not exists criteria public.requirement_criteria;

create index if not exists requirements_criteria_idx
on public.requirements (criteria);

create index if not exists sprint_requirements_criteria_idx
on public.sprint_requirements (criteria);

insert into public.projects (trello_board_id, name, status)
values
  ('5oj0clmi', 'PSLite SEO', 'active')
on conflict (name) do update
set
  trello_board_id = excluded.trello_board_id,
  status = excluded.status;
