alter table public.criteria
add column if not exists sort_number integer;

update public.criteria
set sort_number = case
  when code like '%productivity%' then 1
  when code like '%efficiency%' then 2
  when code like '%quality%' then 3
  when code like '%collaboration%' then 4
end
where sort_number is distinct from case
  when code like '%productivity%' then 1
  when code like '%efficiency%' then 2
  when code like '%quality%' then 3
  when code like '%collaboration%' then 4
end;

create index if not exists criteria_sort_number_idx
on public.criteria (sort_number);
