do $$
begin
  if exists (
    select 1
    from public.requirements
    group by code
    having count(*) > 1
  ) then
    raise exception 'Cannot make requirements.code unique because duplicate code values already exist.';
  end if;
end $$;

alter table public.requirements
drop constraint if exists requirements_code_level_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.requirements'::regclass
      and conname = 'requirements_code_key'
  ) then
    alter table public.requirements
    add constraint requirements_code_key unique (code);
  end if;
end $$;
