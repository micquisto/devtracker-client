alter table public.tasks enable row level security;

create policy "Tasks are readable by authenticated users"
on public.tasks
for select
to authenticated
using (true);

create policy "Tasks are insertable by authenticated users"
on public.tasks
for insert
to authenticated
with check (true);

create policy "Tasks are updatable by authenticated users"
on public.tasks
for update
to authenticated
using (true)
with check (true);

create policy "Tasks are deletable by authenticated users"
on public.tasks
for delete
to authenticated
using (true);
