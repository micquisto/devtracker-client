import "@/assets/styles/SprintKanbanBoard.css";
import "@/assets/styles/PlanningPoker.page.css";
import TrelloDescription from "@/components/scrum/TrelloDescription";
import SprintSyncDataAction from "@/components/scrum/sprint/SprintSyncDataAction";
import { Card } from "@/components/shared/Containers";
import { StyledSelect } from "@/components/shared/Elements";
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
import {
  formatWinningStoryPoints,
  getDisplayedVoteValue,
  getRequiredVoteTally,
  isDeveloperRole,
  isPokerAdmin,
  isRestrictedNameViewer,
  isRestrictedVoteViewer,
  shouldHideMemberRow,
  shouldMaskVoteInTable,
  type PlanningPokerSessionRow,
} from "@/lib/planningPoker/planningPoker.utils";
import { useCallback, useEffect, useMemo, useState } from "react";

const POKER_POINT_OPTIONS = [0, 1, 2, 3, 5, 8, 13, 21] as const;
const PLANNING_TRELLO_LIST_NAME = "Planning";

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

function isUnestimatedTask(task: TaskRow): boolean {
  return !task.story_points || task.story_points === 0;
}

function isPlanningListTask(task: Pick<TaskRow, "trello_list_name">): boolean {
  return task.trello_list_name?.trim().toLowerCase() === PLANNING_TRELLO_LIST_NAME.toLowerCase();
}

function isPlanningPokerTask(task: TaskRow): boolean {
  return isPlanningListTask(task) && isUnestimatedTask(task);
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
  const [sprints, setSprints] = useState<SprintRow[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState("");
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [taskSessions, setTaskSessions] = useState<PlanningPokerSessionRow[]>([]);
  const [voteTaskRows, setVoteTaskRows] = useState<TaskRow[]>([]);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingVote, setSavingVote] = useState(false);
  const [sessionActionLoading, setSessionActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voteMessage, setVoteMessage] = useState<string | null>(null);
  const { syncVersion } = useSprintSync();

  const selectedSprint = useMemo(
    () => sprints.find((sprint) => sprint.id === selectedSprintId) ?? null,
    [sprints, selectedSprintId],
  );

  const currentSprint = useMemo(
    () =>
      sprints.find(
        (sprint) => sprint.is_current === 1 || sprint.is_current === true,
      ) ?? null,
    [sprints],
  );

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

  const taskSessionsByTaskId = useMemo(() => {
    const map = new Map<string, PlanningPokerSessionRow>();
    for (const session of taskSessions) {
      map.set(session.task_id, session);
    }
    return map;
  }, [taskSessions]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );

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
    const sprintLabel = selectedSprint ? getSprintLabel(selectedSprint) : "-";
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
    members,
    selectedSprint,
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
      .select(
        "id,sprint_id,title,description,task_type,priority,severity,story_points,sp_type,trello_list_name,trello_short_id,trello_card_url",
      )
      .in("id", votedTaskIds);

    if (votedTasksError) {
      throw votedTasksError;
    }

    setVoteTaskRows(
      ((votedTasks ?? []) as TaskRow[]).filter((task) => isPlanningListTask(task)),
    );
  }, []);

  const loadSprintTasks = useCallback(
    async (sprintId: string) => {
      const taskRows = await getSupabaseRows<TaskRow>("tasks", {
        select:
          "id,sprint_id,title,description,task_type,priority,severity,story_points,sp_type,trello_list_name,trello_short_id,trello_card_url",
        eq: { sprint_id: sprintId },
      });

      const planningTasks = taskRows.filter(isPlanningPokerTask);
      setTasks(planningTasks);
      setSelectedTaskId((currentTaskId) => {
        if (currentTaskId && planningTasks.some((task) => task.id === currentTaskId)) {
          return currentTaskId;
        }
        return null;
      });
      await reloadVotes(sprintId);
    },
    [reloadVotes],
  );

  const refreshMembers = useCallback(async () => {
    const memberRows = await getSupabaseRows<MemberRow>("members", {
      select: "id,full_name,first_name,last_name,role",
      order: { column: "full_name", ascending: true },
    });
    setMembers(memberRows.filter((member) => Boolean(member.id)));
  }, []);

  const refreshSprints = useCallback(async () => {
    const sprintRows = await getSupabaseRows<SprintRow>("sprints", {
      select: "id,name,sprint_number,is_current,status",
      order: { column: "sprint_number", ascending: false },
    });
    setSprints(sprintRows);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setLoading(true);
      setError(null);

      try {
        const session = await getSupabaseSession();
        const [sprintRows, memberRows] = await Promise.all([
          getSupabaseRows<SprintRow>("sprints", {
            select: "id,name,sprint_number,is_current,status",
            order: { column: "sprint_number", ascending: false },
          }),
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
          const defaultSprint =
            sprintRows.find((sprint) => sprint.is_current === 1 || sprint.is_current === true) ??
            sprintRows[0];

          setSprints(sprintRows);
          setMembers(memberRows.filter((member) => Boolean(member.id)));
          setCurrentMemberId(loggedInMemberId);
          setSelectedSprintId((currentValue) => currentValue || defaultSprint?.id || "");
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
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSprintData() {
      if (!selectedSprintId) {
        setTasks([]);
        setVotes([]);
        setVoteTaskRows([]);
        setSelectedTaskId(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        await loadSprintTasks(selectedSprintId);
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Unable to load sprint tasks."));
          setTasks([]);
          setVotes([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSprintData();

    return () => {
      cancelled = true;
    };
  }, [loadSprintTasks, selectedSprintId]);

  useEffect(() => {
    if (!selectedSprintId || syncVersion === 0) return;
    void loadSprintTasks(selectedSprintId);
  }, [syncVersion, selectedSprintId, loadSprintTasks]);

  useEffect(() => {
    if (!selectedSprintId) return;

    const sprintFilter = `sprint_id=eq.${selectedSprintId}`;
    const channel = supabase
      .channel(`planning-poker-${selectedSprintId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "planning_poker_votes",
          filter: sprintFilter,
        },
        () => {
          void reloadVotes(selectedSprintId);
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
          void reloadVotes(selectedSprintId);
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
          void loadSprintTasks(selectedSprintId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadSprintTasks, reloadVotes, selectedSprintId]);

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
          void refreshSprints();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshMembers, refreshSprints]);

  async function handleVote(storyPoints: number) {
    if (!selectedSprintId || !selectedTaskId || !currentMemberId) {
      setVoteMessage("Sign in as a member to submit a vote.");
      return;
    }

    const selectedSession = taskSessionsByTaskId.get(selectedTaskId);
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
            sprint_id: selectedSprintId,
            task_id: selectedTaskId,
            member_id: currentMemberId,
            story_points: storyPoints,
          },
          { onConflict: "task_id,member_id" },
        );

      if (upsertError) {
        throw upsertError;
      }

      await reloadVotes(selectedSprintId);
      setVoteMessage(`Your vote of ${storyPoints} SP was saved.`);
    } catch (voteError) {
      setError(getErrorMessage(voteError, "Unable to save vote."));
    } finally {
      setSavingVote(false);
    }
  }

  async function handleRevealVotes() {
    if (!selectedSprintId || !selectedTaskId || !currentMemberId) return;

    setSessionActionLoading(true);
    setVoteMessage(null);
    setError(null);

    try {
      const { error: upsertError } = await supabase
        .from("planning_poker_sessions")
        .upsert(
          {
            sprint_id: selectedSprintId,
            task_id: selectedTaskId,
            is_revealed: true,
            revealed_at: new Date().toISOString(),
            revealed_by_member_id: currentMemberId,
          },
          { onConflict: "task_id" },
        );

      if (upsertError) throw upsertError;

      await reloadVotes(selectedSprintId);
      setVoteMessage("Votes revealed to the team.");
    } catch (revealError) {
      setError(getErrorMessage(revealError, "Unable to reveal votes."));
    } finally {
      setSessionActionLoading(false);
    }
  }

  async function handleConfirmVote() {
    if (!selectedSprintId || !selectedTaskId || !currentMemberId || !selectedTask) return;

    const tally = getRequiredVoteTally(
      developerMembers.map((member) => member.id),
      (memberId) => getMemberVote(selectedTaskId, memberId),
    );

    if (!tally.allRequiredVoted || tally.hasTie || tally.winningStoryPoints.length !== 1) {
      setVoteMessage("Confirm is only available when all required votes agree.");
      return;
    }

    const confirmedStoryPoints = tally.winningStoryPoints[0];

    setSessionActionLoading(true);
    setVoteMessage(null);
    setError(null);

    try {
      const { error: taskError } = await supabase
        .from("tasks")
        .update({ story_points: confirmedStoryPoints })
        .eq("id", selectedTaskId);

      if (taskError) throw taskError;

      const { error: sessionError } = await supabase
        .from("planning_poker_sessions")
        .upsert(
          {
            sprint_id: selectedSprintId,
            task_id: selectedTaskId,
            is_revealed: true,
            is_confirmed: true,
            confirmed_story_points: confirmedStoryPoints,
            confirmed_at: new Date().toISOString(),
            confirmed_by_member_id: currentMemberId,
          },
          { onConflict: "task_id" },
        );

      if (sessionError) throw sessionError;

      await loadSprintTasks(selectedSprintId);
      setVoteMessage(`Confirmed ${confirmedStoryPoints} SP for this task.`);
    } catch (confirmError) {
      setError(getErrorMessage(confirmError, "Unable to confirm story points."));
    } finally {
      setSessionActionLoading(false);
    }
  }

  async function handleRevote() {
    if (!selectedSprintId || !selectedTaskId) return;

    setSessionActionLoading(true);
    setVoteMessage(null);
    setError(null);

    try {
      const { error: deleteVotesError } = await supabase
        .from("planning_poker_votes")
        .delete()
        .eq("task_id", selectedTaskId);

      if (deleteVotesError) throw deleteVotesError;

      const { error: sessionError } = await supabase
        .from("planning_poker_sessions")
        .delete()
        .eq("task_id", selectedTaskId);

      if (sessionError) throw sessionError;

      await reloadVotes(selectedSprintId);
      setVoteMessage("All votes cleared. Members can vote again.");
    } catch (revoteError) {
      setError(getErrorMessage(revoteError, "Unable to revote."));
    } finally {
      setSessionActionLoading(false);
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
    selectedTaskId && currentMemberId
      ? getMemberVote(selectedTaskId, currentMemberId)
      : null;

  const selectedTaskSession = selectedTaskId
    ? taskSessionsByTaskId.get(selectedTaskId) ?? null
    : null;

  const selectedTaskTally = useMemo(() => {
    if (!selectedTaskId) {
      return {
        allRequiredVoted: false,
        hasTie: false,
        winningStoryPoints: [],
        topVoteCount: 0,
      };
    }

    return getRequiredVoteTally(
      developerMembers.map((member) => member.id),
      (memberId) => getMemberVote(selectedTaskId, memberId),
    );
  }, [developerMembers, selectedTaskId, votesByTaskAndMember]);

  const votingClosed =
    selectedTaskSession?.is_revealed === true ||
    selectedTaskSession?.is_confirmed === true;

  const canRevealVotes =
    isCurrentMemberPokerAdmin &&
    selectedTaskTally.allRequiredVoted &&
    !selectedTaskSession?.is_revealed &&
    !selectedTaskSession?.is_confirmed;

  const canConfirmVote =
    isCurrentMemberPokerAdmin &&
    selectedTaskTally.allRequiredVoted &&
    !selectedTaskTally.hasTie &&
    !selectedTaskSession?.is_confirmed;

  const selectedTaskVoteCount = useMemo(() => {
    if (!selectedTaskId) return 0;
    return votes.filter((vote) => vote.task_id === selectedTaskId).length;
  }, [selectedTaskId, votes]);

  const canRevote =
    isCurrentMemberPokerAdmin &&
    Boolean(selectedTaskId) &&
    !selectedTaskSession?.is_confirmed &&
    (selectedTaskVoteCount > 0 || selectedTaskSession?.is_revealed === true);

  const showRevealedConsensus =
    selectedTaskSession?.is_revealed === true &&
    selectedTaskTally.winningStoryPoints.length > 0;

  return (
    <div className="planning-poker-page" style={{ padding: "20px 0 40px" }}>
      <Card className="planning-poker-card">
        <div className="planning-poker-header">
          <div>
            <SectionTitle>Planning Poker</SectionTitle>
            <p className="planning-poker-subtitle">
              Estimate unpointed tasks from the Trello Planning list. Developer votes are required; other members may vote optionally.
            </p>
          </div>
          <div className="planning-poker-header-actions">
            <StyledSelect
              value={selectedSprintId}
              onChange={setSelectedSprintId}
              placeholder="Select sprint"
            >
              {sprints.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {getSprintLabel(sprint)}
                </option>
              ))}
            </StyledSelect>
            <SprintSyncDataAction
              currentSprint={currentSprint}
              selectedSprintId={selectedSprintId}
              memberRole={currentMemberRole}
              onSynced={() => loadSprintTasks(selectedSprintId)}
            />
            <span className="planning-poker-count-badge">
              {tasks.length} Planning task{tasks.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {error ? <p className="planning-poker-error">{error}</p> : null}
        {voteMessage ? <p className="planning-poker-message">{voteMessage}</p> : null}

        {loading ? (
          <div className="planning-poker-loading">
            <span className="planning-poker-spinner" />
            Loading planning poker...
          </div>
        ) : null}

        {!loading && tasks.length === 0 ? (
          <div className="planning-poker-empty">
            No unpointed tasks found on the Planning list for the selected sprint.
          </div>
        ) : null}

        {!loading && tasks.length > 0 ? (
          <div className="planning-poker-layout">
            <section className="planning-poker-board">
              <div
                className={`planning-poker-board-column${
                  selectedTask ? " planning-poker-board-column--expanded" : ""
                }`}
              >
                <div className="planning-poker-board-column-header">
                  <span>Planning List</span>
                  <div className="planning-poker-board-column-header-actions">
                    {!selectedTask ? <span>{tasks.length}</span> : null}
                    {selectedTask ? (
                      <button
                        type="button"
                        className="planning-poker-close-button"
                        onClick={() => setSelectedTaskId(null)}
                        aria-label="Close task details"
                      >
                        Close
                      </button>
                    ) : null}
                  </div>
                </div>

                {selectedTask ? (
                  (() => {
                    const { severityLabel, severityColor, priorityColor } =
                      getTaskDisplayColors(selectedTask);
                    const progress = getDeveloperVoteProgress(selectedTask.id);

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
                            {selectedTask.trello_short_id ?? selectedTask.id.slice(0, 8)}
                          </span>
                          <span className="planning-poker-vote-progress">
                            {progress.voted}/{progress.total} dev votes
                          </span>
                        </div>

                        <h3 className="planning-poker-task-expanded-title">
                          {selectedTask.trello_card_url ? (
                            <a
                              href={selectedTask.trello_card_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {selectedTask.title}
                            </a>
                          ) : (
                            selectedTask.title
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
                            {selectedTask.priority}
                          </span>
                          <span className="planning-poker-pill planning-poker-pill--neutral">
                            {formatTaskType(selectedTask.task_type)}
                          </span>
                          <span className="planning-poker-pill planning-poker-pill--neutral">
                            {PLANNING_TRELLO_LIST_NAME}
                          </span>
                        </div>

                        <div className="planning-poker-task-expanded-description">
                          <h4>Description</h4>
                          <TrelloDescription content={selectedTask.description ?? ""} />
                        </div>
                      </article>
                    );
                  })()
                ) : (
                  <div className="planning-poker-board-cards">
                    {tasks.map((task, index) => {
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
                          onClick={() => setSelectedTaskId(task.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedTaskId(task.id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="planning-poker-task-card-top">
                            <span className="planning-poker-task-id">
                              {task.trello_short_id ?? task.id.slice(0, 8)}
                            </span>
                            <span className="planning-poker-vote-progress">
                              {progress.voted}/{progress.total} dev votes
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
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <aside className="planning-poker-vote-panel">
              {selectedTask ? (
                <>
                  <div className="planning-poker-vote-panel-header">
                    <h3>Vote for Task</h3>
                    <p>{selectedTask.title}</p>
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
                          Reveal
                        </button>
                      ) : null}
                      {canConfirmVote ? (
                        <button
                          type="button"
                          className="planning-poker-admin-button planning-poker-admin-button--confirm"
                          disabled={sessionActionLoading}
                          onClick={() => void handleConfirmVote()}
                        >
                          Confirm
                        </button>
                      ) : null}
                      {canRevote ? (
                        <button
                          type="button"
                          className="planning-poker-admin-button planning-poker-admin-button--revote"
                          disabled={sessionActionLoading}
                          onClick={() => void handleRevote()}
                        >
                          Revote
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {showRevealedConsensus ? (
                    <div className="planning-poker-reveal-banner">
                      <span className="planning-poker-reveal-banner__label">Revealed consensus</span>
                      <span className="planning-poker-reveal-banner__value">
                        {formatWinningStoryPoints(selectedTaskTally.winningStoryPoints)}
                        {selectedTaskTally.hasTie ? " (tied)" : ""}
                      </span>
                    </div>
                  ) : null}

                  {selectedTaskSession?.is_confirmed ? (
                    <div className="planning-poker-confirmed-banner">
                      Confirmed at{" "}
                      {selectedTaskSession.confirmed_story_points ?? "—"} SP
                    </div>
                  ) : null}

                  {votingClosed && !selectedTaskSession?.is_confirmed ? (
                    <p className="planning-poker-voting-closed">
                      Voting is closed for this task.
                    </p>
                  ) : null}

                  {visibleDeveloperMembers.length > 0 ? (
                    <div className="planning-poker-voter-section">
                      <h4>Required Developer Votes</h4>
                      <div className="planning-poker-voter-list">
                        {visibleDeveloperMembers.map((member) => {
                        const voteValue = getMemberVote(selectedTask.id, member.id);
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
                          const voteValue = getMemberVote(selectedTask.id, member.id);
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
              Relational view of sprint, task, member, and voted story points.
            </p>
          </div>
        </div>

        {voteTableRows.length === 0 ? (
          <div className="planning-poker-empty">
            No votes recorded for the selected sprint yet.
          </div>
        ) : (
          <div className="planning-poker-table-scroll">
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
                    <td>{row.sprintLabel}</td>
                    <td>{row.taskTitle}</td>
                    <td>{row.taskType}</td>
                    <td>{row.memberName}</td>
                    <td>{row.memberRole}</td>
                    <td>{row.isRequiredVoter ? "Required" : "Optional"}</td>
                    <td>{row.storyPoints}</td>
                    <td>{row.consensusStoryPoints ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
