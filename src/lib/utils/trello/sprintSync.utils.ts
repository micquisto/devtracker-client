import { getSupabaseRows, supabase } from "@/lib/supabase";
import { getTrelloSprintCards, type TrelloSprintCard } from "./trello.utils";

const TRELLO_CUSTOM_FIELD_NAMES = [
  "Date Completed",
  "Assignee",
  "Severity",
  "Priority",
  "Type",
  "Status",
  "Date Added",
  "Project Type",
];

const TRELLO_LIST_NAMES = [
  "Current Sprint",
  "In Development",
  "For Dev Deployment",
  "On Dev Environment",
  "For Live Deployment",
  "On Live🎉",
  "Blocked",
  "Project Refinement",
  "On-Deck Sprint Backlog",
];

const PLANNING_SP_TYPE_LIST_NAMES = new Set([
  "current sprint",
  "in development",
  "for dev deployment",
]);
const PENDING_COMPLETION_LIST_NAMES = new Set([
  "current sprint",
  "in development",
  "for dev deployment",
]);

const TASK_PROJECT_ID = "6142b6ec-3b4c-453f-8669-d173fc857aa1";
const TRELLO_REQUIRED_MEMBER_USERNAME = "janmichaelquisto1";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SprintRow = {
  id: string;
  project_id: string;
  name: string;
  sprint_number: number;
  start_date: string;
  end_date: string;
  sprint_year: number;
  sprint_month: number;
  total_planned_points: number;
  total_completed_points: number;
  status: string;
  is_current: number;
};

export type SprintSyncResult = {
  action: "synced" | "skipped";
  message: string;
  sprint: SprintRow | null;
  cardsFetched: number;
  tasksDeleted: number;
  tasksInserted: number;
};

type TaskRow = {
  id?: string;
  sprint_id: string;
  project_id: string;
  project_type: string;
  assigned_to: string | null;
  trello_card_id: string;
  trello_short_id: number;
  trello_board_id: string;
  trello_card_url: string;
  trello_list_name: string;
  trello_last_synced_at: string;
  title: string;
  description: string;
  task_type: "bug" | "feature" | "improvement";
  priority: "critical" | "high" | "medium" | "low";
  completed_at: string | null;
  story_points: number;
  severity: number;
  status: "todo";
  sp_type: "planned" | "adhoc" | "done" | "blocked";
  is_completed: "pending" | "completed" | "incompleted";
  completion_percentage: number;
};

type ExistingTaskRow = {
  id: string;
  trello_card_id: string;
  sp_type: TaskRow["sp_type"];
};

type ProjectTypeRow = {
  id: string;
  name: string;
};

type StoryPointRow = {
  member_id: string;
  sprint_id: string;
  project_id: string;
  assigned_story_points: number;
  completed_story_points: number;
  total_bonus_points: number;
  adhoc_story_points: number;
};

type ExistingStoryPointRow = {
  member_id: string;
  assigned_story_points: number | null;
  adhoc_story_points: number | null;
};

type MemberAssigneeRow = {
  id: string | null;
  auth_user_id: string | null;
  trello_username: string | null;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

function hasCardLabel(card: TrelloSprintCard, label: string): boolean {
  const targetLabel = normalizeLabel(label);

  return card.labels.some((item) => normalizeLabel(item.name) === targetLabel);
}

function hasCardMemberUsername(card: TrelloSprintCard, username: string): boolean {
  const targetUsername = normalizeLabel(username);

  return card.members.some((member) => normalizeLabel(member.username) === targetUsername);
}

function hasAdditionalSupabaseMember(
  card: TrelloSprintCard,
  memberUsernames: Set<string>,
): boolean {
  const requiredUsername = normalizeLabel(TRELLO_REQUIRED_MEMBER_USERNAME);

  return card.members.some((member) => {
    const username = normalizeLabel(member.username);
    return username !== requiredUsername && memberUsernames.has(username);
  });
}

function getCustomFieldValue(card: TrelloSprintCard, fieldName: string): string | null {
  const value = card.customFields[fieldName];
  if (value === undefined || value === null || value === "") return null;

  return String(value);
}

function normalizeAssigneeValue(value: string): string {
  return value.trim().toLowerCase();
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function buildAssigneeLookup(members: MemberAssigneeRow[]): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const member of members) {
    if (!member.id || !isUuid(member.id)) continue;

    const keys = [
      member.id,
      member.trello_username,
      member.email,
      member.full_name,
      member.first_name,
      member.last_name,
    ].filter((value): value is string => Boolean(value));

    for (const key of keys) {
      lookup.set(normalizeAssigneeValue(key), member.id);
    }
  }

  return lookup;
}

function buildProjectTypeLookup(projectTypes: ProjectTypeRow[]): Map<string, string> {
  return new Map(
    projectTypes.map((projectType) => [
      normalizeLabel(projectType.name),
      projectType.id,
    ]),
  );
}

function resolveAssignedTo(
  card: TrelloSprintCard,
  assigneeLookup: Map<string, string>,
): string | null {
  const assignee = getCustomFieldValue(card, "Assignee");
  if (!assignee) return null;

  return assigneeLookup.get(normalizeAssigneeValue(assignee)) ?? null;
}

function hasSupabaseAssignee(
  card: TrelloSprintCard,
  assigneeLookup: Map<string, string>,
): boolean {
  return resolveAssignedTo(card, assigneeLookup) !== null;
}

function isCardStatusDone(card: TrelloSprintCard): boolean {
  const status = getCustomFieldValue(card, "Status");

  return status ? normalizeLabel(status) === "done" : false;
}

function getTaskType(card: TrelloSprintCard): TaskRow["task_type"] {
  if (hasCardLabel(card, "Bug")) return "bug";
  if (hasCardLabel(card, "Improvement")) return "improvement";

  return "feature";
}

function getTaskPriority(card: TrelloSprintCard): TaskRow["priority"] {
  const priority = getCustomFieldValue(card, "Priority")?.toLowerCase();

  if (priority === "highest") return "critical";
  if (priority === "high") return "high";
  if (priority === "medium") return "medium";
  if (priority === "low") return "low";

  return "medium";
}

function getTaskSeverity(card: TrelloSprintCard): number {
  const severity = getCustomFieldValue(card, "Severity")?.toUpperCase();

  if (severity === "P4") return 1.0;
  if (severity === "P3") return 1.1;
  if (severity === "P2") return 1.2;
  if (severity === "P1") return 1.3;

  return 1.0;
}

function getStoryPoints(card: TrelloSprintCard): number {
  return Number.isFinite(card.storyPoints) ? card.storyPoints ?? 0 : 0;
}

function isCompletedList(listName: string): boolean {
  const normalizedListName = normalizeLabel(listName);

  return (
    normalizedListName !== "current sprint" &&
    normalizedListName !== "in development"
  );
}

function getTaskCompletionStatus(
  card: TrelloSprintCard,
): TaskRow["is_completed"] {
  if (normalizeLabel(card.list.name) === "blocked") {
    return "pending";
  }

  if (hasCardLabel(card, "Incomplete")) {
    return "incompleted";
  }

  return PENDING_COMPLETION_LIST_NAMES.has(normalizeLabel(card.list.name))
    ? "pending"
    : "completed";
}

function isCompletedStoryPointType(spType: TaskRow["sp_type"]): boolean {
  return spType === "planned" || spType === "adhoc";
}

function getSprintPointType(card: TrelloSprintCard): TaskRow["sp_type"] {
  if (normalizeLabel(card.list.name) === "blocked") {
    return "blocked";
  }

  if (!PLANNING_SP_TYPE_LIST_NAMES.has(normalizeLabel(card.list.name))) {
    return "done";
  }

  return hasCardLabel(card, "Ad hoc") ? "adhoc" : "planned";
}

function getTaskCompletedAt(card: TrelloSprintCard, fallbackTimestamp: string): string | null {
  if (getTaskCompletionStatus(card) !== "completed") return null;

  const dateCompleted = getCustomFieldValue(card, "Date Completed");
  if (!dateCompleted) return fallbackTimestamp;

  const parsedDate = new Date(dateCompleted);

  return Number.isNaN(parsedDate.getTime())
    ? fallbackTimestamp
    : parsedDate.toISOString();
}

function getTaskCompletionPercentage(card: TrelloSprintCard): number {
  return getTaskCompletionStatus(card) === "completed" ? 100 : 0;
}

function resolveProjectType(
  card: TrelloSprintCard,
  projectTypeLookup: Map<string, string>,
): string {
  const projectType = getCustomFieldValue(card, "Project Type");
  const projectTypeId = projectType
    ? projectTypeLookup.get(normalizeLabel(projectType))
    : undefined;
  const generalProjectTypeId = projectTypeLookup.get("general");

  if (projectTypeId) return projectTypeId;
  if (generalProjectTypeId) return generalProjectTypeId;

  throw new Error('Missing "General" project type in Supabase project_type table.');
}

function mapCardToTask(
  card: TrelloSprintCard,
  sprint: SprintRow,
  assigneeLookup: Map<string, string>,
  projectTypeLookup: Map<string, string>,
): TaskRow {
  const syncedAt = new Date().toISOString();

  return {
    sprint_id: sprint.id,
    project_id: TASK_PROJECT_ID,
    project_type: resolveProjectType(card, projectTypeLookup),
    assigned_to: resolveAssignedTo(card, assigneeLookup),
    trello_card_id: card.id,
    trello_short_id: card.idShort ?? 0,
    trello_board_id: card.board.id,
    trello_card_url: card.url ?? card.shortUrl ?? "",
    trello_list_name: card.list.name,
    trello_last_synced_at: syncedAt,
    title: card.name,
    description: card.desc ?? "",
    task_type: getTaskType(card),
    priority: getTaskPriority(card),
    completed_at: getTaskCompletedAt(card, syncedAt),
    story_points: getStoryPoints(card),
    severity: getTaskSeverity(card),
    status: "todo",
    sp_type: getSprintPointType(card),
    is_completed: getTaskCompletionStatus(card),
    completion_percentage: getTaskCompletionPercentage(card),
  };
}

async function getCurrentSprint(): Promise<SprintRow | null> {
  const { data, error } = await supabase
    .from("sprints")
    .select(
      "id,project_id,name,sprint_number,start_date,end_date,sprint_year,sprint_month,total_planned_points,total_completed_points,status,is_current",
    )
    .eq("is_current", 1)
    .limit(1);

  if (error) {
    throw error;
  }

  return data?.[0] ? (data[0] as SprintRow) : null;
}

async function replaceSprintTasks(
  sprint: SprintRow,
  cards: TrelloSprintCard[],
  assigneeLookup: Map<string, string>,
  projectTypeLookup: Map<string, string>,
): Promise<{ deleted: number; inserted: number }> {
  if (!sprint.id) {
    throw new Error("Unable to replace tasks without a current sprint id.");
  }

  const existingTasks = await getSupabaseRows<ExistingTaskRow>("tasks", {
    select: "id,trello_card_id,sp_type",
    eq: { sprint_id: sprint.id },
  });
  const shouldPreserveExistingPlannedTasks =
    sprint.status === "active" ||
    sprint.status === "completed" ||
    sprint.status === "done";
  const preservedSpTypes = new Set<TaskRow["sp_type"]>(
    shouldPreserveExistingPlannedTasks ? ["planned", "adhoc"] : [],
  );
  const taskIdsToDelete = existingTasks
    .filter((task) => !preservedSpTypes.has(task.sp_type))
    .map((task) => task.id);
  const preservedTasksByTrelloCardId = new Map(
    existingTasks
      .filter((task) => preservedSpTypes.has(task.sp_type))
      .map((task) => [task.trello_card_id, task]),
  );
  let deletedCount = 0;

  if (taskIdsToDelete.length > 0) {
    const { data: deletedRows, error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .in("id", taskIdsToDelete)
      .select("id");

    if (deleteError) {
      throw deleteError;
    }

    deletedCount = deletedRows?.length ?? taskIdsToDelete.length;
  }

  if (cards.length === 0) {
    return { deleted: deletedCount, inserted: 0 };
  }

  const tasks = cards.map((card) =>
    mapCardToTask(card, sprint, assigneeLookup, projectTypeLookup),
  );
  const tasksToInsert: TaskRow[] = [];

  for (const task of tasks) {
    const existingTask = preservedTasksByTrelloCardId.get(task.trello_card_id);

    if (!existingTask) {
      tasksToInsert.push(task);
      continue;
    }

    const taskUpdate: Partial<TaskRow> = {
      sprint_id: task.sprint_id,
      project_id: task.project_id,
      project_type: task.project_type,
      assigned_to: task.assigned_to,
      trello_card_id: task.trello_card_id,
      trello_short_id: task.trello_short_id,
      trello_board_id: task.trello_board_id,
      trello_card_url: task.trello_card_url,
      trello_list_name: task.trello_list_name,
      trello_last_synced_at: task.trello_last_synced_at,
      title: task.title,
      description: task.description,
      task_type: task.task_type,
      priority: task.priority,
      completed_at: task.completed_at,
      story_points: task.story_points,
      severity: task.severity,
      status: task.status,
      is_completed: task.is_completed,
      completion_percentage: task.completion_percentage,
    };

    if (normalizeLabel(task.trello_list_name) === "blocked") {
      taskUpdate.sp_type = "blocked";
    }

    const { data: updatedRows, error: updateError } = await supabase
      .from("tasks")
      .update(taskUpdate)
      .eq("id", existingTask.id)
      .select("id,trello_list_name");

    if (updateError) {
      throw updateError;
    }

    if (!updatedRows || updatedRows.length === 0) {
      throw new Error(
        `Unable to update task details for Trello card ${task.trello_card_id}.`,
      );
    }
  }

  if (tasksToInsert.length === 0) {
    return {
      deleted: deletedCount,
      inserted: 0,
    };
  }

  const { data, error: insertError } = await supabase
    .from("tasks")
    .insert(tasksToInsert)
    .select("trello_card_id");

  if (insertError) {
    throw insertError;
  }

  return {
    deleted: deletedCount,
    inserted: data?.length ?? tasksToInsert.length,
  };
}

async function getSavedSprintTasks(sprintId: string): Promise<TaskRow[]> {
  return getSupabaseRows<TaskRow>("tasks", {
    select:
      "id,sprint_id,project_id,project_type,assigned_to,trello_card_id,trello_short_id,trello_board_id,trello_card_url,trello_list_name,trello_last_synced_at,title,description,task_type,priority,completed_at,story_points,severity,status,sp_type,is_completed,completion_percentage",
    eq: { sprint_id: sprintId },
  });
}

async function replaceSprintStoryPoints(
  sprint: SprintRow,
  tasks: TaskRow[],
): Promise<void> {
  const storyPointsByMember = new Map<string, StoryPointRow>();
  const shouldUpdateAssignedStoryPoints =
    sprint.status === "planning" || sprint.status === "active";
  const shouldUpdateAdhocStoryPoints = sprint.status === "active";
  const existingStoryPoints = await getSupabaseRows<ExistingStoryPointRow>(
    "story_points",
    {
      select: "member_id,assigned_story_points,adhoc_story_points",
      eq: { sprint_id: sprint.id },
    },
  );
  const existingStoryPointsByMember = new Map(
    existingStoryPoints.map((row) => [row.member_id, row]),
  );

  for (const task of tasks) {
    if (!task.assigned_to) continue;

    const existing = storyPointsByMember.get(task.assigned_to) ?? {
      member_id: task.assigned_to,
      sprint_id: sprint.id,
      project_id: sprint.project_id,
      assigned_story_points: 0,
      completed_story_points: 0,
      total_bonus_points: 0,
      adhoc_story_points: 0,
    };

    if (task.sp_type === "planned") {
      existing.assigned_story_points += task.story_points;
    }

    if (
      isCompletedStoryPointType(task.sp_type) &&
      isCompletedList(task.trello_list_name)
    ) {
      existing.completed_story_points += task.story_points;
    }

    if (shouldUpdateAdhocStoryPoints && task.sp_type === "adhoc") {
      existing.adhoc_story_points += task.story_points;
    }

    storyPointsByMember.set(task.assigned_to, existing);
  }

  const storyPointRows = Array.from(storyPointsByMember.values()).map((row) => {
    const existing = existingStoryPointsByMember.get(row.member_id);
    const assignedStoryPoints = shouldUpdateAssignedStoryPoints
      ? row.assigned_story_points
      : existing?.assigned_story_points ?? row.assigned_story_points;
    const adhocStoryPoints = shouldUpdateAdhocStoryPoints
      ? row.adhoc_story_points
      : existing?.adhoc_story_points ?? row.adhoc_story_points;

    return {
      ...row,
      assigned_story_points: assignedStoryPoints,
      adhoc_story_points: adhocStoryPoints,
      total_bonus_points: Math.max(
        row.completed_story_points - assignedStoryPoints,
        0,
      ),
    };
  });

  const { error } = await supabase.rpc("replace_story_points_for_sprint", {
    p_sprint_id: sprint.id,
    p_rows: storyPointRows,
  });

  if (error) {
    throw error;
  }
}

export async function syncCurrentSprintTasks(): Promise<{
  cards: TrelloSprintCard[];
  result: SprintSyncResult;
}> {
  const sprint = await getCurrentSprint();

  if (!sprint) {
    return {
      cards: [],
      result: {
        action: "skipped",
        message: "No current sprint found, so Trello sync was stopped.",
        sprint: null,
        cardsFetched: 0,
        tasksDeleted: 0,
        tasksInserted: 0,
      },
    };
  }

  if (
    sprint.status !== "planning" &&
    sprint.status !== "active" &&
    sprint.status !== "completed" &&
    sprint.status !== "done"
  ) {
    return {
      cards: [],
      result: {
        action: "skipped",
        message: `Current sprint status "${sprint.status}" is not supported for Trello sync.`,
        sprint,
        cardsFetched: 0,
        tasksDeleted: 0,
        tasksInserted: 0,
      },
    };
  }

  const trelloCards = await getTrelloSprintCards({
    boardIds: null,
    listNames: TRELLO_LIST_NAMES,
    customFieldNames: TRELLO_CUSTOM_FIELD_NAMES,
    memberIds: "all",
  });
  const [supabaseMembers, projectTypes] = await Promise.all([
    getSupabaseRows<MemberAssigneeRow>("members", {
      select: "id,auth_user_id,trello_username,email,full_name,first_name,last_name",
    }),
    getSupabaseRows<ProjectTypeRow>("project_type", {
      select: "id,name",
    }),
  ]);
  const assigneeLookup = buildAssigneeLookup(supabaseMembers);
  const projectTypeLookup = buildProjectTypeLookup(projectTypes);
  const supabaseMemberUsernames = new Set(
    supabaseMembers
      .map((member) => member.trello_username)
      .filter((username): username is string => Boolean(username))
      .map(normalizeLabel),
  );
  const memberFilteredCards = trelloCards.filter(
    (card) =>
      hasCardMemberUsername(card, TRELLO_REQUIRED_MEMBER_USERNAME) &&
      hasAdditionalSupabaseMember(card, supabaseMemberUsernames),
  );
  const cards =
    sprint.status === "planning"
      ? memberFilteredCards.filter((card) => !hasCardLabel(card, "Ad hoc"))
      : trelloCards.filter((card) => {
          if (!hasCardLabel(card, "Ad hoc")) {
            return (
              hasCardMemberUsername(card, TRELLO_REQUIRED_MEMBER_USERNAME) &&
              hasAdditionalSupabaseMember(card, supabaseMemberUsernames)
            );
          }

          return hasSupabaseAssignee(card, assigneeLookup) && !isCardStatusDone(card);
        });
  const taskCounts = await replaceSprintTasks(
    sprint,
    cards,
    assigneeLookup,
    projectTypeLookup,
  );

  // Every successful Trello sync refreshes story points from the final saved task rows.
  const savedTasks = await getSavedSprintTasks(sprint.id);
  await replaceSprintStoryPoints(sprint, savedTasks);

  return {
    cards,
    result: {
      action: "synced",
      message: "Current sprint tasks synced from Trello.",
      sprint,
      cardsFetched: cards.length,
      tasksDeleted: taskCounts.deleted,
      tasksInserted: taskCounts.inserted,
    },
  };
}
