create table if not exists public.criteria_set_criteria (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.critera_set(id) on delete cascade,
  criteria_id uuid not null references public.criteria(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint criteria_set_criteria_set_id_criteria_id_key unique (set_id, criteria_id)
);

create index if not exists criteria_set_criteria_set_id_idx
on public.criteria_set_criteria (set_id);

create index if not exists criteria_set_criteria_criteria_id_idx
on public.criteria_set_criteria (criteria_id);

alter table public.criteria_set_criteria enable row level security;

drop policy if exists "Criteria set criteria are readable by authenticated users"
on public.criteria_set_criteria;
drop policy if exists "Criteria set criteria are insertable by authenticated users"
on public.criteria_set_criteria;
drop policy if exists "Criteria set criteria are updatable by authenticated users"
on public.criteria_set_criteria;
drop policy if exists "Criteria set criteria are deletable by authenticated users"
on public.criteria_set_criteria;

create policy "Criteria set criteria are readable by authenticated users"
on public.criteria_set_criteria
for select
to authenticated
using (true);

create policy "Criteria set criteria are insertable by authenticated users"
on public.criteria_set_criteria
for insert
to authenticated
with check (true);

create policy "Criteria set criteria are updatable by authenticated users"
on public.criteria_set_criteria
for update
to authenticated
using (true)
with check (true);

create policy "Criteria set criteria are deletable by authenticated users"
on public.criteria_set_criteria
for delete
to authenticated
using (true);

insert into public.criteria_set_criteria (set_id, criteria_id)
select
  cs.id,
  c.id
from public.critera_set cs
inner join public.criteria c
  on c.code like '%default%'
where cs.set_code = 'default'
on conflict (set_id, criteria_id) do nothing;
