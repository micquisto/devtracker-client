-- Default criteria set = original seeded criteria values per level
-- (intern, junior, middle, senior, lead), one grading set per level.
-- Middle did not exist in the original seed; its values sit halfway
-- between junior and senior.

insert into public.critera_set (set_name, set_code, version)
values ('Default', 'default', '1.0.0.1')
on conflict (set_code) do nothing;

insert into public.criteria (level, name, code, type, min, max, value, weight, sort_number)
values
  ('intern'::public.requirement_level, 'Productivity', 'productivity_intern_default', 'productivity'::public.criteria_type, 6, 15, 75, 30, 1),
  ('intern'::public.requirement_level, 'Efficiency', 'efficiency_intern_default', 'efficiency'::public.criteria_type, 80, 100, 75, 30, 2),
  ('intern'::public.requirement_level, 'Quality', 'quality_intern_default', 'quality'::public.criteria_type, 5, 5, 75, 30, 3),
  ('intern'::public.requirement_level, 'Collaboration', 'collaboration_intern_default', 'collaboration'::public.criteria_type, 75, 100, 75, 10, 4),
  ('junior'::public.requirement_level, 'Productivity', 'productivity_junior_default', 'productivity'::public.criteria_type, 8, 30, 75, 30, 1),
  ('junior'::public.requirement_level, 'Efficiency', 'efficiency_junior_default', 'efficiency'::public.criteria_type, 80, 100, 75, 30, 2),
  ('junior'::public.requirement_level, 'Quality', 'quality_junior_default', 'quality'::public.criteria_type, 3, 3, 75, 30, 3),
  ('junior'::public.requirement_level, 'Collaboration', 'collaboration_junior_default', 'collaboration'::public.criteria_type, 75, 100, 75, 10, 4),
  ('middle'::public.requirement_level, 'Productivity', 'productivity_middle_default', 'productivity'::public.criteria_type, 9, 35, 75, 30, 1),
  ('middle'::public.requirement_level, 'Efficiency', 'efficiency_middle_default', 'efficiency'::public.criteria_type, 80, 100, 75, 30, 2),
  ('middle'::public.requirement_level, 'Quality', 'quality_middle_default', 'quality'::public.criteria_type, 2, 2, 75, 30, 3),
  ('middle'::public.requirement_level, 'Collaboration', 'collaboration_middle_default', 'collaboration'::public.criteria_type, 75, 100, 75, 10, 4),
  ('senior'::public.requirement_level, 'Productivity', 'productivity_senior_default', 'productivity'::public.criteria_type, 10, 40, 75, 30, 1),
  ('senior'::public.requirement_level, 'Efficiency', 'efficiency_senior_default', 'efficiency'::public.criteria_type, 80, 100, 75, 30, 2),
  ('senior'::public.requirement_level, 'Quality', 'quality_senior_default', 'quality'::public.criteria_type, 1, 1, 75, 30, 3),
  ('senior'::public.requirement_level, 'Collaboration', 'collaboration_senior_default', 'collaboration'::public.criteria_type, 75, 100, 75, 10, 4),
  ('lead'::public.requirement_level, 'Productivity', 'productivity_lead_default', 'productivity'::public.criteria_type, 10, 40, 75, 30, 1),
  ('lead'::public.requirement_level, 'Efficiency', 'efficiency_lead_default', 'efficiency'::public.criteria_type, 80, 100, 75, 30, 2),
  ('lead'::public.requirement_level, 'Quality', 'quality_lead_default', 'quality'::public.criteria_type, 1, 1, 75, 30, 3),
  ('lead'::public.requirement_level, 'Collaboration', 'collaboration_lead_default', 'collaboration'::public.criteria_type, 75, 100, 75, 10, 4)
on conflict (code) do update
set
  level = excluded.level,
  name = excluded.name,
  type = excluded.type,
  min = excluded.min,
  max = excluded.max,
  value = excluded.value,
  weight = excluded.weight,
  sort_number = excluded.sort_number,
  updated_at = now();

insert into public.grading_set (name, grading_code, level, passing_score)
values
  ('Default - Intern', 'default_intern', 'intern'::public.requirement_level, 75),
  ('Default - Junior', 'default_junior', 'junior'::public.requirement_level, 75),
  ('Default - Middle', 'default_middle', 'middle'::public.requirement_level, 75),
  ('Default - Senior', 'default_senior', 'senior'::public.requirement_level, 75),
  ('Default - Lead', 'default_lead', 'lead'::public.requirement_level, 75)
on conflict (grading_code) do update
set
  name = excluded.name,
  level = excluded.level,
  passing_score = excluded.passing_score,
  updated_at = now();

-- Each default grading set holds exactly its level's four default criteria.
delete from public.grading_set_criteria gsc
using public.grading_set gs
where gsc.grading_set_id = gs.id
  and gs.grading_code in (
    'default_intern',
    'default_junior',
    'default_middle',
    'default_senior',
    'default_lead'
  );

insert into public.grading_set_criteria (grading_set_id, criteria_id, percentage)
select gs.id, c.id, c.weight
from public.grading_set gs
inner join public.criteria c
  on c.code = c.type::text || '_' || gs.level::text || '_default'
where gs.grading_code in (
  'default_intern',
  'default_junior',
  'default_middle',
  'default_senior',
  'default_lead'
)
on conflict (grading_set_id, criteria_id) do update
set
  percentage = excluded.percentage,
  updated_at = now();

-- The Default criteria set contains only the default grading sets.
delete from public.criteria_set_grading_set csgs
using public.critera_set cs
where csgs.criteria_set_id = cs.id
  and cs.set_code = 'default';

insert into public.criteria_set_grading_set (criteria_set_id, grading_set_id)
select cs.id, gs.id
from public.critera_set cs
cross join public.grading_set gs
where cs.set_code = 'default'
  and gs.grading_code in (
    'default_intern',
    'default_junior',
    'default_middle',
    'default_senior',
    'default_lead'
  )
on conflict (criteria_set_id, grading_set_id) do nothing;

-- Every sprint that has already started is evaluated with the Default set.
update public.sprints s
set criteria_set_id = cs.id
from public.critera_set cs
where cs.set_code = 'default'
  and s.start_date::date <= current_date
  and s.criteria_set_id is distinct from cs.id;
