do $$
begin
  if to_regclass('public.story_points') is null then
    return;
  end if;

  grant select, insert, update, delete on public.story_points to authenticated;

  drop policy if exists "Story points are readable by authenticated users"
  on public.story_points;
  drop policy if exists "Story points are insertable by authenticated users"
  on public.story_points;
  drop policy if exists "Story points are updatable by authenticated users"
  on public.story_points;
  drop policy if exists "Story points are deletable by authenticated users"
  on public.story_points;

  alter table public.story_points enable row level security;

  create policy "Story points are readable by authenticated users"
  on public.story_points
  for select
  to authenticated
  using (true);

  create policy "Story points are insertable by authenticated users"
  on public.story_points
  for insert
  to authenticated
  with check (true);

  create policy "Story points are updatable by authenticated users"
  on public.story_points
  for update
  to authenticated
  using (true)
  with check (true);

  create policy "Story points are deletable by authenticated users"
  on public.story_points
  for delete
  to authenticated
  using (true);
end $$;
