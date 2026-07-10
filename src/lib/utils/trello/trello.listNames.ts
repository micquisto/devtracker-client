export const TRELLO_FOR_PLANNING_LIST_NAME = "For Planning";
export const TRELLO_MIKE_HOLD_LIST_NAME = "Mike Hold";

/** Lists fetched from every configured Trello board when present. */
export const TRELLO_ALL_BOARDS_LIST_NAMES = [TRELLO_MIKE_HOLD_LIST_NAME] as const;

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

export function isMikeHoldTrelloList(listName?: string | null): boolean {
  return normalizeTrelloListName(listName) === NORMALIZED_TRELLO_MIKE_HOLD_LIST_NAME;
}

export const NORMALIZED_TRELLO_FOR_PLANNING_LIST_NAME = normalizeTrelloListName(
  TRELLO_FOR_PLANNING_LIST_NAME,
);

export const NORMALIZED_TRELLO_MIKE_HOLD_LIST_NAME = normalizeTrelloListName(
  TRELLO_MIKE_HOLD_LIST_NAME,
);
