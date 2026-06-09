alter table public.sprints enable row level security;

create policy "Sprints are readable by authenticated users"
on public.sprints
for select
to authenticated
using (true);

create policy "Sprints are insertable by authenticated users"
on public.sprints
for insert
to authenticated
with check (true);

create policy "Sprints are updatable by authenticated users"
on public.sprints
for update
to authenticated
using (true)
with check (true);
