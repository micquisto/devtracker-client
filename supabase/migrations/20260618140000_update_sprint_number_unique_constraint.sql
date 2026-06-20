alter table public.sprints
drop constraint if exists uq_sprint_number_per_project_year;

drop index if exists public.uq_sprint_number_per_project_period;

create unique index uq_sprint_number_per_project_period
on public.sprints (
  project_id,
  sprint_year,
  sprint_quarter,
  sprint_number
);
