import { getSupabaseRows } from "@/lib/supabase";
import {
  getTrelloBoardMembers,
  getTrelloSprintCards,
  type TrelloSprintCard,
} from "./trello.utils";

const SPRINT_SYNC_BOARD_IDS = ["5oj0clmi", "l7BOmeGw"] as const;
const BLOCKED_LIST_NAME = "Blocked";
const TRELLO_REQUIRED_MEMBER_USERNAME = "janmichaelquisto1";

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

function isBlockedListCard(card: TrelloSprintCard): boolean {
  return normalizeLabel(card.list.name) === "blocked";
}

export function countBlockedTrelloCards(trelloCards: TrelloSprintCard[]): number {
  return trelloCards.filter(isBlockedListCard).length;
}

async function resolveRequiredMemberTrelloIds(): Promise<Set<string>> {
  const members = await getSupabaseRows<{
    trello_member_id: string | null;
    trello_username: string | null;
  }>("members", {
    select: "trello_member_id,trello_username",
  });
  const normalizedUsername = normalizeLabel(TRELLO_REQUIRED_MEMBER_USERNAME);
  const memberIds = new Set<string>();

  for (const member of members) {
    if (
      member.trello_member_id &&
      normalizeLabel(member.trello_username ?? "") === normalizedUsername
    ) {
      memberIds.add(member.trello_member_id);
    }
  }

  if (memberIds.size === 0) {
    for (const boardId of SPRINT_SYNC_BOARD_IDS) {
      const boardMembers = await getTrelloBoardMembers(boardId);

      for (const member of boardMembers) {
        if (normalizeLabel(member.username) === normalizedUsername) {
          memberIds.add(member.id);
        }
      }
    }
  }

  return memberIds;
}

function hasRequiredTrelloCardMember(
  card: TrelloSprintCard,
  requiredMemberTrelloIds: Set<string>,
): boolean {
  const normalizedUsername = normalizeLabel(TRELLO_REQUIRED_MEMBER_USERNAME);

  if (
    requiredMemberTrelloIds.size > 0 &&
    card.idMembers?.some((memberId) => requiredMemberTrelloIds.has(memberId))
  ) {
    return true;
  }

  return card.members.some(
    (member) =>
      normalizeLabel(member.username) === normalizedUsername ||
      requiredMemberTrelloIds.has(member.id),
  );
}

export async function fetchSprintBlockedTrelloCards(): Promise<TrelloSprintCard[]> {
  const requiredMemberTrelloIds = await resolveRequiredMemberTrelloIds();
  const fetchMemberIds =
    requiredMemberTrelloIds.size > 0
      ? Array.from(requiredMemberTrelloIds)
      : "all";
  const cardBatches = await Promise.all(
    SPRINT_SYNC_BOARD_IDS.map((boardId) =>
      getTrelloSprintCards({
        boardIds: [boardId],
        listNames: [BLOCKED_LIST_NAME],
        memberIds: fetchMemberIds,
      }),
    ),
  );
  const cardsById = new Map<string, TrelloSprintCard>();

  for (const card of cardBatches.flat()) {
    if (!hasRequiredTrelloCardMember(card, requiredMemberTrelloIds)) {
      continue;
    }

    cardsById.set(card.id, card);
  }

  return Array.from(cardsById.values());
}

export async function resolveSprintBlockedTasksCount(
  trelloCards?: TrelloSprintCard[],
): Promise<number> {
  if (trelloCards) {
    return countBlockedTrelloCards(trelloCards);
  }

  const blockedCards = await fetchSprintBlockedTrelloCards();
  return blockedCards.length;
}
