alter table if exists public.story_points enable row level security;

do $$
begin
  if to_regclass('public.story_points') is null then
    return;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'story_points'
      and policyname = 'Story points are readable by authenticated users'
  ) then
    create policy "Story points are readable by authenticated users"
    on public.story_points
    for select
    to authenticated
    using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'story_points'
      and policyname = 'Story points are insertable by authenticated users'
  ) then
    create policy "Story points are insertable by authenticated users"
    on public.story_points
    for insert
    to authenticated
    with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'story_points'
      and policyname = 'Story points are updatable by authenticated users'
  ) then
    create policy "Story points are updatable by authenticated users"
    on public.story_points
    for update
    to authenticated
    using (true)
    with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'story_points'
      and policyname = 'Story points are deletable by authenticated users'
  ) then
    create policy "Story points are deletable by authenticated users"
    on public.story_points
    for delete
    to authenticated
    using (true);
  end if;
end $$;
