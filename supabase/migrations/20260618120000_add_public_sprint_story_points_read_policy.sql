grant select on public.sprint_story_points to anon;

drop policy if exists "Sprint scoreboard sprint story points are publicly readable"
on public.sprint_story_points;

create policy "Sprint scoreboard sprint story points are publicly readable"
on public.sprint_story_points
for select
to anon
using (true);
