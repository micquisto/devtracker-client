alter table public.sprint_task_scores
add column if not exists task_id uuid references public.tasks(id) on delete cascade;

update public.sprint_task_scores sts
set task_id = matched.task_id
from (
  select distinct on (sts_inner.id)
    sts_inner.id as score_id,
    t.id as task_id
  from public.sprint_task_scores sts_inner
  inner join public.tasks t
    on t.sprint_id = sts_inner.sprint_id
   and t.trello_card_id = sts_inner.trello_card_id
   and t.sp_type in ('planned', 'adhoc')
  where sts_inner.task_id is null
  order by sts_inner.id, t.trello_last_synced_at desc nulls last, t.id
) matched
where sts.id = matched.score_id
  and sts.task_id is null;

delete from public.sprint_task_scores
where task_id is null;

alter table public.sprint_task_scores
alter column task_id set not null;

alter table public.sprint_task_scores
drop constraint if exists sprint_task_scores_sprint_trello_card_key;

create index if not exists sprint_task_scores_sprint_trello_card_idx
on public.sprint_task_scores (sprint_id, trello_card_id);

alter table public.sprint_task_scores
drop constraint if exists sprint_task_scores_sprint_task_id_key;

alter table public.sprint_task_scores
add constraint sprint_task_scores_sprint_task_id_key unique (sprint_id, task_id);

create index if not exists sprint_task_scores_task_id_idx
on public.sprint_task_scores (task_id);
