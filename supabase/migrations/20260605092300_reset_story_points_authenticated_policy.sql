do $$
declare
  policy_record record;
begin
  if to_regclass('public.story_points') is null then
    return;
  end if;

  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'story_points'
  loop
    execute format(
      'drop policy if exists %I on public.story_points',
      policy_record.policyname
    );
  end loop;

  grant select, insert, update, delete on public.story_points to authenticated;

  alter table public.story_points enable row level security;

  create policy "Authenticated users can manage story points"
  on public.story_points
  for all
  to authenticated
  using (true)
  with check (true);
end $$;
