alter table public.members_performance_score
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now();

alter table public.sprint_member_performance_scores
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_members_performance_score_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_members_performance_score_updated_at
on public.members_performance_score;

create trigger set_members_performance_score_updated_at
before update on public.members_performance_score
for each row
execute function public.set_members_performance_score_updated_at();

create or replace function public.set_sprint_member_performance_scores_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_sprint_member_performance_scores_updated_at
on public.sprint_member_performance_scores;

create trigger set_sprint_member_performance_scores_updated_at
before update on public.sprint_member_performance_scores
for each row
execute function public.set_sprint_member_performance_scores_updated_at();
