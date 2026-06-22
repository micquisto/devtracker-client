import { getFrequencyPreset } from "@/lib/backgroundProcesses/backgroundProcess.config";
import type {
  BackgroundProcessKey,
  BackgroundProcessRow,
  BackgroundProcessRunState,
} from "@/lib/backgroundProcesses/backgroundProcess.registry";

type RawBackgroundProcessRow = Record<string, unknown>;

const RUN_STATES = new Set<BackgroundProcessRunState>([
  "idle",
  "processing",
  "success",
  "failed",
]);

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNullableString(value: unknown): string | null {
  const text = readString(value);
  return text.length > 0 ? text : null;
}

function readBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;

    return parsed.toISOString();
  }

  return null;
}

function readRunState(value: unknown): BackgroundProcessRunState {
  const state = readString(value).toLowerCase();
  if (RUN_STATES.has(state as BackgroundProcessRunState)) {
    return state as BackgroundProcessRunState;
  }
  return "idle";
}

function resolveFrequencyLabel(
  frequency: string | null,
  frequencyIntervalMs: number,
): string | null {
  if (frequency) return frequency;
  if (frequencyIntervalMs <= 0) return "Manual only";
  return getFrequencyPreset(frequencyIntervalMs)?.label ?? null;
}

export function normalizeBackgroundProcessRow(
  row: RawBackgroundProcessRow,
): BackgroundProcessRow | null {
  const processKey = readString(row.process_key);
  const id = readString(row.id);

  if (!id || !processKey) {
    return null;
  }

  const name =
    readString(row.name) ||
    readString(row.label) ||
    processKey.replaceAll("_", " ");
  const description = readString(row.description);
  const frequencyIntervalMs = readNumber(row.frequency_interval_ms, 0);
  const frequency = resolveFrequencyLabel(
    readNullableString(row.frequency) ?? readNullableString(row.interval_label),
    frequencyIntervalMs,
  );

  return {
    id,
    process_key: processKey as BackgroundProcessKey,
    name,
    description,
    frequency,
    frequency_interval_ms: frequencyIntervalMs,
    last_run_at: readTimestamp(row.last_run_at),
    last_completed_at: readTimestamp(row.last_completed_at),
    state: readRunState(row.state),
    last_error: readNullableString(row.last_error),
    is_enabled: readBoolean(row.is_enabled, false),
    created_at: readTimestamp(row.created_at) ?? "",
    updated_at: readTimestamp(row.updated_at) ?? "",
  };
}

export function normalizeBackgroundProcessRows(
  rows: RawBackgroundProcessRow[],
): BackgroundProcessRow[] {
  return rows
    .map(normalizeBackgroundProcessRow)
    .filter((row): row is BackgroundProcessRow => row !== null);
}
