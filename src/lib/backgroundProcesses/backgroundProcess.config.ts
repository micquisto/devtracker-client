import type {
  BackgroundProcessKey,
  BackgroundProcessRow,
} from "@/lib/backgroundProcesses/backgroundProcess.registry";

export const BACKGROUND_PROCESS_FREQUENCY_PRESETS = [
  { label: "Every 1 minute", intervalMs: 60_000 },
  { label: "Every 5 minutes", intervalMs: 5 * 60_000 },
  { label: "Every 10 minutes", intervalMs: 10 * 60_000 },
  { label: "Every 15 minutes", intervalMs: 15 * 60_000 },
  { label: "Every 30 minutes", intervalMs: 30 * 60_000 },
  { label: "Every 1 hour", intervalMs: 60 * 60_000 },
  { label: "Manual only", intervalMs: 0 },
] as const;

export function getFrequencyPreset(intervalMs: number) {
  return BACKGROUND_PROCESS_FREQUENCY_PRESETS.find(
    (preset) => preset.intervalMs === intervalMs,
  );
}

export function getFrequencyPresetValue(process: BackgroundProcessRow): string {
  const preset = getFrequencyPreset(process.frequency_interval_ms);
  if (preset) return String(preset.intervalMs);

  return process.frequency_interval_ms > 0
    ? String(process.frequency_interval_ms)
    : "0";
}

export function getBackgroundProcessIntervalMs(
  process: BackgroundProcessRow | null | undefined,
): number | null {
  if (!process) return null;

  const intervalMs = process.frequency_interval_ms;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return null;

  return intervalMs;
}

export function findBackgroundProcess(
  processes: BackgroundProcessRow[],
  processKey: BackgroundProcessKey,
): BackgroundProcessRow | null {
  return processes.find((process) => process.process_key === processKey) ?? null;
}
