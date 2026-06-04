create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  trello_member_id text unique,
  full_name text not null,
  email text not null unique,
  first_name text not null,
  last_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.members enable row level security;

create policy "Members are readable by authenticated users"
on public.members
for select
to authenticated
using (true);
