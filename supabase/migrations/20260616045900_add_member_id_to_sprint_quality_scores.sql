alter table public.sprint_quality_scores
add column if not exists member_id uuid references public.members(id) on delete cascade;

create index if not exists sprint_quality_scores_member_id_idx
on public.sprint_quality_scores (member_id);

create index if not exists sprint_quality_scores_sprint_member_idx
on public.sprint_quality_scores (sprint_id, member_id);
