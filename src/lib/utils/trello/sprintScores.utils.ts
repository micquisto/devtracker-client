import { getSupabaseRows, supabase } from "@/lib/supabase";
import {
  getWeightedStoryPointsCutoffStartDate,
  isWeightedStoryPointsEnabledForSprint,
} from "../scrum/weightedStoryPoints.utils";
import { isForPlanningTrelloList } from "./trello.listNames";
import {
  resolveSprintBlockedTasksCount,
} from "./sprintBlockedTrello.utils";
import type { TrelloSprintCard } from "./trello.utils";

export type SprintScoreTaskRow = {
  assigned_to: string | null;
  sp_type: "planned" | "adhoc" | "done" | "blocked";
  story_points: number;
  real_story_points: number | null;
  weighted_story_points: number | null;
  trello_list_name: string;
};

export type SprintTaskScoreRejectRow = {
  member_id: string | null;
  reject_count: number | null;
};

export type MemberSprintScoreComputedRow = {
  member_id: string;
  planned_story_points: number;
  completed_story_points: number;
  weighted_story_points: number;
  adhoc_story_points: number;
  planned_tasks_count: number;
  completed_tasks_count: number;
  total_reject_count: number;
  total_adhoc_count: number;
  adhoc_rate: number;
  is_completed: boolean;
};

export type SprintScoreInsertRow = {
  sprint_id: string;
  total_story_points: number;
  planned_story_points: number;
  adhoc_story_points: number;
  sprint_velocity_average: number;
  total_completed_story_points: number;
  planned_tasks_count: number;
  total_reject_count: number;
  total_adhoc_count: number;
  blocked_tasks_count: number;
  adhoc_rate: number;
};

type ExistingMemberSprintScoreRow = {
  member_id: string;
  velocity: number | null;
  accumulated_hours: number | null;
  quality_rate: number | null;
  collaboration: number | null;
  completion_rate_override: number | null;
  severity_rate_override: number | null;
};

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

function isPlannedOrAdhocSpType(
  spType: SprintScoreTaskRow["sp_type"],
): boolean {
  return spType === "planned" || spType === "adhoc";
}

function isCompletedTaskList(listName: string): boolean {
  const normalizedListName = normalizeLabel(listName);

  return (
    !isForPlanningTrelloList(listName) &&
    normalizedListName !== "current sprint" &&
    normalizedListName !== "in development"
  );
}

function getCompletedStoryPoints(task: SprintScoreTaskRow): number {
  return task.real_story_points ?? 0;
}

function getWeightedStoryPoints(task: SprintScoreTaskRow): number {
  return task.weighted_story_points ?? 0;
}

function calculateAdhocRate(
  plannedTasksCount: number,
  adhocTasksCount: number,
): number {
  if (plannedTasksCount <= 0) {
    return 0;
  }

  return (adhocTasksCount / plannedTasksCount) * 100;
}

export function buildMemberSprintScoreRows(
  tasks: SprintScoreTaskRow[],
  taskScoreRows: SprintTaskScoreRejectRow[],
  sprintStatus: string,
  sprint: { id: string; start_date: string },
  cutoffStartDate: string | null,
): MemberSprintScoreComputedRow[] {
  const memberScores = new Map<string, MemberSprintScoreComputedRow>();
  const isCompleted = sprintStatus === "completed";
  const weightedStoryPointsEnabled = isWeightedStoryPointsEnabledForSprint(
    sprint,
    cutoffStartDate,
  );

  for (const task of tasks) {
    if (!task.assigned_to || !isPlannedOrAdhocSpType(task.sp_type)) {
      continue;
    }

    const existing = memberScores.get(task.assigned_to) ?? {
      member_id: task.assigned_to,
      planned_story_points: 0,
      completed_story_points: 0,
      weighted_story_points: 0,
      adhoc_story_points: 0,
      planned_tasks_count: 0,
      completed_tasks_count: 0,
      total_reject_count: 0,
      total_adhoc_count: 0,
      adhoc_rate: 0,
      is_completed: isCompleted,
    };

    if (task.sp_type === "planned") {
      existing.planned_story_points += task.story_points;
      existing.planned_tasks_count += 1;
    }

    if (task.sp_type === "adhoc") {
      existing.adhoc_story_points += task.story_points;
      existing.total_adhoc_count += 1;
    }

    if (isCompletedTaskList(task.trello_list_name)) {
      existing.completed_story_points += getCompletedStoryPoints(task);
      if (weightedStoryPointsEnabled) {
        existing.weighted_story_points += getWeightedStoryPoints(task);
      }
      existing.completed_tasks_count += 1;
    }

    memberScores.set(task.assigned_to, existing);
  }

  for (const taskScoreRow of taskScoreRows) {
    if (!taskScoreRow.member_id) {
      continue;
    }

    const existing = memberScores.get(taskScoreRow.member_id);
    if (!existing) {
      continue;
    }

    existing.total_reject_count += taskScoreRow.reject_count ?? 0;
  }

  return Array.from(memberScores.values()).map((row) => ({
    ...row,
    adhoc_rate: calculateAdhocRate(row.planned_tasks_count, row.total_adhoc_count),
    is_completed: isCompleted,
  }));
}

export function buildSprintScoreRow(
  sprintId: string,
  memberRows: MemberSprintScoreComputedRow[],
  blockedTasksCount = 0,
): SprintScoreInsertRow {
  const totals = memberRows.reduce(
    (accumulator, row) => {
      accumulator.planned_story_points += row.planned_story_points;
      accumulator.adhoc_story_points += row.adhoc_story_points;
      accumulator.total_story_points += row.planned_story_points;
      accumulator.total_completed_story_points += row.completed_story_points;
      accumulator.planned_tasks_count += row.planned_tasks_count;
      accumulator.total_reject_count += row.total_reject_count;
      accumulator.total_adhoc_count += row.total_adhoc_count;
      return accumulator;
    },
    {
      planned_story_points: 0,
      adhoc_story_points: 0,
      total_story_points: 0,
      total_completed_story_points: 0,
      planned_tasks_count: 0,
      total_reject_count: 0,
      total_adhoc_count: 0,
    },
  );

  const sprintVelocityAverage =
    memberRows.length > 0
      ? memberRows.reduce(
          (sum, row) => sum + row.completed_story_points,
          0,
        ) / memberRows.length
      : 0;

  return {
    sprint_id: sprintId,
    total_story_points: totals.total_story_points,
    planned_story_points: Math.round(totals.planned_story_points),
    adhoc_story_points: Math.round(totals.adhoc_story_points),
    sprint_velocity_average: sprintVelocityAverage,
    total_completed_story_points: totals.total_completed_story_points,
    planned_tasks_count: totals.planned_tasks_count,
    total_reject_count: totals.total_reject_count,
    total_adhoc_count: totals.total_adhoc_count,
    blocked_tasks_count: blockedTasksCount,
    adhoc_rate: calculateAdhocRate(
      totals.planned_tasks_count,
      totals.total_adhoc_count,
    ),
  };
}

async function getSprintTaskScoreRejectRows(
  sprintId: string,
): Promise<SprintTaskScoreRejectRow[]> {
  const { data, error } = await supabase
    .from("sprint_task_scores")
    .select("member_id,reject_count")
    .eq("sprint_id", sprintId);

  if (error) {
    throw error;
  }

  return (data ?? []) as SprintTaskScoreRejectRow[];
}

async function getExistingMemberSprintScores(
  sprintId: string,
): Promise<ExistingMemberSprintScoreRow[]> {
  const { data, error } = await supabase
    .from("members_sprint_scores")
    .select(
      "member_id,velocity,accumulated_hours,quality_rate,collaboration,completion_rate_override,severity_rate_override",
    )
    .eq("sprint_id", sprintId);

  if (error) {
    throw error;
  }

  return (data ?? []) as ExistingMemberSprintScoreRow[];
}

export async function replaceSprintScores(
  sprintId: string,
  memberRows: MemberSprintScoreComputedRow[],
  blockedTasksCount = 0,
): Promise<void> {
  const sprintScoreRow = buildSprintScoreRow(
    sprintId,
    memberRows,
    blockedTasksCount,
  );

  const { error } = await supabase
    .from("sprint_scores")
    .upsert(sprintScoreRow, { onConflict: "sprint_id" });

  if (error) {
    throw error;
  }
}

export async function replaceMembersSprintScores(
  sprintId: string,
  memberRows: MemberSprintScoreComputedRow[],
): Promise<{ upserted: number; deleted: number }> {
  const existingRows = await getExistingMemberSprintScores(sprintId);
  const existingByMemberId = new Map(
    existingRows.map((row) => [row.member_id, row]),
  );
  const incomingMemberIds = new Set(memberRows.map((row) => row.member_id));

  const staleMemberIds = existingRows
    .filter((row) => !incomingMemberIds.has(row.member_id))
    .map((row) => row.member_id);

  let deleted = 0;

  if (staleMemberIds.length > 0) {
    const { data: deletedRows, error: deleteError } = await supabase
      .from("members_sprint_scores")
      .delete()
      .eq("sprint_id", sprintId)
      .in("member_id", staleMemberIds)
      .select("member_id");

    if (deleteError) {
      throw deleteError;
    }

    deleted = deletedRows?.length ?? staleMemberIds.length;
  }

  if (memberRows.length === 0) {
    return { upserted: 0, deleted };
  }

  const rows = memberRows.map((row) => {
    const existing = existingByMemberId.get(row.member_id);

    return {
      sprint_id: sprintId,
      member_id: row.member_id,
      planned_story_points: row.planned_story_points,
      completed_story_points: row.completed_story_points,
      weighted_story_points: row.weighted_story_points,
      adhoc_story_points: row.adhoc_story_points,
      planned_tasks_count: row.planned_tasks_count,
      completed_tasks_count: row.completed_tasks_count,
      total_reject_count: row.total_reject_count,
      total_adhoc_count: row.total_adhoc_count,
      adhoc_rate: row.adhoc_rate,
      is_completed: row.is_completed,
      velocity: existing?.velocity ?? null,
      accumulated_hours: existing?.accumulated_hours ?? null,
      quality_rate: existing?.quality_rate ?? null,
      collaboration: existing?.collaboration ?? null,
      completion_rate_override: existing?.completion_rate_override ?? null,
      severity_rate_override: existing?.severity_rate_override ?? null,
    };
  });

  const { data: upsertedRows, error: upsertError } = await supabase
    .from("members_sprint_scores")
    .upsert(rows, { onConflict: "sprint_id,member_id" })
    .select("member_id");

  if (upsertError) {
    throw upsertError;
  }

  return {
    upserted: upsertedRows?.length ?? rows.length,
    deleted,
  };
}

export async function replaceSprintAndMemberScores(
  sprintId: string,
  sprintStatus: string,
  tasks: SprintScoreTaskRow[],
  trelloCards?: TrelloSprintCard[],
  sprint?: { id: string; start_date: string },
  weightedStoryPointsCutoffStartDate?: string | null,
): Promise<void> {
  const taskScoreRows = await getSprintTaskScoreRejectRows(sprintId);
  const sprintRef =
    sprint ??
    ((
      await getSupabaseRows<{ id: string; start_date: string }>("sprints", {
        select: "id,start_date",
        eq: { id: sprintId },
      })
    )[0] ?? { id: sprintId, start_date: "" });
  const cutoffStartDate =
    weightedStoryPointsCutoffStartDate === undefined
      ? await getWeightedStoryPointsCutoffStartDate()
      : weightedStoryPointsCutoffStartDate;
  const memberRows = buildMemberSprintScoreRows(
    tasks,
    taskScoreRows,
    sprintStatus,
    sprintRef,
    cutoffStartDate,
  );
  const blockedTasksCount = await resolveSprintBlockedTasksCount(trelloCards);

  await replaceSprintScores(sprintId, memberRows, blockedTasksCount);
  await replaceMembersSprintScores(sprintId, memberRows);
}

async function getSprintTasksForMemberScoring(
  sprintId: string,
): Promise<SprintScoreTaskRow[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "assigned_to,sp_type,story_points,real_story_points,weighted_story_points,trello_list_name",
    )
    .eq("sprint_id", sprintId);

  if (error) {
    throw error;
  }

  return (data ?? []) as SprintScoreTaskRow[];
}

export async function finalizeCompletedSprintScores(
  sprintId: string,
): Promise<void> {
  const [tasks, sprint] = await Promise.all([
    getSprintTasksForMemberScoring(sprintId),
    getSupabaseRows<{ id: string; start_date: string }>("sprints", {
      select: "id,start_date",
      eq: { id: sprintId },
    }).then((rows) => rows[0] ?? null),
  ]);

  if (!sprint) {
    throw new Error(`Sprint not found: ${sprintId}`);
  }

  const weightedStoryPointsCutoffStartDate =
    await getWeightedStoryPointsCutoffStartDate();
  await replaceSprintAndMemberScores(
    sprintId,
    "completed",
    tasks,
    undefined,
    sprint,
    weightedStoryPointsCutoffStartDate,
  );
}

export async function clearSprintAndMemberScores(
  sprintId: string,
): Promise<void> {
  const { error: sprintScoresError } = await supabase
    .from("sprint_scores")
    .delete()
    .eq("sprint_id", sprintId);

  if (sprintScoresError) {
    throw sprintScoresError;
  }

  const { error: memberScoresError } = await supabase
    .from("members_sprint_scores")
    .delete()
    .eq("sprint_id", sprintId);

  if (memberScoresError) {
    throw memberScoresError;
  }
}
