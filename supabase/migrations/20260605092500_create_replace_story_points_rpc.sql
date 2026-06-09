create or replace function public.replace_story_points_for_sprint(
  p_sprint_id uuid,
  p_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.story_points
  where sprint_id = p_sprint_id;

  if jsonb_array_length(coalesce(p_rows, '[]'::jsonb)) = 0 then
    return;
  end if;

  insert into public.story_points (
    member_id,
    sprint_id,
    project_id,
    assigned_story_points,
    completed_story_points,
    total_bonus_points,
    adhoc_story_points
  )
  select
    row_data.member_id,
    row_data.sprint_id,
    row_data.project_id,
    row_data.assigned_story_points,
    row_data.completed_story_points,
    row_data.total_bonus_points,
    row_data.adhoc_story_points
  from jsonb_to_recordset(p_rows) as row_data(
    member_id uuid,
    sprint_id uuid,
    project_id uuid,
    assigned_story_points numeric,
    completed_story_points numeric,
    total_bonus_points numeric,
    adhoc_story_points numeric
  );
end;
$$;

grant execute on function public.replace_story_points_for_sprint(uuid, jsonb)
to authenticated;
