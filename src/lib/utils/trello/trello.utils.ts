import { getSupabaseRows } from "@/lib/supabase";

export type TrelloParamValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly string[];

export type TrelloRequestParams = Record<string, TrelloParamValue>;

export type TrelloBoard = {
  id: string;
  name: string;
  desc?: string;
  closed?: boolean;
  url?: string;
  shortUrl?: string;
};

export type TrelloList = {
  id: string;
  name: string;
  closed?: boolean;
  idBoard?: string;
  pos?: number;
};

export type TrelloCard = {
  id: string;
  name: string;
  desc?: string;
  closed?: boolean;
  dateLastActivity?: string;
  due?: string | null;
  idBoard?: string;
  idList?: string;
  idMembers?: string[];
  idLabels?: string[];
  labels?: TrelloLabel[];
  members?: TrelloMember[];
  actions?: TrelloAction[];
  customFieldItems?: TrelloCustomFieldItem[];
  pluginData?: TrelloPluginData[];
  shortUrl?: string;
  url?: string;
};

export type TrelloMember = {
  id: string;
  fullName: string;
  username: string;
  initials?: string;
  avatarUrl?: string;
};

export type TrelloLabel = {
  id: string;
  idBoard?: string;
  name: string;
  color: string | null;
};

export type TrelloCustomField = {
  id: string;
  idModel: string;
  modelType: "board" | "card";
  name: string;
  type: "checkbox" | "date" | "list" | "number" | "text";
  options?: Array<{
    id: string;
    value: Record<string, string>;
    color?: string;
  }>;
};

export type TrelloCustomFieldItem = {
  id: string;
  idCustomField: string;
  idModel: string;
  idValue?: string;
  value?: {
    checked?: string;
    date?: string;
    number?: string;
    text?: string;
  };
};

export type TrelloAction = {
  id: string;
  type: string;
  date: string;
  data: TrelloActionData;
  memberCreator?: TrelloMember;
};

export type TrelloActionData = Record<string, unknown> & {
  listAfter?: {
    id: string;
    name: string;
  };
  listBefore?: {
    id: string;
    name: string;
  };
};

export type TrelloComment = TrelloAction & {
  type: "commentCard";
  data: TrelloAction["data"] & {
    text?: string;
  };
};

export type TrelloPluginData = {
  id: string;
  idPlugin: string;
  scope: "board" | "card" | "member" | "organization";
  value: string;
};

export type TrelloDateRange = {
  from?: Date | string | null;
  to?: Date | string | null;
};

export type GetTrelloSprintCardsOptions = {
  boardIds?: string[] | null;
  listIds?: string[] | null;
  listNames?: string[] | null;
  currentSprintListName?: string;
  dateRange?: TrelloDateRange | null;
  memberIds?: string[] | "all" | null;
  customFieldNames?: string[] | null;
  storyPointFieldNames?: string[];
};

export type TrelloSprintCard = TrelloCard & {
  board: TrelloBoard;
  list: TrelloList;
  labels: TrelloLabel[];
  members: TrelloMember[];
  storyPoints: number | null;
  customFields: Record<string, string | number | boolean | null>;
  dateCreated: Date;
  movedToCurrentSprintAt: Date | null;
  historyActivity: TrelloAction[];
  comments: TrelloComment[];
};

type SupabaseMemberRow = {
  trello_member_id: string | null;
};

const TRELLO_API_BASE_URL =
  import.meta.env.VITE_TRELLO_API_BASE_URL ?? "https://api.trello.com/1";
const TRELLO_REQUEST_DELAY_MS = getEnvNumber(
  import.meta.env.VITE_TRELLO_REQUEST_DELAY_MS,
  1200,
);
const TRELLO_MAX_RETRIES = getEnvNumber(import.meta.env.VITE_TRELLO_MAX_RETRIES, 3);
const TRELLO_RATE_LIMIT_RETRY_MS = getEnvNumber(
  import.meta.env.VITE_TRELLO_RATE_LIMIT_RETRY_MS,
  10000,
);

let trelloRequestQueue = Promise.resolve();

function getRequiredEnvVar(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function buildTrelloUrl(path: string, params: TrelloRequestParams = {}): string {
  const url = new URL(
    path.replace(/^\/+/, ""),
    `${TRELLO_API_BASE_URL.replace(/\/+$/, "")}/`,
  );

  const queryParams: TrelloRequestParams = {
    ...params,
    key: getRequiredEnvVar("VITE_TRELLO_API_KEY", import.meta.env.VITE_TRELLO_API_KEY),
    token: getRequiredEnvVar("VITE_TRELLO_TOKEN", import.meta.env.VITE_TRELLO_TOKEN),
  };

  for (const [key, value] of Object.entries(queryParams)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }

  return url.toString();
}

function getEnvNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getRetryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");

  if (retryAfter) {
    const retryAfterSeconds = Number(retryAfter);
    if (Number.isFinite(retryAfterSeconds)) return retryAfterSeconds * 1000;

    const retryAt = new Date(retryAfter).getTime();
    if (Number.isFinite(retryAt)) return Math.max(0, retryAt - Date.now());
  }

  return TRELLO_RATE_LIMIT_RETRY_MS * (attempt + 1);
}

function enqueueTrelloRequest(task: () => Promise<Response>): Promise<Response> {
  const queuedTask = trelloRequestQueue
    .catch(() => undefined)
    .then(async () => {
      if (TRELLO_REQUEST_DELAY_MS > 0) {
        await sleep(TRELLO_REQUEST_DELAY_MS);
      }

      return task();
    });

  trelloRequestQueue = queuedTask.then(
    () => undefined,
    () => undefined,
  );

  return queuedTask;
}

async function fetchTrelloWithRetry(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  for (let attempt = 0; attempt <= TRELLO_MAX_RETRIES; attempt++) {
    const response = await fetch(url, init);

    if (response.status !== 429 || attempt === TRELLO_MAX_RETRIES) {
      return response;
    }

    await sleep(getRetryDelayMs(response, attempt));
  }

  return fetch(url, init);
}

export async function trelloRequest<T>(
  path: string,
  params?: TrelloRequestParams,
  init?: RequestInit,
): Promise<T> {
  const response = await enqueueTrelloRequest(() =>
    fetchTrelloWithRetry(buildTrelloUrl(path, params), init),
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Trello request failed (${response.status} ${response.statusText}): ${message}`,
    );
  }

  return response.json() as Promise<T>;
}

export function getTrelloCardDateCreated(cardId: string): Date {
  return new Date(parseInt(cardId.substring(0, 8), 16) * 1000);
}

export function getTrelloBoard(
  boardId: string,
  params?: TrelloRequestParams,
): Promise<TrelloBoard> {
  return trelloRequest<TrelloBoard>(`/boards/${boardId}`, params);
}

export function getTrelloMemberBoards(
  memberId = "me",
  params: TrelloRequestParams = { filter: "open", fields: "all" },
): Promise<TrelloBoard[]> {
  return trelloRequest<TrelloBoard[]>(`/members/${memberId}/boards`, params);
}

export function getTrelloBoardLists(
  boardId: string,
  params: TrelloRequestParams = { cards: "none", filter: "open" },
): Promise<TrelloList[]> {
  return trelloRequest<TrelloList[]>(`/boards/${boardId}/lists`, params);
}

export function getTrelloList(
  listId: string,
  params?: TrelloRequestParams,
): Promise<TrelloList> {
  return trelloRequest<TrelloList>(`/lists/${listId}`, params);
}

export function getTrelloListCards(
  listId: string,
  params: TrelloRequestParams = { fields: "all", members: true, labels: true },
): Promise<TrelloCard[]> {
  return trelloRequest<TrelloCard[]>(`/lists/${listId}/cards`, params);
}

export function getTrelloBoardCards(
  boardId: string,
  params: TrelloRequestParams = { fields: "all", members: true, labels: true },
): Promise<TrelloCard[]> {
  return trelloRequest<TrelloCard[]>(`/boards/${boardId}/cards`, params);
}

export function getTrelloCard(
  cardId: string,
  params?: TrelloRequestParams,
): Promise<TrelloCard> {
  return trelloRequest<TrelloCard>(`/cards/${cardId}`, params);
}

export function getTrelloCardDetails(
  cardId: string,
  params: TrelloRequestParams = {
    fields: "all",
    actions: "commentCard,updateCard,updateCheckItemStateOnCard",
    attachments: true,
    attachment_fields: "all",
    checklists: "all",
    customFieldItems: true,
    labels: true,
    members: true,
    pluginData: true,
  },
): Promise<TrelloCard> {
  return trelloRequest<TrelloCard>(`/cards/${cardId}`, params);
}

export function getTrelloBoardMembers(
  boardId: string,
  params: TrelloRequestParams = { fields: "all" },
): Promise<TrelloMember[]> {
  return trelloRequest<TrelloMember[]>(`/boards/${boardId}/members`, params);
}

export function getTrelloBoardCustomFields(
  boardId: string,
): Promise<TrelloCustomField[]> {
  return trelloRequest<TrelloCustomField[]>(`/boards/${boardId}/customFields`);
}

export function getTrelloCardCustomFieldItems(
  cardId: string,
): Promise<TrelloCustomFieldItem[]> {
  return trelloRequest<TrelloCustomFieldItem[]>(`/cards/${cardId}/customFieldItems`);
}

export function getTrelloCardPluginData(
  cardId: string,
): Promise<TrelloPluginData[]> {
  return trelloRequest<TrelloPluginData[]>(`/cards/${cardId}/pluginData`);
}

export function getTrelloCardHistoryActivity(
  cardId: string,
  params: TrelloRequestParams = { filter: "all", limit: 1000 },
): Promise<TrelloAction[]> {
  return trelloRequest<TrelloAction[]>(`/cards/${cardId}/actions`, params);
}

export function getTrelloCardComments(
  cardId: string,
  params: TrelloRequestParams = { filter: "commentCard", limit: 1000 },
): Promise<TrelloComment[]> {
  return trelloRequest<TrelloComment[]>(`/cards/${cardId}/actions`, params);
}

export function getTrelloCardLabels(
  cardId: string,
  params: TrelloRequestParams = { fields: "labels" },
): Promise<TrelloLabel[]> {
  return getTrelloCard(cardId, params).then((card) => card.labels ?? []);
}

export async function getTrelloCardStoryPoints(
  cardId: string,
  boardId: string,
  storyPointFieldNames: string[] = ["Story Points", "Story Point", "Points", "SP"],
): Promise<number | null> {
  const [customFields, customFieldItems, pluginData] = await Promise.all([
    getTrelloBoardCustomFields(boardId),
    getTrelloCardCustomFieldItems(cardId),
    getTrelloCardPluginData(cardId),
  ]);

  const storyPointField = customFields.find((field) =>
    storyPointFieldNames.some(
      (name) => field.name.toLowerCase() === name.toLowerCase(),
    ),
  );

  const storyPointItem = storyPointField
    ? customFieldItems.find((item) => item.idCustomField === storyPointField.id)
    : undefined;
  const customFieldValue = storyPointItem?.value?.number ?? storyPointItem?.value?.text;

  if (customFieldValue && !Number.isNaN(Number(customFieldValue))) {
    return Number(customFieldValue);
  }

  for (const item of pluginData) {
    const value = parseTrelloPluginStoryPoints(item.value);
    if (value !== null) return value;
  }

  return null;
}

export async function getTrelloSprintCards(
  options: GetTrelloSprintCardsOptions = {},
): Promise<TrelloSprintCard[]> {
  const {
    boardIds = null,
    listIds = null,
    listNames = null,
    currentSprintListName = "Current Sprint",
    dateRange = null,
    memberIds = null,
    customFieldNames = null,
    storyPointFieldNames,
  } = options;

  const boards = boardIds?.length
    ? await getTrelloBoardsSequentially(boardIds)
    : await getTrelloMemberBoards();
  const selectedMemberIds = await resolveTrelloMemberIds(memberIds);
  const selectedListNames = new Set(
    (listNames?.length ? listNames : [currentSprintListName]).map(normalizeName),
  );
  const selectedListIds = new Set(listIds ?? []);

  const sprintCards: TrelloSprintCard[] = [];

  for (const board of boards) {
    const lists = await getTrelloBoardLists(board.id);
    const members = await getTrelloBoardMembers(board.id);
    const customFields = await getTrelloBoardCustomFields(board.id);
    const targetLists = lists.filter(
      (list) =>
        selectedListIds.has(list.id) ||
        (!selectedListIds.size && selectedListNames.has(normalizeName(list.name))),
    );

    for (const list of targetLists) {
      const cards = await getTrelloListCards(list.id);

      for (const card of cards) {
        if (!matchesMembers(card, selectedMemberIds)) continue;

        const detailedCard = await getTrelloCardDetails(card.id);
        const sprintCard = buildTrelloSprintCard({
          board,
          list,
          card: detailedCard,
          boardMembers: members,
          customFields,
          customFieldNames,
          currentSprintListName,
          storyPointFieldNames,
        });

        if (isDateInRange(sprintCard.movedToCurrentSprintAt, dateRange)) {
          sprintCards.push(sprintCard);
        }
      }
    }
  }

  return sprintCards;
}

async function getTrelloBoardsSequentially(boardIds: string[]): Promise<TrelloBoard[]> {
  const boards: TrelloBoard[] = [];

  for (const boardId of boardIds) {
    boards.push(await getTrelloBoard(boardId));
  }

  return boards;
}

async function resolveTrelloMemberIds(
  memberIds: GetTrelloSprintCardsOptions["memberIds"],
): Promise<string[] | null> {
  if (memberIds === "all") return null;
  if (Array.isArray(memberIds)) return memberIds;

  const members = await getSupabaseRows<SupabaseMemberRow>("members", {
    select: "trello_member_id",
  });

  return members
    .map((member) => member.trello_member_id)
    .filter((memberId): memberId is string => Boolean(memberId));
}

function buildTrelloSprintCard({
  board,
  list,
  card,
  boardMembers,
  customFields,
  customFieldNames,
  currentSprintListName,
  storyPointFieldNames = ["Story Points", "Story Point", "Points", "SP"],
}: {
  board: TrelloBoard;
  list: TrelloList;
  card: TrelloCard;
  boardMembers: TrelloMember[];
  customFields: TrelloCustomField[];
  customFieldNames: string[] | null;
  currentSprintListName: string;
  storyPointFieldNames?: string[];
}): TrelloSprintCard {
  const customFieldItems = card.customFieldItems ?? [];
  const customFieldValues = getTrelloCustomFieldValues(
    customFields,
    customFieldItems,
    customFieldNames,
  );
  const historyActivity = card.actions ?? [];
  const comments = historyActivity.filter(
    (action): action is TrelloComment => action.type === "commentCard",
  );

  return {
    ...card,
    board,
    list,
    labels: card.labels ?? [],
    members: card.members ?? getCardMembers(card, boardMembers),
    storyPoints: getStoryPointsFromCardData(
      customFields,
      customFieldItems,
      card.pluginData ?? [],
      storyPointFieldNames,
    ),
    customFields: customFieldValues,
    dateCreated: getTrelloCardDateCreated(card.id),
    movedToCurrentSprintAt: getMovedToListDate(
      historyActivity,
      list,
      currentSprintListName,
    ),
    historyActivity,
    comments,
  };
}

function getTrelloCustomFieldValues(
  customFields: TrelloCustomField[],
  customFieldItems: TrelloCustomFieldItem[],
  customFieldNames: string[] | null,
): Record<string, string | number | boolean | null> {
  const selectedNames = customFieldNames?.length
    ? new Set(customFieldNames.map(normalizeName))
    : null;

  return customFields.reduce<Record<string, string | number | boolean | null>>(
    (values, field) => {
      if (selectedNames && !selectedNames.has(normalizeName(field.name))) {
        return values;
      }

      const item = customFieldItems.find((item) => item.idCustomField === field.id);
      values[field.name] = resolveCustomFieldValue(field, item);

      return values;
    },
    {},
  );
}

function resolveCustomFieldValue(
  field: TrelloCustomField,
  item?: TrelloCustomFieldItem,
): string | number | boolean | null {
  if (!item) return null;

  if (field.type === "list" && item.idValue) {
    const selectedOption = field.options?.find((option) => option.id === item.idValue);
    return selectedOption ? Object.values(selectedOption.value)[0] : null;
  }

  if (field.type === "checkbox") {
    return item.value?.checked === "true";
  }

  if (field.type === "number") {
    return item.value?.number ? Number(item.value.number) : null;
  }

  return item.value?.date ?? item.value?.text ?? null;
}

function getStoryPointsFromCardData(
  customFields: TrelloCustomField[],
  customFieldItems: TrelloCustomFieldItem[],
  pluginData: TrelloPluginData[],
  storyPointFieldNames: string[],
): number | null {
  const storyPointField = customFields.find((field) =>
    storyPointFieldNames.some(
      (name) => normalizeName(field.name) === normalizeName(name),
    ),
  );
  const storyPointItem = storyPointField
    ? customFieldItems.find((item) => item.idCustomField === storyPointField.id)
    : undefined;
  const customFieldValue =
    storyPointField && storyPointItem
      ? resolveCustomFieldValue(storyPointField, storyPointItem)
      : null;

  if (customFieldValue !== null && !Number.isNaN(Number(customFieldValue))) {
    return Number(customFieldValue);
  }

  for (const item of pluginData) {
    const value = parseTrelloPluginStoryPoints(item.value);
    if (value !== null) return value;
  }

  return null;
}

function getMovedToListDate(
  actions: TrelloAction[],
  list: TrelloList,
  currentSprintListName: string,
): Date | null {
  const action = actions.find(
    (action) =>
      action.type === "updateCard" &&
      (action.data.listAfter?.id === list.id ||
        normalizeName(action.data.listAfter?.name) ===
          normalizeName(currentSprintListName)),
  );

  return action ? new Date(action.date) : null;
}

function isDateInRange(date: Date | null, range: TrelloDateRange | null): boolean {
  if (!range?.from && !range?.to) return true;
  if (!date) return false;

  const from = range.from ? new Date(range.from).getTime() : null;
  const to = range.to ? new Date(range.to).getTime() : null;
  const time = date.getTime();

  return (from === null || time >= from) && (to === null || time <= to);
}

function matchesMembers(card: TrelloCard, memberIds: string[] | null): boolean {
  if (!memberIds) return true;
  return card.idMembers?.some((memberId) => memberIds.includes(memberId)) ?? false;
}

function getCardMembers(
  card: TrelloCard,
  boardMembers: TrelloMember[],
): TrelloMember[] {
  return boardMembers.filter((member) => card.idMembers?.includes(member.id));
}

function normalizeName(value?: string): string {
  return value?.trim().toLowerCase() ?? "";
}

function parseTrelloPluginStoryPoints(value: string): number | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const possibleValues = [
      parsed.storyPoints,
      parsed.storyPoint,
      parsed.points,
      parsed.estimate,
    ];

    const match = possibleValues.find(
      (item) => typeof item === "number" || typeof item === "string",
    );

    return match !== undefined && !Number.isNaN(Number(match)) ? Number(match) : null;
  } catch {
    return null;
  }
}
