import { getSupabaseRows } from "@/lib/supabase";
import {
  getTrelloStoryPointsPluginIds,
  trelloRequest,
  type TrelloRequestParams,
} from "./trello.client";
import { isForPlanningTrelloList } from "./trello.listNames";

export type { TrelloParamValue, TrelloRequestParams } from "./trello.client";
export {
  buildTrelloUrl,
  getTrelloStoryPointsPluginIds,
  TRELLO_STORY_POINTS_POWER_UP_PLUGIN_IDS,
  trelloApiRequest,
  trelloRequest,
} from "./trello.client";

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
  idShort?: number;
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

export type TrelloBoardPlugin = {
  id: string;
  idBoard: string;
  idPlugin: string;
  promotional?: boolean;
};

export type TrelloDateRange = {
  from?: Date | string | null;
  to?: Date | string | null;
};

export type TrelloStoryPointReadSource = "auto" | "pluginOnly" | "customFieldOnly";

export type GetTrelloSprintCardsOptions = {
  boardIds?: string[] | null;
  listIds?: string[] | null;
  listNames?: string[] | null;
  currentSprintListName?: string;
  dateRange?: TrelloDateRange | null;
  includeCardDetails?: boolean;
  memberIds?: string[] | "all" | null;
  customFieldNames?: string[] | null;
  storyPointFieldNames?: string[];
  storyPointSource?: TrelloStoryPointReadSource;
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

export function getTrelloBoardPlugins(
  boardId: string,
  params: TrelloRequestParams = { fields: "id,idBoard,idPlugin,promotional" },
): Promise<TrelloBoardPlugin[]> {
  return trelloRequest<TrelloBoardPlugin[]>(`/boards/${boardId}/boardPlugins`, params);
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
  storyPointSource: TrelloStoryPointReadSource = "auto",
): Promise<number | null> {
  const [customFields, customFieldItems, pluginData] = await Promise.all([
    getTrelloBoardCustomFields(boardId),
    getTrelloCardCustomFieldItems(cardId),
    getTrelloCardPluginData(cardId),
  ]);

  return getStoryPointsFromCardData(
    customFields,
    customFieldItems,
    pluginData,
    storyPointFieldNames,
    storyPointSource,
  );
}

export async function getTrelloStoryPointsForPlanningListCardsByBoard(
  boardId: string,
  cardIds: readonly string[],
  storyPointFieldNames: string[] = ["Story Points", "Story Point", "Points", "SP"],
): Promise<Map<string, number | null>> {
  const storyPointsByCardId = new Map<string, number | null>();
  const targetCardIds = new Set(cardIds.filter(Boolean));

  if (!boardId.trim() || targetCardIds.size === 0) {
    return storyPointsByCardId;
  }

  const [lists, customFields] = await Promise.all([
    getTrelloBoardLists(boardId),
    getTrelloBoardCustomFields(boardId),
  ]);

  const planningList = lists.find((list) => isForPlanningTrelloList(list.name));
  if (!planningList) {
    return storyPointsByCardId;
  }

  const listStoryPointSource: TrelloStoryPointReadSource = "auto";

  const cards = await getTrelloListCards(planningList.id, {
    fields: "all",
    customFieldItems: true,
    pluginData: true,
  });

  for (const card of cards) {
    if (!targetCardIds.has(card.id)) {
      continue;
    }

    storyPointsByCardId.set(
      card.id,
      getStoryPointsFromCardData(
        customFields,
        card.customFieldItems ?? [],
        card.pluginData ?? [],
        storyPointFieldNames,
        listStoryPointSource,
      ),
    );
  }

  return storyPointsByCardId;
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
    includeCardDetails = false,
    memberIds = null,
    customFieldNames = null,
    storyPointFieldNames,
    storyPointSource = "auto",
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
    const [customFields, boardPlugins] = await Promise.all([
      getTrelloBoardCustomFields(board.id),
      getTrelloBoardPlugins(board.id),
    ]);
    const storyPointPluginIds = getTrelloStoryPointsPluginIds();
    const boardUsesStoryPointPowerUp = boardPlugins.some((plugin) =>
      storyPointPluginIds.includes(plugin.idPlugin),
    );
    const targetLists = lists.filter(
      (list) =>
        selectedListIds.has(list.id) ||
        (!selectedListIds.size && selectedListNames.has(normalizeName(list.name))),
    );

    for (const list of targetLists) {
      const listStoryPointSource =
        storyPointSource === "auto" && boardUsesStoryPointPowerUp
          ? isForPlanningTrelloList(list.name)
            ? "auto"
            : "pluginOnly"
          : storyPointSource;
      const cards = await getTrelloListCards(list.id, {
        fields: "all",
        members: true,
        labels: true,
        customFieldItems: true,
        pluginData: true,
      });

      for (const card of cards) {
        if (!matchesMembers(card, selectedMemberIds)) continue;

        const detailedCard =
          includeCardDetails || Boolean(dateRange)
            ? await getTrelloCardDetails(card.id)
            : card;
        const sprintCard = buildTrelloSprintCard({
          board,
          list,
          card: detailedCard,
          boardMembers: members,
          customFields,
          customFieldNames,
          currentSprintListName,
          storyPointFieldNames,
          storyPointSource: listStoryPointSource,
        });

        if (isDateInRange(sprintCard.movedToCurrentSprintAt, dateRange)) {
          sprintCards.push(sprintCard);
        }
      }
    }
  }

  return sprintCards;
}

export type GetTrelloSprintCardByIdOptions = {
  customFieldNames?: string[] | null;
  storyPointFieldNames?: string[];
  currentSprintListName?: string;
  storyPointSource?: TrelloStoryPointReadSource;
};

export async function getTrelloSprintCardById(
  cardId: string,
  options: GetTrelloSprintCardByIdOptions = {},
): Promise<TrelloSprintCard> {
  const card = await getTrelloCardDetails(cardId);
  const boardId = card.idBoard;
  const listId = card.idList;

  if (!boardId || !listId) {
    throw new Error(`Trello card ${cardId} is missing board or list metadata.`);
  }

  const [board, list, members, customFields] = await Promise.all([
    getTrelloBoard(boardId),
    getTrelloList(listId),
    getTrelloBoardMembers(boardId),
    getTrelloBoardCustomFields(boardId),
  ]);

  return buildTrelloSprintCard({
    board,
    list,
    card,
    boardMembers: members,
    customFields,
    customFieldNames: options.customFieldNames ?? null,
    currentSprintListName: options.currentSprintListName ?? "Current Sprint",
    storyPointFieldNames: options.storyPointFieldNames,
    storyPointSource: options.storyPointSource,
  });
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
  storyPointSource = "auto",
}: {
  board: TrelloBoard;
  list: TrelloList;
  card: TrelloCard;
  boardMembers: TrelloMember[];
  customFields: TrelloCustomField[];
  customFieldNames: string[] | null;
  currentSprintListName: string;
  storyPointFieldNames?: string[];
  storyPointSource?: TrelloStoryPointReadSource;
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
    members: mergeCardMembers(card, boardMembers),
    storyPoints: getStoryPointsFromCardData(
      customFields,
      customFieldItems,
      card.pluginData ?? [],
      storyPointFieldNames,
      storyPointSource,
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
  storyPointSource: TrelloStoryPointReadSource = "auto",
): number | null {
  if (storyPointSource !== "customFieldOnly") {
    const pluginStoryPoints = getStoryPointsFromPluginData(pluginData);
    if (pluginStoryPoints !== null) {
      return pluginStoryPoints;
    }
  }

  if (storyPointSource === "pluginOnly") {
    return null;
  }

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

  return null;
}

function getStoryPointsFromPluginData(pluginData: TrelloPluginData[]): number | null {
  const preferredPluginIds = getTrelloStoryPointsPluginIds();
  const preferredItems = preferredPluginIds
    .map((pluginId) => pluginData.find((item) => item.idPlugin === pluginId))
    .filter((item): item is TrelloPluginData => Boolean(item));
  const remainingItems = pluginData.filter(
    (item) => !preferredPluginIds.includes(item.idPlugin),
  );

  for (const item of [...preferredItems, ...remainingItems]) {
    const value = parseTrelloPluginStoryPoints(item.value);
    if (value !== null) {
      return value;
    }
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

function mergeCardMembers(
  card: TrelloCard,
  boardMembers: TrelloMember[],
): TrelloMember[] {
  const membersById = new Map<string, TrelloMember>();

  for (const member of getCardMembers(card, boardMembers)) {
    membersById.set(member.id, member);
  }

  for (const member of card.members ?? []) {
    const existing = membersById.get(member.id);
    membersById.set(member.id, existing ? { ...existing, ...member } : member);
  }

  return Array.from(membersById.values());
}

function normalizeName(value?: string): string {
  return value?.trim().toLowerCase() ?? "";
}

function parseTrelloPluginStoryPoints(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (typeof parsed === "number" && Number.isFinite(parsed)) {
      return parsed;
    }

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const possibleValues = [
      record.points,
      record.storyPoints,
      record.storyPoint,
      record.estimate,
    ];

    const match = possibleValues.find(
      (item) => typeof item === "number" || typeof item === "string",
    );

    if (match !== undefined && !Number.isNaN(Number(match))) {
      return Number(match);
    }

    return null;
  } catch {
    return null;
  }
}
