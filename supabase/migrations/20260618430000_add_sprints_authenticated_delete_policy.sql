drop policy if exists "Sprints are deletable by authenticated users"
on public.sprints;

create policy "Sprints are deletable by authenticated users"
on public.sprints
for delete
to authenticated
using (true);
