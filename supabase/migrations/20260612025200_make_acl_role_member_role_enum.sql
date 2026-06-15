alter table public.access_control_lists
alter column role type public.member_role_enum
using role::public.member_role_enum;
