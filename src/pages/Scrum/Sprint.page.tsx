import { useEffect, useRef, useState } from "react";
import {
  SprintFilter,
  SPRINT_STATUS_STYLE,
  SprintScoreboard,
  type SprintFilterOption,
  type SprintStatus,
} from "@/components/scrum";
import SprintKanbanBoard from "@/components/scrum/sprint/SprintKanbanBoard";
import { StyledSelect } from "@/components/shared/Elements";
import { Title } from "@/components/shared/page";
import {
  getSupabaseSession,
  getSupabaseRows,
  insertSupabaseRows,
  updateSupabaseRows,
} from "@/lib/supabase";
import {
  buildSprintRequirementsFromCurrentRequirements,
  syncCurrentSprintTasks,
} from "@/lib/utils";
import { Text } from "@/lib/theme";
import "@/assets/styles/Sprint.page.css";

const TASK_COUNT_LIST_NAMES = [
  "Current Sprint",
  "Adhoc",
  "In Development",
  "For Dev Deployment",
  "On Dev Environment",
];

type SprintTaskCountRow = {
  assigned_to: string | null;
  trello_list_name: string | null;
  trello_last_synced_at: string | null;
};

type SprintApprovalTaskRow = {
  id: string;
  story_points: number | null;
  sp_type: "planned" | "adhoc" | "done" | "blocked" | null;
};

type CurrentSprintRow = {
  id: string;
  project_id: string;
  name: string;
  sprint_number: number;
  sprint_year: number | null;
  start_date: string;
  end_date: string;
  sprint_quarter: number | null;
  sprint_month: number | null;
  month: number | null;
  total_planned_points: number;
  total_completed_points: number;
  status: string | null;
  is_current: number | boolean;
};

type SprintMemberFilterRow = {
  id: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  sprint_approved: boolean | null;
};

type CurrentMemberRow = {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  role: string | null;
  sprint_approved: boolean | null;
};

type SprintMutationRow = Record<string, string | number | boolean | null>;

type SprintConfirmationDialog = {
  title: string;
  message: string;
  confirmLabel: string;
  accent: string;
  sprintDetail?: string;
  metricDetails?: Array<{
    label: string;
    value: string;
  }>;
  disableConfirm?: boolean;
  showNextSprintForm?: boolean;
  onConfirm: () => void;
};

type SprintApprovalSummary = {
  approvedCount: number;
  requiredCount: number;
};

type NextSprintDraft = {
  year: number;
  quarter: number;
  sprintNumber: number;
  startDate: string;
  endDate: string;
  month: number;
};

const MONTH_OPTIONS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
];

function normalizeListName(value: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeSprintStatus(value: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function isRestrictedSprintActionRole(role: string | null): boolean {
  const normalizedRole = role?.trim().toLowerCase() ?? "";
  return (
    normalizedRole === "developer" ||
    normalizedRole === "mid_level_developer" ||
    normalizedRole === "senior_developer" ||
    normalizedRole === "qa_engineer" ||
    normalizedRole === "designer" ||
    normalizedRole === "intern"
  );
}

function usesEqualScoreboardTopColumns(role: string | null): boolean {
  const normalizedRole = role?.trim().toLowerCase() ?? "";

  return (
    normalizedRole === "developer" ||
    normalizedRole === "senior_developer" ||
    normalizedRole === "tech_lead" ||
    normalizedRole === "project_manager" ||
    normalizedRole === "qa_engineer" ||
    normalizedRole === "desinger" ||
    normalizedRole === "designer"
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {
    const { message, details, hint } = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
    };

    return [message, details, hint]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" ")
      || fallback;
  }

  return fallback;
}

function getMemberFilterName(member: SprintMemberFilterRow): string {
  return (
    member.full_name ||
    [member.first_name, member.last_name].filter(Boolean).join(" ") ||
    "Unnamed member"
  );
}

function getSprintStatusStyleKey(status: string | null): SprintStatus {
  const normalizedStatus = normalizeSprintStatus(status);

  if (normalizedStatus === "planning") return "open";
  if (normalizedStatus === "completed") return "closed";
  if (
    normalizedStatus === "open" ||
    normalizedStatus === "active" ||
    normalizedStatus === "closed"
  ) {
    return normalizedStatus;
  }

  return "open";
}

function buildSprintFilterLabel(sprint: CurrentSprintRow): string {
  return isCurrentSprint(sprint) ? `${sprint.name} (Current)` : sprint.name;
}

function buildSprintFilterOptions(sprints: CurrentSprintRow[]): SprintFilterOption[] {
  return sprints.map((sprint) => ({
    value: sprint.id,
    label: buildSprintFilterLabel(sprint),
    status: getSprintStatusStyleKey(sprint.status),
  }));
}

function isCurrentSprint(sprint: CurrentSprintRow): boolean {
  return sprint.is_current === 1 || sprint.is_current === true;
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatLastSyncDate(value: string | null): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const parts = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((accumulator, part) => {
      accumulator[part.type] = part.value;
      return accumulator;
    }, {});

  return `${parts.month} ${parts.day}, ${parts.year} at ${parts.hour}:${parts.minute} ${parts.dayPeriod.toUpperCase()}`;
}

function getLatestTaskSyncDate(tasks: SprintTaskCountRow[]): string | null {
  const latestTimestamp = tasks.reduce<number | null>((latest, task) => {
    if (!task.trello_last_synced_at) return latest;

    const timestamp = new Date(task.trello_last_synced_at).getTime();
    if (!Number.isFinite(timestamp)) return latest;

    return latest === null ? timestamp : Math.max(latest, timestamp);
  }, null);

  return latestTimestamp === null ? null : new Date(latestTimestamp).toISOString();
}

function formatSprintPeriodDate(value: string | null | undefined): string {
  if (!value) return "-";

  const parsedDate = parseDateOnly(value);
  const timestamp = parsedDate.getTime();

  if (!Number.isFinite(timestamp)) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsedDate);
}

function formatSprintPeriod(sprint: CurrentSprintRow | null): string {
  if (!sprint) return "No sprint period available";

  return `${formatSprintPeriodDate(sprint.start_date)} - ${formatSprintPeriodDate(
    sprint.end_date,
  )}`;
}

function getSprintActionProgressLabel(action: string): string {
  if (action === "start-sync") return "Starting sprint";
  if (action === "sync-data") return "Syncing data";
  if (action === "end-sync") return "Ending sprint";
  if (action === "reopen-sync") return "Reopening sprint";
  if (action === "open-new") return "Opening new sprint";

  return "Processing";
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);

  return nextDate;
}

function getQuarterFromDate(date: Date): number {
  return Math.floor(date.getUTCMonth() / 3) + 1;
}

function getSprintYear(currentSprint: CurrentSprintRow): number {
  if (currentSprint.sprint_year) return currentSprint.sprint_year;

  const yearFromName = currentSprint.name.match(/^(\d{4})\b/u)?.[1];
  if (yearFromName) return Number(yearFromName);

  return parseDateOnly(currentSprint.start_date).getUTCFullYear();
}

function getSprintQuarter(currentSprint: CurrentSprintRow): number {
  if (currentSprint.sprint_quarter) return currentSprint.sprint_quarter;

  const quarterFromName = currentSprint.name.match(/\bQ([1-4])\b/iu)?.[1];
  if (quarterFromName) return Number(quarterFromName);

  return getQuarterFromDate(parseDateOnly(currentSprint.start_date));
}

function buildSprintName({ year, quarter, sprintNumber }: NextSprintDraft): string {
  return `${year} Q${quarter} Sprint ${sprintNumber}`;
}

function buildDefaultNextSprintDraft(currentSprint: CurrentSprintRow): NextSprintDraft {
  const startDate = addDays(parseDateOnly(currentSprint.end_date), 1);
  const endDate = addDays(startDate, 13);
  const currentYear = getSprintYear(currentSprint);
  const currentQuarter = getSprintQuarter(currentSprint);
  const isSprintCycleEnd = currentSprint.sprint_number === 7;
  const nextSprintNumber = isSprintCycleEnd ? 1 : currentSprint.sprint_number + 1;
  const nextQuarter = isSprintCycleEnd
    ? currentQuarter === 4
      ? 1
      : currentQuarter + 1
    : currentQuarter;
  const nextYear = isSprintCycleEnd && currentQuarter === 4
    ? currentYear + 1
    : currentYear;
  const startDateMonth = startDate.getUTCMonth() + 1;
  const monthOptions = getNextSprintMonthOptions(nextYear);

  return {
    year: nextYear,
    quarter: nextQuarter,
    sprintNumber: nextSprintNumber,
    startDate: formatDateOnly(startDate),
    endDate: formatDateOnly(endDate),
    month: monthOptions.some((month) => month.value === startDateMonth)
      ? startDateMonth
      : monthOptions[0].value,
  };
}

function buildNextSprintName(currentSprint: CurrentSprintRow): string {
  return buildSprintName(buildDefaultNextSprintDraft(currentSprint));
}

function getNextSprintQuarterOptions(
  currentSprint: CurrentSprintRow,
  draftYear: number,
): number[] {
  const currentYear = getSprintYear(currentSprint);
  const currentQuarter = getSprintQuarter(currentSprint);
  const minimumQuarter = draftYear === currentYear
    ? currentSprint.sprint_number === 7
      ? currentQuarter + 1
      : currentQuarter
    : 1;

  return [1, 2, 3, 4].filter((quarter) => quarter >= minimumQuarter);
}

function getNextSprintNumberOptions(
  currentSprint: CurrentSprintRow,
  draftYear: number,
  draftQuarter: number,
): number[] {
  if (currentSprint.sprint_number === 7) {
    return [1, 2, 3, 4, 5, 6, 7];
  }

  const currentYear = getSprintYear(currentSprint);
  const currentQuarter = getSprintQuarter(currentSprint);
  const minimumSprint =
    draftYear === currentYear && draftQuarter === currentQuarter
      ? Math.min(currentSprint.sprint_number + 1, 7)
      : 1;

  return [1, 2, 3, 4, 5, 6, 7].filter(
    (sprintNumber) => sprintNumber >= minimumSprint,
  );
}

function getNextSprintMonthOptions(draftYear: number): typeof MONTH_OPTIONS {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  return MONTH_OPTIONS.filter(
    (month) => draftYear > currentYear || month.value >= currentMonth,
  );
}

function buildNextSprintPayload(
  currentSprint: CurrentSprintRow,
  draft: NextSprintDraft,
): SprintMutationRow {
  return {
    project_id: currentSprint.project_id,
    name: buildSprintName(draft),
    sprint_number: draft.sprintNumber,
    start_date: draft.startDate,
    end_date: draft.endDate,
    month: draft.month,
    total_planned_points: 0,
    total_completed_points: 0,
    status: "planning",
    is_current: 1,
  };
}

export default function SprintPage() {
  const sprintActionsRef = useRef<HTMLDivElement | null>(null);
  const approvalButtonRef = useRef<HTMLDivElement | null>(null);
  const [selectedSprint, setSelectedSprint] = useState("");
  const [sprints, setSprints] = useState<CurrentSprintRow[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [lastTrelloSyncAt, setLastTrelloSyncAt] = useState<string | null>(null);
  const [currentSprint, setCurrentSprint] = useState<CurrentSprintRow | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [memberFilterOptions, setMemberFilterOptions] = useState<SprintMemberFilterRow[]>(
    [],
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [sprintActionLoading, setSprintActionLoading] = useState<string | null>(null);
  const [sprintActionsVisible, setSprintActionsVisible] = useState(true);
  const [approvalButtonVisible, setApprovalButtonVisible] = useState(true);
  const [sprintActionError, setSprintActionError] = useState<string | null>(null);
  const [currentMember, setCurrentMember] = useState<CurrentMemberRow | null>(null);
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveMessage, setApproveMessage] = useState<string | null>(null);
  const [sprintApprovalSummary, setSprintApprovalSummary] =
    useState<SprintApprovalSummary>({
      approvedCount: 0,
      requiredCount: 0,
    });
  const [confirmationDialog, setConfirmationDialog] =
    useState<SprintConfirmationDialog | null>(null);
  const [nextSprintDraft, setNextSprintDraft] = useState<NextSprintDraft | null>(
    null,
  );
  const sprintFilterOptions = buildSprintFilterOptions(sprints);
  const selectedSprintRow =
    sprints.find((sprint) => sprint.id === selectedSprint) ??
    currentSprint ??
    sprints[0] ??
    null;
  const selectedSprintStatus = selectedSprintRow?.status ?? null;
  const currentSprintStatus = normalizeSprintStatus(currentSprint?.status ?? null);
  const selectedSprintStatusStyle =
    SPRINT_STATUS_STYLE[getSprintStatusStyleKey(selectedSprintStatus)];
  const sprintTitle =
    `${selectedSprintRow?.name ?? currentSprint?.name ?? "Current Sprint"} Kanban`;
  const nextSprintQuarterOptions =
    currentSprint && nextSprintDraft
      ? getNextSprintQuarterOptions(currentSprint, nextSprintDraft.year)
      : [1, 2, 3, 4];
  const nextSprintNumberOptions =
    currentSprint && nextSprintDraft
      ? getNextSprintNumberOptions(
          currentSprint,
          nextSprintDraft.year,
          nextSprintDraft.quarter,
        )
      : [1, 2, 3, 4, 5, 6, 7];
  const nextSprintMonthOptions = nextSprintDraft
    ? getNextSprintMonthOptions(nextSprintDraft.year)
    : getNextSprintMonthOptions(new Date().getFullYear());
  const nextSprintDraftName = nextSprintDraft
    ? buildSprintName(nextSprintDraft)
    : currentSprint
      ? buildNextSprintName(currentSprint)
      : "Next Sprint";
  const hasRestrictedSprintActions = isRestrictedSprintActionRole(
    currentMember?.role ?? null,
  );
  const shouldUseEqualScoreboardColumns = usesEqualScoreboardTopColumns(
    currentMember?.role ?? null,
  );
  const restrictedMemberId = hasRestrictedSprintActions ? currentMember?.id ?? "" : "";
  const effectiveSelectedMemberId = restrictedMemberId || selectedMemberId;
  const canApproveAssignedTasks =
    hasRestrictedSprintActions && currentMember?.sprint_approved === false;
  const isSprintApprovalReady =
    sprintApprovalSummary.requiredCount === 0 ||
    sprintApprovalSummary.approvedCount >= sprintApprovalSummary.requiredCount;

  useEffect(() => {
    let cancelled = false;
    const countedListNames = new Set(TASK_COUNT_LIST_NAMES.map(normalizeListName));

    async function loadCurrentSprintData() {
      try {
        const [sprintRows, members, session] = await Promise.all([
          getSupabaseRows<CurrentSprintRow>("sprints", {
            select:
              "id,project_id,name,sprint_number,sprint_year,start_date,end_date,sprint_quarter,sprint_month,month,total_planned_points,total_completed_points,status,is_current",
            order: { column: "start_date", ascending: false },
          }),
          getSupabaseRows<SprintMemberFilterRow>("members", {
            select: "id,full_name,first_name,last_name,sprint_approved",
            order: { column: "full_name", ascending: true },
          }),
          getSupabaseSession(),
        ]);
        const sprint = sprintRows.find(isCurrentSprint) ?? null;
        const selectedSprintForData =
          sprintRows.find((row) => row.id === selectedSprint) ?? sprint ?? sprintRows[0] ?? null;
        const [memberByEmail] = session?.user.email
          ? await getSupabaseRows<CurrentMemberRow>("members", {
              select: "id,auth_user_id,email,role,sprint_approved",
              eq: { email: session.user.email },
              limit: 1,
            })
          : [];
        const [memberByAuthUserId] =
          !memberByEmail && session?.user.id
            ? await getSupabaseRows<CurrentMemberRow>("members", {
                select: "id,auth_user_id,email,role,sprint_approved",
                eq: { auth_user_id: session.user.id },
                limit: 1,
              })
            : [];
        const loggedInMember = memberByEmail ?? memberByAuthUserId ?? null;
        const tasks = selectedSprintForData
          ? await getSupabaseRows<SprintTaskCountRow>("tasks", {
              select: "assigned_to,trello_list_name,trello_last_synced_at",
              eq: { sprint_id: selectedSprintForData.id },
            })
          : [];
        const restrictedDataMemberId = isRestrictedSprintActionRole(
          loggedInMember?.role ?? null,
        )
          ? loggedInMember?.id ?? ""
          : "";
        const activeMemberFilterId = restrictedDataMemberId || selectedMemberId;
        const visibleTasks = activeMemberFilterId
          ? tasks.filter((task) => task.assigned_to === activeMemberFilterId)
          : tasks;
        const count = visibleTasks.filter((task) =>
          countedListNames.has(normalizeListName(task.trello_list_name)),
        ).length;
        const memberApprovalById = new Map(
          members
            .filter((member): member is SprintMemberFilterRow & { id: string } =>
              Boolean(member.id),
            )
            .map((member) => [member.id, member.sprint_approved === true]),
        );
        const requiredApprovalMemberIds = new Set(
          tasks
            .map((task) => task.assigned_to)
            .filter((memberId): memberId is string => Boolean(memberId)),
        );
        const approvedRequiredMemberCount = Array.from(requiredApprovalMemberIds)
          .filter((memberId) => memberApprovalById.get(memberId) === true).length;

        if (!cancelled) {
          setTaskCount(count);
          setLastTrelloSyncAt(
            getLatestTaskSyncDate(restrictedDataMemberId ? visibleTasks : tasks),
          );
          setSprints(sprintRows);
          setCurrentSprint(sprint);
          setSelectedSprint((currentValue) =>
            currentValue && sprintRows.some((row) => row.id === currentValue)
              ? currentValue
              : selectedSprintForData?.id ?? "",
          );
          setCurrentMember(loggedInMember ?? null);
          setSprintApprovalSummary({
            approvedCount: approvedRequiredMemberCount,
            requiredCount: requiredApprovalMemberIds.size,
          });
          setMemberFilterOptions(
            restrictedDataMemberId
              ? members.filter((member) => member.id === restrictedDataMemberId)
              : members.filter((member) => Boolean(member.id)),
          );
        }
      } catch {
        if (!cancelled) {
          setTaskCount(0);
          setLastTrelloSyncAt(null);
          setSprints([]);
          setCurrentSprint(null);
          setCurrentMember(null);
          setSprintApprovalSummary({
            approvedCount: 0,
            requiredCount: 0,
          });
          setMemberFilterOptions([]);
        }
      }
    }

    void loadCurrentSprintData();

    return () => {
      cancelled = true;
    };
  }, [refreshKey, selectedMemberId]);

  useEffect(() => {
    const target = sprintActionsRef.current;
    if (!target) return;

    if (typeof IntersectionObserver === "undefined") {
      const rect = target.getBoundingClientRect();
      setSprintActionsVisible(rect.bottom >= 0 && rect.top <= window.innerHeight);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setSprintActionsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [currentSprint?.id, currentSprintStatus, selectedSprint]);

  useEffect(() => {
    if (!canApproveAssignedTasks) {
      setApprovalButtonVisible(true);
      return;
    }

    const target = approvalButtonRef.current;
    if (!target) return;

    if (typeof IntersectionObserver === "undefined") {
      const rect = target.getBoundingClientRect();
      setApprovalButtonVisible(rect.bottom >= 0 && rect.top <= window.innerHeight);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setApprovalButtonVisible(entry.isIntersecting);
      },
      { threshold: 0.1 },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [canApproveAssignedTasks, currentMember?.id]);

  function refreshSprintPageElements(): void {
    setRefreshKey((value) => value + 1);
  }

  async function requestApproveAssignedTasksConfirmation(): Promise<void> {
    if (!currentMember || !currentSprint) return;

    setApproveLoading(true);
    setApproveMessage(null);

    try {
      const assignedTasks = await getSupabaseRows<SprintApprovalTaskRow>("tasks", {
        select: "id,story_points,sp_type",
        eq: {
          sprint_id: currentSprint.id,
          assigned_to: currentMember.id,
        },
      });
      const approvalTasks = assignedTasks.filter((task) => task.sp_type === "planned");
      const assignedStoryPoints = approvalTasks.reduce(
        (total, task) => total + Number(task.story_points ?? 0),
        0,
      );

      requestSprintConfirmation({
        title: "Approve Assigned Tasks",
        message: "Please confirm that you reviewed and approve your assigned sprint tasks.",
        confirmLabel: "Approve Tasks",
        accent: "#00e5a0",
        sprintDetail: currentSprint.name,
        metricDetails: [
          {
            label: "Planned Tasks",
            value: String(approvalTasks.length),
          },
          {
            label: "Planned Story Points",
            value: assignedStoryPoints.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
        ],
        onConfirm: () => void approveAssignedTasks(),
      });
    } catch (error) {
      setApproveMessage(
        getErrorMessage(error, "Unable to load assigned tasks for approval."),
      );
    } finally {
      setApproveLoading(false);
    }
  }

  async function approveAssignedTasks(): Promise<void> {
    if (!currentMember) return;

    setApproveLoading(true);
    setApproveMessage(null);

    try {
      const memberId = currentMember.id;
      const [updatedMember] = await updateSupabaseRows<
        CurrentMemberRow,
        SprintMutationRow
      >("members", { sprint_approved: true }, {
        select: "id,auth_user_id,email,role,sprint_approved",
        eq: { id: memberId },
      });

      if (!updatedMember) {
        throw new Error(`No matching member row was updated for ${memberId}.`);
      }

      setCurrentMember(updatedMember);
      setApproveMessage("Assigned tasks approved.");
    } catch (error) {
      setApproveMessage(getErrorMessage(error, "Unable to approve assigned tasks."));
    } finally {
      setApproveLoading(false);
    }
  }

  function getSelectedCurrentSprintForProcessing(): CurrentSprintRow | null {
    if (!currentSprint || selectedSprint !== currentSprint.id) {
      setSprintActionError("Please select the current sprint before processing sprint data.");
      return null;
    }

    return currentSprint;
  }

  async function startSprint(): Promise<void> {
    const sprintToProcess = getSelectedCurrentSprintForProcessing();
    if (!sprintToProcess) return;

    if (!isSprintApprovalReady) {
      setSprintActionError(
        `Cannot start sprint yet. ${sprintApprovalSummary.approvedCount}/${sprintApprovalSummary.requiredCount} required members have approved their assigned tasks.`,
      );
      return;
    }

    setSprintActionLoading("start-sync");
    setSprintActionError(null);

    try {
      await updateSupabaseRows<CurrentSprintRow, SprintMutationRow>(
        "sprints",
        { status: "active" },
        {
          select:
            "id,project_id,name,sprint_number,sprint_year,start_date,end_date,sprint_quarter,sprint_month,month,total_planned_points,total_completed_points,status,is_current",
          eq: { id: sprintToProcess.id, is_current: sprintToProcess.is_current },
        },
      );
      await syncCurrentSprintTasks(sprintToProcess.id);
      refreshSprintPageElements();
    } catch (error) {
      setSprintActionError(
        error instanceof Error
          ? error.message
          : "Unable to start sprint and sync Trello cards.",
      );
    } finally {
      setSprintActionLoading(null);
    }
  }

  async function reopenSprint(): Promise<void> {
    const sprintToProcess = getSelectedCurrentSprintForProcessing();
    if (!sprintToProcess) return;

    setSprintActionLoading("reopen-sync");
    setSprintActionError(null);

    try {
      await updateSupabaseRows<CurrentSprintRow, SprintMutationRow>(
        "sprints",
        { status: "active" },
        {
          select:
            "id,project_id,name,sprint_number,sprint_year,start_date,end_date,sprint_quarter,sprint_month,month,total_planned_points,total_completed_points,status,is_current",
          eq: { id: sprintToProcess.id, is_current: sprintToProcess.is_current },
        },
      );
      await syncCurrentSprintTasks(sprintToProcess.id);
      refreshSprintPageElements();
    } catch (error) {
      setSprintActionError(
        error instanceof Error
          ? error.message
          : "Unable to reopen sprint and sync Trello cards.",
      );
    } finally {
      setSprintActionLoading(null);
    }
  }

  async function endSprint(): Promise<void> {
    const sprintToProcess = getSelectedCurrentSprintForProcessing();
    if (!sprintToProcess) return;

    setSprintActionLoading("end-sync");
    setSprintActionError(null);

    try {
      await updateSupabaseRows<CurrentSprintRow, SprintMutationRow>(
        "sprints",
        { status: "completed" },
        {
          select:
            "id,project_id,name,sprint_number,sprint_year,start_date,end_date,sprint_quarter,sprint_month,month,total_planned_points,total_completed_points,status,is_current",
          eq: { id: sprintToProcess.id, is_current: sprintToProcess.is_current },
        },
      );
      await syncCurrentSprintTasks(sprintToProcess.id);
      refreshSprintPageElements();
    } catch (error) {
      setSprintActionError(
        error instanceof Error
          ? error.message
          : "Unable to sync Trello cards and end sprint.",
      );
    } finally {
      setSprintActionLoading(null);
    }
  }

  async function syncSprintData(): Promise<void> {
    const sprintToProcess = getSelectedCurrentSprintForProcessing();
    if (!sprintToProcess) return;

    setSprintActionLoading("sync-data");
    setSprintActionError(null);

    try {
      await syncCurrentSprintTasks(sprintToProcess.id);
      refreshSprintPageElements();
    } catch (error) {
      setSprintActionError(
        error instanceof Error ? error.message : "Unable to sync Trello cards.",
      );
    } finally {
      setSprintActionLoading(null);
    }
  }

  async function openNewSprint(): Promise<void> {
    const sprintToProcess = getSelectedCurrentSprintForProcessing();
    if (!sprintToProcess) return;

    const draft = nextSprintDraft ?? buildDefaultNextSprintDraft(sprintToProcess);

    if (
      !draft.year ||
      !draft.quarter ||
      !draft.sprintNumber ||
      !draft.month ||
      !draft.startDate ||
      !draft.endDate
    ) {
      setSprintActionError("Please complete all Open New Sprint fields.");
      return;
    }

    setSprintActionLoading("open-new");
    setSprintActionError(null);

    try {
      await updateSupabaseRows<CurrentSprintRow, SprintMutationRow>(
        "sprints",
        { is_current: 0 },
        {
          select:
            "id,project_id,name,sprint_number,sprint_year,start_date,end_date,sprint_quarter,sprint_month,month,total_planned_points,total_completed_points,status,is_current",
          eq: { id: sprintToProcess.id, is_current: sprintToProcess.is_current },
        },
      );
      const [newSprint] = await insertSupabaseRows<CurrentSprintRow, SprintMutationRow>(
        "sprints",
        buildNextSprintPayload(sprintToProcess, draft),
        "id,project_id,name,sprint_number,sprint_year,start_date,end_date,sprint_quarter,sprint_month,month,total_planned_points,total_completed_points,status,is_current",
      );

      if (!newSprint?.id) {
        throw new Error("Unable to create the new sprint.");
      }

      // Open New Sprint intentionally does not run Trello sync or Sync Data.
      await buildSprintRequirementsFromCurrentRequirements(newSprint.id);
      refreshSprintPageElements();
    } catch (error) {
      setSprintActionError(getErrorMessage(error, "Unable to open a new sprint."));
    } finally {
      setSprintActionLoading(null);
    }
  }

  function requestSprintConfirmation(dialog: SprintConfirmationDialog): void {
    setConfirmationDialog(dialog);
  }

  function updateNextSprintYear(value: string): void {
    if (!currentSprint) return;

    const parsedYear = Number(value);
    if (!Number.isFinite(parsedYear)) return;

    const currentDraft = nextSprintDraft ?? buildDefaultNextSprintDraft(currentSprint);
    const minimumYear = buildDefaultNextSprintDraft(currentSprint).year;
    const nextYear = Math.max(Math.round(parsedYear), minimumYear);
    const quarterOptions = getNextSprintQuarterOptions(currentSprint, nextYear);
    const nextQuarter = quarterOptions.includes(currentDraft.quarter)
      ? currentDraft.quarter
      : quarterOptions[0];
    const sprintOptions = getNextSprintNumberOptions(
      currentSprint,
      nextYear,
      nextQuarter,
    );
    const monthOptions = getNextSprintMonthOptions(nextYear);

    setNextSprintDraft({
      ...currentDraft,
      year: nextYear,
      quarter: nextQuarter,
      sprintNumber: sprintOptions.includes(currentDraft.sprintNumber)
        ? currentDraft.sprintNumber
        : sprintOptions[0],
      month: monthOptions.some((month) => month.value === currentDraft.month)
        ? currentDraft.month
        : monthOptions[0].value,
    });
  }

  function updateNextSprintQuarter(value: string): void {
    if (!currentSprint || !nextSprintDraft) return;

    const nextQuarter = Number(value);
    const sprintOptions = getNextSprintNumberOptions(
      currentSprint,
      nextSprintDraft.year,
      nextQuarter,
    );

    setNextSprintDraft({
      ...nextSprintDraft,
      quarter: nextQuarter,
      sprintNumber: sprintOptions.includes(nextSprintDraft.sprintNumber)
        ? nextSprintDraft.sprintNumber
        : sprintOptions[0],
    });
  }

  function updateNextSprintNumber(value: string): void {
    if (!nextSprintDraft) return;

    setNextSprintDraft({
      ...nextSprintDraft,
      sprintNumber: Number(value),
    });
  }

  function updateNextSprintStartDate(value: string): void {
    if (!nextSprintDraft) return;

    const parsedDate = value ? parseDateOnly(value) : null;
    const monthFromDate = parsedDate ? parsedDate.getUTCMonth() + 1 : nextSprintDraft.month;
    const monthOptions = getNextSprintMonthOptions(nextSprintDraft.year);
    const nextMonth = monthOptions.some((month) => month.value === monthFromDate)
      ? monthFromDate
      : monthOptions[0].value;

    setNextSprintDraft({
      ...nextSprintDraft,
      startDate: value,
      month: nextMonth,
    });
  }

  function updateNextSprintEndDate(value: string): void {
    if (!nextSprintDraft) return;

    setNextSprintDraft({
      ...nextSprintDraft,
      endDate: value,
    });
  }

  function updateNextSprintMonth(value: string): void {
    if (!nextSprintDraft) return;

    setNextSprintDraft({
      ...nextSprintDraft,
      month: Number(value),
    });
  }

  function confirmSprintDialogAction(): void {
    const action = confirmationDialog?.onConfirm;
    setConfirmationDialog(null);
    action?.();
  }

  const sprintActionButtonStyle = (accent: string): React.CSSProperties => ({
    border: `1px solid ${accent}88`,
    background: `${accent}18`,
    color: accent,
    borderRadius: 9,
    padding: "7px 11px",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    fontWeight: 900,
    cursor: sprintActionLoading ? "not-allowed" : "pointer",
    opacity: sprintActionLoading ? 0.65 : 1,
    boxShadow: `0 0 12px ${accent}18`,
  });

  const sprintActionButtonContent = (
    loadingKey: string,
    label: string,
    loadingLabel: string,
    accent: string,
  ) => (
    <>
      {sprintActionLoading === loadingKey ? (
        <span
          aria-hidden="true"
          className="sprint-action-loader"
          style={{
            borderTopColor: accent,
          }}
        />
      ) : null}
      {sprintActionLoading === loadingKey ? loadingLabel : label}
    </>
  );

  const sprintActions =
    selectedSprint === currentSprint?.id && currentSprint ? (
      <div
        ref={sprintActionsRef}
        style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
      >
        {currentSprintStatus === "planning" ? (
          <>
            <button
              type="button"
              disabled={Boolean(sprintActionLoading)}
              onClick={() => {
                requestSprintConfirmation({
                  title: "Start Sprint",
                  message: isSprintApprovalReady
                    ? "This will set the current sprint to active and sync Trello cards, including Ad hoc cards."
                    : "Start Sprint is locked until all members with current sprint tasks approve their assigned work.",
                  confirmLabel: "Start Sprint",
                  accent: "#00e5a0",
                  metricDetails: [
                    {
                      label: "Approved Members",
                      value: String(sprintApprovalSummary.approvedCount),
                    },
                    {
                      label: "Required Approvals",
                      value: String(sprintApprovalSummary.requiredCount),
                    },
                  ],
                  disableConfirm: !isSprintApprovalReady,
                  onConfirm: () => void startSprint(),
                });
              }}
              style={sprintActionButtonStyle("#00e5a0")}
            >
              {sprintActionButtonContent(
                "start-sync",
                "Start Sprint",
                "Starting & syncing...",
                "#00e5a0",
              )}
            </button>
            <button
              type="button"
              disabled={Boolean(sprintActionLoading)}
              onClick={() => {
                requestSprintConfirmation({
                  title: "Sync Data",
                  message:
                    "This will replace the current sprint task data with the latest planning cards from Trello.",
                  confirmLabel: "Sync Data",
                  accent: "#00c8ff",
                  onConfirm: () => void syncSprintData(),
                });
              }}
              style={sprintActionButtonStyle("#00c8ff")}
            >
              {sprintActionButtonContent(
                "sync-data",
                "Sync Data",
                "Syncing...",
                "#00c8ff",
              )}
            </button>
          </>
        ) : null}
        {currentSprintStatus === "active" ? (
          <>
            <button
              type="button"
              disabled={Boolean(sprintActionLoading)}
              onClick={() => {
                requestSprintConfirmation({
                  title: "End Sprint",
                  message:
                    "This will sync Trello data first, then mark the current sprint as completed.",
                  confirmLabel: "End Sprint",
                  accent: "#f5c842",
                  onConfirm: () => void endSprint(),
                });
              }}
              style={sprintActionButtonStyle("#f5c842")}
            >
              {sprintActionButtonContent(
                "end-sync",
                "End Sprint",
                "Syncing & ending...",
                "#f5c842",
              )}
            </button>
            <button
              type="button"
              disabled={Boolean(sprintActionLoading)}
              onClick={() => {
                requestSprintConfirmation({
                  title: "Sync Data",
                  message:
                    "This will replace the current sprint task data with the latest cards from Trello.",
                  confirmLabel: "Sync Data",
                  accent: "#00c8ff",
                  onConfirm: () => void syncSprintData(),
                });
              }}
              style={sprintActionButtonStyle("#00c8ff")}
            >
              {sprintActionButtonContent(
                "sync-data",
                "Sync Data",
                "Syncing...",
                "#00c8ff",
              )}
            </button>
          </>
        ) : null}
        {currentSprintStatus === "completed" ? (
          <>
            <button
              type="button"
              disabled={Boolean(sprintActionLoading)}
              onClick={() => {
                requestSprintConfirmation({
                  title: "Reopen Sprint",
                  message:
                    "This will set the sprint back to active and sync Trello cards, including Ad hoc cards.",
                  confirmLabel: "Reopen",
                  accent: "#00e5a0",
                  onConfirm: () => void reopenSprint(),
                });
              }}
              style={sprintActionButtonStyle("#00e5a0")}
            >
              {sprintActionButtonContent(
                "reopen-sync",
                "Reopen",
                "Reopening & syncing...",
                "#00e5a0",
              )}
            </button>
            <button
              type="button"
              disabled={Boolean(sprintActionLoading)}
              onClick={() => {
                const draft = buildDefaultNextSprintDraft(currentSprint);
                setNextSprintDraft(draft);
                requestSprintConfirmation({
                  title: "Open New Sprint",
                  message:
                    "This will mark the current sprint as done and create a new current sprint in planning status. No Trello sync or Sync Data process will run.",
                  confirmLabel: "Open New Sprint",
                  accent: "#00c8ff",
                  sprintDetail: buildSprintName(draft),
                  showNextSprintForm: true,
                  onConfirm: () => void openNewSprint(),
                });
              }}
              style={sprintActionButtonStyle("#00c8ff")}
            >
              {sprintActionButtonContent(
                "open-new",
                "Open New Sprint",
                "Opening...",
                "#00c8ff",
              )}
            </button>
          </>
        ) : null}
      </div>
    ) : null;

  return (
    <div
      className="sprint-page"
      style={{
        minHeight: "calc(100vh - 96px)",
        display: "flex",
        flexDirection: "column",
        overflow: "visible",
        padding: "16px 0 0",
      }}
    >
      {sprintActionLoading && !sprintActionsVisible ? (
        <div
          aria-live="polite"
          className="sprint-floating-sync-indicator"
          role="status"
        >
          <span className="sprint-action-loader" aria-hidden="true" />
          <span>{getSprintActionProgressLabel(sprintActionLoading)} in progress</span>
        </div>
      ) : null}
      {canApproveAssignedTasks && !approvalButtonVisible ? (
        <div className="sprint-approval-bar sprint-approval-bar--floating">
          <div className="sprint-approval-message">
            {approveMessage}
          </div>
          <button
            className="sprint-approval-button"
            disabled={approveLoading}
            onClick={() => void requestApproveAssignedTasksConfirmation()}
            type="button"
          >
            {approveLoading ? "Loading..." : "Approve Assigned Tasks"}
          </button>
        </div>
      ) : null}
      <SprintFilter
        selectedSprint={selectedSprint}
        onSprintChange={setSelectedSprint}
        options={sprintFilterOptions}
        actions={hasRestrictedSprintActions ? undefined : sprintActions}
      />
      {sprintActionError ? (
        <div
          style={{
            color: "#ff8d8d",
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            margin: "-4px 0 10px auto",
          }}
        >
          {sprintActionError}
        </div>
      ) : null}
      {confirmationDialog ? (
        <div
          className="sprint-confirmation-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !sprintActionLoading) {
              setConfirmationDialog(null);
            }
          }}
        >
          <section
            aria-modal="true"
            className="sprint-confirmation-dialog"
            role="dialog"
            style={{
              borderColor: `${confirmationDialog.accent}66`,
              boxShadow: `0 24px 80px rgba(0,0,0,0.42), 0 0 34px ${confirmationDialog.accent}20`,
            }}
          >
            <div
              className="sprint-confirmation-glow"
              style={{ background: confirmationDialog.accent }}
            />
            <div className="sprint-confirmation-header">
              <span
                className="sprint-confirmation-icon"
                style={{
                  borderColor: `${confirmationDialog.accent}66`,
                  background: `${confirmationDialog.accent}18`,
                  color: confirmationDialog.accent,
                  boxShadow: `0 0 18px ${confirmationDialog.accent}28`,
                }}
              >
                !
              </span>
              <div>
                <div className="sprint-confirmation-eyebrow">Confirm Action</div>
                <h2 className="sprint-confirmation-title">
                  {confirmationDialog.title}
                </h2>
              </div>
            </div>
            <p className="sprint-confirmation-message">
              {confirmationDialog.message}
            </p>
            <div className="sprint-confirmation-details">
              <span style={{ color: Text.faint }}>Sprint</span>
              <strong>
                {confirmationDialog.showNextSprintForm
                  ? nextSprintDraftName
                  : confirmationDialog.sprintDetail ??
                  currentSprint?.name ??
                  "Current Sprint"}
              </strong>
            </div>
            {confirmationDialog.metricDetails?.map((detail) => (
              <div className="sprint-confirmation-details" key={detail.label}>
                <span style={{ color: Text.faint }}>{detail.label}</span>
                <strong>{detail.value}</strong>
              </div>
            ))}
            {confirmationDialog.showNextSprintForm && currentSprint && nextSprintDraft ? (
              <div className="sprint-next-form">
                <label className="sprint-next-field">
                  <span>Year</span>
                  <input
                    min={buildDefaultNextSprintDraft(currentSprint).year}
                    onChange={(event) => updateNextSprintYear(event.target.value)}
                    required
                    type="number"
                    value={nextSprintDraft.year}
                  />
                </label>
                <label className="sprint-next-field">
                  <span>Quarter</span>
                  <div className="sprint-next-select-wrap">
                    <select
                      onChange={(event) => updateNextSprintQuarter(event.target.value)}
                      required
                      value={nextSprintDraft.quarter}
                    >
                      {nextSprintQuarterOptions.map((quarter) => (
                        <option key={quarter} value={quarter}>
                          Q{quarter}
                        </option>
                      ))}
                    </select>
                    <span aria-hidden="true" className="sprint-next-select-arrow">
                      v
                    </span>
                  </div>
                </label>
                <label className="sprint-next-field">
                  <span>Sprint</span>
                  <div className="sprint-next-select-wrap">
                    <select
                      onChange={(event) => updateNextSprintNumber(event.target.value)}
                      required
                      value={nextSprintDraft.sprintNumber}
                    >
                      {nextSprintNumberOptions.map((sprintNumber) => (
                        <option key={sprintNumber} value={sprintNumber}>
                          Sprint {sprintNumber}
                        </option>
                      ))}
                    </select>
                    <span aria-hidden="true" className="sprint-next-select-arrow">
                      v
                    </span>
                  </div>
                </label>
                <label className="sprint-next-field">
                  <span>Start Date</span>
                  <input
                    onChange={(event) => updateNextSprintStartDate(event.target.value)}
                    required
                    type="date"
                    value={nextSprintDraft.startDate}
                  />
                </label>
                <label className="sprint-next-field">
                  <span>End Date</span>
                  <input
                    min={nextSprintDraft.startDate}
                    onChange={(event) => updateNextSprintEndDate(event.target.value)}
                    required
                    type="date"
                    value={nextSprintDraft.endDate}
                  />
                </label>
                <label className="sprint-next-field">
                  <span>Month</span>
                  <div className="sprint-next-select-wrap">
                    <select
                      onChange={(event) => updateNextSprintMonth(event.target.value)}
                      required
                      value={nextSprintDraft.month}
                    >
                      {nextSprintMonthOptions.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                    <span aria-hidden="true" className="sprint-next-select-arrow">
                      v
                    </span>
                  </div>
                </label>
              </div>
            ) : null}
            <div className="sprint-confirmation-actions">
              <button
                className="sprint-confirmation-button sprint-confirmation-button--secondary"
                disabled={Boolean(sprintActionLoading)}
                onClick={() => setConfirmationDialog(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="sprint-confirmation-button sprint-confirmation-button--primary"
                disabled={Boolean(sprintActionLoading) || confirmationDialog.disableConfirm}
                onClick={confirmSprintDialogAction}
                style={{
                  borderColor: `${confirmationDialog.accent}88`,
                  background: `linear-gradient(135deg, ${confirmationDialog.accent}24, ${confirmationDialog.accent}10)`,
                  color: confirmationDialog.accent,
                }}
                type="button"
              >
                {confirmationDialog.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <div className="sprint-board-separator" aria-hidden="true" />

      <div
        className="sprint-header"
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            alignItems: "center",
            color: "rgba(160,210,255,0.68)",
            display: "flex",
            flexBasis: "100%",
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            fontWeight: 900,
            justifyContent: "space-between",
            letterSpacing: "0.08em",
            marginBottom: -2,
            textTransform: "uppercase",
            width: "100%",
          }}
        >
          <div
            style={{
              minWidth: 0,
              textAlign: "left",
            }}
          >
            Last Sync: {formatLastSyncDate(lastTrelloSyncAt)}
          </div>
          <div
            style={{
              marginLeft: 16,
              minWidth: 0,
              textAlign: "right",
            }}
          >
            Sprint Period: {formatSprintPeriod(selectedSprintRow)}
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <Title
            eyebrow="Scrum Board"
            title={sprintTitle}
            align="left"
            size="sprint"
            rowClassName="sprint-title-row"
            meta={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 9px",
                  borderRadius: 99,
                  border: `1px solid ${selectedSprintStatusStyle.border}`,
                  background: selectedSprintStatusStyle.background,
                  color: selectedSprintStatusStyle.color,
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  boxShadow: `0 0 12px ${selectedSprintStatusStyle.color}22`,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: selectedSprintStatusStyle.color,
                    boxShadow: `0 0 8px ${selectedSprintStatusStyle.color}`,
                  }}
                />
                {selectedSprintStatus}
              </span>
            </span>
            }
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            flexDirection: "column",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          {canApproveAssignedTasks ? (
            <div className="sprint-approval-bar" ref={approvalButtonRef}>
              <div className="sprint-approval-message">
                {approveMessage}
              </div>
              <button
                className="sprint-approval-button"
                disabled={approveLoading}
                onClick={() => void requestApproveAssignedTasksConfirmation()}
                type="button"
              >
                {approveLoading ? "Loading..." : "Approve Assigned Tasks"}
              </button>
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            {!hasRestrictedSprintActions ? (
              <StyledSelect
                value={selectedMemberId}
                onChange={setSelectedMemberId}
                placeholder="All members"
                accent={selectedSprintStatusStyle.color}
              >
                {memberFilterOptions.map((member) => (
                  <option key={member.id} value={member.id ?? ""}>
                    {getMemberFilterName(member)}
                  </option>
                ))}
              </StyledSelect>
            ) : null}
            <div
              className="sprint-task-count"
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,200,255,0.18)",
                background: "rgba(0,200,255,0.07)",
                color: "rgba(160,210,255,0.75)",
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {taskCount} tasks
            </div>
          </div>
        </div>
      </div>

      <SprintKanbanBoard
        key={`${selectedSprintRow?.id ?? "no-selected-sprint"}-${refreshKey}`}
        sprintId={selectedSprintRow?.id}
        selectedMemberId={effectiveSelectedMemberId}
      />

      <SprintScoreboard
        equalTopColumnWidths={shouldUseEqualScoreboardColumns}
        key={`scoreboard-${selectedSprintRow?.id ?? "no-selected-sprint"}-${effectiveSelectedMemberId || "all"}-${refreshKey}`}
        sprintId={selectedSprintRow?.id}
        selectedMemberId={effectiveSelectedMemberId}
      />
    </div>
  );
}
