export const SCOREBOARD_INCLUDED_MEMBER_ROLES = new Set([
  "developer",
  "senior_developer",
  "qa_engineer",
  "designer",
]);

export type ScoreboardMemberLike = {
  id: string | null;
  role?: string | null;
};

export type MemberNameSortLike = {
  last_name?: string | null;
  first_name?: string | null;
  full_name?: string | null;
};

export function compareMembersByLastName(
  memberA: MemberNameSortLike,
  memberB: MemberNameSortLike,
): number {
  const lastNameCompare = (memberA.last_name?.trim() ?? "").localeCompare(
    memberB.last_name?.trim() ?? "",
    undefined,
    { sensitivity: "base" },
  );

  if (lastNameCompare !== 0) {
    return lastNameCompare;
  }

  const firstNameCompare = (memberA.first_name?.trim() ?? "").localeCompare(
    memberB.first_name?.trim() ?? "",
    undefined,
    { sensitivity: "base" },
  );

  if (firstNameCompare !== 0) {
    return firstNameCompare;
  }

  return (memberA.full_name?.trim() ?? "").localeCompare(
    memberB.full_name?.trim() ?? "",
    undefined,
    { sensitivity: "base" },
  );
}

export function sortMembersByLastName<T extends MemberNameSortLike>(
  members: T[],
): T[] {
  return [...members].sort(compareMembersByLastName);
}

export function normalizeMemberRole(role: string | null | undefined): string {
  return role?.trim().toLowerCase() ?? "";
}

export function isScoreboardIncludedMemberRole(
  role: string | null | undefined,
): boolean {
  return SCOREBOARD_INCLUDED_MEMBER_ROLES.has(normalizeMemberRole(role));
}

export function isScoreboardIncludedMember(
  member: ScoreboardMemberLike,
  options: { includeAllMembers?: boolean } = {},
): member is ScoreboardMemberLike & { id: string } {
  if (!member.id) {
    return false;
  }

  if (options.includeAllMembers) {
    return true;
  }

  return isScoreboardIncludedMemberRole(member.role);
}

export function buildScoreboardIncludedMemberIdSet(
  members: ScoreboardMemberLike[],
  options: { includeAllMembers?: boolean } = {},
): Set<string> {
  return new Set(
    members
      .filter((member): member is ScoreboardMemberLike & { id: string } =>
        isScoreboardIncludedMember(member, options),
      )
      .map((member) => member.id),
  );
}

export function isTaskAssignedToScoreboardMember(
  assignedTo: string | null | undefined,
  includedMemberIds: Set<string>,
): boolean {
  return Boolean(assignedTo && includedMemberIds.has(assignedTo));
}

export function filterTasksForScoreboardMembers<
  T extends { assigned_to: string | null },
>(
  tasks: T[],
  includedMemberIds: Set<string>,
  options: { includeAllMembers?: boolean } = {},
): T[] {
  if (options.includeAllMembers) {
    return tasks;
  }

  return tasks.filter((task) =>
    isTaskAssignedToScoreboardMember(task.assigned_to, includedMemberIds),
  );
}

export function filterRowsForScoreboardMembers<
  T extends { member_id: string },
>(
  rows: T[],
  includedMemberIds: Set<string>,
  options: { includeAllMembers?: boolean } = {},
): T[] {
  if (options.includeAllMembers) {
    return rows;
  }

  return rows.filter((row) => includedMemberIds.has(row.member_id));
}
