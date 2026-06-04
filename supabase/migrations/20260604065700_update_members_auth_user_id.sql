do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'members'
      and column_name = 'user_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'members'
      and column_name = 'auth_user_id'
  ) then
    alter table public.members rename column user_id to auth_user_id;
  end if;
end $$;

alter table public.members
add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;

alter table public.members
add column if not exists trello_member_id text;

alter table public.members
add column if not exists full_name text,
add column if not exists email text,
add column if not exists first_name text,
add column if not exists last_name text;

create unique index if not exists members_email_key on public.members(email);
create unique index if not exists members_trello_member_id_key on public.members(trello_member_id);
