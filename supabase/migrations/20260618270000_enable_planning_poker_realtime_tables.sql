do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'planning_poker_votes',
    'tasks',
    'members',
    'sprints'
  ]
  loop
    begin
      execute format(
        'alter publication supabase_realtime add table public.%I',
        tbl
      );
    exception
      when duplicate_object then null;
    end;

    execute format(
      'alter table public.%I replica identity full',
      tbl
    );
  end loop;
end $$;
