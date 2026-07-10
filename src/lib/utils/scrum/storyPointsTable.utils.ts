import { getSupabaseRows, supabase } from "@/lib/supabase";
import {
  getMemberColor,
  getMemberInitials,
} from "@/lib/utils/memberColors.utils";
import {
  isScoreboardIncludedMember,
  compareMembersByLastName,
  sortMembersByLastName,
} from "./scoreboardMembers.utils";
import { averageSprintColumns } from "./storypoints.utils";

type MemberSprintScoreRow = {
  sprint_id: string;
  member_id: string;
  completed_story_points: number;
};

type MemberSprintEncodeScoreRow = {
  member_id: string;
  planned_story_points: number | null;
  completed_story_points: number | null;
  weighted_story_points: number | null;
  adhoc_story_points: number | null;
  planned_tasks_count: number | null;
  total_adhoc_count: number | null;
  completed_tasks_count: number | null;
  total_reject_count: number | null;
  accumulated_hours: number | null;
  collaboration: number | null;
  completion_rate_override: number | null;
  severity_rate_override: number | null;
};

type ExistingMemberSprintEncodeRow = {
  member_id: string;
  planned_story_points: number | null;
  completed_story_points: number | null;
  weighted_story_points: number | null;
  adhoc_story_points: number | null;
  planned_tasks_count: number | null;
  completed_tasks_count: number | null;
  total_reject_count: number | null;
  total_adhoc_count: number | null;
  adhoc_rate: number | null;
  is_completed: boolean | null;
  velocity: number | null;
  accumulated_hours: number | null;
  quality_rate: number | null;
  collaboration: number | null;
  completion_rate_override: number | null;
  severity_rate_override: number | null;
};

type SprintStoryPointProjectTypeRow = {
  sprint_id: string;
  model_id: string;
  real_points: number | null;
};

type ProjectTypeRow = {
  id: string;
  name: string;
  category: "admin" | "bugs" | "feature";
};

type SprintTableRow = {
  id: string;
  name: string | null;
  start_date: string;
  end_date: string;
  is_current: number | boolean | null;
  sprint_year: number | null;
  sprint_quarter: number | null;
  sprint_number: number | null;
};

type MemberTableRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  trello_username: string | null;
};

export type StoryPointsSprintColumn = {
  id: string;
  label: string;
  isCurrent: boolean;
};

export type StoryPointsAssigneeRow = {
  id: string;
  name: string;
  initials: string;
  color: string;
  values: number[];
  average: number;
};

export type StoryPointsBreakdownRow = {
  label: string;
  values: number[];
  average: number;
  highlighted?: boolean;
  isTotal?: boolean;
};

export type StoryPointsAssigneeTableData = {
  sprintColumns: StoryPointsSprintColumn[];
  assigneeRows: StoryPointsAssigneeRow[];
  sprintTotals: number[];
  totalAverage: number;
};

export type StoryPointsPageData = StoryPointsAssigneeTableData & {
  breakdownRows: StoryPointsBreakdownRow[];
};

export type StoryPointsPageSourceData = {
  memberScores: MemberSprintScoreRow[];
  sprintStoryPoints: SprintStoryPointProjectTypeRow[];
  sprints: SprintTableRow[];
  members: MemberTableRow[];
  projectTypes: ProjectTypeRow[];
};

export type StoryPointsEncodeMemberRow = {
  memberId: string;
  name: string;
  roleLabel: string;
  planned: number;
  plannedTasks: number;
  adhoc: number;
  adhocTasks: number;
  completed: number;
  completedTasks: number;
  rejected: number;
  hours: number | null;
  collaboration: number | null;
  completionOverride: number | null;
};

export type StoryPointsEncodeDraftRow = StoryPointsEncodeMemberRow & {
  plannedInput: string;
  plannedTasksInput: string;
  adhocInput: string;
  adhocTasksInput: string;
  completedInput: string;
  completedTasksInput: string;
  rejectedInput: string;
  hoursInput: string;
  collaborationInput: string;
  completionOverrideInput: string;
};

export type StoryPointsEncodeUpdateRow = {
  memberId: string;
  plannedStoryPoints: number;
  plannedTasksCount: number;
  adhocStoryPoints: number;
  totalAdhocCount: number;
  completedStoryPoints: number;
  completedTasksCount: number;
  totalRejectCount: number;
  accumulatedHours: number | null;
  collaboration: number | null;
  completionRateOverride: number | null;
};

export const ENCODE_STORY_POINTS_PROJECT_ID =
  "6142b6ec-3b4c-453f-8669-d173fc857aa1";

type ProjectRow = {
  id: string;
  name: string;
};

type SprintStoryPointEncodeBreakdownRow = {
  model_id: string;
  project: string | null;
  points: number | null;
  real_points: number | null;
};

export type StoryPointsEncodeBreakdownProjectColumn = {
  id: string;
  label: string;
};

export type StoryPointsEncodeBreakdownRow = {
  projectTypeId: string;
  label: string;
  category: ProjectTypeRow["category"];
  values: number[];
  total: number;
};

export type StoryPointsEncodeBreakdownDraftRow = {
  projectTypeId: string;
  label: string;
  category: ProjectTypeRow["category"];
  valueInputs: string[];
};

export type StoryPointsEncodeBreakdownUpdateRow = {
  projectTypeId: string;
  projectId: string;
  realPoints: number;
};

export type StoryPointsEncodeBreakdownData = {
  projectColumns: StoryPointsEncodeBreakdownProjectColumn[];
  rows: StoryPointsEncodeBreakdownRow[];
  columnTotals: number[];
  grandTotal: number;
};

export const EMPTY_STORY_POINTS_ENCODE_BREAKDOWN: StoryPointsEncodeBreakdownData =
  {
    projectColumns: [],
    rows: [],
    columnTotals: [],
    grandTotal: 0,
  };

export function buildStoryPointsEncodeBreakdownDraftRows(
  data: StoryPointsEncodeBreakdownData,
): {
  projectColumns: StoryPointsEncodeBreakdownProjectColumn[];
  rows: StoryPointsEncodeBreakdownDraftRow[];
} {
  return {
    projectColumns: data.projectColumns,
    rows: data.rows.map((row) => ({
      projectTypeId: row.projectTypeId,
      label: row.label,
      category: row.category,
      valueInputs: data.projectColumns.map((_, columnIndex) =>
        formatStoryPointsEncodeInputValue(row.values[columnIndex] ?? 0),
      ),
    })),
  };
}

function normalizeEncodeBreakdownProjectKey(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.toLowerCase().replace(/\s+/g, " ");
}

function getEncodeBreakdownPointValue(
  row: SprintStoryPointEncodeBreakdownRow,
): number {
  if (row.real_points !== null && row.real_points !== undefined) {
    return row.real_points;
  }

  if (row.points !== null && row.points !== undefined) {
    return row.points;
  }

  return 0;
}

function resolveEncodeBreakdownProjectIndex(
  projectValue: string | null | undefined,
  projectIndexByKey: Map<string, number>,
): number | null {
  const trimmed = projectValue?.trim();
  if (!trimmed) {
    return null;
  }

  const byId = projectIndexByKey.get(trimmed);
  if (byId !== undefined) {
    return byId;
  }

  const projectKey = normalizeEncodeBreakdownProjectKey(trimmed);
  if (!projectKey) {
    return null;
  }

  return projectIndexByKey.get(projectKey) ?? null;
}

function buildEncodeBreakdownProjectColumns(
  projects: ProjectRow[],
): StoryPointsEncodeBreakdownProjectColumn[] {
  return [...projects]
    .sort((projectA, projectB) => projectA.name.localeCompare(projectB.name))
    .map((project) => ({
      id: project.id,
      label: project.name,
    }));
}

function buildEncodeBreakdownProjectIndexLookup(
  projectColumns: StoryPointsEncodeBreakdownProjectColumn[],
): Map<string, number> {
  const projectIndexByKey = new Map<string, number>();

  projectColumns.forEach((project, index) => {
    projectIndexByKey.set(project.id, index);

    const projectNameKey = normalizeEncodeBreakdownProjectKey(project.label);
    if (projectNameKey) {
      projectIndexByKey.set(projectNameKey, index);
    }
  });

  return projectIndexByKey;
}

export function buildStoryPointsEncodeBreakdownData(
  projectTypes: ProjectTypeRow[],
  projects: ProjectRow[],
  sprintStoryPoints: SprintStoryPointEncodeBreakdownRow[],
): StoryPointsEncodeBreakdownData {
  const projectColumns = buildEncodeBreakdownProjectColumns(projects);
  const projectIndexByKey = buildEncodeBreakdownProjectIndexLookup(projectColumns);

  const pointsByProjectTypeAndProject = new Map<string, number>();

  sprintStoryPoints.forEach((row) => {
    const projectIndex = resolveEncodeBreakdownProjectIndex(
      row.project,
      projectIndexByKey,
    );

    if (projectIndex === null) {
      return;
    }

    const key = `${row.model_id}:${projectIndex}`;
    pointsByProjectTypeAndProject.set(
      key,
      (pointsByProjectTypeAndProject.get(key) ?? 0) +
        getEncodeBreakdownPointValue(row),
    );
  });

  const categoryOrder: Record<ProjectTypeRow["category"], number> = {
    admin: 0,
    bugs: 1,
    feature: 2,
  };

  const rows = [...projectTypes]
    .sort((projectTypeA, projectTypeB) => {
      const categoryDiff =
        categoryOrder[projectTypeA.category] -
        categoryOrder[projectTypeB.category];

      if (categoryDiff !== 0) {
        return categoryDiff;
      }

      return projectTypeA.name.localeCompare(projectTypeB.name);
    })
    .map((projectType) => {
      const values = projectColumns.map(
        (_, projectIndex) =>
          pointsByProjectTypeAndProject.get(
            `${projectType.id}:${projectIndex}`,
          ) ?? 0,
      );

      return {
        projectTypeId: projectType.id,
        label: projectType.name,
        category: projectType.category,
        values,
        total: values.reduce((sum, value) => sum + value, 0),
      };
    });

  const columnTotals = projectColumns.map((_, projectIndex) =>
    rows.reduce((sum, row) => sum + (row.values[projectIndex] ?? 0), 0),
  );

  return {
    projectColumns,
    rows,
    columnTotals,
    grandTotal: columnTotals.reduce((sum, value) => sum + value, 0),
  };
}

export async function loadStoryPointsEncodeBreakdownData(
  sprintId: string,
): Promise<StoryPointsEncodeBreakdownData> {
  const [projectTypes, projects, sprintStoryPoints] = await Promise.all([
    getSupabaseRows<ProjectTypeRow>("project_type", {
      select: "id,name,category",
      order: { column: "name", ascending: true },
    }),
    getSupabaseRows<ProjectRow>("projects", {
      select: "id,name",
      order: { column: "name", ascending: true },
    }),
    getSupabaseRows<SprintStoryPointEncodeBreakdownRow>("sprint_story_points", {
      select: "model_id,project,points,real_points",
      eq: { sprint_id: sprintId, model: "project_type" },
    }),
  ]);

  return buildStoryPointsEncodeBreakdownData(
    projectTypes,
    projects,
    sprintStoryPoints,
  );
}

export async function saveStoryPointsEncodeBreakdownData(
  sprintId: string,
  rows: StoryPointsEncodeBreakdownUpdateRow[],
  projectNameById: Map<string, string>,
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("sprint_story_points")
    .delete()
    .eq("sprint_id", sprintId)
    .eq("model", "project_type");

  if (deleteError) {
    throw deleteError;
  }

  const insertRows = rows
    .map((row) => {
      const projectName = projectNameById.get(row.projectId)?.trim();
      if (!projectName) {
        return null;
      }

      return {
        sprint_id: sprintId,
        model: "project_type" as const,
        model_id: row.projectTypeId,
        project: projectName,
        points: row.realPoints,
        real_points: row.realPoints,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .filter((row) => row.real_points !== 0);

  if (insertRows.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("sprint_story_points")
    .insert(insertRows);

  if (error) {
    throw error;
  }
}

export type ProfessionalismItemColumn = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  value: number;
};

export type StoryPointsEncodeProfessionalismRow = {
  memberId: string;
  name: string;
  roleLabel: string;
  scores: Array<number | null>;
};

export type StoryPointsEncodeProfessionalismDraftRow = {
  memberId: string;
  name: string;
  roleLabel: string;
  scoreInputs: string[];
};

export type StoryPointsEncodeProfessionalismUpdateRow = {
  memberId: string;
  itemId: string;
  score: number;
};

export type StoryPointsEncodeProfessionalismData = {
  itemColumns: ProfessionalismItemColumn[];
  rows: StoryPointsEncodeProfessionalismRow[];
};

export const EMPTY_STORY_POINTS_ENCODE_PROFESSIONALISM: StoryPointsEncodeProfessionalismData =
  {
    itemColumns: [],
    rows: [],
  };

type ProfessionalismItemDbRow = {
  id: string;
  name: string | null;
  code: string | null;
  description: string | null;
  value: number | null;
};

type MemberSprintProfessionalismScoreDbRow = {
  member_id: string;
  item_id: string;
  score: number | null;
};

export function buildStoryPointsEncodeProfessionalismDraftRows(
  data: StoryPointsEncodeProfessionalismData,
): {
  itemColumns: ProfessionalismItemColumn[];
  rows: StoryPointsEncodeProfessionalismDraftRow[];
} {
  return {
    itemColumns: data.itemColumns,
    rows: data.rows.map((row) => ({
      memberId: row.memberId,
      name: row.name,
      roleLabel: row.roleLabel,
      scoreInputs: row.scores.map((score) =>
        score === null ? "" : formatStoryPointsEncodeInputValue(score),
      ),
    })),
  };
}

export function buildStoryPointsEncodeProfessionalismData(
  members: MemberTableRow[],
  items: ProfessionalismItemDbRow[],
  scores: MemberSprintProfessionalismScoreDbRow[],
): StoryPointsEncodeProfessionalismData {
  const itemColumns = [...items]
    .sort((left, right) => {
      const leftLabel = (left.name ?? left.code ?? "").trim().toLowerCase();
      const rightLabel = (right.name ?? right.code ?? "").trim().toLowerCase();
      return leftLabel.localeCompare(rightLabel);
    })
    .map((item) => ({
      id: item.id,
      name: item.name?.trim() || item.code?.trim() || "Item",
      code: item.code?.trim() || "",
      description: item.description,
      value: Number(item.value) || 0,
    }));

  const scoreByMemberAndItem = new Map<string, number>();
  scores.forEach((score) => {
    scoreByMemberAndItem.set(
      `${score.member_id}:${score.item_id}`,
      score.score !== null && Number.isFinite(Number(score.score))
        ? Number(score.score)
        : 0,
    );
  });

  // Same applicable members as the Members encode tab.
  const rows = sortMembersByLastName(
    members.filter((member) => isScoreboardIncludedMember(member)),
  ).map((member) => ({
    memberId: member.id,
    name: getMemberDisplayName(member),
    roleLabel: formatStoryPointsMemberRoleLabel(member.role),
    scores: itemColumns.map((item) => {
      const key = `${member.id}:${item.id}`;
      if (!scoreByMemberAndItem.has(key)) {
        return null;
      }

      const rawScore = scoreByMemberAndItem.get(key) ?? 0;
      const maxValue = Math.max(0, item.value);
      return Math.min(Math.max(rawScore, 0), maxValue);
    }),
  }));

  return {
    itemColumns,
    rows,
  };
}

export async function loadStoryPointsEncodeProfessionalismData(
  sprintId: string,
  members: MemberTableRow[],
): Promise<StoryPointsEncodeProfessionalismData> {
  let items: ProfessionalismItemDbRow[] = [];
  let scores: MemberSprintProfessionalismScoreDbRow[] = [];

  try {
    items = await getSupabaseRows<ProfessionalismItemDbRow>(
      "professionalism_items",
      {
        select: "id,name,code,description,value",
        order: { column: "name", ascending: true },
      },
    );
  } catch {
    items = [];
  }

  try {
    scores = await getSupabaseRows<MemberSprintProfessionalismScoreDbRow>(
      "member_sprint_professionalism_scores",
      {
        select: "member_id,item_id,score",
        eq: { sprint_id: sprintId },
      },
    );
  } catch {
    scores = [];
  }

  return buildStoryPointsEncodeProfessionalismData(members, items, scores);
}

export async function saveStoryPointsEncodeProfessionalismData(
  sprintId: string,
  rows: StoryPointsEncodeProfessionalismUpdateRow[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("member_sprint_professionalism_scores")
    .delete()
    .eq("sprint_id", sprintId);

  if (deleteError) {
    throw deleteError;
  }

  if (rows.length === 0) {
    return;
  }

  const insertRows = rows.map((row) => ({
    sprint_id: sprintId,
    member_id: row.memberId,
    item_id: row.itemId,
    score: row.score,
  }));

  const { error } = await supabase
    .from("member_sprint_professionalism_scores")
    .insert(insertRows);

  if (error) {
    throw error;
  }
}

type SprintEncodeScoreRow = {
  planned_story_points: number | null;
  adhoc_story_points: number | null;
  total_completed_story_points: number | null;
  planned_tasks_count: number | null;
  total_adhoc_count: number | null;
  total_reject_count: number | null;
  blocked_tasks_count: number | null;
  sprint_velocity_average: number | null;
};

export type StoryPointsEncodeSprintDraft = {
  plannedStoryPointsInput: string;
  adhocStoryPointsInput: string;
  completedStoryPointsInput: string;
  plannedTasksCountInput: string;
  adhocTasksCountInput: string;
  rejectCountInput: string;
  blockedTasksCountInput: string;
};

export type StoryPointsEncodeSprintFieldKey = keyof StoryPointsEncodeSprintDraft;

export type StoryPointsEncodeSprintUpdate = {
  plannedStoryPoints: number;
  adhocStoryPoints: number;
  completedStoryPoints: number;
  plannedTasksCount: number;
  adhocTasksCount: number;
  rejectCount: number;
  blockedTasksCount: number;
};

function isCurrentSprintFlag(
  value: number | boolean | null | undefined,
): boolean {
  return value === 1 || value === true;
}

function getMemberDisplayName(member: MemberTableRow): string {
  return (
    member.full_name ||
    [member.first_name, member.last_name].filter(Boolean).join(" ") ||
    "Unnamed member"
  );
}

export function formatStoryPointsMemberRoleLabel(
  role: string | null | undefined,
): string {
  if (!role?.trim()) {
    return "Member";
  }

  return role
    .trim()
    .split("_")
    .filter(Boolean)
    .map(
      (part) =>
        `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`,
    )
    .join(" ");
}

export function formatStoryPointsEncodeInputValue(value: number): string {
  if (value === 0) {
    return "0";
  }

  return Number.isInteger(value) ? String(value) : String(value);
}

export function parseStoryPointsEncodeInputValue(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Story points must be a non-negative number.");
  }

  return parsed;
}

export function parseStoryPointsEncodeCountValue(value: string): number {
  return Math.round(parseStoryPointsEncodeInputValue(value));
}

export function formatStoryPointsEncodeNullableInputValue(
  value: number | null,
): string {
  if (value === null) {
    return "";
  }

  return formatStoryPointsEncodeInputValue(value);
}

export function parseStoryPointsEncodeNullableInputValue(
  value: string,
): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Completion override must be a non-negative number.");
  }

  return parsed;
}

function calculateEncodeAdhocRate(
  plannedTasksCount: number,
  adhocTasksCount: number,
): number {
  if (plannedTasksCount <= 0) {
    return 0;
  }

  return (adhocTasksCount / plannedTasksCount) * 100;
}

export function buildStoryPointsEncodeSprintDraft(
  score: SprintEncodeScoreRow | null,
): StoryPointsEncodeSprintDraft {
  return {
    plannedStoryPointsInput: formatStoryPointsEncodeInputValue(
      score?.planned_story_points ?? 0,
    ),
    adhocStoryPointsInput: formatStoryPointsEncodeInputValue(
      score?.adhoc_story_points ?? 0,
    ),
    completedStoryPointsInput: formatStoryPointsEncodeInputValue(
      score?.total_completed_story_points ?? 0,
    ),
    plannedTasksCountInput: formatStoryPointsEncodeInputValue(
      score?.planned_tasks_count ?? 0,
    ),
    adhocTasksCountInput: formatStoryPointsEncodeInputValue(
      score?.total_adhoc_count ?? 0,
    ),
    rejectCountInput: formatStoryPointsEncodeInputValue(
      score?.total_reject_count ?? 0,
    ),
    blockedTasksCountInput: formatStoryPointsEncodeInputValue(
      score?.blocked_tasks_count ?? 0,
    ),
  };
}

export function buildStoryPointsEncodeMemberRows(
  members: MemberTableRow[],
  scores: MemberSprintEncodeScoreRow[],
): StoryPointsEncodeMemberRow[] {
  const scoresByMemberId = new Map(
    scores.map((score) => [score.member_id, score]),
  );

  return sortMembersByLastName(
    members.filter((member) => isScoreboardIncludedMember(member)),
  ).map((member) => {
      const score = scoresByMemberId.get(member.id);

      return {
        memberId: member.id,
        name: getMemberDisplayName(member),
        roleLabel: formatStoryPointsMemberRoleLabel(member.role),
        planned: score?.planned_story_points ?? 0,
        plannedTasks: score?.planned_tasks_count ?? 0,
        adhoc: score?.adhoc_story_points ?? 0,
        adhocTasks: score?.total_adhoc_count ?? 0,
        completed: score?.completed_story_points ?? 0,
        completedTasks: score?.completed_tasks_count ?? 0,
        rejected: score?.total_reject_count ?? 0,
        hours: score?.accumulated_hours ?? null,
        collaboration: score?.collaboration ?? null,
        completionOverride: score?.completion_rate_override ?? null,
      };
    });
}

export function buildStoryPointsEncodeDraftRows(
  members: MemberTableRow[],
  scores: MemberSprintEncodeScoreRow[],
): StoryPointsEncodeDraftRow[] {
  return buildStoryPointsEncodeMemberRows(members, scores).map((row) => ({
    ...row,
    plannedInput: formatStoryPointsEncodeInputValue(row.planned),
    plannedTasksInput: formatStoryPointsEncodeInputValue(row.plannedTasks),
    adhocInput: formatStoryPointsEncodeInputValue(row.adhoc),
    adhocTasksInput: formatStoryPointsEncodeInputValue(row.adhocTasks),
    completedInput: formatStoryPointsEncodeInputValue(row.completed),
    completedTasksInput: formatStoryPointsEncodeInputValue(row.completedTasks),
    rejectedInput: formatStoryPointsEncodeInputValue(row.rejected),
    hoursInput: formatStoryPointsEncodeNullableInputValue(row.hours),
    collaborationInput: formatStoryPointsEncodeNullableInputValue(
      row.collaboration,
    ),
    completionOverrideInput: formatStoryPointsEncodeNullableInputValue(
      row.completionOverride,
    ),
  }));
}

export async function loadStoryPointsEncodeScores(
  sprintId: string,
): Promise<MemberSprintEncodeScoreRow[]> {
  return getSupabaseRows<MemberSprintEncodeScoreRow>("members_sprint_scores", {
    select:
      "member_id,planned_story_points,completed_story_points,weighted_story_points,adhoc_story_points,planned_tasks_count,total_adhoc_count,completed_tasks_count,total_reject_count,accumulated_hours,collaboration,completion_rate_override,severity_rate_override",
    eq: { sprint_id: sprintId },
  });
}

export async function loadStoryPointsEncodeSprintScore(
  sprintId: string,
): Promise<SprintEncodeScoreRow | null> {
  const rows = await getSupabaseRows<SprintEncodeScoreRow>("sprint_scores", {
    select:
      "planned_story_points,adhoc_story_points,total_completed_story_points,planned_tasks_count,total_adhoc_count,total_reject_count,blocked_tasks_count,sprint_velocity_average",
    eq: { sprint_id: sprintId },
    limit: 1,
  });

  return rows[0] ?? null;
}

export async function loadStoryPointsEncodeData(sprintId: string): Promise<{
  memberScores: MemberSprintEncodeScoreRow[];
  sprintScore: SprintEncodeScoreRow | null;
}> {
  const [memberScores, sprintScore] = await Promise.all([
    loadStoryPointsEncodeScores(sprintId),
    loadStoryPointsEncodeSprintScore(sprintId),
  ]);

  return { memberScores, sprintScore };
}

export async function saveStoryPointsEncodeSprintScore(
  sprintId: string,
  update: StoryPointsEncodeSprintUpdate,
): Promise<void> {
  const existingRows = await getSupabaseRows<SprintEncodeScoreRow>(
    "sprint_scores",
    {
      select: "sprint_velocity_average",
      eq: { sprint_id: sprintId },
      limit: 1,
    },
  );
  const existing = existingRows[0];
  const plannedStoryPoints = Math.round(update.plannedStoryPoints);
  const adhocStoryPoints = Math.round(update.adhocStoryPoints);

  const { error } = await supabase.from("sprint_scores").upsert(
    {
      sprint_id: sprintId,
      planned_story_points: plannedStoryPoints,
      adhoc_story_points: adhocStoryPoints,
      total_story_points: plannedStoryPoints,
      total_completed_story_points: update.completedStoryPoints,
      planned_tasks_count: update.plannedTasksCount,
      total_adhoc_count: update.adhocTasksCount,
      total_reject_count: update.rejectCount,
      blocked_tasks_count: update.blockedTasksCount,
      sprint_velocity_average: existing?.sprint_velocity_average ?? 0,
      adhoc_rate: calculateEncodeAdhocRate(
        update.plannedTasksCount,
        update.adhocTasksCount,
      ),
    },
    { onConflict: "sprint_id" },
  );

  if (error) {
    throw error;
  }
}

export async function saveStoryPointsEncodeData(
  sprintId: string,
  sprintUpdate: StoryPointsEncodeSprintUpdate,
  memberRows: StoryPointsEncodeUpdateRow[],
): Promise<void> {
  await saveStoryPointsEncodeSprintScore(sprintId, sprintUpdate);
  await saveStoryPointsEncodeScores(sprintId, memberRows);
}

export async function saveStoryPointsEncodeScores(
  sprintId: string,
  rows: StoryPointsEncodeUpdateRow[],
): Promise<void> {
  const existingRows = await getSupabaseRows<ExistingMemberSprintEncodeRow>(
    "members_sprint_scores",
    {
      select:
        "member_id,planned_story_points,completed_story_points,weighted_story_points,adhoc_story_points,planned_tasks_count,completed_tasks_count,total_reject_count,total_adhoc_count,adhoc_rate,is_completed,velocity,accumulated_hours,quality_rate,collaboration,completion_rate_override,severity_rate_override",
      eq: { sprint_id: sprintId },
    },
  );
  const existingByMemberId = new Map(
    existingRows.map((row) => [row.member_id, row]),
  );

  const upsertRows = rows.map((row) => {
    const existing = existingByMemberId.get(row.memberId);

    return {
      sprint_id: sprintId,
      member_id: row.memberId,
      planned_story_points: row.plannedStoryPoints,
      completed_story_points: row.completedStoryPoints,
      weighted_story_points: existing?.weighted_story_points ?? 0,
      adhoc_story_points: row.adhocStoryPoints,
      planned_tasks_count: row.plannedTasksCount,
      completed_tasks_count: row.completedTasksCount,
      total_reject_count: row.totalRejectCount,
      total_adhoc_count: row.totalAdhocCount,
      adhoc_rate: existing?.adhoc_rate ?? 0,
      is_completed: existing?.is_completed ?? false,
      velocity: existing?.velocity ?? null,
      accumulated_hours: row.accumulatedHours,
      quality_rate: existing?.quality_rate ?? null,
      collaboration: row.collaboration,
      completion_rate_override: row.completionRateOverride,
      severity_rate_override: existing?.severity_rate_override ?? null,
    };
  });

  if (upsertRows.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("members_sprint_scores")
    .upsert(upsertRows, { onConflict: "sprint_id,member_id" });

  if (error) {
    throw error;
  }
}

export async function saveStoryPointsEncodeStoryPoints(
  sprintId: string,
  memberRows: StoryPointsEncodeUpdateRow[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("story_points")
    .delete()
    .eq("sprint_id", sprintId)
    .eq("project_id", ENCODE_STORY_POINTS_PROJECT_ID);

  if (deleteError) {
    throw deleteError;
  }

  if (memberRows.length === 0) {
    return;
  }

  const insertRows = memberRows.map((row) => {
    const assignedStoryPoints = row.plannedStoryPoints;
    const completedStoryPoints = row.completedStoryPoints;

    return {
      member_id: row.memberId,
      sprint_id: sprintId,
      project_id: ENCODE_STORY_POINTS_PROJECT_ID,
      assigned_story_points: assignedStoryPoints,
      completed_story_points: completedStoryPoints,
      total_bonus_points: Math.max(
        completedStoryPoints - assignedStoryPoints,
        0,
      ),
      adhoc_story_points: row.adhocStoryPoints,
    };
  });

  const { error } = await supabase.from("story_points").insert(insertRows);

  if (error) {
    throw error;
  }
}

function formatSprintColumnLabel(sprint: SprintTableRow): string {
  const startDate = new Date(sprint.start_date);
  if (Number.isFinite(startDate.getTime())) {
    return `${startDate.getMonth() + 1}/${startDate.getDate()}`;
  }

  const endDate = new Date(sprint.end_date);
  if (Number.isFinite(endDate.getTime())) {
    return `${endDate.getMonth() + 1}/${endDate.getDate()}`;
  }

  if (sprint.name?.trim()) {
    return sprint.name.trim();
  }

  return `S${sprint.sprint_number ?? "?"}`;
}

function getSprintSortTimestamp(sprint: SprintTableRow): number {
  const endTimestamp = new Date(sprint.end_date).getTime();
  if (Number.isFinite(endTimestamp)) {
    return endTimestamp;
  }

  const startTimestamp = new Date(sprint.start_date).getTime();
  if (Number.isFinite(startTimestamp)) {
    return startTimestamp;
  }

  const year = sprint.sprint_year ?? 0;
  const number = sprint.sprint_number ?? 0;

  return year * 100 + number;
}

export function getStoryPointsSprintYear(sprint: SprintTableRow): number | null {
  if (sprint.sprint_year !== null && sprint.sprint_year !== undefined) {
    const year = Number(sprint.sprint_year);
    return Number.isFinite(year) ? year : null;
  }

  const endDate = new Date(sprint.end_date);
  if (Number.isFinite(endDate.getTime())) {
    return endDate.getFullYear();
  }

  const startDate = new Date(sprint.start_date);
  if (Number.isFinite(startDate.getTime())) {
    return startDate.getFullYear();
  }

  return null;
}

export function getStoryPointsAvailableYears(
  sprints: SprintTableRow[],
): number[] {
  return [
    ...new Set(
      sprints
        .map((sprint) => getStoryPointsSprintYear(sprint))
        .filter((year): year is number => year !== null),
    ),
  ].sort((yearA, yearB) => yearB - yearA);
}

export function getDefaultStoryPointsYear(years: number[]): number | null {
  if (years.length === 0) {
    return null;
  }

  const currentYear = new Date().getFullYear();
  if (years.includes(currentYear)) {
    return currentYear;
  }

  return years[0];
}

function sortSprintColumns(sprints: SprintTableRow[]): SprintTableRow[] {
  const currentSprint = sprints.find((sprint) => isCurrentSprintFlag(sprint.is_current));
  const otherSprints = sprints
    .filter((sprint) => sprint.id !== currentSprint?.id)
    .sort(
      (sprintA, sprintB) =>
        getSprintSortTimestamp(sprintB) - getSprintSortTimestamp(sprintA),
    );

  return currentSprint ? [currentSprint, ...otherSprints] : otherSprints;
}

function buildSprintColumns(sprints: SprintTableRow[]): StoryPointsSprintColumn[] {
  return sortSprintColumns(sprints).map((sprint) => ({
    id: sprint.id,
    label: formatSprintColumnLabel(sprint),
    isCurrent: isCurrentSprintFlag(sprint.is_current),
  }));
}

export function getStoryPointsSprintsForYear(
  sprints: SprintTableRow[],
  year: number,
): SprintTableRow[] {
  return sortSprintColumns(
    sprints.filter((sprint) => getStoryPointsSprintYear(sprint) === year),
  );
}

export function getStoryPointsEncodeSprintsForYear(
  sprints: SprintTableRow[],
  year: number,
): SprintTableRow[] {
  return getStoryPointsSprintsForYear(sprints, year).filter(
    (sprint) => !isCurrentSprintFlag(sprint.is_current),
  );
}

function formatStoryPointsSprintDate(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return value;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatStoryPointsSprintOptionLabel(
  sprint: SprintTableRow,
): string {
  const name = sprint.name?.trim();
  const startDate = formatStoryPointsSprintDate(sprint.start_date);
  const endDate = formatStoryPointsSprintDate(sprint.end_date);
  const baseName =
    name ??
    (sprint.sprint_number ? `Sprint ${sprint.sprint_number}` : "Sprint");

  if (startDate && endDate) {
    return `${baseName} (${startDate} - ${endDate})`;
  }

  if (startDate) {
    return `${baseName} (${startDate})`;
  }

  return baseName;
}

function sumBreakdownValues(rows: Array<{ values: number[] }>): number[] {
  if (rows.length === 0) {
    return [];
  }

  return rows[0].values.map((_, sprintIndex) =>
    rows.reduce((sum, row) => sum + (row.values[sprintIndex] ?? 0), 0),
  );
}

function buildStoryPointsBreakdownRows(
  sprintColumns: StoryPointsSprintColumn[],
  sprintStoryPoints: SprintStoryPointProjectTypeRow[],
  projectTypes: ProjectTypeRow[],
): StoryPointsBreakdownRow[] {
  const pointsBySprintAndProjectType = sprintStoryPoints.reduce<
    Map<string, Map<string, number>>
  >((bySprint, row) => {
    const pointsByProjectType =
      bySprint.get(row.sprint_id) ?? new Map<string, number>();
    pointsByProjectType.set(
      row.model_id,
      (pointsByProjectType.get(row.model_id) ?? 0) + (row.real_points ?? 0),
    );
    bySprint.set(row.sprint_id, pointsByProjectType);
    return bySprint;
  }, new Map());

  const valuesForProjectType = (projectTypeId: string): number[] =>
    sprintColumns.map(
      (sprint) =>
        pointsBySprintAndProjectType.get(sprint.id)?.get(projectTypeId) ?? 0,
    );

  const toBreakdownRow = (
    label: string,
    values: number[],
    options: { highlighted?: boolean; isTotal?: boolean } = {},
  ): StoryPointsBreakdownRow => ({
    label,
    values,
    average: averageSprintColumns(values),
    ...options,
  });

  const adminTypes = projectTypes
    .filter((projectType) => projectType.category === "admin")
    .sort((projectTypeA, projectTypeB) =>
      projectTypeA.name.localeCompare(projectTypeB.name),
    );
  const bugTypes = projectTypes.filter(
    (projectType) => projectType.category === "bugs",
  );
  const featureTypes = projectTypes
    .filter((projectType) => projectType.category === "feature")
    .sort((projectTypeA, projectTypeB) =>
      projectTypeA.name.localeCompare(projectTypeB.name),
    );

  const adminRows = adminTypes.map((projectType) =>
    toBreakdownRow(projectType.name, valuesForProjectType(projectType.id)),
  );
  const adminTotalRow = toBreakdownRow(
    "Admin Tot",
    sumBreakdownValues(adminRows),
    { highlighted: true },
  );
  const bugRows = bugTypes.map((projectType) =>
    toBreakdownRow(projectType.name, valuesForProjectType(projectType.id), {
      highlighted: true,
    }),
  );
  const featureRows = featureTypes.map((projectType) =>
    toBreakdownRow(projectType.name, valuesForProjectType(projectType.id)),
  );
  const featureTotalRow = toBreakdownRow(
    "Feature Tot",
    sumBreakdownValues(featureRows),
    { highlighted: true },
  );
  const totalRow = toBreakdownRow(
    "Total",
    sumBreakdownValues([adminTotalRow, ...bugRows, featureTotalRow]),
    { highlighted: true, isTotal: true },
  );

  return [
    ...adminRows,
    adminTotalRow,
    ...bugRows,
    ...featureRows,
    featureTotalRow,
    totalRow,
  ];
}

export function buildStoryPointsAssigneeTableData(
  memberScores: MemberSprintScoreRow[],
  members: MemberTableRow[],
  sprintColumns: StoryPointsSprintColumn[],
): StoryPointsAssigneeTableData {
  const scoresByMemberAndSprint = memberScores.reduce<
    Map<string, Map<string, number>>
  >((byMember, row) => {
    const memberScoresBySprint =
      byMember.get(row.member_id) ?? new Map<string, number>();
    memberScoresBySprint.set(
      row.sprint_id,
      (memberScoresBySprint.get(row.sprint_id) ?? 0) +
        (row.completed_story_points ?? 0),
    );
    byMember.set(row.member_id, memberScoresBySprint);
    return byMember;
  }, new Map());

  const membersById = new Map(members.map((member) => [member.id, member]));
  const memberIds = [
    ...new Set([
      ...scoresByMemberAndSprint.keys(),
      ...members
        .filter((member) => isScoreboardIncludedMember(member))
        .map((member) => member.id),
    ]),
  ]
    .filter((memberId) => {
      const member = membersById.get(memberId);
      return member ? isScoreboardIncludedMember(member) : false;
    })
    .sort((memberIdA, memberIdB) => {
      const memberA = membersById.get(memberIdA);
      const memberB = membersById.get(memberIdB);

      if (!memberA || !memberB) {
        return 0;
      }

      return compareMembersByLastName(memberA, memberB);
    });

  const assigneeRows = memberIds
    .map((memberId) => {
      const member = membersById.get(memberId);
      if (!member) return null;

      const name = getMemberDisplayName(member);
      const values = sprintColumns.map(
        (sprint) => scoresByMemberAndSprint.get(memberId)?.get(sprint.id) ?? 0,
      );

      return {
        id: memberId,
        name,
        initials: getMemberInitials(name),
        color: getMemberColor(member, name),
        values,
        average: averageSprintColumns(values),
      };
    })
    .filter((row): row is StoryPointsAssigneeRow => row !== null);

  const sprintTotals = sprintColumns.map((_, sprintIndex) =>
    assigneeRows.reduce((sum, assignee) => sum + assignee.values[sprintIndex], 0),
  );

  return {
    sprintColumns,
    assigneeRows,
    sprintTotals,
    totalAverage: averageSprintColumns(sprintTotals),
  };
}

export function buildStoryPointsPageData(
  memberScores: MemberSprintScoreRow[],
  sprintStoryPoints: SprintStoryPointProjectTypeRow[],
  sprints: SprintTableRow[],
  members: MemberTableRow[],
  projectTypes: ProjectTypeRow[],
): StoryPointsPageData {
  const sprintColumns = buildSprintColumns(sprints);
  const assigneeTable = buildStoryPointsAssigneeTableData(
    memberScores,
    members,
    sprintColumns,
  );
  const breakdownRows = buildStoryPointsBreakdownRows(
    sprintColumns,
    sprintStoryPoints,
    projectTypes,
  );

  return {
    ...assigneeTable,
    breakdownRows,
  };
}

export function buildStoryPointsPageDataForYear(
  source: StoryPointsPageSourceData,
  year: number,
): StoryPointsPageData {
  const sprints = source.sprints.filter(
    (sprint) => getStoryPointsSprintYear(sprint) === year,
  );

  return buildStoryPointsPageData(
    source.memberScores,
    source.sprintStoryPoints,
    sprints,
    source.members,
    source.projectTypes,
  );
}

export async function loadStoryPointsPageSourceData(): Promise<StoryPointsPageSourceData> {
  const [memberScores, sprintStoryPoints, projectTypes, sprints, members] =
    await Promise.all([
      getSupabaseRows<MemberSprintScoreRow>("members_sprint_scores", {
        select: "sprint_id,member_id,completed_story_points",
      }),
      getSupabaseRows<SprintStoryPointProjectTypeRow>("sprint_story_points", {
        select: "sprint_id,model_id,real_points",
        eq: { model: "project_type" },
      }),
      getSupabaseRows<ProjectTypeRow>("project_type", {
        select: "id,name,category",
        order: { column: "name", ascending: true },
      }),
      getSupabaseRows<SprintTableRow>("sprints", {
        select:
          "id,name,start_date,end_date,is_current,sprint_year,sprint_quarter,sprint_number",
      }),
      getSupabaseRows<MemberTableRow>("members", {
        select: "id,full_name,first_name,last_name,role,trello_username",
      }),
    ]);

  return {
    memberScores,
    sprintStoryPoints,
    sprints,
    members,
    projectTypes,
  };
}

export async function loadStoryPointsPageData(): Promise<StoryPointsPageData> {
  const source = await loadStoryPointsPageSourceData();
  const years = getStoryPointsAvailableYears(source.sprints);
  const defaultYear = getDefaultStoryPointsYear(years);

  if (defaultYear === null) {
    return buildStoryPointsPageData(
      source.memberScores,
      source.sprintStoryPoints,
      [],
      source.members,
      source.projectTypes,
    );
  }

  return buildStoryPointsPageDataForYear(source, defaultYear);
}

/** @deprecated Use loadStoryPointsPageData instead. */
export async function loadStoryPointsAssigneeTableData(): Promise<StoryPointsAssigneeTableData> {
  const pageData = await loadStoryPointsPageData();
  return {
    sprintColumns: pageData.sprintColumns,
    assigneeRows: pageData.assigneeRows,
    sprintTotals: pageData.sprintTotals,
    totalAverage: pageData.totalAverage,
  };
}

export function formatStoryPointsCell(value: number): string {
  if (value === 0) return "0";

  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
