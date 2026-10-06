-- Criteria -> Grading Set (with per-criteria percentage) -> Criteria Set.
-- Grading sets become level-specific with a single passing score.

alter table public.grading_set
add column if not exists level public.requirement_level not null default 'all';

alter table public.grading_set
add column if not exists passing_score double precision not null default 75;

create index if not exists grading_set_level_idx
on public.grading_set (level);

create table if not exists public.grading_set_criteria (
  id uuid primary key default gen_random_uuid(),
  grading_set_id uuid not null references public.grading_set(id) on delete cascade,
  criteria_id uuid not null references public.criteria(id) on delete cascade,
  percentage double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grading_set_criteria_grading_set_id_criteria_id_key unique (grading_set_id, criteria_id),
  constraint grading_set_criteria_percentage_range check (percentage >= 0 and percentage <= 100)
);

create index if not exists grading_set_criteria_grading_set_id_idx
on public.grading_set_criteria (grading_set_id);

create index if not exists grading_set_criteria_criteria_id_idx
on public.grading_set_criteria (criteria_id);

create or replace function public.set_grading_set_criteria_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_grading_set_criteria_updated_at
on public.grading_set_criteria;

create trigger set_grading_set_criteria_updated_at
before update on public.grading_set_criteria
for each row
execute function public.set_grading_set_criteria_updated_at();

create table if not exists public.criteria_set_grading_set (
  id uuid primary key default gen_random_uuid(),
  criteria_set_id uuid not null references public.critera_set(id) on delete cascade,
  grading_set_id uuid not null references public.grading_set(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint criteria_set_grading_set_criteria_set_id_grading_set_id_key unique (criteria_set_id, grading_set_id)
);

create index if not exists criteria_set_grading_set_criteria_set_id_idx
on public.criteria_set_grading_set (criteria_set_id);

create index if not exists criteria_set_grading_set_grading_set_id_idx
on public.criteria_set_grading_set (grading_set_id);

-- RLS: authenticated + anon full access, matching the other admin tables.
do $$
declare
  tbl text;
begin
  foreach tbl in array array['grading_set_criteria', 'criteria_set_grading_set']
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', tbl);

    execute format('drop policy if exists "Authenticated can select" on public.%I', tbl);
    execute format('drop policy if exists "Authenticated can insert" on public.%I', tbl);
    execute format('drop policy if exists "Authenticated can update" on public.%I', tbl);
    execute format('drop policy if exists "Authenticated can delete" on public.%I', tbl);
    execute format('drop policy if exists "Anon can select" on public.%I', tbl);
    execute format('drop policy if exists "Anon can insert" on public.%I', tbl);
    execute format('drop policy if exists "Anon can update" on public.%I', tbl);
    execute format('drop policy if exists "Anon can delete" on public.%I', tbl);

    execute format('create policy "Authenticated can select" on public.%I for select to authenticated using (true)', tbl);
    execute format('create policy "Authenticated can insert" on public.%I for insert to authenticated with check (true)', tbl);
    execute format('create policy "Authenticated can update" on public.%I for update to authenticated using (true) with check (true)', tbl);
    execute format('create policy "Authenticated can delete" on public.%I for delete to authenticated using (true)', tbl);
    execute format('create policy "Anon can select" on public.%I for select to anon using (true)', tbl);
    execute format('create policy "Anon can insert" on public.%I for insert to anon with check (true)', tbl);
    execute format('create policy "Anon can update" on public.%I for update to anon using (true) with check (true)', tbl);
    execute format('create policy "Anon can delete" on public.%I for delete to anon using (true)', tbl);
  end loop;
end $$;

-- Backfill: turn every criteria set's directly linked criteria into one
-- grading set per level, keeping current weights as percentages and the
-- passing score previously used for that level.
do $$
declare
  cs record;
  lvl public.requirement_level;
  new_grading_set_id uuid;
  resolved_passing double precision;
begin
  for cs in
    select distinct s.id, s.set_name, s.set_code
    from public.critera_set s
    inner join public.criteria_set_criteria link on link.set_id = s.id
  loop
    for lvl in
      select distinct c.level
      from public.criteria_set_criteria link
      inner join public.criteria c on c.id = link.criteria_id
      where link.set_id = cs.id
        and (
          c.level <> 'all'
          or not exists (
            select 1
            from public.criteria_set_criteria l2
            inner join public.criteria c2 on c2.id = l2.criteria_id
            where l2.set_id = cs.id and c2.level <> 'all'
          )
        )
    loop
      select ps.value
      into resolved_passing
      from public.sprints sp
      inner join public.passing_scores ps
        on ps.grading_set_id = sp.grading_set_id
      where sp.criteria_set_id = cs.id
        and ps.level in (lvl, 'all')
      order by (ps.level = lvl) desc, sp.start_date desc nulls last
      limit 1;

      insert into public.grading_set (name, grading_code, level, passing_score)
      values (
        cs.set_name || ' - ' || initcap(lvl::text),
        cs.set_code || '_' || lvl::text,
        lvl,
        coalesce(resolved_passing, 75)
      )
      on conflict (grading_code) do update
      set
        level = excluded.level,
        passing_score = excluded.passing_score,
        updated_at = now()
      returning id into new_grading_set_id;

      -- Level-specific criteria first; "all" criteria fill any missing type.
      insert into public.grading_set_criteria (grading_set_id, criteria_id, percentage)
      select distinct on (coalesce(c.type::text, c.id::text))
        new_grading_set_id,
        c.id,
        least(greatest(coalesce(c.weight, 0), 0), 100)
      from public.criteria_set_criteria link
      inner join public.criteria c on c.id = link.criteria_id
      where link.set_id = cs.id
        and (c.level = lvl or c.level = 'all')
      order by coalesce(c.type::text, c.id::text), (c.level = lvl) desc, c.sort_number nulls last
      on conflict (grading_set_id, criteria_id) do nothing;

      insert into public.criteria_set_grading_set (criteria_set_id, grading_set_id)
      values (cs.id, new_grading_set_id)
      on conflict (criteria_set_id, grading_set_id) do nothing;
    end loop;
  end loop;
end $$;
