import { getSupabaseRows, supabase } from "@/lib/supabase";
import { assertSprintTasksMutable, getFrozenSprintTasksErrorMessage, isFrozenSprint } from "../scrum/frozenSprintTasks.utils";
import {
  getWeightedStoryPointsCutoffStartDate,
  resolveWeightedStoryPointsForSprint,
} from "../scrum/weightedStoryPoints.utils";
import {
  getTrelloBoardMembers,
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
  NORMALIZED_TRELLO_MIKE_HOLD_LIST_NAME,
  TRELLO_ALL_BOARDS_LIST_NAMES,
  TRELLO_FOR_PLANNING_LIST_NAME,
} from "./trello.listNames";
import {
  clearSprintTaskScores,
  countPlannedAndAdhocTasks,
  replaceSprintTaskScores,
} from "./sprintTaskScores.utils";
import {
  clearSprintAndMemberScores,
  finalizeCompletedSprintScores,
  replaceSprintAndMemberScores,
} from "./sprintScores.utils";
import { countBlockedTrelloCards } from "./sprintBlockedTrello.utils";
import { ENCODE_STORY_POINTS_PROJECT_ID } from "../scrum/storyPointsTable.utils";

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
  "Reject Count",
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
  ...TRELLO_ALL_BOARDS_LIST_NAMES,
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
  ...TRELLO_ALL_BOARDS_LIST_NAMES,
];
const TRELLO_LIST_MERGE_ORDER = [
  ...ORIGINAL_TRELLO_LIST_NAMES,
  ...EXTRA_TRELLO_LIST_NAMES,
];

const PLANNING_SP_TYPE_LIST_NAMES = new Set([
  "current sprint",
  "in development",
  "for dev deployment",
  NORMALIZED_TRELLO_MIKE_HOLD_LIST_NAME,
]);
const PLANNING_SPRINT_PLANNED_LIST_NAMES = new Set([
  NORMALIZED_TRELLO_FOR_PLANNING_LIST_NAME,
  "planning",
  "current sprint",
  "in development",
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
  NORMALIZED_TRELLO_MIKE_HOLD_LIST_NAME,
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
  month: number | null;
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
  weighted_story_points: number | null;
};

type ExistingTaskRow = {
  id: string;
  sprint_id: string;
  trello_card_id: string;
  sp_type: TaskRow["sp_type"];
  is_completed: TaskRow["is_completed"];
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
  trello_member_id: string | null;
  trello_username: string | null;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type RequiredTrelloMemberFilter = {
  username: string;
  memberIds: Set<string>;
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
  return card.labels.some((item) => isAdhocLabelName(item.name));
}

function isAdhocLabelName(labelName: string): boolean {
  return normalizeLabel(labelName).replace(/[\s-]+/g, "") === "adhoc";
}

function isAdhocSyncList(listName?: string | null): boolean {
  return ADHOC_SYNC_LIST_NAMES.has(normalizeLabel(listName ?? ""));
}

function isEligibleAdhocSyncCard(
  card: TrelloSprintCard,
  requiredMember: RequiredTrelloMemberFilter,
): boolean {
  return (
    isAdhocCard(card) &&
    isAdhocSyncList(card.list.name) &&
    hasTrelloCardMember(card, requiredMember)
  );
}

function isOtherListAdhocLabelCard(card: TrelloSprintCard): boolean {
  return isAdhocCard(card) && !isAdhocSyncList(card.list.name);
}

function buildActiveSyncCardSet(
  trelloCards: TrelloSprintCard[],
  requiredMember: RequiredTrelloMemberFilter,
  supabaseMemberUsernames: Set<string>,
): TrelloSprintCard[] {
  const cardsById = new Map<string, TrelloSprintCard>();

  for (const card of trelloCards) {
    if (!hasTrelloCardMember(card, requiredMember)) {
      continue;
    }

    if (isEligibleAdhocSyncCard(card, requiredMember)) {
      cardsById.set(card.id, card);
      continue;
    }

    if (isOtherListAdhocLabelCard(card)) {
      cardsById.set(card.id, card);
      continue;
    }

    if (hasAdditionalSupabaseMember(card, supabaseMemberUsernames)) {
      cardsById.set(card.id, card);
    }
  }

  return Array.from(cardsById.values());
}

function getSprintTrelloCardIdsAfterDelete(
  existingTasks: ExistingTaskRow[],
  deletedTaskIds: string[],
): Set<string> {
  const deletedTaskIdSet = new Set(deletedTaskIds);

  return new Set(
    existingTasks
      .filter((task) => !deletedTaskIdSet.has(task.id))
      .map((task) => task.trello_card_id),
  );
}

function shouldInsertActiveSprintTask(
  card: TrelloSprintCard,
  task: TaskRow,
  sprintTrelloCardIds: Set<string>,
  requiredMember: RequiredTrelloMemberFilter,
): boolean {
  if (sprintTrelloCardIds.has(task.trello_card_id)) {
    return false;
  }

  if (task.sp_type === "planned") {
    return false;
  }

  if (isAdhocCard(card) || task.sp_type === "adhoc") {
    return isEligibleAdhocSyncCard(card, requiredMember);
  }

  return true;
}

function resolveRequiredTrelloMemberFilter(
  supabaseMembers: MemberAssigneeRow[],
): RequiredTrelloMemberFilter {
  const username = TRELLO_REQUIRED_MEMBER_USERNAME;
  const normalizedUsername = normalizeLabel(username);
  const memberIds = new Set<string>();

  for (const member of supabaseMembers) {
    if (
      member.trello_member_id &&
      normalizeLabel(member.trello_username ?? "") === normalizedUsername
    ) {
      memberIds.add(member.trello_member_id);
    }
  }

  return { username, memberIds };
}

function hasTrelloCardMember(
  card: TrelloSprintCard,
  requiredMember: RequiredTrelloMemberFilter,
): boolean {
  const normalizedUsername = normalizeLabel(requiredMember.username);

  if (
    requiredMember.memberIds.size > 0 &&
    card.idMembers?.some((memberId) => requiredMember.memberIds.has(memberId))
  ) {
    return true;
  }

  return card.members.some(
    (member) =>
      normalizeLabel(member.username) === normalizedUsername ||
      requiredMember.memberIds.has(member.id),
  );
}

async function enrichRequiredTrelloMemberFromBoards(
  requiredMember: RequiredTrelloMemberFilter,
  boardIds: string[],
): Promise<RequiredTrelloMemberFilter> {
  if (requiredMember.memberIds.size > 0) {
    return requiredMember;
  }

  const memberIds = new Set(requiredMember.memberIds);
  const normalizedUsername = normalizeLabel(requiredMember.username);

  for (const boardId of boardIds) {
    const boardMembers = await getTrelloBoardMembers(boardId);

    for (const member of boardMembers) {
      if (normalizeLabel(member.username) === normalizedUsername) {
        memberIds.add(member.id);
      }
    }
  }

  return { ...requiredMember, memberIds };
}

function filterCardsByRequiredMember(
  trelloCards: TrelloSprintCard[],
  requiredMember: RequiredTrelloMemberFilter,
): TrelloSprintCard[] {
  return trelloCards.filter((card) => hasTrelloCardMember(card, requiredMember));
}

function normalizeSprintStatus(status: string | null | undefined): string {
  return status?.trim().toLowerCase() ?? "";
}

function isPlanningSprintPlannedListName(listName: string): boolean {
  return PLANNING_SPRINT_PLANNED_LIST_NAMES.has(normalizeLabel(listName));
}

function buildPlanningSyncCards(
  trelloCards: TrelloSprintCard[],
  requiredMember: RequiredTrelloMemberFilter,
): TrelloSprintCard[] {
  return filterCardsByRequiredMember(trelloCards, requiredMember).filter(
    (card) =>
      !isAdhocCard(card) && isPlanningSprintPlannedListName(card.list.name),
  );
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

function getSprintPointType(
  card: TrelloSprintCard,
  sprintStatus?: string | null,
): TaskRow["sp_type"] {
  if (normalizeLabel(card.list.name) === "blocked") {
    return "blocked";
  }

  const isPlanningSprint = normalizeSprintStatus(sprintStatus) === "planning";

  // Outside planning, For Planning cards are tracked as done (not planned/adhoc).
  // During planning sync they are included as planned tasks.
  if (isForPlanningTrelloList(card.list.name) && !isPlanningSprint) {
    return "done";
  }

  const plannedListNames = isPlanningSprint
    ? PLANNING_SPRINT_PLANNED_LIST_NAMES
    : PLANNING_SP_TYPE_LIST_NAMES;
  const normalizedListName = normalizeLabel(card.list.name);

  if (!plannedListNames.has(normalizedListName)) {
    return "done";
  }

  if (isAdhocCard(card) && isAdhocSyncList(card.list.name)) {
    return "adhoc";
  }

  return "planned";
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

function getWeightedStoryPoints(
  card: TrelloSprintCard,
  sprint: Pick<SprintRow, "id" | "start_date">,
  cutoffStartDate: string | null,
): number {
  const weightedValue = (() => {
    if (hasCardLabel(card, "Incomplete")) return 0;
    if (!isCompletedList(card.list.name)) return 0;

    return (
      (getStoryPoints(card) *
        getTaskCompletionPercentage(card) *
        getTaskSeverity(card)) /
      100
    );
  })();

  return resolveWeightedStoryPointsForSprint(
    sprint,
    cutoffStartDate,
    weightedValue,
  );
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
  weightedStoryPointsCutoffStartDate: string | null = null,
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
    sp_type: getSprintPointType(card, sprint.status),
    is_completed: getTaskCompletionStatus(card),
    completion_percentage: getTaskCompletionPercentage(card),
    real_story_points: getRealStoryPoints(card),
    weighted_story_points: getWeightedStoryPoints(
      card,
      sprint,
      weightedStoryPointsCutoffStartDate,
    ),
  };
}

async function getCurrentSprint(): Promise<SprintRow | null> {
  const { data, error } = await supabase
    .from("sprints")
    .select(
      "id,project_id,name,sprint_number,start_date,end_date,sprint_year,sprint_month,month,total_planned_points,total_completed_points,blocked_count,planned_tasks_count,adhoc_tasks_count,total_tasks_count,status,is_current",
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
      "id,project_id,name,sprint_number,start_date,end_date,sprint_year,sprint_month,month,total_planned_points,total_completed_points,blocked_count,planned_tasks_count,adhoc_tasks_count,total_tasks_count,status,is_current",
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

function getPreservedSpTypesForSprintUpdate(
  sprintStatus: string | null | undefined,
): Set<TaskRow["sp_type"]> {
  if (normalizeSprintStatus(sprintStatus) === "planning") {
    return new Set();
  }

  return new Set(["planned", "adhoc"]);
}

function shouldPreservePlannedAdhocCompletionStatus(
  sprintStatus: string | null | undefined,
  existingTask: ExistingTaskRow,
): boolean {
  if (normalizeSprintStatus(sprintStatus) !== "active") {
    return false;
  }

  return (
    isPlannedOrAdhocSpType(existingTask.sp_type) &&
    existingTask.is_completed === "pending"
  );
}

function buildTaskUpdateFromCard(
  card: TrelloSprintCard,
  task: TaskRow,
  existingTask: ExistingTaskRow,
  preservedSpTypes: Set<TaskRow["sp_type"]>,
  sprintStatus?: string | null,
  sprint?: Pick<SprintRow, "id" | "start_date">,
  weightedStoryPointsCutoffStartDate: string | null = null,
): Partial<TaskRow> {
  const shouldPreserveSpType =
    existingTask.sprint_id === task.sprint_id &&
    preservedSpTypes.has(existingTask.sp_type);
  const shouldPreserveCompletionStatus =
    shouldPreservePlannedAdhocCompletionStatus(sprintStatus, existingTask);

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
    story_points: task.story_points,
    severity: task.severity,
    status: task.status,
  };

  if (!shouldPreserveCompletionStatus) {
    taskUpdate.completed_at = task.completed_at;
    taskUpdate.is_completed = getTaskCompletionStatus(card);
    taskUpdate.completion_percentage = getTaskCompletionPercentage(card);
    taskUpdate.real_story_points = getRealStoryPoints(card);
    taskUpdate.weighted_story_points = sprint
      ? getWeightedStoryPoints(
          card,
          sprint,
          weightedStoryPointsCutoffStartDate,
        )
      : 0;
  } else {
    // Keep is_completed pending, but refresh earned SP when the card leaves sprint/dev lists.
    taskUpdate.completion_percentage = getTaskCompletionPercentage(card);
    taskUpdate.real_story_points = getRealStoryPoints(card);
    taskUpdate.weighted_story_points = sprint
      ? getWeightedStoryPoints(
          card,
          sprint,
          weightedStoryPointsCutoffStartDate,
        )
      : 0;
  }

  if (!shouldPreserveSpType) {
    taskUpdate.sp_type = task.sp_type;
  }

  return taskUpdate;
}

async function updateSprintTaskFromCard(
  sprint: SprintRow,
  existingTask: ExistingTaskRow,
  card: TrelloSprintCard,
  task: TaskRow,
  preservedSpTypes: Set<TaskRow["sp_type"]>,
  weightedStoryPointsCutoffStartDate: string | null = null,
): Promise<void> {
  assertSprintTasksMutable(sprint);

  const taskUpdate = buildTaskUpdateFromCard(
    card,
    task,
    existingTask,
    preservedSpTypes,
    sprint.status,
    sprint,
    weightedStoryPointsCutoffStartDate,
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
      `Unable to update task details for Trello card ${task.trello_card_id} (task ${existingTask.id}, sprint ${sprint.id}). The task row may have been removed or no longer belongs to this sprint.`,
    );
  }
}

async function reassignPlanningTaskToCurrentSprint(
  sprint: SprintRow,
  existingTask: ExistingTaskRow,
  card: TrelloSprintCard,
  task: TaskRow,
  weightedStoryPointsCutoffStartDate: string | null = null,
): Promise<void> {
  assertCurrentSprintForTaskSync(sprint);
  assertSprintTasksMutable(sprint);

  if (normalizeSprintStatus(sprint.status) !== "planning") {
    throw new Error(
      "Cross-sprint task reassignment is only supported during planning sync.",
    );
  }

  if (!isPlanningSprintPlannedListName(card.list.name)) {
    return;
  }

  const taskUpdate: Partial<TaskRow> = {
    ...buildTaskUpdateFromCard(
      card,
      task,
      existingTask,
      new Set(),
      sprint.status,
      sprint,
      weightedStoryPointsCutoffStartDate,
    ),
    sprint_id: sprint.id,
    sp_type: "planned",
  };

  const { data: updatedRows, error: updateError } = await supabase
    .from("tasks")
    .update(taskUpdate)
    .eq("id", existingTask.id)
    .select("id,sprint_id,trello_list_name");

  if (updateError) {
    throw updateError;
  }

  if (!updatedRows || updatedRows.length === 0) {
    throw new Error(
      `Unable to reassign Trello card ${task.trello_card_id} to the current planning sprint.`,
    );
  }
}

function shouldUpdateTaskFromTrelloCard(
  spType: TaskRow["sp_type"],
  isPlanningSprint: boolean,
): boolean {
  if (isPlanningSprint) {
    return true;
  }

  return isPlannedOrAdhocSpType(spType);
}

async function updatePlannedAdhocTasksFromAllTrelloCards(
  sprint: SprintRow,
  allTrelloCards: TrelloSprintCard[],
  assigneeLookup: Map<string, string>,
  projectTypeLookup: Map<string, string>,
  weightedStoryPointsCutoffStartDate: string | null = null,
): Promise<void> {
  if (allTrelloCards.length === 0) {
    return;
  }

  const isPlanningSprint = normalizeSprintStatus(sprint.status) === "planning";
  const preservedSpTypes = getPreservedSpTypesForSprintUpdate(sprint.status);
  const allCardsById = new Map(
    dedupeTrelloCardsById(allTrelloCards).map((card) => [card.id, card]),
  );
  const currentSprintTasks = await getSupabaseRows<ExistingTaskRow>("tasks", {
    select: "id,sprint_id,trello_card_id,sp_type,is_completed",
    eq: { sprint_id: sprint.id },
  });

  for (const existingTask of currentSprintTasks) {
    if (!shouldUpdateTaskFromTrelloCard(existingTask.sp_type, isPlanningSprint)) {
      continue;
    }

    const card = allCardsById.get(existingTask.trello_card_id);
    if (!card) {
      continue;
    }

    const task = mapCardToTask(
      card,
      sprint,
      assigneeLookup,
      projectTypeLookup,
      weightedStoryPointsCutoffStartDate,
    );
    await updateSprintTaskFromCard(
      sprint,
      existingTask,
      card,
      task,
      preservedSpTypes,
      weightedStoryPointsCutoffStartDate,
    );
  }
}

/**
 * Planned/adhoc tasks still in the DB but missing from the fetched Trello card set
 * are treated as Done Sprint completed so their story points count across related tables.
 */
async function markMissingTrelloPlannedAdhocTasksAsDoneSprint(
  sprint: SprintRow,
  allTrelloCards: TrelloSprintCard[],
  weightedStoryPointsCutoffStartDate: string | null = null,
): Promise<number> {
  if (normalizeSprintStatus(sprint.status) === "planning") {
    return 0;
  }

  assertCurrentSprintForTaskSync(sprint);
  assertSprintTasksMutable(sprint);

  const fetchedTrelloCardIds = new Set(
    dedupeTrelloCardsById(allTrelloCards).map((card) => card.id),
  );

  type MissingDoneSprintTaskRow = {
    id: string;
    story_points: number | null;
    completion_percentage: number | null;
    severity: number | null;
    trello_card_id: string | null;
    trello_list_name: string | null;
    trello_last_synced_at: string | null;
    is_completed: TaskRow["is_completed"];
    sp_type: TaskRow["sp_type"];
  };

  const currentSprintTasks = await getSupabaseRows<MissingDoneSprintTaskRow>(
    "tasks",
    {
      select:
        "id,story_points,completion_percentage,severity,trello_card_id,trello_list_name,trello_last_synced_at,is_completed,sp_type",
      eq: { sprint_id: sprint.id },
    },
  );

  const missingTasks = currentSprintTasks.filter((task) => {
    if (!isPlannedOrAdhocSpType(task.sp_type)) {
      return false;
    }

    const trelloCardId = task.trello_card_id?.trim() ?? "";
    if (!trelloCardId) {
      return true;
    }

    return !fetchedTrelloCardIds.has(trelloCardId);
  });

  if (missingTasks.length === 0) {
    return 0;
  }

  const syncedAt = new Date().toISOString();
  let updated = 0;

  for (const task of missingTasks) {
    const completionPercentage =
      Number(task.completion_percentage) > 0
        ? Number(task.completion_percentage)
        : 100;
    const storyPoints = Number(task.story_points) || 0;
    const severityMultiplier = Number(task.severity) || 1.0;
    const realStoryPoints = (storyPoints * completionPercentage) / 100;
    const weightedStoryPoints = resolveWeightedStoryPointsForSprint(
      sprint,
      weightedStoryPointsCutoffStartDate,
      (storyPoints * completionPercentage * severityMultiplier) / 100,
    );

    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        trello_list_name: CANONICAL_DONE_SPRINT_LIST_NAME,
        is_completed: "completed",
        completed_at: task.trello_last_synced_at ?? syncedAt,
        completion_percentage: completionPercentage,
        real_story_points: realStoryPoints,
        weighted_story_points: weightedStoryPoints,
        trello_last_synced_at: syncedAt,
      })
      .eq("id", task.id)
      .eq("sprint_id", sprint.id);

    if (updateError) {
      throw updateError;
    }

    updated += 1;
  }

  return updated;
}

async function deleteAllTasksForCurrentSprint(
  sprint: SprintRow,
): Promise<number> {
  assertCurrentSprintForTaskSync(sprint);
  assertSprintTasksMutable(sprint);

  const { data: deletedRows, error: deleteError } = await supabase
    .from("tasks")
    .delete()
    .eq("sprint_id", sprint.id)
    .select("id");

  if (deleteError) {
    throw deleteError;
  }

  return deletedRows?.length ?? 0;
}

async function replacePlanningSprintTasks(
  sprint: SprintRow,
  cards: TrelloSprintCard[],
  assigneeLookup: Map<string, string>,
  projectTypeLookup: Map<string, string>,
  weightedStoryPointsCutoffStartDate: string | null = null,
): Promise<{ deleted: number; inserted: number }> {
  if (!sprint.id) {
    throw new Error("Unable to replace tasks without a current sprint id.");
  }

  assertCurrentSprintForTaskSync(sprint);
  assertSprintTasksMutable(sprint);

  if (cards.length === 0) {
    const deletedCount = await deleteAllTasksForCurrentSprint(sprint);
    return { deleted: deletedCount, inserted: 0 };
  }

  const dedupedCards = dedupeTrelloCardsById(cards);
  const tasks = dedupedCards.map((card) =>
    mapCardToTask(
      card,
      sprint,
      assigneeLookup,
      projectTypeLookup,
      weightedStoryPointsCutoffStartDate,
    ),
  );
  const plannedTasksByTrelloCardId = new Map<string, TaskRow>();

  for (let index = 0; index < dedupedCards.length; index++) {
    const task = tasks[index];
    if (task.sp_type !== "planned") {
      continue;
    }

    plannedTasksByTrelloCardId.set(task.trello_card_id, task);
  }

  const eligibleTrelloCardIds = Array.from(plannedTasksByTrelloCardId.keys());
  const existingCurrentSprintTasks = await getSupabaseRows<ExistingTaskRow>("tasks", {
    select: "id,sprint_id,trello_card_id,sp_type,is_completed",
    eq: { sprint_id: sprint.id },
  });
  const { data: existingRowsForIncomingCards, error: existingRowsError } =
    eligibleTrelloCardIds.length > 0
      ? await supabase
          .from("tasks")
          .select("id,sprint_id,trello_card_id,sp_type,is_completed")
          .in("trello_card_id", eligibleTrelloCardIds)
      : { data: [], error: null };

  if (existingRowsError) {
    throw existingRowsError;
  }

  const currentSprintTasksByTrelloCardId = new Map(
    existingCurrentSprintTasks.map((task) => [task.trello_card_id, task]),
  );
  const otherSprintTasksByTrelloCardId = new Map(
    ((existingRowsForIncomingCards ?? []) as ExistingTaskRow[])
      .filter((task) => task.sprint_id !== sprint.id)
      .map((task) => [task.trello_card_id, task]),
  );
  const preservedSpTypes = getPreservedSpTypesForSprintUpdate(sprint.status);
  const tasksToInsert: TaskRow[] = [];
  let syncedCount = 0;

  for (const card of dedupedCards) {
    const task = plannedTasksByTrelloCardId.get(card.id);
    if (!task) {
      continue;
    }

    const existingCurrentSprintTask = currentSprintTasksByTrelloCardId.get(
      task.trello_card_id,
    );
    if (existingCurrentSprintTask) {
      await updateSprintTaskFromCard(
        sprint,
        existingCurrentSprintTask,
        card,
        task,
        preservedSpTypes,
        weightedStoryPointsCutoffStartDate,
      );
      syncedCount += 1;
      continue;
    }

    const otherSprintTask = otherSprintTasksByTrelloCardId.get(task.trello_card_id);
    if (otherSprintTask) {
      await reassignPlanningTaskToCurrentSprint(
        sprint,
        otherSprintTask,
        card,
        task,
        weightedStoryPointsCutoffStartDate,
      );
      syncedCount += 1;
      continue;
    }

    tasksToInsert.push(task);
  }

  let insertedCount = 0;

  if (tasksToInsert.length > 0) {
    const { data, error: insertError } = await supabase
      .from("tasks")
      .insert(tasksToInsert)
      .select("trello_card_id");

    if (insertError) {
      throw insertError;
    }

    insertedCount = data?.length ?? tasksToInsert.length;
    syncedCount += insertedCount;
  }

  const eligibleTrelloCardIdSet = new Set(eligibleTrelloCardIds);
  const taskIdsToDelete = existingCurrentSprintTasks
    .filter((task) => !eligibleTrelloCardIdSet.has(task.trello_card_id))
    .map((task) => task.id);
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

  return {
    deleted: deletedCount,
    inserted: syncedCount,
  };
}

async function replaceSprintTasks(
  sprint: SprintRow,
  cards: TrelloSprintCard[],
  assigneeLookup: Map<string, string>,
  projectTypeLookup: Map<string, string>,
  allTrelloCards: TrelloSprintCard[] = cards,
  requiredTrelloMember?: RequiredTrelloMemberFilter,
  weightedStoryPointsCutoffStartDate: string | null = null,
): Promise<{ deleted: number; inserted: number }> {
  if (normalizeSprintStatus(sprint.status) === "planning") {
    return replacePlanningSprintTasks(
      sprint,
      cards,
      assigneeLookup,
      projectTypeLookup,
      weightedStoryPointsCutoffStartDate,
    );
  }

  if (!sprint.id) {
    throw new Error("Unable to replace tasks without a current sprint id.");
  }

  assertSprintTasksMutable(sprint);

  const existingTasks = await getSupabaseRows<ExistingTaskRow>("tasks", {
    select: "id,sprint_id,trello_card_id,sp_type,is_completed",
    eq: { sprint_id: sprint.id },
  });
  const isPlanningSprint = normalizeSprintStatus(sprint.status) === "planning";
  const preservedSpTypes = getPreservedSpTypesForSprintUpdate(sprint.status);
  const taskIdsToDelete = existingTasks
    .filter((task) => shouldDeleteExistingTask(task, isPlanningSprint))
    .map((task) => task.id);
  const deletedTaskIdSet = new Set(taskIdsToDelete);
  const survivingExistingTasks = existingTasks.filter(
    (task) => !deletedTaskIdSet.has(task.id),
  );
  const existingSprintTasksByTrelloCardId = new Map(
    survivingExistingTasks.map((task) => [task.trello_card_id, task]),
  );
  const preservedTasksByTrelloCardId = new Map(
    survivingExistingTasks
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

  const sprintTrelloCardIds = getSprintTrelloCardIdsAfterDelete(
    existingTasks,
    taskIdsToDelete,
  );
  const tasksToInsert: TaskRow[] = [];

  if (cards.length > 0) {
    const dedupedCards = dedupeTrelloCardsById(cards);
    const tasks = dedupedCards.map((card) =>
      mapCardToTask(
        card,
        sprint,
        assigneeLookup,
        projectTypeLookup,
        weightedStoryPointsCutoffStartDate,
      ),
    );
    const incomingTrelloCardIds = tasks.map((task) => task.trello_card_id);
    const { data: existingRowsForIncomingCards, error: existingRowsError } =
      incomingTrelloCardIds.length > 0
        ? await supabase
            .from("tasks")
            .select("id,sprint_id,trello_card_id,sp_type,is_completed")
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
    const otherSprintTasksByTrelloCardId = new Map(
      ((existingRowsForIncomingCards ?? []) as ExistingTaskRow[])
        .filter((task) => task.sprint_id !== sprint.id)
        .map((task) => [task.trello_card_id, task]),
    );

    for (let index = 0; index < dedupedCards.length; index++) {
      const card = dedupedCards[index];
      const task = tasks[index];

      if (task.sprint_id !== sprint.id) {
        continue;
      }

      const existingTask =
        preservedTasksByTrelloCardId.get(task.trello_card_id) ??
        existingSprintTasksByTrelloCardId.get(task.trello_card_id) ??
        existingTasksByTrelloCardId.get(task.trello_card_id);

      if (existingTask) {
        await updateSprintTaskFromCard(
          sprint,
          existingTask,
          card,
          task,
          preservedSpTypes,
          weightedStoryPointsCutoffStartDate,
        );
        continue;
      }

      const otherSprintTask = otherSprintTasksByTrelloCardId.get(
        task.trello_card_id,
      );
      if (otherSprintTask) {
        continue;
      }

      if (
        !shouldInsertActiveSprintTask(
          card,
          task,
          sprintTrelloCardIds,
          requiredTrelloMember ?? resolveRequiredTrelloMemberFilter([]),
        )
      ) {
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
      weightedStoryPointsCutoffStartDate,
    );
    await markMissingTrelloPlannedAdhocTasksAsDoneSprint(
      sprint,
      allTrelloCards,
      weightedStoryPointsCutoffStartDate,
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
    weightedStoryPointsCutoffStartDate,
  );
  await markMissingTrelloPlannedAdhocTasksAsDoneSprint(
    sprint,
    allTrelloCards,
    weightedStoryPointsCutoffStartDate,
  );

  return {
    deleted: deletedCount,
    inserted: data?.length ?? tasksToInsert.length,
  };
}

async function getSavedSprintTasks(sprintId: string): Promise<TaskRow[]> {
  return getSupabaseRows<TaskRow>("tasks", {
    select:
      "id,sprint_id,project_id,project_type,project,assigned_to,trello_card_id,trello_short_id,trello_board_id,trello_card_url,trello_list_name,trello_last_synced_at,title,description,task_type,priority,completed_at,story_points,severity,status,sp_type,is_completed,completion_percentage,real_story_points,weighted_story_points",
    eq: { sprint_id: sprintId },
  });
}

function shouldUpdateSprintTaskScores(sprintStatus: string): boolean {
  return sprintStatus === "active" || sprintStatus === "completed";
}

function shouldMutateSprintTasks(sprintStatus: string): boolean {
  const status = normalizeSprintStatus(sprintStatus);

  return status === "planning" || status === "active";
}

async function replaceSprintStoryPoints(
  sprint: SprintRow,
  tasks: TaskRow[],
): Promise<void> {
  const storyPointsByMember = new Map<string, StoryPointRow>();
  const sprintStatus = normalizeSprintStatus(sprint.status);
  const shouldUpdateAssignedStoryPoints =
    sprintStatus === "planning" || sprintStatus === "active";
  const shouldUpdateAdhocStoryPoints = sprintStatus === "active";
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
      // Keep Encode Story Points + Scoreboard on the same story_points project rows.
      project_id: ENCODE_STORY_POINTS_PROJECT_ID,
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
  trelloCards?: TrelloSprintCard[],
): Promise<void> {
  const sprintTasks = tasks.filter((task) => task.sprint_id === sprint.id);
  const { planned: plannedTasksCount, adhoc: adhocTasksCount } =
    countPlannedAndAdhocTasks(sprintTasks);
  const blockedCount = trelloCards
    ? countBlockedTrelloCards(trelloCards)
    : sprintTasks.filter(
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

export type SyncProgressUpdate = {
  percent: number;
  label?: string;
};

export type SyncCurrentSprintTasksOptions = {
  sprintId?: string;
  sprintStatus?: string;
  onProgress?: (update: SyncProgressUpdate) => void;
};

function reportSyncProgress(
  onProgress: SyncCurrentSprintTasksOptions["onProgress"],
  percent: number,
  label?: string,
): void {
  onProgress?.({
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    label,
  });
}

function isCurrentSprintFlag(
  value: number | boolean | null | undefined,
): boolean {
  return value === 1 || value === true;
}

function assertCurrentSprintForTaskSync(
  sprint: Pick<SprintRow, "is_current" | "name">,
): void {
  if (!isCurrentSprintFlag(sprint.is_current)) {
    const sprintLabel = sprint.name?.trim() || "This sprint";
    throw new Error(
      `${sprintLabel} is not the current sprint. Task sync only affects tasks for the current sprint.`,
    );
  }
}

const OPEN_NEW_SPRINT_ALLOWED_STATUSES = new Set([
  "active",
  "completed",
  "done",
]);

function assertOpenNewSprintTarget(sprint: SprintRow): void {
  const sprintStatus = normalizeSprintStatus(sprint.status);

  if (!OPEN_NEW_SPRINT_ALLOWED_STATUSES.has(sprintStatus)) {
    throw new Error(
      `Open New Sprint can only modify tasks for an active or completed sprint. "${sprint.name}" has status "${sprint.status}".`,
    );
  }

  // Allow already-demoted completed/done sprints so a failed Open New Sprint
  // (demote succeeded, insert failed) can be retried safely.
  const isCloseableWithoutCurrent =
    sprintStatus === "completed" || sprintStatus === "done";

  if (
    !isCurrentSprintFlag(sprint.is_current) &&
    !isCloseableWithoutCurrent
  ) {
    throw new Error(
      "Open New Sprint can only modify tasks for the current sprint.",
    );
  }
}

export async function finalizePendingPlannedAdhocTasksOnOpenNewSprint(
  sprintId: string,
): Promise<{ updated: number; deleted: number }> {
  const sprint = await getSprintById(sprintId);

  if (!sprint) {
    throw new Error(`Sprint not found: ${sprintId}`);
  }

  assertOpenNewSprintTarget(sprint);

  const sprintStatus = normalizeSprintStatus(sprint.status);
  const { data: deletedRows, error: deleteError } = await supabase
    .from("tasks")
    .delete()
    .eq("sprint_id", sprint.id)
    .not("sp_type", "in", '("planned","adhoc")')
    .select("id");

  if (deleteError) {
    throw deleteError;
  }

  const deleted = deletedRows?.length ?? 0;

  if (sprintStatus !== "active") {
    return { updated: 0, deleted };
  }

  const syncedAt = new Date().toISOString();
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(
      "id,story_points,completion_percentage,severity,trello_last_synced_at",
    )
    .eq("sprint_id", sprint.id)
    .eq("is_completed", "pending")
    .in("sp_type", ["planned", "adhoc"]);

  if (error) {
    throw error;
  }

  let updated = 0;
  const weightedStoryPointsCutoffStartDate =
    await getWeightedStoryPointsCutoffStartDate();

  for (const task of tasks ?? []) {
    const completionPercentage =
      task.completion_percentage > 0 ? task.completion_percentage : 100;
    const storyPoints = Number(task.story_points) || 0;
    const severityMultiplier = Number(task.severity) || 1.0;
    const realStoryPoints = (storyPoints * completionPercentage) / 100;
    const weightedStoryPoints = resolveWeightedStoryPointsForSprint(
      sprint,
      weightedStoryPointsCutoffStartDate,
      (storyPoints * completionPercentage * severityMultiplier) / 100,
    );

    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        is_completed: "completed",
        completed_at: task.trello_last_synced_at ?? syncedAt,
        completion_percentage: completionPercentage,
        real_story_points: realStoryPoints,
        weighted_story_points: weightedStoryPoints,
      })
      .eq("id", task.id)
      .eq("sprint_id", sprint.id);

    if (updateError) {
      throw updateError;
    }

    updated += 1;
  }

  return { updated, deleted };
}

function assertReopenSprintTarget(sprint: SprintRow): void {
  if (!isCurrentSprintFlag(sprint.is_current)) {
    throw new Error(
      "Reopen Sprint can only modify tasks for the current sprint.",
    );
  }

  if (normalizeSprintStatus(sprint.status) !== "active") {
    throw new Error(
      `Reopen Sprint can only modify tasks for an active sprint. "${sprint.name}" has status "${sprint.status}".`,
    );
  }
}

export async function resetPlannedAdhocTasksToPendingOnReopenSprint(
  sprintId: string,
): Promise<{ updated: number }> {
  const sprint = await getSprintById(sprintId);

  if (!sprint) {
    throw new Error(`Sprint not found: ${sprintId}`);
  }

  assertReopenSprintTarget(sprint);

  const { data: updatedRows, error } = await supabase
    .from("tasks")
    .update({
      is_completed: "pending",
      completed_at: null,
    })
    .eq("sprint_id", sprint.id)
    .in("sp_type", ["planned", "adhoc"])
    .eq("is_completed", "completed")
    .select("id");

  if (error) {
    throw error;
  }

  return { updated: updatedRows?.length ?? 0 };
}

/**
 * After a sprint is marked completed, refresh every datastore Encode Story Points
 * and Scoreboard rely on (story_points, sprint_story_points, sprint/member scores).
 */
export async function finalizeCompletedSprintData(
  sprintId: string,
): Promise<void> {
  const sprint = await getSprintById(sprintId);
  if (!sprint) {
    throw new Error(`Sprint not found: ${sprintId}`);
  }

  const completedSprint = {
    ...sprint,
    status: "completed",
  };
  const savedTasks = await getSavedSprintTasks(sprintId);

  await replaceSprintStoryPoints(completedSprint, savedTasks);
  await replaceSprintStoryPointBreakdown(completedSprint, savedTasks);
  await finalizeCompletedSprintScores(sprintId);
}

export async function syncCurrentSprintTasks(
  options: SyncCurrentSprintTasksOptions = {},
): Promise<{
  cards: TrelloSprintCard[];
  result: SprintSyncResult;
}> {
  const {
    sprintId: expectedSprintId,
    sprintStatus: expectedSprintStatus,
    onProgress,
  } = options;

  reportSyncProgress(onProgress, 2, "Preparing sync");
  const currentSprint = await getCurrentSprint();

  if (!currentSprint) {
    reportSyncProgress(onProgress, 100, "Skipped");
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

  if (expectedSprintId && currentSprint.id !== expectedSprintId) {
    reportSyncProgress(onProgress, 100, "Skipped");
    return {
      cards: [],
      result: {
        action: "skipped",
        message: "Selected sprint is not the current sprint, so Trello sync was stopped.",
        sprint: currentSprint,
        cardsFetched: 0,
        tasksDeleted: 0,
        tasksInserted: 0,
      },
    };
  }

  reportSyncProgress(onProgress, 8, "Loading sprint");
  const loadedSprint = expectedSprintId
    ? await getSprintById(expectedSprintId)
    : currentSprint;

  if (!loadedSprint) {
    reportSyncProgress(onProgress, 100, "Skipped");
    return {
      cards: [],
      result: {
        action: "skipped",
        message: "Sprint not found, so Trello sync was stopped.",
        sprint: null,
        cardsFetched: 0,
        tasksDeleted: 0,
        tasksInserted: 0,
      },
    };
  }

  const sprint =
    expectedSprintStatus !== undefined && expectedSprintStatus !== ""
      ? { ...loadedSprint, status: expectedSprintStatus }
      : loadedSprint;

  if (!isCurrentSprintFlag(loadedSprint.is_current)) {
    reportSyncProgress(onProgress, 100, "Skipped");
    return {
      cards: [],
      result: {
        action: "skipped",
        message:
          "Selected sprint is not the current sprint, so Trello sync was stopped.",
        sprint: loadedSprint,
        cardsFetched: 0,
        tasksDeleted: 0,
        tasksInserted: 0,
      },
    };
  }

  const sprintStatus = normalizeSprintStatus(sprint.status);

  if (
    sprintStatus !== "planning" &&
    sprintStatus !== "active" &&
    sprintStatus !== "completed" &&
    sprintStatus !== "done"
  ) {
    reportSyncProgress(onProgress, 100, "Skipped");
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

  reportSyncProgress(onProgress, 16, "Loading members");
  const [supabaseMembers, projectTypes] = await Promise.all([
    getSupabaseRows<MemberAssigneeRow>("members", {
      select:
        "id,auth_user_id,trello_member_id,trello_username,email,full_name,first_name,last_name",
    }),
    getSupabaseRows<ProjectTypeRow>("project_type", {
      select: "id,name",
    }),
  ]);
  const assigneeLookup = buildAssigneeLookup(supabaseMembers);
  const projectTypeLookup = buildProjectTypeLookup(projectTypes);

  reportSyncProgress(onProgress, 28, "Resolving Trello members");
  const requiredTrelloMember = await enrichRequiredTrelloMemberFromBoards(
    resolveRequiredTrelloMemberFilter(supabaseMembers),
    [...ORIGINAL_TRELLO_BOARD_IDS, ...EXTRA_TRELLO_BOARD_IDS],
  );
  const requiredMemberTrelloIds = Array.from(requiredTrelloMember.memberIds);
  const fetchMemberIds =
    requiredMemberTrelloIds.length > 0 ? requiredMemberTrelloIds : "all";

  reportSyncProgress(onProgress, 40, "Fetching Trello cards");
  const [originalBoardCards, extraBoardCards] = await Promise.all([
    getTrelloSprintCards({
      boardIds: ORIGINAL_TRELLO_BOARD_IDS,
      listNames: ORIGINAL_TRELLO_LIST_NAMES,
      customFieldNames: TRELLO_CUSTOM_FIELD_NAMES,
      memberIds: fetchMemberIds,
    }),
    getTrelloSprintCards({
      boardIds: EXTRA_TRELLO_BOARD_IDS,
      listNames: EXTRA_TRELLO_LIST_NAMES,
      customFieldNames: TRELLO_CUSTOM_FIELD_NAMES,
      memberIds: fetchMemberIds,
    }),
  ]);
  const trelloCards = filterCardsByRequiredMember(
    mergeTrelloCardsByListName([originalBoardCards, extraBoardCards]),
    requiredTrelloMember,
  );
  const supabaseMemberUsernames = new Set(
    supabaseMembers
      .map((member) => member.trello_username)
      .filter((username): username is string => Boolean(username))
      .map(normalizeLabel),
  );
  const primaryCards =
    sprintStatus === "planning"
      ? buildPlanningSyncCards(trelloCards, requiredTrelloMember)
      : buildActiveSyncCardSet(
          trelloCards,
          requiredTrelloMember,
          supabaseMemberUsernames,
        );
  const cards = primaryCards;
  const weightedStoryPointsCutoffStartDate =
    await getWeightedStoryPointsCutoffStartDate();
  let taskCounts = { deleted: 0, inserted: 0 };

  reportSyncProgress(onProgress, 58, "Updating sprint tasks");
  if (shouldMutateSprintTasks(sprintStatus)) {
    assertCurrentSprintForTaskSync(sprint);
    taskCounts = await replaceSprintTasks(
      sprint,
      cards,
      assigneeLookup,
      projectTypeLookup,
      sprintStatus === "planning" ? cards : trelloCards,
      requiredTrelloMember,
      weightedStoryPointsCutoffStartDate,
    );
  }

  // Every successful Trello sync refreshes story points from the final saved task rows.
  reportSyncProgress(onProgress, 72, "Refreshing story points");
  const savedTasks = await getSavedSprintTasks(sprint.id);
  await updateSprintTaskAggregates(sprint, savedTasks, trelloCards);
  await replaceSprintStoryPoints(sprint, savedTasks);
  await replaceSprintStoryPointBreakdown(sprint, savedTasks);

  reportSyncProgress(onProgress, 88, "Updating scores");
  if (shouldUpdateSprintTaskScores(sprintStatus)) {
    await replaceSprintTaskScores(
      sprint.id,
      sprint.month ?? sprint.sprint_month ?? null,
      cards,
    );
    await replaceSprintAndMemberScores(
      sprint.id,
      sprintStatus,
      savedTasks,
      trelloCards,
      sprint,
      weightedStoryPointsCutoffStartDate,
    );
  } else {
    await clearSprintTaskScores(sprint.id);
    await clearSprintAndMemberScores(sprint.id);
  }

  reportSyncProgress(onProgress, 100, "Complete");
  return {
    cards,
    result: {
      action: "synced",
      message: "Current sprint tasks synced from Trello.",
      sprint,
      cardsFetched: trelloCards.length,
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
    select: "id,sprint_id,trello_card_id,trello_board_id,trello_card_url,sp_type,is_completed",
    eq: { id: taskId, sprint_id: sprintId },
    limit: 1,
  });

  if (!existingTask) {
    throw new Error("Task not found for the selected sprint.");
  }

  const sprint = await getSprintById(sprintId);
  if (!sprint) {
    throw new Error("Sprint not found.");
  }

  assertSprintTasksMutable(sprint);

  if (!existingTask.trello_card_id?.trim() || !existingTask.trello_board_id?.trim()) {
    throw new Error("Task is missing Trello card metadata required for story point sync.");
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
      select:
        "id,auth_user_id,trello_member_id,trello_username,email,full_name,first_name,last_name",
    }),
    getSupabaseRows<ProjectTypeRow>("project_type", {
      select: "id,name",
    }),
  ]);

  const assigneeLookup = buildAssigneeLookup(supabaseMembers);
  const projectTypeLookup = buildProjectTypeLookup(projectTypes);
  const weightedStoryPointsCutoffStartDate =
    await getWeightedStoryPointsCutoffStartDate();
  const mappedTask = mapCardToTask(
    resolvedCard,
    sprint,
    assigneeLookup,
    projectTypeLookup,
    weightedStoryPointsCutoffStartDate,
  );

  await updateSprintTaskFromCard(
    sprint,
    existingTask,
    resolvedCard,
    mappedTask,
    getPreservedSpTypesForSprintUpdate(sprint.status),
    weightedStoryPointsCutoffStartDate,
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

type SprintTaskScoreSourceRow = {
  task_id: string;
  trello_card_id: string;
  member_id: string | null;
  short_id: number | null;
  trello_name: string;
  short_url: string | null;
  story_points: number;
  completion_rate: number;
  severity_multiplier: number;
  project: string | null;
};

export type RebuildSprintTasksFromTaskScoresResult = {
  sprintId: string;
  scoresLoaded: number;
  cardsFetched: number;
  missingTrelloCardIds: string[];
  tasksUpdated: number;
  tasksInserted: number;
  tasksDeleted: number;
  skippedScoreRows: number;
  planned: number;
  adhoc: number;
};

function normalizeScoreCompletionRate(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 100;
  }

  return Math.min(Math.max(value, 0), 100);
}

function normalizeScoreSeverityMultiplier(
  value: number | null | undefined,
): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 1.0;
  }

  return value;
}

function getRebuildSpType(card: TrelloSprintCard): TaskRow["sp_type"] {
  return isAdhocCard(card) ? "adhoc" : "planned";
}

function getRealStoryPointsFromValues(
  card: TrelloSprintCard,
  storyPoints: number,
  completionPercentage: number,
): number {
  if (hasCardLabel(card, "Incomplete")) return 0;
  if (!isCompletedList(card.list.name)) return 0;

  return (storyPoints * completionPercentage) / 100;
}

function getWeightedStoryPointsFromValues(
  card: TrelloSprintCard,
  storyPoints: number,
  completionPercentage: number,
  severityMultiplier: number,
): number {
  if (hasCardLabel(card, "Incomplete")) return 0;
  if (!isCompletedList(card.list.name)) return 0;

  return (storyPoints * completionPercentage * severityMultiplier) / 100;
}

function mapCardToTaskFromScore(
  card: TrelloSprintCard,
  sprint: SprintRow,
  score: SprintTaskScoreSourceRow,
  assigneeLookup: Map<string, string>,
  projectTypeLookup: Map<string, string>,
  weightedStoryPointsCutoffStartDate: string | null = null,
): TaskRow {
  const task = mapCardToTask(
    card,
    sprint,
    assigneeLookup,
    projectTypeLookup,
    weightedStoryPointsCutoffStartDate,
  );
  const storyPoints = Number.isFinite(score.story_points)
    ? score.story_points
    : task.story_points;
  const completionPercentage = normalizeScoreCompletionRate(
    score.completion_rate,
  );
  const severityMultiplier = normalizeScoreSeverityMultiplier(
    score.severity_multiplier,
  );

  return {
    ...task,
    story_points: storyPoints,
    assigned_to: score.member_id ?? task.assigned_to,
    project: score.project?.trim() || task.project,
    severity: severityMultiplier,
    completion_percentage: completionPercentage,
    sp_type: getRebuildSpType(card),
    real_story_points: getRealStoryPointsFromValues(
      card,
      storyPoints,
      completionPercentage,
    ),
    weighted_story_points: resolveWeightedStoryPointsForSprint(
      sprint,
      weightedStoryPointsCutoffStartDate,
      getWeightedStoryPointsFromValues(
        card,
        storyPoints,
        completionPercentage,
        severityMultiplier,
      ),
    ),
  };
}

async function loadSprintTaskScoresSnapshot(
  sprintId: string,
): Promise<SprintTaskScoreSourceRow[]> {
  const { data, error } = await supabase
    .from("sprint_task_scores")
    .select(
      "task_id,trello_card_id,member_id,short_id,trello_name,short_url,story_points,completion_rate,severity_multiplier,project",
    )
    .eq("sprint_id", sprintId);

  if (error) {
    throw error;
  }

  return (data ?? []) as SprintTaskScoreSourceRow[];
}

async function deleteSprintTasksNotLinkedToScores(
  sprint: SprintRow,
  scoreLinkedTaskIds: Set<string>,
): Promise<number> {
  assertSprintTasksMutable(sprint);

  const existingTasks = await getSupabaseRows<{ id: string }>("tasks", {
    select: "id",
    eq: { sprint_id: sprint.id },
  });
  const taskIdsToDelete = existingTasks
    .map((task) => task.id)
    .filter((taskId) => !scoreLinkedTaskIds.has(taskId));

  if (taskIdsToDelete.length === 0) {
    return 0;
  }

  const { data: deletedRows, error: deleteError } = await supabase
    .from("tasks")
    .delete()
    .eq("sprint_id", sprint.id)
    .in("id", taskIdsToDelete)
    .select("id");

  if (deleteError) {
    throw deleteError;
  }

  return deletedRows?.length ?? taskIdsToDelete.length;
}

async function fetchTrelloCardsForScoreRows(
  scoreRows: SprintTaskScoreSourceRow[],
): Promise<{
  cardsById: Map<string, TrelloSprintCard>;
  missingTrelloCardIds: string[];
}> {
  const uniqueCardIds = [
    ...new Set(scoreRows.map((row) => row.trello_card_id).filter(Boolean)),
  ];
  const cardsById = new Map<string, TrelloSprintCard>();
  const missingTrelloCardIds: string[] = [];

  await Promise.all(
    uniqueCardIds.map(async (cardId) => {
      try {
        const card = await getTrelloSprintCardById(cardId, {
          customFieldNames: TRELLO_CUSTOM_FIELD_NAMES,
          storyPointSource: "customFieldOnly",
        });
        cardsById.set(cardId, card);
      } catch {
        missingTrelloCardIds.push(cardId);
      }
    }),
  );

  return { cardsById, missingTrelloCardIds };
}

export function isSprintEligibleForTaskScoreRebuild(
  sprint: Pick<SprintRow, "status" | "is_current">,
): boolean {
  if (sprint.is_current === 1) {
    return false;
  }

  return !isFrozenSprint(sprint);
}

function getTaskScoreRebuildErrorMessage(sprint: SprintRow): string {
  if (sprint.is_current === 1) {
    return `Sprint rebuild is limited to non-current past sprints. "${sprint.name}" is the current sprint.`;
  }

  if (isFrozenSprint(sprint)) {
    return getFrozenSprintTasksErrorMessage(sprint);
  }

  return `Sprint rebuild is not available for "${sprint.name}" with status "${sprint.status}".`;
}

export async function rebuildSprintTasksFromTaskScores(
  sprintId: string,
): Promise<RebuildSprintTasksFromTaskScoresResult> {
  const sprint = await getSprintById(sprintId);

  if (!sprint) {
    throw new Error(`Sprint not found: ${sprintId}`);
  }

  if (!isSprintEligibleForTaskScoreRebuild(sprint)) {
    throw new Error(getTaskScoreRebuildErrorMessage(sprint));
  }

  assertSprintTasksMutable(sprint);

  const scoreRows = await loadSprintTaskScoresSnapshot(sprintId);

  if (scoreRows.length === 0) {
    throw new Error(
      `No sprint_task_scores rows found for sprint ${sprintId}. Load scores before rebuilding tasks.`,
    );
  }

  const [supabaseMembers, projectTypes, { cardsById, missingTrelloCardIds }] =
    await Promise.all([
      getSupabaseRows<MemberAssigneeRow>("members", {
        select:
          "id,auth_user_id,trello_member_id,trello_username,email,full_name,first_name,last_name",
      }),
      getSupabaseRows<ProjectTypeRow>("project_type", {
        select: "id,name",
      }),
      fetchTrelloCardsForScoreRows(scoreRows),
    ]);
  const assigneeLookup = buildAssigneeLookup(supabaseMembers);
  const projectTypeLookup = buildProjectTypeLookup(projectTypes);
  const weightedStoryPointsCutoffStartDate =
    await getWeightedStoryPointsCutoffStartDate();
  const scoreLinkedTaskIds = new Set(scoreRows.map((row) => row.task_id));
  const existingTaskIds = new Set(
    (
      await getSupabaseRows<{ id: string }>("tasks", {
        select: "id",
        eq: { sprint_id: sprintId },
      })
    ).map((task) => task.id),
  );
  let tasksUpdated = 0;
  let tasksInserted = 0;
  let skippedScoreRows = 0;
  let planned = 0;
  let adhoc = 0;

  for (const score of scoreRows) {
    const card = cardsById.get(score.trello_card_id);
    if (!card) {
      skippedScoreRows += 1;
      continue;
    }

    const task = mapCardToTaskFromScore(
      card,
      sprint,
      score,
      assigneeLookup,
      projectTypeLookup,
      weightedStoryPointsCutoffStartDate,
    );

    if (task.sp_type === "planned") {
      planned += 1;
    } else if (task.sp_type === "adhoc") {
      adhoc += 1;
    }

    if (existingTaskIds.has(score.task_id)) {
      const { error: updateError } = await supabase
        .from("tasks")
        .update(task)
        .eq("id", score.task_id)
        .eq("sprint_id", sprintId);

      if (updateError) {
        throw updateError;
      }

      tasksUpdated += 1;
      continue;
    }

    const { error: insertError } = await supabase
      .from("tasks")
      .insert({ ...task, id: score.task_id });

    if (insertError) {
      throw insertError;
    }

    existingTaskIds.add(score.task_id);
    tasksInserted += 1;
  }

  if (tasksUpdated + tasksInserted === 0) {
    throw new Error(
      `Unable to rebuild tasks for sprint ${sprintId}: no Trello cards could be loaded from sprint_task_scores.`,
    );
  }

  const tasksDeleted = await deleteSprintTasksNotLinkedToScores(
    sprint,
    scoreLinkedTaskIds,
  );

  return {
    sprintId,
    scoresLoaded: scoreRows.length,
    cardsFetched: cardsById.size,
    missingTrelloCardIds,
    tasksUpdated,
    tasksInserted,
    tasksDeleted,
    skippedScoreRows,
    planned,
    adhoc,
  };
}
