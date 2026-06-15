drop policy if exists "Members can update their own row"
on public.members;

create policy "Members can update their own row"
on public.members
for update
to authenticated
using (
  auth.uid() = auth_user_id
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
with check (
  auth.uid() = auth_user_id
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
