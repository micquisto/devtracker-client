-- Add sort_order for reorderable accountabilities lists.

alter table public.accountabilities_metric_comments
  add column if not exists sort_order integer not null default 0;

alter table public.accountabilities_ongoing_project_comments
  add column if not exists sort_order integer not null default 0;

alter table public.accountabilities_challenges
  add column if not exists sort_order integer not null default 0;

alter table public.accountabilities_plans_next_steps
  add column if not exists sort_order integer not null default 0;

alter table public.accountabilities_team_goals
  add column if not exists sort_order integer not null default 0;

alter table public.accountabilities_notable_highlights
  add column if not exists sort_order integer not null default 0;

-- Backfill existing rows by created_at within each group.
with ranked as (
  select
    id,
    row_number() over (
      partition by sprint_year, sprint_month, metric_key
      order by created_at asc, id asc
    ) as rn
  from public.accountabilities_metric_comments
)
update public.accountabilities_metric_comments as comments
set sort_order = ranked.rn
from ranked
where comments.id = ranked.id;

with ranked as (
  select
    id,
    row_number() over (
      partition by project_id
      order by created_at asc, id asc
    ) as rn
  from public.accountabilities_ongoing_project_comments
)
update public.accountabilities_ongoing_project_comments as comments
set sort_order = ranked.rn
from ranked
where comments.id = ranked.id;

with ranked as (
  select
    id,
    row_number() over (
      partition by sprint_year, sprint_month
      order by created_at asc, id asc
    ) as rn
  from public.accountabilities_challenges
)
update public.accountabilities_challenges as rows
set sort_order = ranked.rn
from ranked
where rows.id = ranked.id;

with ranked as (
  select
    id,
    row_number() over (
      partition by sprint_year, sprint_month
      order by created_at asc, id asc
    ) as rn
  from public.accountabilities_plans_next_steps
)
update public.accountabilities_plans_next_steps as rows
set sort_order = ranked.rn
from ranked
where rows.id = ranked.id;

with ranked as (
  select
    id,
    row_number() over (
      partition by sprint_year, sprint_month
      order by created_at asc, id asc
    ) as rn
  from public.accountabilities_team_goals
)
update public.accountabilities_team_goals as rows
set sort_order = ranked.rn
from ranked
where rows.id = ranked.id;

with ranked as (
  select
    id,
    row_number() over (
      partition by sprint_year, sprint_month
      order by created_at asc, id asc
    ) as rn
  from public.accountabilities_notable_highlights
)
update public.accountabilities_notable_highlights as rows
set sort_order = ranked.rn
from ranked
where rows.id = ranked.id;

create index if not exists accountabilities_metric_comments_sort_idx
on public.accountabilities_metric_comments (sprint_year, sprint_month, metric_key, sort_order);

create index if not exists accountabilities_ongoing_project_comments_sort_idx
on public.accountabilities_ongoing_project_comments (project_id, sort_order);

create index if not exists accountabilities_challenges_sort_idx
on public.accountabilities_challenges (sprint_year, sprint_month, sort_order);

create index if not exists accountabilities_plans_next_steps_sort_idx
on public.accountabilities_plans_next_steps (sprint_year, sprint_month, sort_order);

create index if not exists accountabilities_team_goals_sort_idx
on public.accountabilities_team_goals (sprint_year, sprint_month, sort_order);

create index if not exists accountabilities_notable_highlights_sort_idx
on public.accountabilities_notable_highlights (sprint_year, sprint_month, sort_order);
