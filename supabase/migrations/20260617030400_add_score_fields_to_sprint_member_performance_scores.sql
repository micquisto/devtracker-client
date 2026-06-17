alter table public.sprint_member_performance_scores
add column if not exists sprint_efficiency_score double precision,
add column if not exists sprint_collaboration_score double precision,
add column if not exists sprint_productivity_rate double precision,
add column if not exists sprint_productivity_score double precision;
