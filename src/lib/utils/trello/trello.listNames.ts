export const TRELLO_FOR_PLANNING_LIST_NAME = "For Planning";

export function normalizeTrelloListName(value?: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

export function isForPlanningTrelloList(listName?: string | null): boolean {
  const normalized = normalizeTrelloListName(listName);

  return (
    normalized === NORMALIZED_TRELLO_FOR_PLANNING_LIST_NAME ||
    normalized === "planning"
  );
}

export const NORMALIZED_TRELLO_FOR_PLANNING_LIST_NAME = normalizeTrelloListName(
  TRELLO_FOR_PLANNING_LIST_NAME,
);
