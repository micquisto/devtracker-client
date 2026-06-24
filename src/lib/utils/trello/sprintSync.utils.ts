import { getSupabaseRows, supabase } from "@/lib/supabase";
import {
  getTrelloSprintCardById,
  getTrelloSprintCards,
  type TrelloSprintCard,
} from "./trello.utils";
import {
  DEFAULT_TRELLO_STORY_POINT_FIELD_NAMES,
  updateTrelloCardStoryPoints,
  type UpdateTrelloCardStoryPointsResult,
} from "./trello.storyPoints";
import {
  isForPlanningTrelloList,
  NORMALIZED_TRELLO_FOR_PLANNING_LIST_NAME,
  TRELLO_FOR_PLANNING_LIST_NAME,
} from "./trello.listNames";

const TRELLO_CUSTOM_FIELD_NAMES = [
  "Date Completed",
  "Assignee",
  "Severity",
  "Priority",
  "Type",
  "Status",
  "Date Added",
  "Project Type",
  "Project",
  "Completion Rate",
];

const ORIGINAL_TRELLO_BOARD_IDS = ["5oj0clmi"];
const ORIGINAL_TRELLO_LIST_NAMES = [
  TRELLO_FOR_PLANNING_LIST_NAME,
  "Current Sprint",
  "In Development",
  "For Dev Deployment",
  "On Dev Environment",
  "For Live Deployment",
  "On Live🎉",
  "Blocked",
  "Project Refinement",
  "On-Deck Sprint Backlog",
  "Done QA",
];

const EXTRA_TRELLO_BOARD_IDS = ["l7BOmeGw"];
const EXTRA_TRELLO_LIST_NAMES = [
  TRELLO_FOR_PLANNING_LIST_NAME,
  "Project Refinement",
  "Backlog",
  "Next Sprint",
  "Current Sprint",
  "In Development",
  "For Dev Deployment",
  "On Dev Environment",
  "For Live Deployment",
  "On Live",
  "Blocked",
  "Done Sprint",
  "DoneSprint",
];
const TRELLO_LIST_MERGE_ORDER = [
  ...ORIGINAL_TRELLO_LIST_NAMES,
  ...EXTRA_TRELLO_LIST_NAMES,
];

const PLANNING_SP_TYPE_LIST_NAMES = new Set([
  "current sprint",
  "in development",
  "for dev deployment",
]);
const ADHOC_SYNC_LIST_NAMES = new Set([
  "current sprint",
  "in development",
]);
const PENDING_COMPLETION_LIST_NAMES = new Set([
  NORMALIZED_TRELLO_FOR_PLANNING_LIST_NAME,
  "planning",
  "current sprint",
  "in development",
]);
const DONE_SPRINT_LIST_NAMES = new Set(["done sprint", "donesprint"]);
const CANONICAL_DONE_SPRINT_LIST_NAME = "Done Sprint";

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
  blocked_count: number;
  planned_tasks_count: number;
  adhoc_tasks_count: number;
  total_tasks_count: number;
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

export type SyncTaskStoryPointsFromTrelloOptions = {
  taskId: string;
  sprintId: string;
  storyPoints: number;
};

export type SyncedPlanningTaskRow = {
  id: string;
  sprint_id: string;
  title: string;
  description: string | null;
  task_type: TaskRow["task_type"];
  priority: TaskRow["priority"];
  severity: number;
  story_points: number;
  sp_type: TaskRow["sp_type"];
  trello_list_name: string | null;
  trello_short_id: number | null;
  trello_card_url: string | null;
  trello_card_id: string;
  trello_board_id: string;
};

export type SyncTaskStoryPointsFromTrelloResult = {
  taskId: string;
  storyPoints: number;
  trelloUpdate: UpdateTrelloCardStoryPointsResult;
  updatedTask: SyncedPlanningTaskRow;
};

type TaskRow = {
  id?: string;
  sprint_id: string;
  project_id: string;
  project_type: string;
  project: string;
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
  real_story_points: number | null;
};

type ExistingTaskRow = {
  id: string;
  sprint_id: string;
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

type SprintStoryPointModel = "member" | "project_type" | "sprint";

type SprintStoryPointRow = {
  sprint_id: string;
  model: SprintStoryPointModel;
  model_id: string;
  project: string | null;
  points: number;
  real_points: number;
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

function isDoneSprintListName(listName: string): boolean {
  return DONE_SPRINT_LIST_NAMES.has(normalizeLabel(listName));
}

function getTrelloCardListName(card: TrelloSprintCard): string {
  const listName = card.list.name.trim();

  if (isDoneSprintListName(listName)) {
    return CANONICAL_DONE_SPRINT_LIST_NAME;
  }

  return listName;
}

function dedupeTrelloCardsById(cards: TrelloSprintCard[]): TrelloSprintCard[] {
  const cardsById = new Map<string, TrelloSprintCard>();

  for (const card of cards) {
    const existing = cardsById.get(card.id);
    if (!existing) {
      cardsById.set(card.id, card);
      continue;
    }

    const existingListMatches =
      Boolean(existing.idList) && existing.idList === existing.list.id;
    const cardListMatches =
      Boolean(card.idList) && card.idList === card.list.id;

    if (!existingListMatches && cardListMatches) {
      cardsById.set(card.id, card);
    }
  }

  return Array.from(cardsById.values());
}

function mergeTrelloCardsByListName(cardGroups: TrelloSprintCard[][]): TrelloSprintCard[] {
  const cardsByListName = new Map<string, TrelloSprintCard[]>();

  for (const cards of cardGroups) {
    for (const card of cards) {
      const listName = normalizeLabel(card.list.name);
      const groupedCards = cardsByListName.get(listName) ?? [];

      groupedCards.push(card);
      cardsByListName.set(listName, groupedCards);
    }
  }

  const mergedCards: TrelloSprintCard[] = [];
  const mergedListNames = new Set<string>();

  for (const listName of TRELLO_LIST_MERGE_ORDER) {
    const normalizedListName = normalizeLabel(listName);
    if (mergedListNames.has(normalizedListName)) continue;

    const groupedCards = cardsByListName.get(normalizedListName);
    if (groupedCards) mergedCards.push(...groupedCards);
    mergedListNames.add(normalizedListName);
  }

  for (const [listName, groupedCards] of cardsByListName) {
    if (!mergedListNames.has(listName)) mergedCards.push(...groupedCards);
  }

  return mergedCards;
}

function hasCardLabel(card: TrelloSprintCard, label: string): boolean {
  const targetLabel = normalizeLabel(label);

  return card.labels.some((item) => normalizeLabel(item.name) === targetLabel);
}

function isAdhocCard(card: TrelloSprintCard): boolean {
  return hasCardLabel(card, "Ad hoc");
}

function isAdhocSyncList(listName?: string | null): boolean {
  return ADHOC_SYNC_LIST_NAMES.has(normalizeLabel(listName ?? ""));
}

function isEligibleAdhocSyncCard(
  card: TrelloSprintCard,
  assigneeLookup: Map<string, string>,
): boolean {
  return (
    isAdhocCard(card) &&
    isAdhocSyncList(card.list.name) &&
    hasSupabaseAssignee(card, assigneeLookup) &&
    !isCardStatusDone(card)
  );
}

function mergeSyncCardsWithEligibleAdhoc(
  primaryCards: TrelloSprintCard[],
  allTrelloCards: TrelloSprintCard[],
  assigneeLookup: Map<string, string>,
): TrelloSprintCard[] {
  const cardsById = new Map(
    dedupeTrelloCardsById(primaryCards).map((card) => [card.id, card]),
  );

  for (const card of dedupeTrelloCardsById(allTrelloCards)) {
    if (!isEligibleAdhocSyncCard(card, assigneeLookup)) {
      continue;
    }

    cardsById.set(card.id, card);
  }

  return Array.from(cardsById.values());
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
  const severity = getCustomFieldValue(card, "Severity")?.trim().toUpperCase();

  if (severity === "P4") return 1.0;
  if (severity === "P3") return 1.1;
  if (severity === "P2") return 1.2;
  if (severity === "P1") return 1.3;

  return 1.0;
}

function getStoryPoints(card: TrelloSprintCard): number {
  return Number.isFinite(card.storyPoints) ? card.storyPoints ?? 0 : 0;
}

function getTaskStoryPoints(task: TaskRow): number {
  return task.real_story_points ?? 0;
}

function isCompletedList(listName: string): boolean {
  const normalizedListName = normalizeLabel(listName);

  return (
    !isForPlanningTrelloList(listName) &&
    normalizedListName !== "current sprint" &&
    normalizedListName !== "in development"
  );
}

function getTaskCompletionStatus(
  card: TrelloSprintCard,
): TaskRow["is_completed"] {
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

  if (isForPlanningTrelloList(card.list.name)) {
    return "done";
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
  const rawValue = card.customFields["Completion Rate"];

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return 100;
  }

  const completionRate = String(rawValue).replace("%", "").trim();
  if (!completionRate) {
    return 100;
  }

  const parsedValue = Number(completionRate);
  if (!Number.isFinite(parsedValue)) {
    return 100;
  }

  return Math.min(Math.max(parsedValue, 0), 100);
}

function getRealStoryPoints(card: TrelloSprintCard): number {
  if (hasCardLabel(card, "Incomplete")) return 0;
  if (!isCompletedList(card.list.name)) return 0;

  return (getStoryPoints(card) * getTaskCompletionPercentage(card)) / 100;
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

function getTaskProject(card: TrelloSprintCard): string {
  return getCustomFieldValue(card, "Project")?.trim() || "General";
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
    project: getTaskProject(card),
    assigned_to: resolveAssignedTo(card, assigneeLookup),
    trello_card_id: card.id,
    trello_short_id: card.idShort ?? 0,
    trello_board_id: card.board.id,
    trello_card_url: card.url ?? card.shortUrl ?? "",
    trello_list_name: getTrelloCardListName(card),
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
    real_story_points: getRealStoryPoints(card),
  };
}

async function getCurrentSprint(): Promise<SprintRow | null> {
  const { data, error } = await supabase
    .from("sprints")
    .select(
      "id,project_id,name,sprint_number,start_date,end_date,sprint_year,sprint_month,total_planned_points,total_completed_points,blocked_count,planned_tasks_count,adhoc_tasks_count,total_tasks_count,status,is_current",
    )
    .eq("is_current", 1)
    .limit(1);

  if (error) {
    throw error;
  }

  return data?.[0] ? (data[0] as SprintRow) : null;
}

async function getSprintById(sprintId: string): Promise<SprintRow | null> {
  const { data, error } = await supabase
    .from("sprints")
    .select(
      "id,project_id,name,sprint_number,start_date,end_date,sprint_year,sprint_month,total_planned_points,total_completed_points,blocked_count,planned_tasks_count,adhoc_tasks_count,total_tasks_count,status,is_current",
    )
    .eq("id", sprintId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? (data as SprintRow) : null;
}

function shouldDeleteExistingTask(
  task: ExistingTaskRow,
  isPlanningSprint: boolean,
): boolean {
  if (isPlanningSprint) {
    return true;
  }

  return task.sp_type !== "planned" && task.sp_type !== "adhoc";
}

function isPlannedOrAdhocSpType(spType: TaskRow["sp_type"]): boolean {
  return spType === "planned" || spType === "adhoc";
}

function buildTaskUpdateFromCard(
  card: TrelloSprintCard,
  task: TaskRow,
  existingTask: ExistingTaskRow,
  preservedSpTypes: Set<TaskRow["sp_type"]>,
): Partial<TaskRow> {
  const shouldPreserveSpType =
    existingTask.sprint_id === task.sprint_id &&
    preservedSpTypes.has(existingTask.sp_type);

  const taskUpdate: Partial<TaskRow> = {
    project_id: task.project_id,
    project_type: task.project_type,
    project: task.project,
    assigned_to: task.assigned_to,
    trello_card_id: task.trello_card_id,
    trello_short_id: task.trello_short_id,
    trello_board_id: task.trello_board_id,
    trello_card_url: task.trello_card_url,
    trello_list_name: getTrelloCardListName(card),
    trello_last_synced_at: task.trello_last_synced_at,
    title: task.title,
    description: task.description,
    task_type: task.task_type,
    priority: task.priority,
    completed_at: task.completed_at,
    story_points: task.story_points,
    severity: task.severity,
    status: task.status,
    is_completed: getTaskCompletionStatus(card),
    completion_percentage: getTaskCompletionPercentage(card),
    real_story_points: getRealStoryPoints(card),
  };

  if (!shouldPreserveSpType) {
    taskUpdate.sp_type = task.sp_type;
  }

  if (isForPlanningTrelloList(getTrelloCardListName(card))) {
    taskUpdate.sp_type = "done";
  }

  if (
    normalizeLabel(getTrelloCardListName(card)) === "blocked" &&
    !(shouldPreserveSpType && existingTask.sp_type === "planned")
  ) {
    taskUpdate.sp_type = "blocked";
  }

  return taskUpdate;
}

async function updateSprintTaskFromCard(
  sprint: SprintRow,
  existingTask: ExistingTaskRow,
  card: TrelloSprintCard,
  task: TaskRow,
  preservedSpTypes: Set<TaskRow["sp_type"]>,
): Promise<void> {
  const taskUpdate = buildTaskUpdateFromCard(
    card,
    task,
    existingTask,
    preservedSpTypes,
  );

  const { data: updatedRows, error: updateError } = await supabase
    .from("tasks")
    .update(taskUpdate)
    .eq("id", existingTask.id)
    .eq("sprint_id", sprint.id)
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

async function updatePlannedAdhocTasksFromAllTrelloCards(
  sprint: SprintRow,
  allTrelloCards: TrelloSprintCard[],
  assigneeLookup: Map<string, string>,
  projectTypeLookup: Map<string, string>,
): Promise<void> {
  if (sprint.status === "planning" || allTrelloCards.length === 0) {
    return;
  }

  const preservedSpTypes = new Set<TaskRow["sp_type"]>(["planned", "adhoc"]);
  const allCardsById = new Map(
    dedupeTrelloCardsById(allTrelloCards).map((card) => [card.id, card]),
  );
  const currentSprintTasks = await getSupabaseRows<ExistingTaskRow>("tasks", {
    select: "id,sprint_id,trello_card_id,sp_type",
    eq: { sprint_id: sprint.id },
  });

  for (const existingTask of currentSprintTasks) {
    if (!isPlannedOrAdhocSpType(existingTask.sp_type)) {
      continue;
    }

    const card = allCardsById.get(existingTask.trello_card_id);
    if (!card) {
      continue;
    }

    const task = mapCardToTask(card, sprint, assigneeLookup, projectTypeLookup);
    await updateSprintTaskFromCard(
      sprint,
      existingTask,
      card,
      task,
      preservedSpTypes,
    );
  }
}

async function replaceSprintTasks(
  sprint: SprintRow,
  cards: TrelloSprintCard[],
  assigneeLookup: Map<string, string>,
  projectTypeLookup: Map<string, string>,
  allTrelloCards: TrelloSprintCard[] = cards,
): Promise<{ deleted: number; inserted: number }> {
  if (!sprint.id) {
    throw new Error("Unable to replace tasks without a current sprint id.");
  }

  const existingTasks = await getSupabaseRows<ExistingTaskRow>("tasks", {
    select: "id,sprint_id,trello_card_id,sp_type",
    eq: { sprint_id: sprint.id },
  });
  const isPlanningSprint = sprint.status === "planning";
  const preservedSpTypes = new Set<TaskRow["sp_type"]>(
    isPlanningSprint ? [] : ["planned", "adhoc"],
  );
  const taskIdsToDelete = existingTasks
    .filter((task) => shouldDeleteExistingTask(task, isPlanningSprint))
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
      .eq("sprint_id", sprint.id)
      .in("id", taskIdsToDelete)
      .select("id");

    if (deleteError) {
      throw deleteError;
    }

    deletedCount = deletedRows?.length ?? taskIdsToDelete.length;
  }

  const tasksToInsert: TaskRow[] = [];

  if (cards.length > 0) {
    const dedupedCards = dedupeTrelloCardsById(cards);
    const tasks = dedupedCards.map((card) =>
      mapCardToTask(card, sprint, assigneeLookup, projectTypeLookup),
    );
    const incomingTrelloCardIds = tasks.map((task) => task.trello_card_id);
    const { data: existingRowsForIncomingCards, error: existingRowsError } =
      incomingTrelloCardIds.length > 0
        ? await supabase
            .from("tasks")
            .select("id,sprint_id,trello_card_id,sp_type")
            .in("trello_card_id", incomingTrelloCardIds)
        : { data: [], error: null };

    if (existingRowsError) {
      throw existingRowsError;
    }

    const existingTasksByTrelloCardId = new Map(
      ((existingRowsForIncomingCards ?? []) as ExistingTaskRow[])
        .filter((task) => task.sprint_id === sprint.id)
        .map((task) => [task.trello_card_id, task]),
    );
    const nonCurrentSprintTrelloCardIds = new Set(
      ((existingRowsForIncomingCards ?? []) as ExistingTaskRow[])
        .filter((task) => task.sprint_id !== sprint.id)
        .map((task) => task.trello_card_id),
    );

    for (let index = 0; index < dedupedCards.length; index++) {
      const card = dedupedCards[index];
      const task = tasks[index];

      if (task.sprint_id !== sprint.id) {
        continue;
      }

      const existingTask =
        preservedTasksByTrelloCardId.get(task.trello_card_id) ??
        existingTasksByTrelloCardId.get(task.trello_card_id);

      if (existingTask) {
        await updateSprintTaskFromCard(
          sprint,
          existingTask,
          card,
          task,
          preservedSpTypes,
        );
        continue;
      }

      if (nonCurrentSprintTrelloCardIds.has(task.trello_card_id)) {
        continue;
      }

      tasksToInsert.push(task);
    }
  }

  if (tasksToInsert.length === 0) {
    await updatePlannedAdhocTasksFromAllTrelloCards(
      sprint,
      allTrelloCards,
      assigneeLookup,
      projectTypeLookup,
    );

    return {
      deleted: deletedCount,
      inserted: 0,
    };
  }

  if (tasksToInsert.some((task) => task.sprint_id !== sprint.id)) {
    throw new Error("Unable to insert tasks outside the current sprint.");
  }

  const { data, error: insertError } = await supabase
    .from("tasks")
    .insert(tasksToInsert)
    .select("trello_card_id");

  if (insertError) {
    throw insertError;
  }

  await updatePlannedAdhocTasksFromAllTrelloCards(
    sprint,
    allTrelloCards,
    assigneeLookup,
    projectTypeLookup,
  );

  return {
    deleted: deletedCount,
    inserted: data?.length ?? tasksToInsert.length,
  };
}

async function getSavedSprintTasks(sprintId: string): Promise<TaskRow[]> {
  return getSupabaseRows<TaskRow>("tasks", {
    select:
      "id,sprint_id,project_id,project_type,project,assigned_to,trello_card_id,trello_short_id,trello_board_id,trello_card_url,trello_list_name,trello_last_synced_at,title,description,task_type,priority,completed_at,story_points,severity,status,sp_type,is_completed,completion_percentage,real_story_points",
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
      existing.completed_story_points += getTaskStoryPoints(task);
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
  }).filter((row) => row.sprint_id === sprint.id);

  const { error } = await supabase.rpc("replace_story_points_for_sprint", {
    p_sprint_id: sprint.id,
    p_rows: storyPointRows,
  });

  if (error) {
    throw error;
  }
}

async function replaceSprintStoryPointBreakdown(
  sprint: SprintRow,
  tasks: TaskRow[],
): Promise<void> {
  const currentSprintTasks = tasks.filter(
    (task) =>
      task.sprint_id === sprint.id &&
      (task.sp_type === "planned" || task.sp_type === "adhoc"),
  );
  const rowsByKey = new Map<string, SprintStoryPointRow>();

  const addBreakdownPoints = (
    model: SprintStoryPointModel,
    modelId: string | null,
    project: string | null,
    task: TaskRow,
  ) => {
    if (!modelId || !UUID_PATTERN.test(modelId)) return;

    const projectName = project?.trim() || "General";
    const key = `${model}:${modelId}:${projectName}`;
    const existing = rowsByKey.get(key) ?? {
      sprint_id: sprint.id,
      model,
      model_id: modelId,
      project: projectName,
      points: 0,
      real_points: 0,
    };

    if (task.sp_type === "planned") {
      existing.points += task.story_points;
    }

    existing.real_points += task.real_story_points ?? 0;
    rowsByKey.set(key, existing);
  };

  for (const task of currentSprintTasks) {
    addBreakdownPoints("sprint", sprint.id, task.project, task);
    addBreakdownPoints("member", task.assigned_to, task.project, task);
    addBreakdownPoints("project_type", task.project_type, task.project, task);
  }

  const breakdownRows = Array.from(rowsByKey.values()).filter(
    (row) => row.points > 0 || row.real_points > 0,
  );
  const nextRows = breakdownRows.filter(
    (row) => row.sprint_id === sprint.id,
  );

  const { error: deleteError } = await supabase
    .from("sprint_story_points")
    .delete()
    .eq("sprint_id", sprint.id);

  if (deleteError) {
    throw deleteError;
  }

  if (nextRows.length === 0) return;

  const { error: insertError } = await supabase
    .from("sprint_story_points")
    .insert(nextRows);

  if (insertError) {
    throw insertError;
  }
}

async function updateSprintTaskAggregates(
  sprint: SprintRow,
  tasks: TaskRow[],
): Promise<void> {
  const sprintTasks = tasks.filter((task) => task.sprint_id === sprint.id);
  const plannedTasksCount = sprintTasks.filter(
    (task) => task.sp_type === "planned",
  ).length;
  const adhocTasksCount = sprintTasks.filter(
    (task) => task.sp_type === "adhoc",
  ).length;
  const blockedCount = sprintTasks.filter(
    (task) => normalizeLabel(task.trello_list_name) === "blocked",
  ).length;

  const { error } = await supabase
    .from("sprints")
    .update({
      planned_tasks_count: plannedTasksCount,
      adhoc_tasks_count: adhocTasksCount,
      total_tasks_count: plannedTasksCount + adhocTasksCount,
      blocked_count: blockedCount,
    })
    .eq("id", sprint.id);

  if (error) {
    throw error;
  }
}

export async function syncCurrentSprintTasks(expectedSprintId?: string): Promise<{
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

  if (expectedSprintId && sprint.id !== expectedSprintId) {
    return {
      cards: [],
      result: {
        action: "skipped",
        message: "Selected sprint is not the current sprint, so Trello sync was stopped.",
        sprint,
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

  const [originalBoardCards, extraBoardCards] = await Promise.all([
    getTrelloSprintCards({
      boardIds: ORIGINAL_TRELLO_BOARD_IDS,
      listNames: ORIGINAL_TRELLO_LIST_NAMES,
      customFieldNames: TRELLO_CUSTOM_FIELD_NAMES,
      memberIds: "all",
    }),
    getTrelloSprintCards({
      boardIds: EXTRA_TRELLO_BOARD_IDS,
      listNames: EXTRA_TRELLO_LIST_NAMES,
      customFieldNames: TRELLO_CUSTOM_FIELD_NAMES,
      memberIds: "all",
    }),
  ]);
  const trelloCards = mergeTrelloCardsByListName([originalBoardCards, extraBoardCards]);
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
  const memberFilteredCardIds = new Set(memberFilteredCards.map((card) => card.id));
  const primaryCards =
    sprint.status === "planning"
      ? trelloCards.filter((card) => {
          if (isAdhocCard(card)) {
            return false;
          }

          if (isForPlanningTrelloList(card.list.name)) {
            return true;
          }

          return memberFilteredCardIds.has(card.id);
        })
      : trelloCards.filter(
          (card) =>
            !isAdhocCard(card) &&
            hasCardMemberUsername(card, TRELLO_REQUIRED_MEMBER_USERNAME) &&
            hasAdditionalSupabaseMember(card, supabaseMemberUsernames),
        );
  const cards =
    sprint.status === "planning"
      ? primaryCards
      : mergeSyncCardsWithEligibleAdhoc(
          primaryCards,
          trelloCards,
          assigneeLookup,
        );
  const taskCounts = await replaceSprintTasks(
    sprint,
    cards,
    assigneeLookup,
    projectTypeLookup,
    trelloCards,
  );

  // Every successful Trello sync refreshes story points from the final saved task rows.
  const savedTasks = await getSavedSprintTasks(sprint.id);
  await updateSprintTaskAggregates(sprint, savedTasks);
  await replaceSprintStoryPoints(sprint, savedTasks);
  await replaceSprintStoryPointBreakdown(sprint, savedTasks);

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

const PLANNING_TASK_SELECT =
  "id,sprint_id,title,description,task_type,priority,severity,story_points,sp_type,trello_list_name,trello_short_id,trello_card_url,trello_card_id,trello_board_id";

export async function syncTaskStoryPointsFromTrello(
  options: SyncTaskStoryPointsFromTrelloOptions,
): Promise<SyncTaskStoryPointsFromTrelloResult> {
  const { taskId, sprintId, storyPoints } = options;

  const [existingTask] = await getSupabaseRows<ExistingTaskRow & {
    trello_board_id: string | null;
    trello_card_url: string | null;
  }>("tasks", {
    select: "id,sprint_id,trello_card_id,trello_board_id,trello_card_url,sp_type",
    eq: { id: taskId, sprint_id: sprintId },
    limit: 1,
  });

  if (!existingTask) {
    throw new Error("Task not found for the selected sprint.");
  }

  if (!existingTask.trello_card_id?.trim() || !existingTask.trello_board_id?.trim()) {
    throw new Error("Task is missing Trello card metadata required for story point sync.");
  }

  const sprint = await getSprintById(sprintId);
  if (!sprint) {
    throw new Error("Sprint not found.");
  }

  const trelloUpdate = await updateTrelloCardStoryPoints({
    cardId: existingTask.trello_card_id,
    boardId: existingTask.trello_board_id,
    storyPoints,
    source: "customField",
    fieldNames: [...DEFAULT_TRELLO_STORY_POINT_FIELD_NAMES],
  });

  const card = await getTrelloSprintCardById(existingTask.trello_card_id, {
    customFieldNames: TRELLO_CUSTOM_FIELD_NAMES,
    storyPointSource: "customFieldOnly",
  });
  const resolvedCard =
    card.storyPoints === null && trelloUpdate.source === "customField"
      ? { ...card, storyPoints }
      : card;

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
  const mappedTask = mapCardToTask(
    resolvedCard,
    sprint,
    assigneeLookup,
    projectTypeLookup,
  );

  await updateSprintTaskFromCard(
    sprint,
    existingTask,
    resolvedCard,
    mappedTask,
    new Set<TaskRow["sp_type"]>(),
  );

  const { data: updatedTask, error: updatedTaskError } = await supabase
    .from("tasks")
    .select(PLANNING_TASK_SELECT)
    .eq("id", taskId)
    .eq("sprint_id", sprintId)
    .maybeSingle();

  if (updatedTaskError) {
    throw updatedTaskError;
  }

  if (!updatedTask) {
    throw new Error("Updated task could not be loaded after Trello sync.");
  }

  return {
    taskId,
    storyPoints,
    trelloUpdate,
    updatedTask: updatedTask as SyncedPlanningTaskRow,
  };
}
