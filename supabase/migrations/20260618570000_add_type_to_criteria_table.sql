do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'criteria_type'
  ) then
    create type public.criteria_type as enum (
      'productivity',
      'efficiency',
      'quality',
      'collaboration',
      'professionalism',
      'velocity'
    );
  end if;
end $$;

alter table public.criteria
add column if not exists "type" public.criteria_type;

update public.criteria
set "type" = case
  when lower(code) like '%productivity%' then 'productivity'::public.criteria_type
  when lower(code) like '%efficiency%' then 'efficiency'::public.criteria_type
  when lower(code) like '%quality%' then 'quality'::public.criteria_type
  when lower(code) like '%collaboration%' then 'collaboration'::public.criteria_type
  when lower(code) like '%professionalism%' then 'professionalism'::public.criteria_type
  when lower(code) like '%velocity%' then 'velocity'::public.criteria_type
end
where "type" is distinct from case
  when lower(code) like '%productivity%' then 'productivity'::public.criteria_type
  when lower(code) like '%efficiency%' then 'efficiency'::public.criteria_type
  when lower(code) like '%quality%' then 'quality'::public.criteria_type
  when lower(code) like '%collaboration%' then 'collaboration'::public.criteria_type
  when lower(code) like '%professionalism%' then 'professionalism'::public.criteria_type
  when lower(code) like '%velocity%' then 'velocity'::public.criteria_type
end;

create index if not exists criteria_type_idx
on public.criteria ("type");
