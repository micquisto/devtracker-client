import { supabase } from "@/lib/supabase";
import type { TrelloSprintCard } from "./trello.utils";

export type SprintTaskScoreTaskRow = {
  id: string;
  trello_card_id: string;
  assigned_to: string | null;
  sp_type: "planned" | "adhoc" | "done" | "blocked";
  title: string;
  trello_short_id: number | null;
  trello_card_url: string | null;
  story_points: number;
  severity: number;
  completion_percentage: number;
  project: string | null;
};

export type SprintTaskScoreInsertRow = {
  sprint_id: string;
  task_id: string;
  trello_card_id: string;
  member_id: string | null;
  short_id: number | null;
  trello_name: string;
  short_url: string | null;
  story_points: number;
  completion_rate: number;
  severity_multiplier: number;
  reject_count: number | null;
  project: string | null;
  month: number | null;
};

export type SprintTaskScoreCounts = {
  planned: number;
  adhoc: number;
  total: number;
};

export type ReplaceSprintTaskScoresResult = SprintTaskScoreCounts & {
  upserted: number;
  deleted: number;
};

const SPRINT_TASK_SCORE_TASK_SELECT =
  "id,trello_card_id,assigned_to,sp_type,title,trello_short_id,trello_card_url,story_points,severity,completion_percentage,project";

const PLANNED_OR_ADHOC_SP_TYPES = ["planned", "adhoc"] as const;

function getCustomFieldValue(
  card: TrelloSprintCard,
  fieldName: string,
): string | null {
  const value = card.customFields[fieldName];
  if (value === undefined || value === null || value === "") return null;

  return String(value);
}

export function getSeverityMultiplierFromCard(card: TrelloSprintCard): number {
  const severity = getCustomFieldValue(card, "Severity")?.trim().toUpperCase();

  if (severity === "P1") return 1.3;
  if (severity === "P2") return 1.2;
  if (severity === "P3") return 1.1;
  if (severity === "P4") return 1.0;

  return 1.0;
}

export function getCompletionRateFromCard(card: TrelloSprintCard): number {
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

function getRejectCountFromCard(card: TrelloSprintCard): number | null {
  const rawValue = getCustomFieldValue(card, "Reject Count");
  if (!rawValue) return null;

  const parsedValue = Number(rawValue.trim());
  if (!Number.isFinite(parsedValue)) return null;

  return Math.trunc(parsedValue);
}

function getStoryPointsFromCard(card: TrelloSprintCard): number {
  return Number.isFinite(card.storyPoints) ? card.storyPoints ?? 0 : 0;
}

function normalizeCompletionRate(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 100;
  }

  return Math.min(Math.max(value, 0), 100);
}

function normalizeSeverityMultiplier(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 1.0;
  }

  return value;
}

export function countPlannedAndAdhocTasks(
  tasks: Pick<SprintTaskScoreTaskRow, "sp_type">[],
): SprintTaskScoreCounts {
  const planned = tasks.filter((task) => task.sp_type === "planned").length;
  const adhoc = tasks.filter((task) => task.sp_type === "adhoc").length;

  return {
    planned,
    adhoc,
    total: planned + adhoc,
  };
}

function buildTrelloCardsById(
  cards: TrelloSprintCard[],
): Map<string, TrelloSprintCard> {
  const cardsById = new Map<string, TrelloSprintCard>();

  for (const card of cards) {
    cardsById.set(card.id, card);
  }

  return cardsById;
}

export function mapTaskToSprintTaskScoreRow(
  task: SprintTaskScoreTaskRow,
  sprintId: string,
  month: number | null,
  card: TrelloSprintCard | null,
): SprintTaskScoreInsertRow {
  return {
    sprint_id: sprintId,
    task_id: task.id,
    trello_card_id: task.trello_card_id,
    member_id: task.assigned_to ?? null,
    short_id: task.trello_short_id ?? card?.idShort ?? null,
    trello_name: task.title.trim() || card?.name || task.trello_card_id,
    short_url: task.trello_card_url ?? card?.shortUrl ?? card?.url ?? null,
    story_points: Number.isFinite(task.story_points)
      ? task.story_points
      : card
        ? getStoryPointsFromCard(card)
        : 0,
    completion_rate: normalizeCompletionRate(task.completion_percentage),
    severity_multiplier: normalizeSeverityMultiplier(task.severity),
    reject_count: card ? getRejectCountFromCard(card) : null,
    project:
      task.project?.trim() ||
      (card ? getCustomFieldValue(card, "Project")?.trim() : null) ||
      null,
    month,
  };
}

export async function getSprintTasksForScoring(
  sprintId: string,
): Promise<SprintTaskScoreTaskRow[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(SPRINT_TASK_SCORE_TASK_SELECT)
    .eq("sprint_id", sprintId)
    .in("sp_type", [...PLANNED_OR_ADHOC_SP_TYPES]);

  if (error) {
    throw error;
  }

  return (data ?? []) as SprintTaskScoreTaskRow[];
}

async function getSprintTaskScoreRowCount(sprintId: string): Promise<number> {
  const { count, error } = await supabase
    .from("sprint_task_scores")
    .select("id", { count: "exact", head: true })
    .eq("sprint_id", sprintId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function assertSprintTaskScoreCountsMatch(
  sprintId: string,
  expected: SprintTaskScoreCounts,
): Promise<void> {
  const actualCount = await getSprintTaskScoreRowCount(sprintId);

  if (actualCount !== expected.total) {
    throw new Error(
      `sprint_task_scores count mismatch for sprint ${sprintId}: expected ${expected.total} rows (${expected.planned} planned, ${expected.adhoc} adhoc) but found ${actualCount}.`,
    );
  }
}

export async function clearSprintTaskScores(
  sprintId: string,
): Promise<{ deleted: number }> {
  const { data, error } = await supabase
    .from("sprint_task_scores")
    .delete()
    .eq("sprint_id", sprintId)
    .select("id");

  if (error) {
    throw error;
  }

  return { deleted: data?.length ?? 0 };
}

export async function replaceSprintTaskScores(
  sprintId: string,
  month: number | null,
  cards: TrelloSprintCard[] = [],
): Promise<ReplaceSprintTaskScoresResult> {
  const eligibleTasks = await getSprintTasksForScoring(sprintId);
  const expectedCounts = countPlannedAndAdhocTasks(eligibleTasks);
  const trelloCardsById = buildTrelloCardsById(cards);
  const rows = eligibleTasks.map((task) =>
    mapTaskToSprintTaskScoreRow(
      task,
      sprintId,
      month,
      trelloCardsById.get(task.trello_card_id) ?? null,
    ),
  );

  const { deleted } = await clearSprintTaskScores(sprintId);

  if (rows.length === 0) {
    await assertSprintTaskScoreCountsMatch(sprintId, expectedCounts);
    return {
      upserted: 0,
      deleted,
      ...expectedCounts,
    };
  }

  const { data: insertedRows, error: insertError } = await supabase
    .from("sprint_task_scores")
    .insert(rows)
    .select("id");

  if (insertError) {
    throw insertError;
  }

  const upserted = insertedRows?.length ?? rows.length;
  if (upserted !== expectedCounts.total) {
    throw new Error(
      `sprint_task_scores insert mismatch for sprint ${sprintId}: inserted ${upserted} of ${expectedCounts.total} planned/adhoc tasks.`,
    );
  }

  await assertSprintTaskScoreCountsMatch(sprintId, expectedCounts);

  return {
    upserted,
    deleted,
    ...expectedCounts,
  };
}

/** @deprecated Use replaceSprintTaskScores instead. */
export async function replaceSprintTaskScoresFromTrelloCards(
  sprintId: string,
  month: number | null,
  cards: TrelloSprintCard[],
  _tasks: SprintTaskScoreTaskRow[] = [],
): Promise<{ upserted: number; deleted: number }> {
  const result = await replaceSprintTaskScores(sprintId, month, cards);
  return { upserted: result.upserted, deleted: result.deleted };
}
