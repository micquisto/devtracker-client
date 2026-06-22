import type { BackgroundProcessKey, BackgroundProcessRow } from "@/lib/backgroundProcesses/backgroundProcess.registry";
import { isMissingBackgroundProcessesTableError } from "@/lib/backgroundProcesses/backgroundProcess.defaults";
import { normalizeBackgroundProcessRow } from "@/lib/backgroundProcesses/backgroundProcess.mapper";
import { getSupabaseRows, supabase } from "@/lib/supabase";

export type BackgroundProcessRunState =
  | "idle"
  | "processing"
  | "success"
  | "failed";

type RunTrackedBackgroundProcessOptions = {
  onStateChange?: (row: BackgroundProcessRow | null) => void;
};

async function ensureBackgroundProcessRecord(): Promise<boolean> {
  const { error } = await supabase.rpc("ensure_background_processes");

  if (!error) {
    return true;
  }

  if (isMissingBackgroundProcessesTableError(error)) {
    return false;
  }

  throw error;
}

async function fetchBackgroundProcessRow(
  processKey: BackgroundProcessKey,
): Promise<BackgroundProcessRow | null> {
  const rows = await getSupabaseRows<Record<string, unknown>>("background_processes", {
    select: "*",
    eq: { process_key: processKey },
    limit: 1,
  });

  const row = rows[0];
  if (!row) return null;

  return normalizeBackgroundProcessRow(row);
}

function normalizeRpcRow(data: unknown): BackgroundProcessRow | null {
  if (!data || typeof data !== "object") return null;

  if (Array.isArray(data)) {
    const firstRow = data[0];
    return firstRow && typeof firstRow === "object"
      ? normalizeBackgroundProcessRow(firstRow as Record<string, unknown>)
      : null;
  }

  return normalizeBackgroundProcessRow(data as Record<string, unknown>);
}

async function updateBackgroundProcessRun(
  processKey: BackgroundProcessKey,
  state: BackgroundProcessRunState,
  lastError: string | null = null,
): Promise<BackgroundProcessRow | null> {
  const isAvailable = await ensureBackgroundProcessRecord();
  if (!isAvailable) {
    return null;
  }

  const { data, error } = await supabase.rpc("update_background_process_run", {
    p_process_key: processKey,
    p_state: state,
    p_last_error: lastError,
  });

  if (error) {
    if (isMissingBackgroundProcessesTableError(error)) {
      return null;
    }

    throw error;
  }

  const updatedRow = normalizeRpcRow(data);
  if (updatedRow) {
    return updatedRow;
  }

  return fetchBackgroundProcessRow(processKey);
}

export async function markBackgroundProcessRunStarted(
  processKey: BackgroundProcessKey,
): Promise<BackgroundProcessRow | null> {
  return updateBackgroundProcessRun(processKey, "processing");
}

export async function markBackgroundProcessRunSuccess(
  processKey: BackgroundProcessKey,
): Promise<BackgroundProcessRow | null> {
  return updateBackgroundProcessRun(processKey, "success");
}

export async function markBackgroundProcessRunFailed(
  processKey: BackgroundProcessKey,
  errorMessage: string,
): Promise<BackgroundProcessRow | null> {
  return updateBackgroundProcessRun(processKey, "failed", errorMessage);
}

export async function runTrackedBackgroundProcess<T>(
  processKey: BackgroundProcessKey,
  run: () => Promise<T>,
  options: RunTrackedBackgroundProcessOptions = {},
): Promise<T> {
  const notifyStateChange = (row: BackgroundProcessRow | null): void => {
    options.onStateChange?.(row);
  };

  try {
    notifyStateChange(await markBackgroundProcessRunStarted(processKey));
  } catch {
    // Run tracking is best-effort when the database is unavailable.
  }

  try {
    const result = await run();

    try {
      notifyStateChange(await markBackgroundProcessRunSuccess(processKey));
    } catch {
      // Run tracking is best-effort when the database is unavailable.
    }

    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Background process run failed.";

    try {
      notifyStateChange(await markBackgroundProcessRunFailed(processKey, message));
    } catch {
      // Run tracking is best-effort when the database is unavailable.
    }

    throw error;
  }
}
