-- planning_poker_sprint_focus was added after the blanket anon grant migration.
grant select, insert, update, delete on public.planning_poker_sprint_focus to anon;

drop policy if exists "Anon can select" on public.planning_poker_sprint_focus;
drop policy if exists "Anon can insert" on public.planning_poker_sprint_focus;
drop policy if exists "Anon can update" on public.planning_poker_sprint_focus;
drop policy if exists "Anon can delete" on public.planning_poker_sprint_focus;

create policy "Anon can select"
on public.planning_poker_sprint_focus
for select
to anon
using (true);

create policy "Anon can insert"
on public.planning_poker_sprint_focus
for insert
to anon
with check (true);

create policy "Anon can update"
on public.planning_poker_sprint_focus
for update
to anon
using (true)
with check (true);

create policy "Anon can delete"
on public.planning_poker_sprint_focus
for delete
to anon
using (true);
