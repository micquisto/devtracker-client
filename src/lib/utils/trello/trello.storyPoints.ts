import {
  getTrelloOwnStoryPointsPluginIds,
  getTrelloStoryPointsPluginIds,
  trelloApiRequest,
} from "./trello.client";
import {
  getTrelloBoardCustomFields,
  getTrelloBoardPlugins,
  getTrelloCardPluginData,
  getTrelloCardStoryPoints,
  type TrelloCustomField,
  type TrelloCustomFieldItem,
  type TrelloPluginData,
} from "./trello.utils";

export const DEFAULT_TRELLO_STORY_POINT_FIELD_NAMES = [
  "Story Points",
  "Story Point",
  "Points",
  "SP",
] as const;

export type TrelloStoryPointStorageSource = "customField" | "pluginData";

export type TrelloStoryPointUpdateSource =
  | "auto"
  | TrelloStoryPointStorageSource;

export type ResolveTrelloStoryPointFieldOptions = {
  boardId: string;
  fieldNames?: readonly string[];
};

export type ResolvedTrelloStoryPointCustomField = {
  source: "customField";
  boardId: string;
  customFieldId: string;
  customFieldName: string;
  customFieldType: TrelloCustomField["type"];
};

export type ResolvedTrelloStoryPointPluginData = {
  source: "pluginData";
  cardId: string;
  pluginDataId: string;
  idPlugin: string;
  storyPointKey: string;
  existingValue: Record<string, unknown>;
  preferenceScore?: number;
};

export type ReadTrelloCardStoryPointsOptions = {
  cardId: string;
  boardId: string;
  fieldNames?: readonly string[];
};

export type UpdateTrelloCardStoryPointsOptions = {
  cardId: string;
  boardId: string;
  storyPoints: number;
  fieldNames?: readonly string[];
  source?: TrelloStoryPointUpdateSource;
  clearWhenZero?: boolean;
  idPlugin?: string;
  preferredPluginIds?: readonly string[];
};

export type UpdateTrelloCardStoryPointsResult = {
  cardId: string;
  boardId: string;
  storyPoints: number;
  source: TrelloStoryPointStorageSource;
  customFieldId?: string;
  customFieldName?: string;
  pluginDataId?: string;
};

export type TrelloStoryPointUpdateErrorDetails = {
  cardId: string;
  boardId: string;
  storyPoints: number;
  attemptedSources: TrelloStoryPointStorageSource[];
};

export class TrelloStoryPointUpdateError extends Error {
  readonly details: TrelloStoryPointUpdateErrorDetails;

  constructor(message: string, details: TrelloStoryPointUpdateErrorDetails) {
    super(message);
    this.name = "TrelloStoryPointUpdateError";
    this.details = details;
  }
}

export class TrelloStoryPointPowerUpRestrictedError extends TrelloStoryPointUpdateError {
  readonly requiresManualInitialization: boolean;

  constructor(
    message: string,
    details: TrelloStoryPointUpdateErrorDetails,
    requiresManualInitialization = true,
  ) {
    super(message, details);
    this.name = "TrelloStoryPointPowerUpRestrictedError";
    this.requiresManualInitialization = requiresManualInitialization;
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function isTrelloPluginDataWriteForbiddenError(error: unknown): boolean {
  const message = getErrorMessage(error, "");
  return message.includes("private pluginData is limited to approved applications");
}

export function buildStoryPointPowerUpInitializeMessage(cardUrl?: string | null): string {
  const lines = [
    "Trello does not allow external apps to initialize Agile Tools story points on a card that has never been pointed in Trello.",
    "",
    "One-time setup for this card:",
    "1. Open the card in Trello",
    "2. In Power-Ups, click Story Points and set any value",
    "3. Return here and click Confirm again",
    "",
    "After that, Planning Poker can update the Power-Up points automatically.",
  ];

  if (cardUrl?.trim()) {
    lines.push("", cardUrl.trim());
  }

  return lines.join("\n");
}

const PLUGIN_STORY_POINT_KEYS = [
  "points",
  "storyPoints",
  "storyPoint",
  "estimate",
] as const;

const STORY_POINTS_FOR_TRELLO_PLUGIN_KEY = "points";

function orderStoryPointPluginIds(
  preferredPluginIds: readonly string[],
  boardPluginIds: readonly string[],
): string[] {
  const boardStoryPointPlugins = boardPluginIds.filter((pluginId) =>
    preferredPluginIds.includes(pluginId),
  );
  const remainingPreferred = preferredPluginIds.filter(
    (pluginId) => !boardStoryPointPlugins.includes(pluginId),
  );

  return [...boardStoryPointPlugins, ...remainingPreferred];
}

async function getStoryPointPluginIdsForBoard(
  boardId: string,
  preferredPluginIds: readonly string[],
): Promise<string[]> {
  try {
    const boardPlugins = await getTrelloBoardPlugins(boardId);
    const boardPluginIds = boardPlugins.map((plugin) => plugin.idPlugin);
    return orderStoryPointPluginIds(preferredPluginIds, boardPluginIds);
  } catch {
    return [...preferredPluginIds];
  }
}

function buildPluginStoryPointValue(
  existingValue: Record<string, unknown>,
  storyPointKey: string,
  storyPoints: number,
  clearWhenZero: boolean,
): Record<string, unknown> {
  const nextPoints =
    storyPoints === 0 && clearWhenZero ? 0 : storyPoints;
  const updatedValue: Record<string, unknown> = {
    ...existingValue,
    [storyPointKey]: nextPoints,
  };

  if (storyPointKey === "points" || "pointsHistory" in existingValue) {
    const existingHistory = Array.isArray(existingValue.pointsHistory)
      ? existingValue.pointsHistory.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [];

    updatedValue.pointsHistory = [
      ...existingHistory,
      `${Date.now()}:${nextPoints}`,
    ];
  }

  return updatedValue;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function resolveFieldNames(fieldNames?: readonly string[]): string[] {
  return fieldNames?.length
    ? [...fieldNames]
    : [...DEFAULT_TRELLO_STORY_POINT_FIELD_NAMES];
}

function findStoryPointCustomField(
  customFields: TrelloCustomField[],
  fieldNames: readonly string[],
): TrelloCustomField | undefined {
  return customFields.find((field) =>
    fieldNames.some((name) => normalizeName(field.name) === normalizeName(name)),
  );
}

function parsePluginStoryPointPayload(
  value: string,
  idPlugin?: string,
): { storyPointKey: string; existingValue: Record<string, unknown> } | null {
  const preferredPluginIds = getTrelloStoryPointsPluginIds();
  const isPreferredPlugin = idPlugin
    ? preferredPluginIds.includes(idPlugin)
    : false;

  if (!value.trim()) {
    if (!isPreferredPlugin) {
      return null;
    }

    return {
      storyPointKey: STORY_POINTS_FOR_TRELLO_PLUGIN_KEY,
      existingValue: {},
    };
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (typeof parsed === "number" && Number.isFinite(parsed)) {
      return {
        storyPointKey: STORY_POINTS_FOR_TRELLO_PLUGIN_KEY,
        existingValue: { [STORY_POINTS_FOR_TRELLO_PLUGIN_KEY]: parsed },
      };
    }

    if (!parsed || typeof parsed !== "object") {
      return isPreferredPlugin
        ? {
            storyPointKey: STORY_POINTS_FOR_TRELLO_PLUGIN_KEY,
            existingValue: {},
          }
        : null;
    }

    const record = parsed as Record<string, unknown>;
    const storyPointKey = PLUGIN_STORY_POINT_KEYS.find((key) => key in record);

    if (storyPointKey) {
      return { storyPointKey, existingValue: record };
    }

    if (isPreferredPlugin) {
      return {
        storyPointKey: STORY_POINTS_FOR_TRELLO_PLUGIN_KEY,
        existingValue: record,
      };
    }

    return null;
  } catch {
    return isPreferredPlugin
      ? {
          storyPointKey: STORY_POINTS_FOR_TRELLO_PLUGIN_KEY,
          existingValue: {},
        }
      : null;
  }
}

function getPluginPreferenceScore(
  idPlugin: string,
  preferredPluginIds: readonly string[],
): number {
  const preferredIndex = preferredPluginIds.indexOf(idPlugin);
  return preferredIndex >= 0 ? preferredPluginIds.length - preferredIndex : 0;
}

function resolvePluginDataItemForStoryPoints(
  cardId: string,
  item: TrelloPluginData,
  preferredPluginIds: readonly string[],
): ResolvedTrelloStoryPointPluginData | null {
  const parsed = parsePluginStoryPointPayload(item.value, item.idPlugin);
  if (!parsed) {
    return null;
  }

  return {
    source: "pluginData",
    cardId,
    pluginDataId: item.id,
    idPlugin: item.idPlugin,
    storyPointKey: parsed.storyPointKey,
    existingValue: parsed.existingValue,
    preferenceScore: getPluginPreferenceScore(item.idPlugin, preferredPluginIds),
  };
}

function buildCustomFieldStoryPointBody(
  fieldType: TrelloCustomField["type"],
  storyPoints: number,
  clearWhenZero: boolean,
): { value: { number?: string; text?: string } } {
  if (storyPoints === 0 && clearWhenZero) {
    if (fieldType === "number") {
      return { value: { number: "" } };
    }

    return { value: { text: "" } };
  }

  if (fieldType === "number") {
    return { value: { number: String(storyPoints) } };
  }

  return { value: { text: String(storyPoints) } };
}

function assertValidStoryPoints(storyPoints: number): void {
  if (!Number.isFinite(storyPoints) || storyPoints < 0) {
    throw new Error("storyPoints must be a non-negative finite number.");
  }
}

export async function resolveTrelloStoryPointCustomField(
  options: ResolveTrelloStoryPointFieldOptions,
): Promise<ResolvedTrelloStoryPointCustomField | null> {
  const fieldNames = resolveFieldNames(options.fieldNames);
  const customFields = await getTrelloBoardCustomFields(options.boardId);
  const storyPointField = findStoryPointCustomField(customFields, fieldNames);

  if (!storyPointField) {
    return null;
  }

  return {
    source: "customField",
    boardId: options.boardId,
    customFieldId: storyPointField.id,
    customFieldName: storyPointField.name,
    customFieldType: storyPointField.type,
  };
}

export async function resolveTrelloStoryPointPluginData(
  cardId: string,
  options: {
    idPlugin?: string;
    preferredPluginIds?: readonly string[];
    boardId?: string;
  } = {},
): Promise<ResolvedTrelloStoryPointPluginData | null> {
  const basePreferredPluginIds =
    options.preferredPluginIds ?? getTrelloStoryPointsPluginIds();
  const preferredPluginIds = options.boardId
    ? await getStoryPointPluginIdsForBoard(options.boardId, basePreferredPluginIds)
    : [...basePreferredPluginIds];
  const pluginDataItems = await getTrelloCardPluginData(cardId);
  const candidates: ResolvedTrelloStoryPointPluginData[] = [];

  for (const item of pluginDataItems) {
    if (options.idPlugin && item.idPlugin !== options.idPlugin) {
      continue;
    }

    const resolved = resolvePluginDataItemForStoryPoints(
      cardId,
      item,
      preferredPluginIds,
    );

    if (resolved) {
      candidates.push(resolved);
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort(
    (left, right) => (right.preferenceScore ?? 0) - (left.preferenceScore ?? 0),
  );

  return candidates[0];
}

export async function readTrelloCardStoryPoints(
  options: ReadTrelloCardStoryPointsOptions,
): Promise<number | null> {
  return getTrelloCardStoryPoints(
    options.cardId,
    options.boardId,
    resolveFieldNames(options.fieldNames),
  );
}

function toResolvedPluginData(
  cardId: string,
  idPlugin: string,
  pluginDataId: string,
  existingValue: Record<string, unknown>,
): ResolvedTrelloStoryPointPluginData {
  return {
    source: "pluginData",
    cardId,
    pluginDataId,
    idPlugin,
    storyPointKey: STORY_POINTS_FOR_TRELLO_PLUGIN_KEY,
    existingValue,
    preferenceScore: Number.MAX_SAFE_INTEGER,
  };
}

async function resolveCreatedPluginData(
  cardId: string,
  idPlugin: string,
  initialValue: Record<string, unknown>,
  created?: TrelloPluginData | void,
): Promise<ResolvedTrelloStoryPointPluginData> {
  if (created?.id) {
    return toResolvedPluginData(
      cardId,
      created.idPlugin ?? idPlugin,
      created.id,
      initialValue,
    );
  }

  const pluginDataItems = await getTrelloCardPluginData(cardId);
  const createdItem = pluginDataItems.find((item) => item.idPlugin === idPlugin);

  if (!createdItem) {
    throw new Error(
      `Story Points power-up data was not created on card ${cardId}.`,
    );
  }

  return toResolvedPluginData(
    cardId,
    createdItem.idPlugin,
    createdItem.id,
    initialValue,
  );
}

async function verifyPluginStoryPoints(
  cardId: string,
  idPlugin: string,
  storyPoints: number,
): Promise<void> {
  const pluginDataItems = await getTrelloCardPluginData(cardId);
  const pluginItem = pluginDataItems.find((item) => item.idPlugin === idPlugin);

  if (!pluginItem) {
    throw new Error(
      `No Story Points power-up data found on card ${cardId} after update.`,
    );
  }

  const parsed = parsePluginStoryPointPayload(pluginItem.value, idPlugin);
  const actualPoints = parsed?.existingValue[STORY_POINTS_FOR_TRELLO_PLUGIN_KEY];

  if (typeof actualPoints !== "number" || actualPoints !== storyPoints) {
    throw new Error(
      `Story Points power-up value mismatch on card ${cardId} (expected ${storyPoints}, got ${typeof actualPoints === "number" ? actualPoints : "none"}).`,
    );
  }
}

async function createStoryPointsPluginData(
  cardId: string,
  boardId: string,
  idPlugin: string,
  storyPoints: number,
): Promise<ResolvedTrelloStoryPointPluginData> {
  const initialValue = buildPluginStoryPointValue(
    {},
    STORY_POINTS_FOR_TRELLO_PLUGIN_KEY,
    storyPoints,
    false,
  );
  const valueJson = JSON.stringify(initialValue);

  try {
    const created = await trelloApiRequest<TrelloPluginData>({
      path: `/cards/${cardId}/pluginData`,
      method: "POST",
      body: {
        idPlugin,
        value: valueJson,
        access: "shared",
      },
    });

    const resolved = await resolveCreatedPluginData(
      cardId,
      idPlugin,
      initialValue,
      created,
    );
    await verifyPluginStoryPoints(cardId, idPlugin, storyPoints);
    return resolved;
  } catch (error) {
    if (isTrelloPluginDataWriteForbiddenError(error)) {
      throw new TrelloStoryPointPowerUpRestrictedError(
        buildStoryPointPowerUpInitializeMessage(),
        {
          cardId,
          boardId,
          storyPoints,
          attemptedSources: ["pluginData"],
        },
      );
    }

    throw error;
  }
}

async function createStoryPointsPluginDataForBoard(
  cardId: string,
  boardId: string,
  storyPoints: number,
  preferredPluginIds: readonly string[],
): Promise<ResolvedTrelloStoryPointPluginData> {
  const ownPluginIds = getTrelloOwnStoryPointsPluginIds();
  const errors: string[] = [];

  for (const idPlugin of ownPluginIds) {
    try {
      return await createStoryPointsPluginData(
        cardId,
        boardId,
        idPlugin,
        storyPoints,
      );
    } catch (error) {
      if (error instanceof TrelloStoryPointPowerUpRestrictedError) {
        throw error;
      }

      errors.push(getErrorMessage(error, `Plugin ${idPlugin}`));
    }
  }

  const boardPluginIds = await getStoryPointPluginIdsForBoard(
    boardId,
    preferredPluginIds,
  );
  const thirdPartyPluginIds = boardPluginIds.filter(
    (pluginId) => !ownPluginIds.includes(pluginId),
  );

  if (thirdPartyPluginIds.length > 0) {
    throw new TrelloStoryPointPowerUpRestrictedError(
      buildStoryPointPowerUpInitializeMessage(),
      {
        cardId,
        boardId,
        storyPoints,
        attemptedSources: ["pluginData"],
      },
    );
  }

  throw new Error(
    errors.length > 0
      ? errors.join(" | ")
      : "Unable to initialize Story Points power-up data on the card.",
  );
}

async function updateStoryPointsViaCustomField(
  options: UpdateTrelloCardStoryPointsOptions,
  resolved: ResolvedTrelloStoryPointCustomField,
): Promise<UpdateTrelloCardStoryPointsResult> {
  const body = buildCustomFieldStoryPointBody(
    resolved.customFieldType,
    options.storyPoints,
    options.clearWhenZero ?? false,
  );

  await trelloApiRequest<TrelloCustomFieldItem>({
    path: `/cards/${options.cardId}/customField/${resolved.customFieldId}/item`,
    method: "PUT",
    body,
  });

  return {
    cardId: options.cardId,
    boardId: options.boardId,
    storyPoints: options.storyPoints,
    source: "customField",
    customFieldId: resolved.customFieldId,
    customFieldName: resolved.customFieldName,
  };
}

async function updateStoryPointsViaPluginData(
  options: UpdateTrelloCardStoryPointsOptions,
  resolved: ResolvedTrelloStoryPointPluginData,
): Promise<UpdateTrelloCardStoryPointsResult> {
  const updatedValue = buildPluginStoryPointValue(
    resolved.existingValue,
    resolved.storyPointKey,
    options.storyPoints,
    options.clearWhenZero ?? false,
  );

  try {
    await trelloApiRequest<TrelloPluginData>({
      path: `/cards/${options.cardId}/pluginData/${resolved.pluginDataId}`,
      method: "PUT",
      body: {
        value: JSON.stringify(updatedValue),
      },
    });

    await verifyPluginStoryPoints(
      options.cardId,
      resolved.idPlugin,
      options.storyPoints,
    );
  } catch (error) {
    if (isTrelloPluginDataWriteForbiddenError(error)) {
      throw new TrelloStoryPointPowerUpRestrictedError(
        buildStoryPointPowerUpInitializeMessage(),
        {
          cardId: options.cardId,
          boardId: options.boardId,
          storyPoints: options.storyPoints,
          attemptedSources: ["pluginData"],
        },
      );
    }

    throw error;
  }

  return {
    cardId: options.cardId,
    boardId: options.boardId,
    storyPoints: options.storyPoints,
    source: "pluginData",
    pluginDataId: resolved.pluginDataId,
  };
}

export async function updateTrelloCardStoryPoints(
  options: UpdateTrelloCardStoryPointsOptions,
): Promise<UpdateTrelloCardStoryPointsResult> {
  assertValidStoryPoints(options.storyPoints);

  const source = options.source ?? "auto";
  const attemptedSources: TrelloStoryPointStorageSource[] = [];
  const errorDetails: TrelloStoryPointUpdateErrorDetails = {
    cardId: options.cardId,
    boardId: options.boardId,
    storyPoints: options.storyPoints,
    attemptedSources,
  };

  if (source === "auto" || source === "pluginData") {
    attemptedSources.push("pluginData");

    const preferredPluginIds =
      options.preferredPluginIds ?? getTrelloStoryPointsPluginIds();

    const resolvedPluginData = await resolveTrelloStoryPointPluginData(
      options.cardId,
      {
        idPlugin: options.idPlugin,
        preferredPluginIds,
        boardId: options.boardId,
      },
    );

    if (resolvedPluginData) {
      return updateStoryPointsViaPluginData(options, resolvedPluginData);
    }

    if (source === "pluginData") {
      try {
        const createdPluginData = await createStoryPointsPluginDataForBoard(
          options.cardId,
          options.boardId,
          options.storyPoints,
          options.idPlugin ? [options.idPlugin] : preferredPluginIds,
        );
        return {
          cardId: options.cardId,
          boardId: options.boardId,
          storyPoints: options.storyPoints,
          source: "pluginData",
          pluginDataId: createdPluginData.pluginDataId,
        };
      } catch (createError) {
        if (createError instanceof TrelloStoryPointPowerUpRestrictedError) {
          throw createError;
        }

        throw new TrelloStoryPointUpdateError(
          `Unable to update Story Points power-up on card ${options.cardId}. ${getErrorMessage(createError, "Trello rejected the power-up update.")}`,
          errorDetails,
        );
      }
    }
  }

  if (source === "auto" || source === "customField") {
    attemptedSources.push("customField");

    const resolvedCustomField = await resolveTrelloStoryPointCustomField({
      boardId: options.boardId,
      fieldNames: options.fieldNames,
    });

    if (resolvedCustomField) {
      return updateStoryPointsViaCustomField(options, resolvedCustomField);
    }

    if (source === "customField") {
      throw new TrelloStoryPointUpdateError(
        `No story point custom field found on board ${options.boardId}.`,
        errorDetails,
      );
    }
  }

  throw new TrelloStoryPointUpdateError(
    `Unable to update story points for card ${options.cardId}. No compatible custom field or plugin data storage was found.`,
    errorDetails,
  );
}

export async function getTrelloCardStoryPointContext(
  options: ReadTrelloCardStoryPointsOptions,
): Promise<{
  storyPoints: number | null;
  customField: ResolvedTrelloStoryPointCustomField | null;
  pluginData: ResolvedTrelloStoryPointPluginData | null;
}> {
  const [storyPoints, customField, pluginData] = await Promise.all([
    readTrelloCardStoryPoints(options),
    resolveTrelloStoryPointCustomField({
      boardId: options.boardId,
      fieldNames: options.fieldNames,
    }),
    resolveTrelloStoryPointPluginData(options.cardId, {
      preferredPluginIds: getTrelloStoryPointsPluginIds(),
      boardId: options.boardId,
    }),
  ]);

  return {
    storyPoints,
    customField,
    pluginData,
  };
}
