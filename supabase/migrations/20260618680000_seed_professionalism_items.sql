insert into public.professionalism_items (name, code, value)
values
  ('Reliability & Dependability', 'reliability_dependability', 5),
  (
    'Communication & Professional Interaction',
    'communication_professional_interaction',
    5
  ),
  ('Accountability & Integrity', 'accountability_integrity', 5),
  ('Team Conduct & Attitude', 'team_conduct_attitude', 5),
  (
    'Adaptability & Professional Growth',
    'adaptability_professional_growth',
    5
  )
on conflict (code) do update
set
  name = excluded.name,
  value = excluded.value,
  updated_at = now();
