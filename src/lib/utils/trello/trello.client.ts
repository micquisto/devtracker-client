export type TrelloParamValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly string[];

export type TrelloRequestParams = Record<string, TrelloParamValue>;

export type TrelloApiMethod = "GET" | "POST" | "PUT" | "DELETE";

export type TrelloApiRequestOptions = {
  path: string;
  params?: TrelloRequestParams;
  method?: TrelloApiMethod;
  body?: unknown;
  headers?: Record<string, string>;
};

/**
 * Known Story Points power-up plugin IDs.
 * 59d4ef8cfea15a55b0086614 is the primary Story Points power-up used on our boards.
 * 638372c5e00ec1016bb45460 is the third-party "Story Points for Trello" power-up.
 */
export const TRELLO_STORY_POINTS_POWER_UP_PLUGIN_IDS = [
  "59d4ef8cfea15a55b0086614",
  "638372c5e00ec1016bb45460",
] as const;

export function getTrelloStoryPointsPluginIds(): readonly string[] {
  const fromEnv = import.meta.env.VITE_TRELLO_STORY_POINTS_PLUGIN_ID?.trim();

  if (fromEnv) {
    return [fromEnv];
  }

  return TRELLO_STORY_POINTS_POWER_UP_PLUGIN_IDS;
}

/**
 * Optional plugin ID for a Workbench-registered Trello Power-Up.
 * REST pluginData writes are only permitted for the API key's own Power-Up app.
 */
export function getTrelloOwnStoryPointsPluginIds(): readonly string[] {
  const fromEnv = import.meta.env.VITE_TRELLO_OWN_STORY_POINTS_PLUGIN_ID?.trim();

  if (!fromEnv) {
    return [];
  }

  return [fromEnv];
}

const TRELLO_API_BASE_URL =
  import.meta.env.VITE_TRELLO_API_BASE_URL ?? "https://api.trello.com/1";
const TRELLO_REQUEST_DELAY_MS = getEnvNumber(
  import.meta.env.VITE_TRELLO_REQUEST_DELAY_MS,
  500,
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

function getEnvNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function buildTrelloUrl(
  path: string,
  params: TrelloRequestParams = {},
): string {
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

async function parseTrelloResponseBody<T>(response: Response): Promise<T> {
  const responseText = await response.text();
  if (!responseText) {
    return undefined as T;
  }

  return JSON.parse(responseText) as T;
}

export async function trelloApiRequest<T>(
  options: TrelloApiRequestOptions,
): Promise<T> {
  const {
    path,
    params = {},
    method = "GET",
    body,
    headers = {},
  } = options;

  const requestInit: RequestInit = {
    method,
    headers: {
      ...headers,
    },
  };

  if (body !== undefined) {
    requestInit.headers = {
      "Content-Type": "application/json",
      ...requestInit.headers,
    };
    requestInit.body = JSON.stringify(body);
  }

  const response = await enqueueTrelloRequest(() =>
    fetchTrelloWithRetry(buildTrelloUrl(path, params), requestInit),
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Trello request failed (${response.status} ${response.statusText}): ${message}`,
    );
  }

  return parseTrelloResponseBody<T>(response);
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

  return parseTrelloResponseBody<T>(response);
}
