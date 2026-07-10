export const FROZEN_SPRINT_STATUSES = new Set(["done", "completed"]);

export function normalizeSprintStatusForFreeze(
  status: string | null | undefined,
): string {
  return status?.trim().toLowerCase() ?? "";
}

export function isFrozenSprintStatus(
  status: string | null | undefined,
): boolean {
  return FROZEN_SPRINT_STATUSES.has(normalizeSprintStatusForFreeze(status));
}

export function isFrozenSprint(
  sprint: { status: string | null | undefined },
): boolean {
  return isFrozenSprintStatus(sprint.status);
}

export const FROZEN_SPRINT_TASKS_ERROR =
  "Tasks for done or completed sprints are frozen and cannot be created, updated, or deleted.";

export function getFrozenSprintTasksErrorMessage(
  sprint: { status?: string | null; name?: string | null },
): string {
  const sprintLabel = sprint.name?.trim() || "This sprint";
  const statusLabel = sprint.status?.trim() || "closed";

  return `${sprintLabel} is ${statusLabel}. ${FROZEN_SPRINT_TASKS_ERROR}`;
}

export function assertSprintTasksMutable(
  sprint: { status: string | null | undefined; name?: string | null },
): void {
  if (isFrozenSprint(sprint)) {
    throw new Error(getFrozenSprintTasksErrorMessage(sprint));
  }
}
