alter table public.projects enable row level security;

create policy "Projects are readable by authenticated users"
on public.projects
for select
to authenticated
using (true);

create policy "Projects are insertable by authenticated users"
on public.projects
for insert
to authenticated
with check (true);

create policy "Projects are updatable by authenticated users"
on public.projects
for update
to authenticated
using (true)
with check (true);
