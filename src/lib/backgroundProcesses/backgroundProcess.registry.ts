export const BACKGROUND_PROCESS_KEYS = {
  SPRINT_TRELLO_SYNC: "sprint_trello_sync",
} as const;

export type BackgroundProcessKey =
  (typeof BACKGROUND_PROCESS_KEYS)[keyof typeof BACKGROUND_PROCESS_KEYS];

export type BackgroundProcessRunState =
  | "idle"
  | "processing"
  | "success"
  | "failed";

export type BackgroundProcessRow = {
  id: string;
  process_key: BackgroundProcessKey;
  name: string;
  description: string;
  frequency: string | null;
  frequency_interval_ms: number;
  last_run_at: string | null;
  last_completed_at: string | null;
  state: BackgroundProcessRunState;
  last_error: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export const BACKGROUND_PROCESS_MANAGER_ROLES = [
  "tech_lead",
  "super_admin",
] as const;

export type BackgroundProcessManagerRole =
  (typeof BACKGROUND_PROCESS_MANAGER_ROLES)[number];

export function canManageBackgroundProcesses(role: string | null | undefined): boolean {
  const normalizedRole = role?.trim().toLowerCase() ?? "";

  return BACKGROUND_PROCESS_MANAGER_ROLES.some(
    (managerRole) => managerRole === normalizedRole,
  );
}
