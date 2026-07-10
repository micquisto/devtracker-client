alter table public.members_sprint_scores
add column if not exists completion_rate_override double precision;
