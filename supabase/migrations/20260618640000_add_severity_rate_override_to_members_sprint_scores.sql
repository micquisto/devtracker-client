alter table public.members_sprint_scores
add column if not exists severity_rate_override double precision;
