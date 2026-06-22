import {
  getTrelloBoardCustomFields,
  getTrelloCardPluginData,
  getTrelloCardStoryPoints,
  type TrelloCustomField,
  type TrelloCustomFieldItem,
  type TrelloPluginData,
} from "./trello.utils";
import { trelloApiRequest } from "./trello.client";

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

const PLUGIN_STORY_POINT_KEYS = [
  "storyPoints",
  "storyPoint",
  "points",
  "estimate",
] as const;

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
): { storyPointKey: string; existingValue: Record<string, unknown> } | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const storyPointKey = PLUGIN_STORY_POINT_KEYS.find((key) => key in parsed);

    if (!storyPointKey) {
      return null;
    }

    return { storyPointKey, existingValue: parsed };
  } catch {
    return null;
  }
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
): Promise<ResolvedTrelloStoryPointPluginData | null> {
  const pluginDataItems = await getTrelloCardPluginData(cardId);

  for (const item of pluginDataItems) {
    const parsed = parsePluginStoryPointPayload(item.value);
    if (!parsed) {
      continue;
    }

    return {
      source: "pluginData",
      cardId,
      pluginDataId: item.id,
      idPlugin: item.idPlugin,
      storyPointKey: parsed.storyPointKey,
      existingValue: parsed.existingValue,
    };
  }

  return null;
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
  const updatedValue = {
    ...resolved.existingValue,
    [resolved.storyPointKey]:
      options.storyPoints === 0 && (options.clearWhenZero ?? false)
        ? 0
        : options.storyPoints,
  };

  await trelloApiRequest<TrelloPluginData>({
    path: `/cards/${options.cardId}/pluginData/${resolved.pluginDataId}`,
    method: "PUT",
    body: {
      value: JSON.stringify(updatedValue),
    },
  });

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

  if (source === "auto" || source === "pluginData") {
    attemptedSources.push("pluginData");

    const resolvedPluginData = await resolveTrelloStoryPointPluginData(
      options.cardId,
    );

    if (resolvedPluginData) {
      return updateStoryPointsViaPluginData(options, resolvedPluginData);
    }

    if (source === "pluginData") {
      throw new TrelloStoryPointUpdateError(
        `No story point plugin data found on card ${options.cardId}.`,
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
    resolveTrelloStoryPointPluginData(options.cardId),
  ]);

  return {
    storyPoints,
    customField,
    pluginData,
  };
}
