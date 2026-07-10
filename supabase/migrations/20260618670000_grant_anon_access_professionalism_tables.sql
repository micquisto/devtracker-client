grant select, insert, update, delete on public.professionalism_items to anon;
grant select, insert, update, delete on public.member_sprint_professionalism_scores to anon;

drop policy if exists "Anon can select" on public.professionalism_items;
drop policy if exists "Anon can insert" on public.professionalism_items;
drop policy if exists "Anon can update" on public.professionalism_items;
drop policy if exists "Anon can delete" on public.professionalism_items;

create policy "Anon can select"
on public.professionalism_items
for select
to anon
using (true);

create policy "Anon can insert"
on public.professionalism_items
for insert
to anon
with check (true);

create policy "Anon can update"
on public.professionalism_items
for update
to anon
using (true)
with check (true);

create policy "Anon can delete"
on public.professionalism_items
for delete
to anon
using (true);

drop policy if exists "Anon can select" on public.member_sprint_professionalism_scores;
drop policy if exists "Anon can insert" on public.member_sprint_professionalism_scores;
drop policy if exists "Anon can update" on public.member_sprint_professionalism_scores;
drop policy if exists "Anon can delete" on public.member_sprint_professionalism_scores;

create policy "Anon can select"
on public.member_sprint_professionalism_scores
for select
to anon
using (true);

create policy "Anon can insert"
on public.member_sprint_professionalism_scores
for insert
to anon
with check (true);

create policy "Anon can update"
on public.member_sprint_professionalism_scores
for update
to anon
using (true)
with check (true);

create policy "Anon can delete"
on public.member_sprint_professionalism_scores
for delete
to anon
using (true);
