import {
  BACKGROUND_PROCESS_KEYS,
  type BackgroundProcessKey,
  type BackgroundProcessRow,
} from "@/lib/backgroundProcesses/backgroundProcess.registry";

export const DEFAULT_BACKGROUND_PROCESSES: BackgroundProcessRow[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    process_key: BACKGROUND_PROCESS_KEYS.SPRINT_TRELLO_SYNC,
    name: "Sprint Trello Sync",
    description:
      "Automatically syncs current sprint task data from Trello after page load and every 5 minutes.",
    frequency: "Every 5 minutes",
    frequency_interval_ms: 5 * 60 * 1000,
    last_run_at: null,
    last_completed_at: null,
    state: "idle",
    last_error: null,
    is_enabled: true,
    created_at: "",
    updated_at: "",
  },
];

export function getDefaultBackgroundProcess(
  processKey: BackgroundProcessKey,
): BackgroundProcessRow | undefined {
  return DEFAULT_BACKGROUND_PROCESSES.find(
    (process) => process.process_key === processKey,
  );
}

export function isMissingBackgroundProcessesTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message).toLowerCase() : "";

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "42883" ||
    message.includes("background_processes") ||
    message.includes("ensure_background_processes") ||
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("could not find the function")
  );
}
