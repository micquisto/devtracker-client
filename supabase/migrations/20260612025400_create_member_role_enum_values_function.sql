create or replace function public.get_member_role_enum_values()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array_agg(enum_value.enumlabel::text order by enum_value.enumsortorder),
    array[]::text[]
  )
  from pg_enum enum_value
  join pg_type enum_type
    on enum_type.oid = enum_value.enumtypid
  join pg_namespace enum_namespace
    on enum_namespace.oid = enum_type.typnamespace
  where enum_namespace.nspname = 'public'
    and enum_type.typname = 'member_role_enum';
$$;

grant execute on function public.get_member_role_enum_values()
to authenticated;
