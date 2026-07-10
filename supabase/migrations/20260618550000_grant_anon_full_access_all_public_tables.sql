-- Tables created after 20260618250000 need anon grants and RLS policies.
-- Re-apply blanket anon access for every current public table.

grant usage on schema public to anon;

grant select, insert, update, delete on all tables in schema public to anon;
grant usage, select on all sequences in schema public to anon;
grant execute on all functions in schema public to anon;

do $$
declare
  tbl text;
begin
  for tbl in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', tbl);

    execute format('drop policy if exists "Anon can select" on public.%I', tbl);
    execute format('drop policy if exists "Anon can insert" on public.%I', tbl);
    execute format('drop policy if exists "Anon can update" on public.%I', tbl);
    execute format('drop policy if exists "Anon can delete" on public.%I', tbl);

    execute format(
      'create policy "Anon can select" on public.%I for select to anon using (true)',
      tbl
    );
    execute format(
      'create policy "Anon can insert" on public.%I for insert to anon with check (true)',
      tbl
    );
    execute format(
      'create policy "Anon can update" on public.%I for update to anon using (true) with check (true)',
      tbl
    );
    execute format(
      'create policy "Anon can delete" on public.%I for delete to anon using (true)',
      tbl
    );
  end loop;
end $$;

grant execute on function public.ensure_background_processes() to anon;

grant execute on function public.update_background_process_run(
  text,
  public.background_process_state_enum,
  text
) to anon;

grant execute on function public.get_member_role_enum_values() to anon;
