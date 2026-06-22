export const POKER_ADMIN_ROLES = new Set(["tech_lead", "super_admin", "superadmin"]);

export const POKER_TASK_CONTROLLER_ROLES = new Set([
  "tech_lead",
  "super_admin",
  "superadmin",
  "project_manager",
]);

export const RESTRICTED_VOTE_VIEWER_ROLES = new Set(["developer", "qa_engineer"]);

export const RESTRICTED_NAME_VIEWER_ROLES = new Set([
  "developer",
  "qa_engineer",
  "designer",
]);

export const DEVELOPER_ROLES = new Set([
  "developer",
  "senior_developer",
  "mid_level_developer",
]);

export type RequiredVoteTally = {
  allRequiredVoted: boolean;
  hasTie: boolean;
  winningStoryPoints: number[];
  topVoteCount: number;
};

export type PlanningPokerSessionRow = {
  id: string;
  sprint_id: string;
  task_id: string;
  is_revealed: boolean;
  revealed_at: string | null;
  revealed_by_member_id: string | null;
  is_confirmed: boolean;
  confirmed_story_points: number | null;
  confirmed_at: string | null;
  confirmed_by_member_id: string | null;
};

export type PlanningPokerSprintFocusRow = {
  sprint_id: string;
  active_task_id: string | null;
  opened_by_member_id: string | null;
  opened_at: string | null;
};

export function isPokerAdmin(role: string | null): boolean {
  return POKER_ADMIN_ROLES.has(role?.trim().toLowerCase() ?? "");
}

export function isPokerTaskController(role: string | null): boolean {
  return POKER_TASK_CONTROLLER_ROLES.has(role?.trim().toLowerCase() ?? "");
}

export function isDeveloperRole(role: string | null): boolean {
  return DEVELOPER_ROLES.has(role?.trim().toLowerCase() ?? "");
}

export function isRestrictedVoteViewer(role: string | null): boolean {
  return RESTRICTED_VOTE_VIEWER_ROLES.has(role?.trim().toLowerCase() ?? "");
}

export function isRestrictedNameViewer(role: string | null): boolean {
  return RESTRICTED_NAME_VIEWER_ROLES.has(role?.trim().toLowerCase() ?? "");
}

export function shouldHideMemberRow(
  memberId: string,
  viewerMemberId: string | null,
  hideOthersNames: boolean,
): boolean {
  if (!hideOthersNames) return false;
  if (!viewerMemberId) return true;
  return memberId !== viewerMemberId;
}

export function getRequiredVoteTally(
  requiredMemberIds: string[],
  getMemberVote: (memberId: string) => number | null,
): RequiredVoteTally {
  if (requiredMemberIds.length === 0) {
    return {
      allRequiredVoted: false,
      hasTie: false,
      winningStoryPoints: [],
      topVoteCount: 0,
    };
  }

  const voteValues = requiredMemberIds.map((memberId) => getMemberVote(memberId));
  const allRequiredVoted = voteValues.every((value) => value !== null);

  const counts = new Map<number, number>();
  for (const value of voteValues) {
    if (value === null) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  if (counts.size === 0) {
    return {
      allRequiredVoted,
      hasTie: false,
      winningStoryPoints: [],
      topVoteCount: 0,
    };
  }

  const topVoteCount = Math.max(...counts.values());
  const winningStoryPoints = [...counts.entries()]
    .filter(([, count]) => count === topVoteCount)
    .map(([storyPoints]) => storyPoints)
    .sort((left, right) => left - right);

  return {
    allRequiredVoted,
    hasTie: winningStoryPoints.length > 1,
    winningStoryPoints,
    topVoteCount,
  };
}

export function formatWinningStoryPoints(values: number[]): string {
  if (values.length === 0) return "—";
  return values.map((value) => `${value} SP`).join(", ");
}

export function getDisplayedVoteValue(
  voteValue: number | null,
  memberId: string,
  viewerMemberId: string | null,
  hideOthersVotes: boolean,
  pendingLabel: string,
): string | number {
  if (hideOthersVotes && memberId !== viewerMemberId) {
    return "—";
  }

  return voteValue ?? pendingLabel;
}

export function shouldMaskVoteInTable(
  memberId: string,
  viewerMemberId: string | null,
  hideOthersVotes: boolean,
  isRevealed: boolean,
): boolean {
  if (!hideOthersVotes) return false;
  if (memberId === viewerMemberId) return false;
  return !isRevealed;
}
