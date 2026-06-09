do $$
declare
  constraint_record record;
begin
  if to_regclass('public.tasks') is null then
    return;
  end if;

  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%sp_type%'
  loop
    execute format(
      'alter table public.tasks drop constraint if exists %I',
      constraint_record.conname
    );
  end loop;

  alter table public.tasks
  add constraint tasks_sp_type_allowed_values
  check (sp_type in ('planned', 'adhoc', 'done'));
end $$;
