grant select on public.sprints to anon;
grant select on public.tasks to anon;
grant select on public.story_points to anon;
grant select on public.members to anon;
grant select on public.project_type to anon;

drop policy if exists "Current sprint is publicly readable"
on public.sprints;
drop policy if exists "Sprint scoreboard sprints are publicly readable"
on public.sprints;
drop policy if exists "Current sprint tasks are publicly readable"
on public.tasks;
drop policy if exists "Sprint scoreboard tasks are publicly readable"
on public.tasks;
drop policy if exists "Current sprint story points are publicly readable"
on public.story_points;
drop policy if exists "Sprint scoreboard story points are publicly readable"
on public.story_points;
drop policy if exists "Current sprint members are publicly readable"
on public.members;
drop policy if exists "Sprint scoreboard members are publicly readable"
on public.members;
drop policy if exists "Project types are publicly readable"
on public.project_type;

create policy "Sprint scoreboard sprints are publicly readable"
on public.sprints
for select
to anon
using (true);

create policy "Sprint scoreboard tasks are publicly readable"
on public.tasks
for select
to anon
using (true);

create policy "Sprint scoreboard story points are publicly readable"
on public.story_points
for select
to anon
using (true);

create policy "Sprint scoreboard members are publicly readable"
on public.members
for select
to anon
using (
  exists (
    select 1
    from public.tasks
    where tasks.assigned_to = members.id
  )
  or exists (
    select 1
    from public.story_points
    where story_points.member_id = members.id
  )
);

create policy "Project types are publicly readable"
on public.project_type
for select
to anon
using (true);
