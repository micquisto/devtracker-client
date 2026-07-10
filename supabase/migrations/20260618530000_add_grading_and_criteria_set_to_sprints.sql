alter table public.sprints
add column if not exists grading_set_id uuid references public.grading_set(id) on delete set null;

alter table public.sprints
add column if not exists criteria_set_id uuid references public.critera_set(id) on delete set null;

create index if not exists sprints_grading_set_id_idx
on public.sprints (grading_set_id);

create index if not exists sprints_criteria_set_id_idx
on public.sprints (criteria_set_id);

update public.sprints s
set
  grading_set_id = gs.id,
  criteria_set_id = cs.id
from public.grading_set gs
cross join public.critera_set cs
where gs.grading_code = 'default'
  and cs.set_code = 'default'
  and s.start_date::date <= current_date
  and (
    s.grading_set_id is distinct from gs.id
    or s.criteria_set_id is distinct from cs.id
  );
