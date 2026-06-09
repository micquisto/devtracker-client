drop function if exists public.replace_story_points_for_sprint(uuid, jsonb);

create or replace function public.replace_story_points_for_sprint(
  p_sprint_id uuid,
  p_rows jsonb,
  p_update_assigned boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  drop table if exists pg_temp.replace_story_points_existing;

  create temp table replace_story_points_existing
  on commit drop
  as
  select
    member_id,
    assigned_story_points
  from public.story_points
  where sprint_id = p_sprint_id;

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
    case
      when p_update_assigned then row_data.assigned_story_points
      else coalesce(existing.assigned_story_points, row_data.assigned_story_points, 0)
    end as assigned_story_points,
    row_data.completed_story_points,
    greatest(
      row_data.completed_story_points -
      case
        when p_update_assigned then row_data.assigned_story_points
        else coalesce(existing.assigned_story_points, row_data.assigned_story_points, 0)
      end,
      0
    ) as total_bonus_points,
    row_data.adhoc_story_points
  from jsonb_to_recordset(p_rows) as row_data(
    member_id uuid,
    sprint_id uuid,
    project_id uuid,
    assigned_story_points numeric,
    completed_story_points numeric,
    total_bonus_points numeric,
    adhoc_story_points numeric
  )
  left join pg_temp.replace_story_points_existing existing
    on existing.member_id = row_data.member_id;
end;
$$;

grant execute on function public.replace_story_points_for_sprint(uuid, jsonb, boolean)
to authenticated;
