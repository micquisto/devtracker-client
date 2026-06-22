import "@/assets/styles/SprintKanbanBoard.css";
import "@/assets/styles/PlanningPoker.page.css";
import PlanningPokerVoteProgress from "@/components/scrum/planningPoker/PlanningPokerVoteProgress";
import TrelloDescription from "@/components/scrum/TrelloDescription";
import SprintSyncDataAction from "@/components/scrum/sprint/SprintSyncDataAction";
import type { SprintSyncTarget } from "@/components/scrum/sprint/SprintSyncDataAction";
import { Card } from "@/components/shared/Containers";
import { SectionTitle } from "@/components/shared/Sections";
import { PRI_COLOR } from "@/lib/helper";
import {
  getSupabaseRows,
  getSupabaseSession,
  supabase,
} from "@/lib/supabase";
import {
  Palette,
  SeverityColor,
} from "@/lib/theme";
import { useSprintSync } from "@/contexts";
import { syncTaskStoryPointsFromTrello } from "@/lib/utils/trello";
import {
  getTrelloStoryPointsForPlanningListCardsByBoard,
} from "@/lib/utils/trello/trello.utils";
import { DEFAULT_TRELLO_STORY_POINT_FIELD_NAMES } from "@/lib/utils/trello/trello.storyPoints";
import { isForPlanningTrelloList, TRELLO_FOR_PLANNING_LIST_NAME } from "@/lib/utils/trello/trello.listNames";
import type { SyncedPlanningTaskRow } from "@/lib/utils/trello/sprintSync.utils";
import {
  formatWinningStoryPoints,
  getDisplayedVoteValue,
  getRequiredVoteTally,
  isDeveloperRole,
  isPokerAdmin,
  isPokerTaskController,
  isRestrictedNameViewer,
  isRestrictedVoteViewer,
  shouldHideMemberRow,
  shouldMaskVoteInTable,
  type PlanningPokerSessionRow,
  type PlanningPokerSprintFocusRow,
} from "@/lib/planningPoker/planningPoker.utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const POKER_POINT_OPTIONS = [0, 1, 2, 3, 5, 8, 13, 21] as const;
const PLANNING_POKER_FOCUS_POLL_MS = 3000;
const PLANNING_POKER_FOCUS_BROADCAST_EVENT = "sprint_focus_changed";
const TASK_LIST_SELECT =
  "id,sprint_id,title,task_type,priority,severity,story_points,sp_type,trello_list_name,trello_short_id,trello_card_url,trello_card_id,trello_board_id";
const TASK_DETAIL_SELECT = `${TASK_LIST_SELECT},description`;

type SprintRow = {
  id: string;
  name: string | null;
  sprint_number: number | null;
  is_current: number | boolean | null;
  status: string | null;
};

type TaskRow = {
  id: string;
  sprint_id: string;
  title: string;
  description: string | null;
  task_type: "bug" | "feature" | "improvement";
  priority: "critical" | "high" | "medium" | "low";
  severity: number;
  story_points: number;
  sp_type: "planned" | "adhoc" | "done" | "blocked";
  trello_list_name: string | null;
  trello_short_id: number | null;
  trello_card_url: string | null;
  trello_card_id: string | null;
  trello_board_id: string | null;
};

type MemberRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
};

type VoteRow = {
  id: string;
  sprint_id: string;
  task_id: string;
  member_id: string;
  story_points: number;
  created_at: string;
};

type SprintFocusBroadcastPayload = {
  sprint_id: string;
  task_id: string | null;
  opened_at: string | null;
};

function getPlanningPokerChannelName(sprintId: string): string {
  return `planning-poker-${sprintId}`;
}

type VoteTableRow = {
  id: string;
  sprintLabel: string;
  taskTitle: string;
  taskType: string;
  memberName: string;
  memberRole: string;
  storyPoints: number | string;
  consensusStoryPoints: string | null;
  isRequiredVoter: boolean;
};

const ASSIGNEE_COLORS = [
  Palette.cyan,
  Palette.green,
  Palette.gold,
  Palette.purple,
  Palette.pink,
  Palette.orange,
  Palette.indigo,
  Palette.redSoft,
];

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {
    const { message, details, hint, code } = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    const parts = [message, details, hint, code].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(" — ");
    }
  }

  return fallback;
}

function getMemberName(member: MemberRow): string {
  return (
    member.full_name ||
    [member.first_name, member.last_name].filter(Boolean).join(" ") ||
    "Unnamed member"
  );
}

function getMemberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "MB";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getAssigneeColor(memberId: string): string {
  const hash = Array.from(memberId).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  return ASSIGNEE_COLORS[hash % ASSIGNEE_COLORS.length];
}

function getSeverityLabel(value: number): string {
  if (value === 1.3) return "P1";
  if (value === 1.2) return "P2";
  if (value === 1.1) return "P3";
  return "P4";
}

function getSprintLabel(sprint: SprintRow): string {
  const fallback = sprint.sprint_number
    ? `Sprint ${sprint.sprint_number}`
    : "Unnamed sprint";
  const name = sprint.name || fallback;
  const isCurrent = sprint.is_current === 1 || sprint.is_current === true;
  return isCurrent ? `${name} (Current)` : name;
}

function formatRoleLabel(role: string | null): string {
  if (!role?.trim()) return "Member";
  return role
    .trim()
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}


function isPlanningListTask(task: Pick<TaskRow, "trello_list_name">): boolean {
  return isForPlanningTrelloList(task.trello_list_name);
}

function hasStoryPointsValue(points: number | null | undefined): boolean {
  const value = Number(points);
  return Number.isFinite(value) && value > 0;
}

function isUnpointedTask(task: Pick<TaskRow, "story_points">): boolean {
  return !hasStoryPointsValue(task.story_points);
}

function isPlanningPokerTaskFromDb(
  task: TaskRow,
  confirmedTaskIds: ReadonlySet<string>,
): boolean {
  return (
    isPlanningListTask(task) &&
    !confirmedTaskIds.has(task.id) &&
    isUnpointedTask(task)
  );
}

function isPlanningPokerTask(
  task: TaskRow,
  confirmedTaskIds: ReadonlySet<string>,
  trelloStoryPointsByTaskId: Map<string, number | null>,
): boolean {
  if (!isPlanningPokerTaskFromDb(task, confirmedTaskIds)) {
    return false;
  }

  const trelloStoryPoints = trelloStoryPointsByTaskId.get(task.id);
  if (hasStoryPointsValue(trelloStoryPoints)) {
    return false;
  }

  return true;
}

function groupPlanningTasksByBoardId(tasks: TaskRow[]): Map<string, TaskRow[]> {
  const tasksByBoardId = new Map<string, TaskRow[]>();

  for (const task of tasks) {
    const boardId = task.trello_board_id?.trim();
    const cardId = task.trello_card_id?.trim();
    if (!boardId || !cardId) {
      continue;
    }

    const boardTasks = tasksByBoardId.get(boardId) ?? [];
    boardTasks.push(task);
    tasksByBoardId.set(boardId, boardTasks);
  }

  return tasksByBoardId;
}

async function fetchTrelloStoryPointsByTaskId(
  tasks: TaskRow[],
): Promise<Map<string, number | null>> {
  const storyPointsByTaskId = new Map<string, number | null>();
  const tasksByBoardId = groupPlanningTasksByBoardId(tasks);

  await Promise.all(
    [...tasksByBoardId.entries()].map(async ([boardId, boardTasks]) => {
      try {
        const storyPointsByCardId = await getTrelloStoryPointsForPlanningListCardsByBoard(
          boardId,
          boardTasks.map((task) => task.trello_card_id as string),
          [...DEFAULT_TRELLO_STORY_POINT_FIELD_NAMES],
        );

        for (const task of boardTasks) {
          const cardId = task.trello_card_id as string;
          storyPointsByTaskId.set(task.id, storyPointsByCardId.get(cardId) ?? null);
        }
      } catch {
        for (const task of boardTasks) {
          storyPointsByTaskId.set(task.id, null);
        }
      }
    }),
  );

  return storyPointsByTaskId;
}

async function refinePlanningTasksWithTrello(
  planningListTasks: TaskRow[],
  confirmedTaskIds: ReadonlySet<string>,
): Promise<TaskRow[]> {
  const tasksToVerify = planningListTasks.filter((task) =>
    isPlanningPokerTaskFromDb(task, confirmedTaskIds),
  );

  if (tasksToVerify.length === 0) {
    return [];
  }

  const trelloStoryPointsByTaskId = await fetchTrelloStoryPointsByTaskId(tasksToVerify);

  return planningListTasks.filter((task) =>
    isPlanningPokerTask(task, confirmedTaskIds, trelloStoryPointsByTaskId),
  );
}

function formatTaskType(taskType: string): string {
  return taskType.charAt(0).toUpperCase() + taskType.slice(1);
}

function getTaskDisplayColors(task: TaskRow): {
  severityLabel: string;
  severityColor: string;
  priorityColor: string;
} {
  const severityLabel = getSeverityLabel(task.severity);
  const severityColor = SeverityColor[severityLabel] ?? Palette.green;
  const priorityColor =
    PRI_COLOR[task.priority] ??
    {
      critical: Palette.red,
      high: Palette.orange,
      medium: Palette.gold,
      low: Palette.green,
    }[task.priority] ??
    Palette.cyan;

  return { severityLabel, severityColor, priorityColor };
}

export default function PlanningPokerPage() {
  const [currentSprint, setCurrentSprint] = useState<SprintRow | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [planningListTaskCount, setPlanningListTaskCount] = useState(0);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [taskSessions, setTaskSessions] = useState<PlanningPokerSessionRow[]>([]);
  const [sprintFocus, setSprintFocus] = useState<PlanningPokerSprintFocusRow | null>(null);
  const [focusedTask, setFocusedTask] = useState<TaskRow | null>(null);
  const [focusedTaskLoading, setFocusedTaskLoading] = useState(false);
  const [voteTaskRows, setVoteTaskRows] = useState<TaskRow[]>([]);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [trelloVerifyLoading, setTrelloVerifyLoading] = useState(false);
  const [savingVote, setSavingVote] = useState(false);
  const [pendingSessionAction, setPendingSessionAction] = useState<
    "reveal" | "confirm" | "revote" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [voteMessage, setVoteMessage] = useState<string | null>(null);
  const { syncVersion } = useSprintSync();
  const [activeTaskDescription, setActiveTaskDescription] = useState<{
    taskId: string;
    description: string | null;
    loading: boolean;
  } | null>(null);
  const planningPokerChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const trelloVerifyRequestIdRef = useRef(0);
  const activeTaskDescriptionRequestIdRef = useRef(0);
  const focusedTaskIdRef = useRef<string | null>(null);

  const currentSprintId = currentSprint?.id ?? "";

  const currentSprintSyncTarget = useMemo((): SprintSyncTarget | null => {
    if (!currentSprint) return null;

    return {
      id: currentSprint.id,
      name: currentSprint.name ?? getSprintLabel(currentSprint),
      status: currentSprint.status,
    };
  }, [currentSprint]);

  const currentMemberRole = useMemo(() => {
    if (!currentMemberId) return null;
    return members.find((member) => member.id === currentMemberId)?.role ?? null;
  }, [currentMemberId, members]);

  const hideOthersVotes = useMemo(
    () => isRestrictedVoteViewer(currentMemberRole),
    [currentMemberRole],
  );

  const hideOthersNames = useMemo(
    () => isRestrictedNameViewer(currentMemberRole),
    [currentMemberRole],
  );

  const isCurrentMemberPokerAdmin = useMemo(
    () => isPokerAdmin(currentMemberRole),
    [currentMemberRole],
  );

  const isTaskController = useMemo(
    () => isPokerTaskController(currentMemberRole),
    [currentMemberRole],
  );

  const activeTaskId = isTaskController
    ? selectedTaskId
    : (sprintFocus?.active_task_id ?? focusedTask?.id ?? null);

  const activeTask = useMemo(() => {
    if (!activeTaskId) return null;

    if (isTaskController) {
      return tasks.find((task) => task.id === activeTaskId) ?? null;
    }

    if (focusedTask?.id === activeTaskId) {
      return focusedTask;
    }

    return voteTaskRows.find((task) => task.id === activeTaskId) ?? null;
  }, [activeTaskId, focusedTask, isTaskController, tasks, voteTaskRows]);

  const taskSessionsByTaskId = useMemo(() => {
    const map = new Map<string, PlanningPokerSessionRow>();
    for (const session of taskSessions) {
      map.set(session.task_id, session);
    }
    return map;
  }, [taskSessions]);

  const developerMembers = useMemo(
    () => members.filter((member) => isDeveloperRole(member.role)),
    [members],
  );

  const optionalMembers = useMemo(
    () => members.filter((member) => !isDeveloperRole(member.role)),
    [members],
  );

  const visibleDeveloperMembers = useMemo(
    () =>
      developerMembers.filter(
        (member) => !shouldHideMemberRow(member.id, currentMemberId, hideOthersNames),
      ),
    [currentMemberId, developerMembers, hideOthersNames],
  );

  const visibleOptionalMembers = useMemo(
    () =>
      optionalMembers.filter(
        (member) => !shouldHideMemberRow(member.id, currentMemberId, hideOthersNames),
      ),
    [currentMemberId, hideOthersNames, optionalMembers],
  );

  const votesByTaskAndMember = useMemo(() => {
    const map = new Map<string, VoteRow>();
    for (const vote of votes) {
      map.set(`${vote.task_id}:${vote.member_id}`, vote);
    }
    return map;
  }, [votes]);

  const voteTableRows = useMemo<VoteTableRow[]>(() => {
    const sprintLabel = currentSprint ? getSprintLabel(currentSprint) : "-";
    const tasksById = new Map(
      [...tasks, ...voteTaskRows].map((task) => [task.id, task]),
    );
    const membersById = new Map(members.map((member) => [member.id, member]));
    const requiredMemberIds = developerMembers.map((member) => member.id);

    return votes
      .map((vote) => {
        const task = tasksById.get(vote.task_id);
        const member = membersById.get(vote.member_id);
        if (!task || !member || !isPlanningListTask(task)) return null;
        if (!isTaskController && activeTaskId && vote.task_id !== activeTaskId) {
          return null;
        }
        if (shouldHideMemberRow(vote.member_id, currentMemberId, hideOthersNames)) {
          return null;
        }

        const session = taskSessionsByTaskId.get(vote.task_id);
        const isRevealed = session?.is_revealed ?? false;
        const tally = getRequiredVoteTally(requiredMemberIds, (memberId) =>
          votesByTaskAndMember.get(`${vote.task_id}:${memberId}`)?.story_points ?? null,
        );
        const maskVote = shouldMaskVoteInTable(
          vote.member_id,
          currentMemberId,
          hideOthersVotes,
          isRevealed,
        );
        const storyPoints = maskVote ? "—" : vote.story_points;
        const consensusStoryPoints =
          isRevealed && tally.winningStoryPoints.length > 0
            ? formatWinningStoryPoints(tally.winningStoryPoints)
            : null;

        return {
          id: vote.id,
          sprintLabel,
          taskTitle: task.title,
          taskType: formatTaskType(task.task_type),
          memberName: getMemberName(member),
          memberRole: formatRoleLabel(member.role),
          storyPoints,
          consensusStoryPoints,
          isRequiredVoter: isDeveloperRole(member.role),
        };
      })
      .filter((row): row is VoteTableRow => row !== null)
      .sort((left, right) => {
        const taskCompare = left.taskTitle.localeCompare(right.taskTitle);
        if (taskCompare !== 0) return taskCompare;
        return left.memberName.localeCompare(right.memberName);
      });
  }, [
    currentMemberId,
    developerMembers,
    hideOthersNames,
    hideOthersVotes,
    isTaskController,
    members,
    activeTaskId,
    currentSprint,
    taskSessionsByTaskId,
    tasks,
    voteTaskRows,
    votes,
    votesByTaskAndMember,
  ]);

  const reloadVotes = useCallback(async (sprintId: string) => {
    const [voteRows, sessionRows] = await Promise.all([
      getSupabaseRows<VoteRow>("planning_poker_votes", {
        select: "id,sprint_id,task_id,member_id,story_points,created_at",
        eq: { sprint_id: sprintId },
        order: { column: "created_at", ascending: false },
      }),
      getSupabaseRows<PlanningPokerSessionRow>("planning_poker_sessions", {
        select:
          "id,sprint_id,task_id,is_revealed,revealed_at,revealed_by_member_id,is_confirmed,confirmed_story_points,confirmed_at,confirmed_by_member_id",
        eq: { sprint_id: sprintId },
      }).catch(() => [] as PlanningPokerSessionRow[]),
    ]);
    setVotes(voteRows);
    setTaskSessions(sessionRows);

    const votedTaskIds = [...new Set(voteRows.map((vote) => vote.task_id))];
    if (votedTaskIds.length === 0) {
      setVoteTaskRows([]);
      return;
    }

    const { data: votedTasks, error: votedTasksError } = await supabase
      .from("tasks")
      .select(TASK_LIST_SELECT)
      .in("id", votedTaskIds);

    if (votedTasksError) {
      throw votedTasksError;
    }

    setVoteTaskRows(
      ((votedTasks ?? []) as TaskRow[]).filter((task) => isPlanningListTask(task)),
    );
  }, []);

  const loadFocusedTaskById = useCallback(
    async (taskId: string | null, options?: { silent?: boolean }) => {
      if (!taskId) {
        focusedTaskIdRef.current = null;
        setFocusedTask(null);
        setFocusedTaskLoading(false);
        return;
      }

      const isSameTask = focusedTaskIdRef.current === taskId;
      const silent = options?.silent ?? isSameTask;

      if (!silent) {
        setFocusedTaskLoading(true);
      }

      try {
        const { data, error } = await supabase
          .from("tasks")
          .select(TASK_DETAIL_SELECT)
          .eq("id", taskId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        const nextTask = (data as TaskRow | null) ?? null;
        focusedTaskIdRef.current = nextTask?.id ?? null;
        setFocusedTask(nextTask);
      } catch (focusError) {
        if (!isSameTask) {
          focusedTaskIdRef.current = null;
          setFocusedTask(null);
        }
        console.warn("Unable to load facilitator task:", focusError);
      } finally {
        if (!silent) {
          setFocusedTaskLoading(false);
        }
      }
    },
    [],
  );

  const loadSprintFocusRow = useCallback(async (sprintId: string) => {
    const { data, error } = await supabase
      .from("planning_poker_sprint_focus")
      .select("sprint_id,active_task_id,opened_by_member_id,opened_at")
      .eq("sprint_id", sprintId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const focusRow = (data as PlanningPokerSprintFocusRow | null) ?? null;
    setSprintFocus(focusRow);
    return focusRow;
  }, []);

  const applySprintFocusBroadcast = useCallback(
    (payload: SprintFocusBroadcastPayload) => {
      if (!payload.task_id) {
        setSprintFocus(null);
        return;
      }

      setSprintFocus({
        sprint_id: payload.sprint_id,
        active_task_id: payload.task_id,
        opened_by_member_id: null,
        opened_at: payload.opened_at,
      });
    },
    [],
  );

  const broadcastSprintFocusChange = useCallback(
    async (payload: SprintFocusBroadcastPayload) => {
      const message = {
        type: "broadcast" as const,
        event: PLANNING_POKER_FOCUS_BROADCAST_EVENT,
        payload,
      };

      const existingChannel = planningPokerChannelRef.current;
      if (existingChannel) {
        await existingChannel.send(message);
        return;
      }

      const channel = supabase.channel(getPlanningPokerChannelName(payload.sprint_id), {
        config: { broadcast: { self: true } },
      });

      await new Promise<void>((resolve) => {
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            void channel.send(message).finally(() => {
              void supabase.removeChannel(channel);
              resolve();
            });
            return;
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            void supabase.removeChannel(channel);
            resolve();
          }
        });
      });
    },
    [],
  );

  const syncFocusedTaskFromSprintFocus = useCallback(
    async (sprintId: string) => {
      try {
        const focusRow = await loadSprintFocusRow(sprintId);
        const nextTaskId = focusRow?.active_task_id ?? null;

        if (nextTaskId) {
          await loadFocusedTaskById(nextTaskId, {
            silent: focusedTaskIdRef.current === nextTaskId,
          });
        } else {
          await loadFocusedTaskById(null);
        }

        if (isTaskController) {
          setSelectedTaskId(nextTaskId);
        }

        return focusRow;
      } catch (syncError) {
        console.warn("Unable to sync planning poker sprint focus:", syncError);
        return null;
      }
    },
    [isTaskController, loadFocusedTaskById, loadSprintFocusRow],
  );

  const ensurePlanningPokerSession = useCallback(
    async (sprintId: string, taskId: string) => {
      const { error: sessionError } = await supabase
        .from("planning_poker_sessions")
        .upsert(
          {
            sprint_id: sprintId,
            task_id: taskId,
          },
          { onConflict: "task_id", ignoreDuplicates: true },
        );

      if (sessionError) {
        throw sessionError;
      }
    },
    [],
  );

  const setSprintFocusTask = useCallback(
    async (taskId: string | null) => {
      if (!currentSprintId) return;

      const focusPayload = {
        sprint_id: currentSprintId,
        active_task_id: taskId,
        opened_by_member_id: taskId && currentMemberId ? currentMemberId : null,
        opened_at: taskId ? new Date().toISOString() : null,
      };

      const { error: upsertError } = await supabase
        .from("planning_poker_sprint_focus")
        .upsert(focusPayload, { onConflict: "sprint_id" });

      if (upsertError) {
        const { data: existingFocus, error: readError } = await supabase
          .from("planning_poker_sprint_focus")
          .select("sprint_id")
          .eq("sprint_id", currentSprintId)
          .maybeSingle();

        if (readError) {
          throw readError;
        }

        const mutation = existingFocus
          ? supabase
              .from("planning_poker_sprint_focus")
              .update(focusPayload)
              .eq("sprint_id", currentSprintId)
          : supabase.from("planning_poker_sprint_focus").insert(focusPayload);

        const { error: mutationError } = await mutation;
        if (mutationError) {
          throw mutationError;
        }
      }

      if (taskId) {
        await ensurePlanningPokerSession(currentSprintId, taskId);
      }

      const focusBroadcast: SprintFocusBroadcastPayload = {
        sprint_id: currentSprintId,
        task_id: taskId,
        opened_at: focusPayload.opened_at,
      };

      await Promise.all([
        syncFocusedTaskFromSprintFocus(currentSprintId),
        reloadVotes(currentSprintId),
        broadcastSprintFocusChange(focusBroadcast),
      ]);
    },
    [
      broadcastSprintFocusChange,
      currentMemberId,
      currentSprintId,
      ensurePlanningPokerSession,
      reloadVotes,
      syncFocusedTaskFromSprintFocus,
    ],
  );

  const loadSprintTasks = useCallback(
    async (sprintId: string) => {
      const verifyRequestId = trelloVerifyRequestIdRef.current + 1;
      trelloVerifyRequestIdRef.current = verifyRequestId;

      const [taskRows, sessionRows] = await Promise.all([
        getSupabaseRows<TaskRow>("tasks", {
          select: TASK_LIST_SELECT,
          eq: { sprint_id: sprintId },
        }),
        getSupabaseRows<PlanningPokerSessionRow>("planning_poker_sessions", {
          select:
            "id,sprint_id,task_id,is_revealed,revealed_at,revealed_by_member_id,is_confirmed,confirmed_story_points,confirmed_at,confirmed_by_member_id",
          eq: { sprint_id: sprintId },
        }).catch(() => [] as PlanningPokerSessionRow[]),
      ]);

      const confirmedTaskIds = new Set(
        sessionRows
          .filter((session) => session.is_confirmed)
          .map((session) => session.task_id),
      );
      const planningListTasks = taskRows.filter(isPlanningListTask);
      const planningTasks = planningListTasks.filter((task) =>
        isPlanningPokerTaskFromDb(task, confirmedTaskIds),
      );

      setPlanningListTaskCount(planningListTasks.length);
      setTasks(planningTasks);
      setTaskSessions(sessionRows);
      setSelectedTaskId((currentTaskId) => {
        if (currentTaskId && planningTasks.some((task) => task.id === currentTaskId)) {
          return currentTaskId;
        }
        return null;
      });

      void reloadVotes(sprintId).catch((voteError) => {
        console.warn("Unable to refresh planning poker votes:", voteError);
      });

      const unpointedPlanningTasks = planningListTasks.filter((task) =>
        isPlanningPokerTaskFromDb(task, confirmedTaskIds),
      );

      if (unpointedPlanningTasks.length === 0) {
        setTrelloVerifyLoading(false);
        return;
      }

      setTrelloVerifyLoading(true);

      void refinePlanningTasksWithTrello(planningListTasks, confirmedTaskIds)
        .then((refinedTasks) => {
          if (trelloVerifyRequestIdRef.current !== verifyRequestId) {
            return;
          }

          setTasks(refinedTasks);
          setSelectedTaskId((currentTaskId) => {
            if (currentTaskId && refinedTasks.some((task) => task.id === currentTaskId)) {
              return currentTaskId;
            }
            return null;
          });
        })
        .catch((verifyError) => {
          console.warn("Unable to verify planning poker story points from Trello:", verifyError);
        })
        .finally(() => {
          if (trelloVerifyRequestIdRef.current === verifyRequestId) {
            setTrelloVerifyLoading(false);
          }
        });
    },
    [reloadVotes],
  );

  const applySyncedTaskUpdate = useCallback((updatedTask: SyncedPlanningTaskRow) => {
    const taskRow = updatedTask as TaskRow;

    setTasks((currentTasks) =>
      currentTasks
        .map((task) => (task.id === taskRow.id ? taskRow : task))
        .filter((task) => isPlanningListTask(task) && isUnpointedTask(task)),
    );
    setFocusedTask((currentTask) =>
      currentTask?.id === taskRow.id ? taskRow : currentTask,
    );
    setVoteTaskRows((currentRows) =>
      currentRows.map((task) => (task.id === taskRow.id ? taskRow : task)),
    );
  }, []);

  const loadCurrentSprint = useCallback(async () => {
    const [currentByFlag] = await getSupabaseRows<SprintRow>("sprints", {
      select: "id,name,sprint_number,is_current,status",
      eq: { is_current: 1 },
      limit: 1,
    });

    if (currentByFlag) {
      setCurrentSprint(currentByFlag);
      return currentByFlag;
    }

    const recentSprints = await getSupabaseRows<SprintRow>("sprints", {
      select: "id,name,sprint_number,is_current,status",
      order: { column: "sprint_number", ascending: false },
      limit: 20,
    });

    const activeSprint =
      recentSprints.find(
        (sprint) => sprint.is_current === 1 || sprint.is_current === true,
      ) ?? null;

    setCurrentSprint(activeSprint);
    return activeSprint;
  }, []);

  const refreshMembers = useCallback(async () => {
    const memberRows = await getSupabaseRows<MemberRow>("members", {
      select: "id,full_name,first_name,last_name,role",
      order: { column: "full_name", ascending: true },
    });
    setMembers(memberRows.filter((member) => Boolean(member.id)));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setLoading(true);
      setError(null);

      try {
        const session = await getSupabaseSession();
        const [, memberRows] = await Promise.all([
          loadCurrentSprint(),
          getSupabaseRows<MemberRow>("members", {
            select: "id,full_name,first_name,last_name,role",
            order: { column: "full_name", ascending: true },
          }),
        ]);

        let loggedInMemberId: string | null = null;
        if (session?.user.email) {
          const [memberByEmail] = await getSupabaseRows<{ id: string }>("members", {
            select: "id",
            eq: { email: session.user.email },
            limit: 1,
          });
          loggedInMemberId = memberByEmail?.id ?? null;
        }

        if (!loggedInMemberId && session?.user.id) {
          const [memberByAuthUser] = await getSupabaseRows<{ id: string }>("members", {
            select: "id",
            eq: { auth_user_id: session.user.id },
            limit: 1,
          });
          loggedInMemberId = memberByAuthUser?.id ?? null;
        }

        if (!cancelled) {
          setMembers(memberRows.filter((member) => Boolean(member.id)));
          setCurrentMemberId(loggedInMemberId);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Unable to load planning poker data."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [loadCurrentSprint]);

  useEffect(() => {
    let cancelled = false;

    async function loadSprintData() {
      if (!currentSprintId) {
        setTasks([]);
        setPlanningListTaskCount(0);
        setVotes([]);
        setVoteTaskRows([]);
        setSprintFocus(null);
        setFocusedTask(null);
        setSelectedTaskId(null);
        return;
      }

      setTasksLoading(true);
      setError(null);

      try {
        await loadSprintTasks(currentSprintId);
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Unable to load sprint tasks."));
        }
      } finally {
        if (!cancelled) {
          setTasksLoading(false);
        }
      }
    }

    if (!currentSprintId) {
      setTasksLoading(false);
      return;
    }

    void loadSprintData();

    return () => {
      cancelled = true;
    };
  }, [loadSprintTasks, currentSprintId]);

  useEffect(() => {
    if (!currentSprintId) {
      setSprintFocus(null);
      setFocusedTask(null);
      return;
    }

    void syncFocusedTaskFromSprintFocus(currentSprintId);
  }, [currentSprintId, syncFocusedTaskFromSprintFocus]);

  useEffect(() => {
    if (!currentSprintId || syncVersion === 0) return;
    void loadSprintTasks(currentSprintId);
  }, [syncVersion, currentSprintId, loadSprintTasks]);

  useEffect(() => {
    if (!activeTaskId) {
      setActiveTaskDescription(null);
      return;
    }

    const requestId = activeTaskDescriptionRequestIdRef.current + 1;
    activeTaskDescriptionRequestIdRef.current = requestId;

    setActiveTaskDescription((current) =>
      current?.taskId === activeTaskId && !current.loading
        ? current
        : { taskId: activeTaskId, description: null, loading: true },
    );

    void supabase
      .from("tasks")
      .select("description")
      .eq("id", activeTaskId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (activeTaskDescriptionRequestIdRef.current !== requestId) {
          return;
        }

        if (error) {
          console.warn("Unable to load task description:", error);
          setActiveTaskDescription({
            taskId: activeTaskId,
            description: null,
            loading: false,
          });
          return;
        }

        setActiveTaskDescription({
          taskId: activeTaskId,
          description: (data as Pick<TaskRow, "description"> | null)?.description ?? null,
          loading: false,
        });
      });
  }, [activeTaskId]);

  useEffect(() => {
    if (!currentSprintId) return;

    const sprintFilter = `sprint_id=eq.${currentSprintId}`;
    const channel = supabase
      .channel(getPlanningPokerChannelName(currentSprintId), {
        config: { broadcast: { self: true } },
      })
      .on(
        "broadcast",
        { event: PLANNING_POKER_FOCUS_BROADCAST_EVENT },
        ({ payload }) => {
          const focusPayload = payload as SprintFocusBroadcastPayload | undefined;
          if (!focusPayload || focusPayload.sprint_id !== currentSprintId) {
            return;
          }

          applySprintFocusBroadcast(focusPayload);
          void loadFocusedTaskById(focusPayload.task_id, {
            silent: focusedTaskIdRef.current === focusPayload.task_id,
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "planning_poker_votes",
          filter: sprintFilter,
        },
        () => {
          void reloadVotes(currentSprintId);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "planning_poker_sessions",
          filter: sprintFilter,
        },
        () => {
          void reloadVotes(currentSprintId).then(() => {
            void syncFocusedTaskFromSprintFocus(currentSprintId);
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: sprintFilter,
        },
        () => {
          void loadSprintTasks(currentSprintId);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "planning_poker_sprint_focus",
          filter: sprintFilter,
        },
        () => {
          void syncFocusedTaskFromSprintFocus(currentSprintId);
        },
      )
      .subscribe();

    planningPokerChannelRef.current = channel;

    return () => {
      planningPokerChannelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [
    applySprintFocusBroadcast,
    loadFocusedTaskById,
    loadSprintTasks,
    reloadVotes,
    syncFocusedTaskFromSprintFocus,
    currentSprintId,
  ]);

  useEffect(() => {
    if (!currentSprintId || isTaskController) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void syncFocusedTaskFromSprintFocus(currentSprintId);
    }, PLANNING_POKER_FOCUS_POLL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentSprintId, isTaskController, syncFocusedTaskFromSprintFocus]);

  useEffect(() => {
    const channel = supabase
      .channel("planning-poker-shared")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "members" },
        () => {
          void refreshMembers();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sprints" },
        () => {
          void loadCurrentSprint();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadCurrentSprint, refreshMembers]);

  function handleSelectTask(taskId: string) {
    setSelectedTaskId(taskId);
    if (isTaskController) {
      void setSprintFocusTask(taskId).catch((focusError) => {
        setError(getErrorMessage(focusError, "Unable to open task for the team."));
      });
    }
  }

  function handleCloseTask() {
    setSelectedTaskId(null);
    activeTaskDescriptionRequestIdRef.current += 1;
    setActiveTaskDescription(null);
    if (isTaskController) {
      void setSprintFocusTask(null).catch((focusError) => {
        setError(getErrorMessage(focusError, "Unable to close the team task."));
      });
    }
  }

  function handlePreviousTask() {
    if (!canGoToPreviousTask) return;
    handleSelectTask(orderedTasks[activeTaskIndex - 1].id);
  }

  function handleNextTask() {
    if (!canGoToNextTask) return;
    handleSelectTask(orderedTasks[activeTaskIndex + 1].id);
  }

  async function handleVote(storyPoints: number) {
    if (!currentSprintId || !activeTaskId || !currentMemberId) {
      setVoteMessage("Sign in as a member to submit a vote.");
      return;
    }

    const selectedSession = taskSessionsByTaskId.get(activeTaskId);
    if (selectedSession?.is_revealed || selectedSession?.is_confirmed) {
      setVoteMessage("Voting is closed for this task. Wait for a revote if needed.");
      return;
    }

    setSavingVote(true);
    setVoteMessage(null);
    setError(null);

    try {
      const { error: upsertError } = await supabase
        .from("planning_poker_votes")
        .upsert(
          {
            sprint_id: currentSprintId,
            task_id: activeTaskId,
            member_id: currentMemberId,
            story_points: storyPoints,
          },
          { onConflict: "task_id,member_id" },
        );

      if (upsertError) {
        throw upsertError;
      }

      await reloadVotes(currentSprintId);
      setVoteMessage(`Your vote of ${storyPoints} SP was saved.`);
    } catch (voteError) {
      setError(getErrorMessage(voteError, "Unable to save vote."));
    } finally {
      setSavingVote(false);
    }
  }

  async function handleRevealVotes() {
    if (!currentSprintId || !activeTaskId || !currentMemberId) return;

    setPendingSessionAction("reveal");
    setVoteMessage(null);
    setError(null);

    try {
      const { error: upsertError } = await supabase
        .from("planning_poker_sessions")
        .upsert(
          {
            sprint_id: currentSprintId,
            task_id: activeTaskId,
            is_revealed: true,
            revealed_at: new Date().toISOString(),
            revealed_by_member_id: currentMemberId,
          },
          { onConflict: "task_id" },
        );

      if (upsertError) throw upsertError;

      await reloadVotes(currentSprintId);
      setVoteMessage("Votes revealed to the team.");
    } catch (revealError) {
      setError(getErrorMessage(revealError, "Unable to reveal votes."));
    } finally {
      setPendingSessionAction(null);
    }
  }

  async function handleConfirmVote() {
    if (!currentSprintId || !activeTaskId || !currentMemberId || !activeTask) return;

    if (!activeTaskSession?.is_revealed) {
      setVoteMessage("Reveal votes before confirming story points.");
      return;
    }

    const tally = getRequiredVoteTally(
      developerMembers.map((member) => member.id),
      (memberId) => getMemberVote(activeTaskId, memberId),
    );

    if (!tally.allRequiredVoted || tally.hasTie || tally.winningStoryPoints.length !== 1) {
      setVoteMessage("Confirm is only available when all required votes agree.");
      return;
    }

    const confirmedStoryPoints = tally.winningStoryPoints[0];

    setPendingSessionAction("confirm");
    setVoteMessage("Updating story points on Trello...");
    setError(null);

    try {
      const { updatedTask } = await syncTaskStoryPointsFromTrello({
        taskId: activeTaskId,
        sprintId: currentSprintId,
        storyPoints: confirmedStoryPoints,
      });

      const { error: sessionError } = await supabase
        .from("planning_poker_sessions")
        .upsert(
          {
            sprint_id: currentSprintId,
            task_id: activeTaskId,
            is_revealed: true,
            is_confirmed: true,
            confirmed_story_points: confirmedStoryPoints,
            confirmed_at: new Date().toISOString(),
            confirmed_by_member_id: currentMemberId,
          },
          { onConflict: "task_id" },
        );

      if (sessionError) throw sessionError;

      applySyncedTaskUpdate(updatedTask);
      await reloadVotes(currentSprintId);
      await setSprintFocusTask(null);
      setSelectedTaskId(null);
      await loadSprintTasks(currentSprintId);
      setVoteMessage(
        `Confirmed ${confirmedStoryPoints} SP. Trello card updated successfully.`,
      );
    } catch (confirmError) {
      setError(
        getErrorMessage(confirmError, "Unable to confirm story points on Trello."),
      );
    } finally {
      setPendingSessionAction(null);
    }
  }

  async function handleRevote() {
    if (!currentSprintId || !activeTaskId) return;

    setPendingSessionAction("revote");
    setVoteMessage(null);
    setError(null);

    try {
      const { error: deleteVotesError } = await supabase
        .from("planning_poker_votes")
        .delete()
        .eq("task_id", activeTaskId);

      if (deleteVotesError) throw deleteVotesError;

      const { error: sessionError } = await supabase
        .from("planning_poker_sessions")
        .delete()
        .eq("task_id", activeTaskId);

      if (sessionError) throw sessionError;

      await reloadVotes(currentSprintId);
      setVoteMessage("All votes cleared. Members can vote again.");
    } catch (revoteError) {
      setError(getErrorMessage(revoteError, "Unable to revote."));
    } finally {
      setPendingSessionAction(null);
    }
  }

  function getMemberVote(taskId: string, memberId: string): number | null {
    return votesByTaskAndMember.get(`${taskId}:${memberId}`)?.story_points ?? null;
  }

  function getDeveloperVoteProgress(taskId: string): {
    voted: number;
    total: number;
  } {
    const voted = developerMembers.filter(
      (member) => getMemberVote(taskId, member.id) !== null,
    ).length;

    return { voted, total: developerMembers.length };
  }

  const currentMemberVote =
    activeTaskId && currentMemberId
      ? getMemberVote(activeTaskId, currentMemberId)
      : null;

  const activeDeveloperVoteProgress = activeTaskId
    ? getDeveloperVoteProgress(activeTaskId)
    : { voted: 0, total: 0 };

  const activeTaskSession = activeTaskId
    ? taskSessionsByTaskId.get(activeTaskId) ?? null
    : null;

  const activeTaskTally = useMemo(() => {
    if (!activeTaskId) {
      return {
        allRequiredVoted: false,
        hasTie: false,
        winningStoryPoints: [],
        topVoteCount: 0,
      };
    }

    return getRequiredVoteTally(
      developerMembers.map((member) => member.id),
      (memberId) => getMemberVote(activeTaskId, memberId),
    );
  }, [activeTaskId, developerMembers, votesByTaskAndMember]);

  const votingClosed =
    activeTaskSession?.is_revealed === true ||
    activeTaskSession?.is_confirmed === true;

  const sessionActionLoading = pendingSessionAction !== null;

  const canRevealVotes =
    isCurrentMemberPokerAdmin &&
    activeTaskTally.allRequiredVoted &&
    !activeTaskSession?.is_revealed &&
    !activeTaskSession?.is_confirmed;

  const canConfirmVote =
    isCurrentMemberPokerAdmin &&
    activeTaskSession?.is_revealed === true &&
    activeTaskTally.allRequiredVoted &&
    activeTaskTally.winningStoryPoints.length === 1 &&
    !activeTaskTally.hasTie &&
    !activeTaskSession?.is_confirmed;

  const activeTaskVoteCount = useMemo(() => {
    if (!activeTaskId) return 0;
    return votes.filter((vote) => vote.task_id === activeTaskId).length;
  }, [activeTaskId, votes]);

  const canRevote =
    isCurrentMemberPokerAdmin &&
    Boolean(activeTaskId) &&
    !activeTaskSession?.is_confirmed &&
    (activeTaskVoteCount > 0 || activeTaskSession?.is_revealed === true);

  const showRevealedConsensus =
    activeTaskSession?.is_revealed === true &&
    activeTaskTally.winningStoryPoints.length > 0;

  const orderedTasks = useMemo(() => {
    return [...tasks].sort((left, right) => {
      const leftKey = left.trello_short_id ?? left.title;
      const rightKey = right.trello_short_id ?? right.title;

      if (typeof leftKey === "number" && typeof rightKey === "number") {
        return leftKey - rightKey;
      }

      return left.title.localeCompare(right.title);
    });
  }, [tasks]);

  const activeTaskIndex = useMemo(() => {
    if (!activeTaskId) return -1;
    return orderedTasks.findIndex((task) => task.id === activeTaskId);
  }, [activeTaskId, orderedTasks]);

  const canGoToPreviousTask =
    isTaskController && activeTaskIndex > 0;

  const canGoToNextTask =
    isTaskController &&
    activeTaskIndex >= 0 &&
    activeTaskIndex < orderedTasks.length - 1;

  const showNoCurrentSprint = !loading && !currentSprint;

  const showPlanningLayout =
    !loading &&
    Boolean(currentSprint) &&
    (isTaskController
      ? tasks.length > 0 || tasksLoading
      : Boolean(activeTask) ||
        focusedTaskLoading ||
        Boolean(sprintFocus?.active_task_id));

  const showWaitingForFacilitator =
    !loading &&
    !tasksLoading &&
    !isTaskController &&
    !activeTask &&
    !focusedTaskLoading &&
    !sprintFocus?.active_task_id;

  const showNoPlanningListTasks =
    !loading &&
    !tasksLoading &&
    !trelloVerifyLoading &&
    Boolean(currentSprint) &&
    isTaskController &&
    planningListTaskCount === 0;

  const showAllPlanningTasksPointed =
    !loading &&
    !tasksLoading &&
    !trelloVerifyLoading &&
    isTaskController &&
    planningListTaskCount > 0 &&
    tasks.length === 0;

  const showTasksLoadingState =
    !loading &&
    Boolean(currentSprint) &&
    isTaskController &&
    tasksLoading &&
    tasks.length === 0;

  const expandedTaskDescription = useMemo(() => {
    if (!activeTaskId) {
      return "";
    }

    if (
      activeTaskDescription?.taskId === activeTaskId &&
      !activeTaskDescription.loading
    ) {
      return activeTaskDescription.description ?? "";
    }

    if (activeTask?.id === activeTaskId && activeTask.description) {
      return activeTask.description;
    }

    return "";
  }, [activeTask, activeTaskDescription, activeTaskId]);

  const isExpandedDescriptionLoading = Boolean(
    activeTaskId &&
      activeTaskDescription?.taskId === activeTaskId &&
      activeTaskDescription.loading &&
      !expandedTaskDescription,
  );

  return (
    <div className="planning-poker-page">
      <Card className="planning-poker-card">
        <div className="planning-poker-header">
          <div>
            <SectionTitle>Planning Poker</SectionTitle>
            <p className="planning-poker-subtitle">
              Estimate unpointed tasks from the Trello For Planning list. Confirm writes story
              points to the Trello Story Points custom field. Developer votes are required;
              other members may vote optionally.
            </p>
          </div>
          <div className="planning-poker-header-actions">
            {currentSprint ? (
              <span className="planning-poker-sprint-badge">
                {getSprintLabel(currentSprint)}
              </span>
            ) : null}
            <SprintSyncDataAction
              currentSprint={currentSprintSyncTarget}
              selectedSprintId={currentSprintId}
              memberRole={currentMemberRole}
              onSynced={() => loadSprintTasks(currentSprintId)}
            />
            <span className="planning-poker-count-badge">
              {isTaskController
                ? trelloVerifyLoading
                  ? `Checking Trello · ${tasks.length} task${tasks.length === 1 ? "" : "s"}`
                  : `${tasks.length} Planning task${tasks.length === 1 ? "" : "s"}`
                : activeTask
                  ? "Facilitator task"
                  : "Waiting for task"}
            </span>
          </div>
        </div>

        {error ? (
          <p className="planning-poker-error planning-poker-error--multiline">{error}</p>
        ) : null}
        {voteMessage ? <p className="planning-poker-message">{voteMessage}</p> : null}

        {loading ? (
          <div className="planning-poker-loading">
            <span className="planning-poker-spinner" />
            Loading planning poker...
          </div>
        ) : null}

        {showNoCurrentSprint ? (
          <div className="planning-poker-empty">
            No current sprint is active. Mark a sprint as current to use Planning Poker.
          </div>
        ) : null}

        {showTasksLoadingState ? (
          <div className="planning-poker-loading planning-poker-loading--inline">
            <span className="planning-poker-spinner" />
            Loading For Planning tasks...
          </div>
        ) : null}

        {showNoPlanningListTasks ? (
          <div className="planning-poker-empty">
            No tasks found on the For Planning list for the selected sprint. Sync from Trello to
            import For Planning cards.
          </div>
        ) : null}

        {showAllPlanningTasksPointed ? (
          <div className="planning-poker-empty">
            All For Planning list tasks already have story points assigned. Sync from Trello if
            cards are missing.
          </div>
        ) : null}

        {showWaitingForFacilitator ? (
          <div className="planning-poker-empty planning-poker-empty--facilitator">
            Waiting for a facilitator to open a task for estimation.
          </div>
        ) : null}

        {showPlanningLayout ? (
          <div
            className={`planning-poker-layout${
              activeTask ? " planning-poker-layout--active-task" : ""
            }`}
          >
            <section className="planning-poker-board">
              <div
                className={`planning-poker-board-column${
                  activeTask ? " planning-poker-board-column--expanded" : ""
                }`}
              >
                <div className="planning-poker-board-column-header">
                  <span>{isTaskController ? "For Planning" : "Current Task"}</span>
                  <div className="planning-poker-board-column-header-actions">
                    {isTaskController && !activeTask ? <span>{tasks.length}</span> : null}
                    {isTaskController && activeTask ? (
                      <div className="planning-poker-task-nav">
                        <button
                          type="button"
                          className="planning-poker-nav-button"
                          disabled={!canGoToPreviousTask}
                          onClick={handlePreviousTask}
                          aria-label="Open previous task"
                        >
                          Previous
                        </button>
                        <span className="planning-poker-task-nav-position">
                          {activeTaskIndex + 1} / {orderedTasks.length}
                        </span>
                        <button
                          type="button"
                          className="planning-poker-nav-button"
                          disabled={!canGoToNextTask}
                          onClick={handleNextTask}
                          aria-label="Open next task"
                        >
                          Next
                        </button>
                        <button
                          type="button"
                          className="planning-poker-close-button"
                          onClick={handleCloseTask}
                          aria-label="Close task details"
                        >
                          Close
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                {activeTask ? (
                  (() => {
                    const { severityLabel, severityColor, priorityColor } =
                      getTaskDisplayColors(activeTask);
                    const progress = getDeveloperVoteProgress(activeTask.id);

                    return (
                      <article
                        className="planning-poker-task-expanded sprint-kanban-card"
                        style={{
                          border: `1px solid ${severityColor}38`,
                          borderLeft: `4px solid ${priorityColor}`,
                          background: `linear-gradient(135deg, ${priorityColor}12, ${severityColor}0f 42%, rgba(6,13,31,0.58))`,
                          boxShadow: `0 12px 32px rgba(0,0,0,0.22), 0 0 24px ${severityColor}16`,
                        }}
                      >
                        <div className="planning-poker-task-card-top">
                          <span className="planning-poker-task-id">
                            {activeTask.trello_short_id ?? activeTask.id.slice(0, 8)}
                          </span>
                        </div>

                        <h3 className="planning-poker-task-expanded-title">
                          {activeTask.trello_card_url ? (
                            <a
                              href={activeTask.trello_card_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {activeTask.title}
                            </a>
                          ) : (
                            activeTask.title
                          )}
                        </h3>

                        <div className="planning-poker-task-meta planning-poker-task-meta--expanded">
                          <span
                            className="planning-poker-pill"
                            style={{
                              color: severityColor,
                              borderColor: `${severityColor}66`,
                              background: `${severityColor}18`,
                            }}
                          >
                            {severityLabel}
                          </span>
                          <span
                            className="planning-poker-pill"
                            style={{
                              color: priorityColor,
                              borderColor: `${priorityColor}66`,
                              background: `${priorityColor}18`,
                            }}
                          >
                            {activeTask.priority}
                          </span>
                          <span className="planning-poker-pill planning-poker-pill--neutral">
                            {formatTaskType(activeTask.task_type)}
                          </span>
                          <span className="planning-poker-pill planning-poker-pill--neutral">
                            {TRELLO_FOR_PLANNING_LIST_NAME}
                          </span>
                        </div>

                        <PlanningPokerVoteProgress
                          voted={progress.voted}
                          total={progress.total}
                        />

                        <div className="planning-poker-task-expanded-description">
                          <h4>Description</h4>
                          {isExpandedDescriptionLoading ? (
                            <div className="planning-poker-loading planning-poker-loading--inline">
                              <span className="planning-poker-spinner" />
                              Loading description...
                            </div>
                          ) : (
                            <TrelloDescription content={expandedTaskDescription} />
                          )}
                        </div>
                      </article>
                    );
                  })()
                ) : focusedTaskLoading ? (
                  <div className="planning-poker-loading planning-poker-loading--inline">
                    <span className="planning-poker-spinner" />
                    Loading facilitator task...
                  </div>
                ) : isTaskController ? (
                  <div className="planning-poker-board-cards">
                    {orderedTasks.map((task, index) => {
                      const { severityLabel, severityColor, priorityColor } =
                        getTaskDisplayColors(task);
                      const progress = getDeveloperVoteProgress(task.id);

                      return (
                        <article
                          key={task.id}
                          className="sprint-kanban-card planning-poker-task-card"
                          style={{
                            animationDelay: `${index * 0.04}s`,
                            border: `1px solid ${severityColor}38`,
                            borderLeft: `4px solid ${priorityColor}`,
                            background: `linear-gradient(135deg, ${priorityColor}12, ${severityColor}0f 42%, rgba(6,13,31,0.58))`,
                            boxShadow: `0 8px 24px rgba(0,0,0,0.16), 0 0 18px ${severityColor}16`,
                          }}
                          onClick={() => handleSelectTask(task.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleSelectTask(task.id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="planning-poker-task-card-top">
                            <span className="planning-poker-task-id">
                              {task.trello_short_id ?? task.id.slice(0, 8)}
                            </span>
                          </div>

                          <h3 className="planning-poker-task-title">
                            {task.title}
                          </h3>

                          <div className="planning-poker-task-meta">
                            <span
                              className="planning-poker-pill"
                              style={{
                                color: severityColor,
                                borderColor: `${severityColor}66`,
                                background: `${severityColor}18`,
                              }}
                            >
                              {severityLabel}
                            </span>
                            <span
                              className="planning-poker-pill"
                              style={{
                                color: priorityColor,
                                borderColor: `${priorityColor}66`,
                                background: `${priorityColor}18`,
                              }}
                            >
                              {task.priority}
                            </span>
                            <span className="planning-poker-pill planning-poker-pill--neutral">
                              {formatTaskType(task.task_type)}
                            </span>
                          </div>

                          <PlanningPokerVoteProgress
                            voted={progress.voted}
                            total={progress.total}
                            compact
                          />
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </section>

            <aside className="planning-poker-vote-panel">
              {activeTask ? (
                <>
                  <div className="planning-poker-vote-panel-header">
                    <h3>Vote for Task</h3>
                    <p>{activeTask.title}</p>
                    <PlanningPokerVoteProgress
                      voted={activeDeveloperVoteProgress.voted}
                      total={activeDeveloperVoteProgress.total}
                      compact
                    />
                  </div>

                  <div className="planning-poker-point-grid">
                    {POKER_POINT_OPTIONS.map((points) => {
                      const isActive = currentMemberVote === points;
                      return (
                        <button
                          key={points}
                          type="button"
                          className={`planning-poker-point-button${
                            isActive ? " planning-poker-point-button--active" : ""
                          }`}
                          disabled={
                            savingVote || !currentMemberId || votingClosed || sessionActionLoading
                          }
                          onClick={() => void handleVote(points)}
                        >
                          {points}
                        </button>
                      );
                    })}
                  </div>

                  {isCurrentMemberPokerAdmin ? (
                    <div className="planning-poker-admin-actions">
                      {canRevealVotes ? (
                        <button
                          type="button"
                          className="planning-poker-admin-button planning-poker-admin-button--reveal"
                          disabled={sessionActionLoading}
                          onClick={() => void handleRevealVotes()}
                        >
                          {pendingSessionAction === "reveal" ? (
                            <>
                              <span
                                className="planning-poker-spinner planning-poker-spinner--button"
                                aria-hidden="true"
                              />
                              Revealing...
                            </>
                          ) : (
                            "Reveal"
                          )}
                        </button>
                      ) : null}
                      {canConfirmVote ? (
                        <button
                          type="button"
                          className="planning-poker-admin-button planning-poker-admin-button--confirm"
                          disabled={sessionActionLoading}
                          onClick={() => void handleConfirmVote()}
                        >
                          {pendingSessionAction === "confirm" ? (
                            <>
                              <span
                                className="planning-poker-spinner planning-poker-spinner--button"
                                aria-hidden="true"
                              />
                              Confirming...
                            </>
                          ) : (
                            "Confirm"
                          )}
                        </button>
                      ) : null}
                      {canRevote ? (
                        <button
                          type="button"
                          className="planning-poker-admin-button planning-poker-admin-button--revote"
                          disabled={sessionActionLoading}
                          onClick={() => void handleRevote()}
                        >
                          {pendingSessionAction === "revote" ? (
                            <>
                              <span
                                className="planning-poker-spinner planning-poker-spinner--button"
                                aria-hidden="true"
                              />
                              Clearing...
                            </>
                          ) : (
                            "Revote"
                          )}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {showRevealedConsensus ? (
                    <div className="planning-poker-reveal-banner">
                      <span className="planning-poker-reveal-banner__label">Revealed consensus</span>
                      <span className="planning-poker-reveal-banner__value">
                        {formatWinningStoryPoints(activeTaskTally.winningStoryPoints)}
                        {activeTaskTally.hasTie ? " (tied)" : ""}
                      </span>
                    </div>
                  ) : null}

                  {activeTaskSession?.is_confirmed ? (
                    <div className="planning-poker-confirmed-banner">
                      Confirmed at{" "}
                      {activeTaskSession.confirmed_story_points ?? "—"} SP
                    </div>
                  ) : null}

                  {votingClosed && !activeTaskSession?.is_confirmed ? (
                    <p className="planning-poker-voting-closed">
                      Voting is closed for this task.
                    </p>
                  ) : null}

                  {visibleDeveloperMembers.length > 0 ? (
                    <div className="planning-poker-voter-section">
                      <h4>Required Developer Votes</h4>
                      <div className="planning-poker-voter-list">
                        {visibleDeveloperMembers.map((member) => {
                        const voteValue = getMemberVote(activeTask.id, member.id);
                        const memberName = getMemberName(member);
                        const memberColor = getAssigneeColor(member.id);
                        const displayedVote = getDisplayedVoteValue(
                          voteValue,
                          member.id,
                          currentMemberId,
                          hideOthersVotes,
                          "Pending",
                        );
                        const isHiddenVote =
                          hideOthersVotes && member.id !== currentMemberId;

                        return (
                          <div key={member.id} className="planning-poker-voter-row">
                            <span
                              className="planning-poker-voter-avatar"
                              style={{ background: memberColor }}
                            >
                              {getMemberInitials(memberName)}
                            </span>
                            <div className="planning-poker-voter-info">
                              <span>{memberName}</span>
                              <span>{formatRoleLabel(member.role)}</span>
                            </div>
                            <span
                              className={`planning-poker-voter-value${
                                voteValue === null && !isHiddenVote
                                  ? " planning-poker-voter-value--pending"
                                  : isHiddenVote
                                    ? " planning-poker-voter-value--hidden"
                                    : ""
                              }`}
                            >
                              {displayedVote}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  ) : null}

                  {visibleOptionalMembers.length > 0 ? (
                    <div className="planning-poker-voter-section">
                      <h4>Optional Votes</h4>
                      <div className="planning-poker-voter-list">
                        {visibleOptionalMembers.map((member) => {
                          const voteValue = getMemberVote(activeTask.id, member.id);
                          const memberName = getMemberName(member);
                          const memberColor = getAssigneeColor(member.id);
                          const displayedVote = getDisplayedVoteValue(
                            voteValue,
                            member.id,
                            currentMemberId,
                            hideOthersVotes,
                            "Optional",
                          );
                          const isHiddenVote =
                            hideOthersVotes && member.id !== currentMemberId;

                          return (
                            <div key={member.id} className="planning-poker-voter-row">
                              <span
                                className="planning-poker-voter-avatar"
                                style={{ background: memberColor }}
                              >
                                {getMemberInitials(memberName)}
                              </span>
                              <div className="planning-poker-voter-info">
                                <span>{memberName}</span>
                                <span>{formatRoleLabel(member.role)}</span>
                              </div>
                              <span
                                className={`planning-poker-voter-value${
                                  voteValue === null && !isHiddenVote
                                    ? " planning-poker-voter-value--optional"
                                    : isHiddenVote
                                      ? " planning-poker-voter-value--hidden"
                                      : ""
                                }`}
                              >
                                {displayedVote}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="planning-poker-empty-panel">
                  Select a task to start voting.
                </div>
              )}
            </aside>
          </div>
        ) : null}
      </Card>

      <Card className="planning-poker-card planning-poker-votes-card">
        <div className="planning-poker-header">
          <div>
            <SectionTitle>Sprint Task Votes</SectionTitle>
            <p className="planning-poker-subtitle">
              {isTaskController
                ? "Relational view of sprint, task, member, and voted story points."
                : "Your votes for the facilitator task."}
            </p>
          </div>
        </div>

        {voteTableRows.length === 0 ? (
          <div className="planning-poker-empty">
            No votes recorded for the selected sprint yet.
          </div>
        ) : (
          <>
            <div className="planning-poker-table-scroll planning-poker-table-scroll--desktop">
              <table className="planning-poker-table">
                <thead>
                  <tr>
                    <th>Sprint</th>
                    <th>Task</th>
                    <th>Task Type</th>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Vote Required</th>
                    <th>Voted Story Points</th>
                    <th>Consensus SP</th>
                  </tr>
                </thead>
                <tbody>
                  {voteTableRows.map((row) => (
                    <tr key={row.id}>
                      <td data-label="Sprint">{row.sprintLabel}</td>
                      <td data-label="Task">{row.taskTitle}</td>
                      <td data-label="Task Type">{row.taskType}</td>
                      <td data-label="Member">{row.memberName}</td>
                      <td data-label="Role">{row.memberRole}</td>
                      <td data-label="Vote Required">
                        {row.isRequiredVoter ? "Required" : "Optional"}
                      </td>
                      <td data-label="Voted SP">{row.storyPoints}</td>
                      <td data-label="Consensus SP">{row.consensusStoryPoints ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="planning-poker-table-scroll--mobile">
              {voteTableRows.map((row) => (
                <article key={row.id} className="planning-poker-vote-card">
                  <h4 className="planning-poker-vote-card__title">{row.taskTitle}</h4>
                  <div className="planning-poker-vote-card__grid">
                    <div className="planning-poker-vote-card__item">
                      <span className="planning-poker-vote-card__label">Sprint</span>
                      <span className="planning-poker-vote-card__value">{row.sprintLabel}</span>
                    </div>
                    <div className="planning-poker-vote-card__item">
                      <span className="planning-poker-vote-card__label">Member</span>
                      <span className="planning-poker-vote-card__value">{row.memberName}</span>
                    </div>
                    <div className="planning-poker-vote-card__item">
                      <span className="planning-poker-vote-card__label">Role</span>
                      <span className="planning-poker-vote-card__value">{row.memberRole}</span>
                    </div>
                    <div className="planning-poker-vote-card__item">
                      <span className="planning-poker-vote-card__label">Task Type</span>
                      <span className="planning-poker-vote-card__value">{row.taskType}</span>
                    </div>
                    <div className="planning-poker-vote-card__item">
                      <span className="planning-poker-vote-card__label">Vote Required</span>
                      <span className="planning-poker-vote-card__value">
                        {row.isRequiredVoter ? "Required" : "Optional"}
                      </span>
                    </div>
                    <div className="planning-poker-vote-card__item">
                      <span className="planning-poker-vote-card__label">Voted SP</span>
                      <span className="planning-poker-vote-card__value">{row.storyPoints}</span>
                    </div>
                    <div className="planning-poker-vote-card__item planning-poker-vote-card__item--full">
                      <span className="planning-poker-vote-card__label">Consensus SP</span>
                      <span className="planning-poker-vote-card__value">
                        {row.consensusStoryPoints ?? "—"}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
