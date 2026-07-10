alter table public.sprint_task_scores
add column if not exists member_id uuid references public.members(id) on delete set null;

create index if not exists sprint_task_scores_member_id_idx
on public.sprint_task_scores (member_id);

update public.sprint_task_scores sts
set member_id = t.assigned_to
from public.tasks t
where t.sprint_id = sts.sprint_id
  and t.trello_card_id = sts.trello_card_id
  and t.assigned_to is not null
  and sts.member_id is distinct from t.assigned_to;
