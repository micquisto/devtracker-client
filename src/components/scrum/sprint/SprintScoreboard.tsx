import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { DoughnutChart, StackedColumnChart } from "@/components/shared/Charts";
import { TEAM_MEMBERS } from "@/data/Mock.data";
import {
  PROJECT_LABELS,
  SPRINT_BOARD_TASKS,
} from "@/data/SprintBoard.data";
import { getSupabaseRows } from "@/lib/supabase";
import { Background, Border, Chart } from "@/lib/theme";

const sprintBoardTasks = SPRINT_BOARD_TASKS;

const plannedStoryPoints = sprintBoardTasks
  .filter((task) => !task.isAdhoc)
  .reduce((sum, task) => sum + task.points, 0);

const adhocStoryPoints = sprintBoardTasks
  .filter((task) => task.isAdhoc)
  .reduce((sum, task) => sum + task.points, 0);

const initialProjectStoryPointSegments = PROJECT_LABELS.map((project) => ({
  ...project,
  storyPoints: sprintBoardTasks
    .filter((task) => task.project === project.label)
    .reduce((sum, task) => sum + task.points, 0),
}))
  .filter((project) => project.storyPoints > 0)
  .map((project) => ({
  ...project,
  value: project.storyPoints,
}));

type SprintRow = {
  id: string;
  name: string | null;
  blocked_count: number | null;
};

type ScoreboardTaskRow = {
  story_points: number;
  real_story_points: number | null;
  sp_type: string | null;
  trello_list_name: string | null;
  project_type: string | null;
  project: string | null;
  assigned_to: string | null;
  is_completed: string | null;
};

type ScoreboardStoryPointTotals = {
  planned: number;
  adhoc: number;
  plannedTasks: number;
  adhocTasks: number;
  completedTasks: number;
};

type ProjectTypeRow = {
  id: string;
  name: string;
};

type ProjectStoryPointSegment = {
  label: string;
  color: string;
  storyPoints: number;
  value: number;
};

type MemberRow = {
  id: string | null;
  trello_username: string | null;
  role: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type StoryPointRow = {
  member_id: string;
  assigned_story_points: number | null;
  adhoc_story_points: number | null;
  completed_story_points: number | null;
};

type SprintStoryPointBreakdownRow = {
  model: "member" | "project_type" | "sprint";
  model_id: string;
  real_points: number | null;
};

type SprintScoreboardProps = {
  equalTopColumnWidths?: boolean;
  includeExcludedMembers?: boolean;
  showPublicViewButton?: boolean;
  showScrollLink?: boolean;
  title?: string;
  useDialCompletionChart?: boolean;
  sprintId?: string;
  sprintName?: string;
  selectedMemberId?: string;
};

type MemberStoryPointCard = {
  id: string;
  name: string;
  initials: string;
  color: string;
  plannedStoryPoints: number;
  adhocStoryPoints: number;
  completedStoryPoints: number;
  completedRate: number;
};

const PROJECT_TYPE_FALLBACK_COLORS = [
  "#00c8ff",
  "#a78bfa",
  "#f5c842",
  "#ff6eb4",
  "#00e5a0",
  "#ff9f43",
  "#6b89ff",
  "#ff6b6b",
];

const TASK_PROJECT_COLORS = [
  "#00c8ff",
  "#ff6b6b",
  "#f5c842",
  "#00e5a0",
  "#a78bfa",
  "#ff6eb4",
  "#ff9f43",
  "#6b89ff",
];

const ASSIGNEE_COLORS = [
  "#00c8ff",
  "#00e5a0",
  "#f5c842",
  "#a78bfa",
  "#ff6eb4",
  "#ff9f43",
  "#6b89ff",
  "#ff6b6b",
];

const MOCK_MEMBER_COLOR_BY_NAME = new Map(
  TEAM_MEMBERS.map((member) => [member.name, member.color]),
);

const MOCK_MEMBER_NAME_BY_TRELLO_USERNAME: Record<string, string> = {
  joshuabalansa: "John Doe",
  doerrosales1: "Sarah Kim",
  louiefranzgualingco: "Alex Rivera",
  jpangs: "Mia Chen",
  thomasandrewzaragoza1: "Leo Santos",
};

const UNASSIGNED_COLOR = "#8a96a8";

const EXCLUDED_SCOREBOARD_MEMBER_IDS = new Set([
  "c5726102-b436-4557-ad88-ac148f349558",
]);

const EXCLUDED_SCOREBOARD_MEMBER_ROLES = new Set([
  "tech_lead",
  "project_manager",
]);

function getProjectTypeColor(projectTypeName: string): string {
  const existingProjectLabel = PROJECT_LABELS.find(
    (item) => item.label === projectTypeName,
  );

  if (existingProjectLabel) return existingProjectLabel.color;
  if (projectTypeName === "General") return "#8a96a8";

  const hash = Array.from(projectTypeName).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );

  return PROJECT_TYPE_FALLBACK_COLORS[hash % PROJECT_TYPE_FALLBACK_COLORS.length];
}

function getTaskProjectColor(index: number): string {
  return TASK_PROJECT_COLORS[index % TASK_PROJECT_COLORS.length];
}

function isProjectStoryPointTask(task: ScoreboardTaskRow): boolean {
  return task.sp_type === "planned" || task.sp_type === "adhoc";
}

function isCompletedList(listName: string): boolean {
  const normalizedListName = listName.trim().toLowerCase();

  return (
    normalizedListName !== "current sprint" &&
    normalizedListName !== "in development"
  );
}

function getMemberName(member: MemberRow): string {
  return (
    member.full_name ||
    [member.first_name, member.last_name].filter(Boolean).join(" ") ||
    "Unnamed member"
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function getMemberColor(member: MemberRow & { id: string }, fallbackName: string): string {
  if (fallbackName === "Unassigned") return UNASSIGNED_COLOR;

  const mockMemberName = member.trello_username
    ? MOCK_MEMBER_NAME_BY_TRELLO_USERNAME[member.trello_username]
    : undefined;
  const mockColor = mockMemberName
    ? MOCK_MEMBER_COLOR_BY_NAME.get(mockMemberName)
    : undefined;

  if (mockColor) return mockColor;

  const seed = member.id ?? fallbackName;
  const hash = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return ASSIGNEE_COLORS[hash % ASSIGNEE_COLORS.length];
}

function getCompletedRate(completed: number, planned: number): number {
  if (planned <= 0) return 0;

  return Math.min(Math.round((completed / planned) * 100), 100);
}

function getCompletionSummaryColor(percent: number): string {
  if (percent >= 100) return "#00d26a";
  if (percent >= 76) return "#14b8a6";
  if (percent >= 51) return "#2563eb";
  if (percent >= 26) return "#f5c842";

  return "#ff4757";
}

function getRateProgressColor(percent: number): string {
  if (percent >= 90) return "#00e5a0";
  if (percent >= 75) return "#14b8a6";
  if (percent >= 50) return "#f5c842";
  if (percent >= 25) return "#ff9f43";

  return "#ff4757";
}

export default function SprintScoreboard({
  equalTopColumnWidths = false,
  includeExcludedMembers = false,
  showPublicViewButton = true,
  showScrollLink = true,
  title,
  useDialCompletionChart = false,
  sprintId = "",
  sprintName = "",
  selectedMemberId = "",
}: SprintScoreboardProps) {
  const scoreboardRef = useRef<HTMLElement | null>(null);
  const copyToastTimeoutRef = useRef<number | null>(null);
  const [publicLinkCopied, setPublicLinkCopied] = useState(false);
  const [isDownloadingScoreboard, setIsDownloadingScoreboard] = useState(false);
  const [supabaseStoryPointTotals, setSupabaseStoryPointTotals] =
    useState<ScoreboardStoryPointTotals>({
      planned: selectedMemberId ? 0 : plannedStoryPoints,
      adhoc: selectedMemberId ? 0 : adhocStoryPoints,
      plannedTasks: selectedMemberId
        ? 0
        : sprintBoardTasks.filter((task) => !task.isAdhoc).length,
      adhocTasks: selectedMemberId
        ? 0
        : sprintBoardTasks.filter((task) => task.isAdhoc).length,
      completedTasks: 0,
    });
  const [projectStoryPointSegments, setProjectStoryPointSegments] = useState<
    ProjectStoryPointSegment[]
  >(selectedMemberId ? [] : initialProjectStoryPointSegments);
  const [taskProjectStoryPointSegments, setTaskProjectStoryPointSegments] =
    useState<ProjectStoryPointSegment[]>(
      selectedMemberId ? [] : initialProjectStoryPointSegments,
    );
  const [memberStoryPointCards, setMemberStoryPointCards] =
    useState<MemberStoryPointCard[]>([]);
  const [blockedCount, setBlockedCount] = useState(0);
  const [completedStoryPointTotal, setCompletedStoryPointTotal] = useState(0);
  const [resolvedSprintName, setResolvedSprintName] = useState(sprintName);
  const [selectedMemberName, setSelectedMemberName] = useState("");
  const scoreboardTitle =
    title ?? `${resolvedSprintName || sprintName || "Sprint"} Story Points`;
  const scoreboardHeading = selectedMemberId && selectedMemberName
    ? `Scoreboard: ${selectedMemberName}`
    : "Scoreboard";
  const displayedPlannedStoryPoints = supabaseStoryPointTotals.planned;
  const displayedAdhocStoryPoints = supabaseStoryPointTotals.adhoc;
  const displayedTotalBoardStoryPoints =
    displayedPlannedStoryPoints + displayedAdhocStoryPoints;
  const displayedPlannedTaskCount = supabaseStoryPointTotals.plannedTasks;
  const displayedAdhocTaskCount = supabaseStoryPointTotals.adhocTasks;
  const displayedTotalTaskCount =
    displayedPlannedTaskCount + displayedAdhocTaskCount;
  const displayedCompletedTaskCount = supabaseStoryPointTotals.completedTasks;
  const displayedCompletedBoardStoryPoints = Math.min(
    completedStoryPointTotal,
    displayedTotalBoardStoryPoints,
  );
  const displayedCompletedBoardRate = getCompletedRate(
    displayedCompletedBoardStoryPoints,
    displayedPlannedStoryPoints,
  );
  const displayedAverageMemberCompletionRate =
    memberStoryPointCards.length > 0
      ? Math.round(
          memberStoryPointCards.reduce(
            (sum, member) => sum + member.completedRate,
            0,
          ) / memberStoryPointCards.length,
        )
      : 0;
  const displayedCompletedBoardColor = getCompletionSummaryColor(
    displayedCompletedBoardRate,
  );
  const projectStoryPointChartSegments = projectStoryPointSegments.filter(
    (project) => project.storyPoints > 0,
  );
  const taskProjectStoryPointChartSegments = taskProjectStoryPointSegments.filter(
    (project) => project.storyPoints > 0,
  );
  const assigneeCompletionSegments = memberStoryPointCards
    .map((member) => {
      const total = member.plannedStoryPoints + member.adhocStoryPoints;
      const completed = Math.min(member.completedStoryPoints, total);
      const notDone = Math.max(total - completed, 0);
      const completedPercent =
        member.plannedStoryPoints > 0
          ? Math.min(
              Math.round((completed / member.plannedStoryPoints) * 100),
              100,
            )
          : 0;

      return {
        ...member,
        completed,
        notDone,
        total,
        completedPercent,
        label: member.name,
        labelColor: member.color,
        topLabel: `${completedPercent}%`,
        stacks: [
          {
            value: notDone,
            defaultColor: `${member.color}24`,
            highlightColor: `${member.color}38`,
            highlightBoxShadow: `0 0 16px ${member.color}22`,
            borderRadius: "5px 5px 0 0",
          },
          {
            value: completed,
            defaultColor: `${member.color}cc`,
            highlightColor: `linear-gradient(180deg,${member.color},${member.color}99)`,
            highlightBoxShadow: `0 0 18px ${member.color}55`,
          },
        ],
      };
    });
  const maxAssigneeCompletionTotal = Math.max(
    ...assigneeCompletionSegments.map((member) => member.total),
    4,
  );
  const assigneeCompletionGridStep = Math.max(
    1,
    Math.ceil(maxAssigneeCompletionTotal / 4),
  );
  const assigneeCompletionGridTicks = Array.from({ length: 5 }, (_, index) =>
    Math.min(index * assigneeCompletionGridStep, maxAssigneeCompletionTotal),
  ).filter((value, index, values) => values.indexOf(value) === index);
  const dialCompletedPoints = assigneeCompletionSegments.reduce(
    (sum, member) => sum + member.completed,
    0,
  );
  const dialTotalPoints = assigneeCompletionSegments.reduce(
    (sum, member) => sum + member.total,
    0,
  );
  const dialNotCompletedPoints = Math.max(dialTotalPoints - dialCompletedPoints, 0);
  const dialCompletionPercent =
    dialTotalPoints > 0
      ? Math.min(Math.round((dialCompletedPoints / dialTotalPoints) * 100), 100)
      : 0;
  const dialAccentColor = getCompletionSummaryColor(dialCompletionPercent);
  const dialCircumference = 2 * Math.PI * 72;
  const dialDashOffset =
    dialCircumference - (dialCompletionPercent / 100) * dialCircumference;

  useEffect(() => {
    return () => {
      if (copyToastTimeoutRef.current) {
        window.clearTimeout(copyToastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadStoryPointTotals() {
      try {
        const [currentSprint] = sprintId
          ? await getSupabaseRows<SprintRow>("sprints", {
              select: "id,name,blocked_count",
              eq: { id: sprintId },
              limit: 1,
            })
          : await getSupabaseRows<SprintRow>("sprints", {
              select: "id,name,blocked_count",
              eq: { is_current: 1 },
              limit: 1,
            });

        if (!currentSprint) {
          if (!cancelled) {
            setSupabaseStoryPointTotals({
              planned: 0,
              adhoc: 0,
              plannedTasks: 0,
              adhocTasks: 0,
              completedTasks: 0,
            });
            setProjectStoryPointSegments([]);
            setTaskProjectStoryPointSegments([]);
            setMemberStoryPointCards([]);
            setBlockedCount(0);
            setCompletedStoryPointTotal(0);
            setResolvedSprintName(sprintName);
            setSelectedMemberName("");
          }
          return;
        }

        const taskFilters: Record<string, string> = { sprint_id: currentSprint.id };
        const storyPointFilters: Record<string, string> = { sprint_id: currentSprint.id };

        if (selectedMemberId) {
          taskFilters.assigned_to = selectedMemberId;
          storyPointFilters.member_id = selectedMemberId;
        }

        const [tasks, projectTypes, members, storyPoints, sprintStoryPoints] = await Promise.all([
          getSupabaseRows<ScoreboardTaskRow>("tasks", {
            select: "story_points,real_story_points,sp_type,trello_list_name,project_type,project,assigned_to,is_completed",
            eq: taskFilters,
          }),
          getSupabaseRows<ProjectTypeRow>("project_type", {
            select: "id,name",
          }),
          getSupabaseRows<MemberRow>("members", {
            select: "id,trello_username,role,full_name,first_name,last_name",
          }),
          getSupabaseRows<StoryPointRow>("story_points", {
            select:
              "member_id,assigned_story_points,adhoc_story_points,completed_story_points",
            eq: storyPointFilters,
          }),
          getSupabaseRows<SprintStoryPointBreakdownRow>("sprint_story_points", {
            select: "model,model_id,real_points",
            eq: { sprint_id: currentSprint.id },
          }),
        ]);
        const currentSprintStoryPointTasks = tasks.filter(isProjectStoryPointTask);
        const totals = tasks.reduce<ScoreboardStoryPointTotals>(
          (sum, task) => {
            if (task.sp_type === "planned") {
              sum.planned += task.story_points;
              sum.plannedTasks += 1;
            }

            if (task.sp_type === "adhoc") {
              sum.adhoc += task.story_points;
              sum.adhocTasks += 1;
            }

            if (
              isProjectStoryPointTask(task) &&
              isCompletedList(task.trello_list_name ?? "")
            ) {
              sum.completedTasks += 1;
            }

            return sum;
          },
          {
            planned: 0,
            adhoc: 0,
            plannedTasks: 0,
            adhocTasks: 0,
            completedTasks: 0,
          },
        );
        const storyPointsByProjectTypeId = tasks.reduce<Map<string, number>>(
          (sum, task) => {
            if (isProjectStoryPointTask(task) && task.project_type) {
              sum.set(
                task.project_type,
                (sum.get(task.project_type) ?? 0) + task.story_points,
              );
            }

            return sum;
          },
          new Map(),
        );
        const projectSegments = projectTypes
          .map((projectType) => {
            const storyPoints = storyPointsByProjectTypeId.get(projectType.id) ?? 0;

            return {
              label: projectType.name,
              color: getProjectTypeColor(projectType.name),
              storyPoints,
              value: storyPoints,
            };
          })
          .filter((projectType) => !selectedMemberId || projectType.storyPoints > 0);
        const taskCountByTaskProject = currentSprintStoryPointTasks.reduce<Map<string, number>>(
          (sum, task) => {
            const projectName = task.project?.trim() || "General";
            sum.set(projectName, (sum.get(projectName) ?? 0) + 1);

            return sum;
          },
          new Map(),
        );
        const taskProjectSegments = Array.from(taskCountByTaskProject.entries())
          .sort(([projectNameA, taskCountA], [projectNameB, taskCountB]) => {
            if (taskCountB !== taskCountA) return taskCountB - taskCountA;
            return projectNameA.localeCompare(projectNameB);
          })
          .map(([projectName, taskCount], index) => ({
            label: projectName,
            color: getTaskProjectColor(index),
            storyPoints: taskCount,
            value: taskCount,
          }));
        const storyPointsByMemberId = new Map(
          storyPoints.map((storyPoint) => [storyPoint.member_id, storyPoint]),
        );
        const selectedMember = selectedMemberId
          ? members.find((member) => member.id === selectedMemberId)
          : null;
        const completedStoryPointsByMemberId = sprintStoryPoints.reduce<Map<string, number>>(
          (sum, row) => {
            if (row.model !== "member") return sum;
            if (selectedMemberId && row.model_id !== selectedMemberId) return sum;

            sum.set(row.model_id, (sum.get(row.model_id) ?? 0) + (row.real_points ?? 0));
            return sum;
          },
          new Map(),
        );
        const sprintCompletedStoryPoints = selectedMemberId
          ? completedStoryPointsByMemberId.get(selectedMemberId) ?? 0
          : sprintStoryPoints.reduce(
              (sum, row) =>
                row.model === "sprint" ? sum + (row.real_points ?? 0) : sum,
              0,
            );
        const memberCards = members
          .filter(
            (member): member is MemberRow & { id: string } =>
              Boolean(member.id) &&
              (!selectedMemberId || member.id === selectedMemberId) &&
              (includeExcludedMembers ||
                (!EXCLUDED_SCOREBOARD_MEMBER_IDS.has(member.id as string) &&
                  !EXCLUDED_SCOREBOARD_MEMBER_ROLES.has(
                    member.role?.trim().toLowerCase() ?? "",
                  ))),
          )
          .map((member) => {
            const memberName = getMemberName(member);
            const storyPoint = storyPointsByMemberId.get(member.id);
            const plannedPoints = storyPoint?.assigned_story_points ?? 0;
            const completedPoints = completedStoryPointsByMemberId.get(member.id) ?? 0;

            return {
              id: member.id,
              name: memberName,
              initials: getInitials(memberName),
              color: getMemberColor(member, memberName),
              plannedStoryPoints: plannedPoints,
              adhocStoryPoints: storyPoint?.adhoc_story_points ?? 0,
              completedStoryPoints: completedPoints,
              completedRate: getCompletedRate(completedPoints, plannedPoints),
            };
          });

        if (!cancelled) {
          setSupabaseStoryPointTotals(totals);
          setProjectStoryPointSegments(projectSegments);
          setTaskProjectStoryPointSegments(taskProjectSegments);
          setMemberStoryPointCards(memberCards);
          setCompletedStoryPointTotal(sprintCompletedStoryPoints);
          setResolvedSprintName(currentSprint.name?.trim() || sprintName);
          setSelectedMemberName(selectedMember ? getMemberName(selectedMember) : "");
          setBlockedCount(
            selectedMemberId
              ? tasks.filter((task) => task.sp_type === "blocked").length
              : currentSprint.blocked_count ?? 0,
          );
        }
      } catch {
        if (!cancelled) {
          setSupabaseStoryPointTotals({
            planned: selectedMemberId ? 0 : plannedStoryPoints,
            adhoc: selectedMemberId ? 0 : adhocStoryPoints,
            plannedTasks: selectedMemberId
              ? 0
              : sprintBoardTasks.filter((task) => !task.isAdhoc).length,
            adhocTasks: selectedMemberId
              ? 0
              : sprintBoardTasks.filter((task) => task.isAdhoc).length,
            completedTasks: 0,
          });
          setProjectStoryPointSegments(
            selectedMemberId ? [] : initialProjectStoryPointSegments,
          );
          setTaskProjectStoryPointSegments(
            selectedMemberId ? [] : initialProjectStoryPointSegments,
          );
          setMemberStoryPointCards([]);
          setBlockedCount(0);
          setCompletedStoryPointTotal(0);
          setResolvedSprintName(sprintName);
          setSelectedMemberName("");
        }
      }
    }

    void loadStoryPointTotals();

    return () => {
      cancelled = true;
    };
  }, [includeExcludedMembers, selectedMemberId, sprintId, sprintName]);

  const scrollToScoreboard = () => {
    const target = scoreboardRef.current;
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const downloadScoreboardPdf = async () => {
    const target = scoreboardRef.current;
    if (!target || isDownloadingScoreboard) return;

    setIsDownloadingScoreboard(true);

    try {
      const canvas = await html2canvas(target, {
        backgroundColor: "#060d1f",
        ignoreElements: (element) =>
          element.classList.contains("sprint-scoreboard-header-action"),
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
      });
      const imageData = canvas.toDataURL("image/png");
      const bounds = target.getBoundingClientRect();
      const padding = 24;
      const imageWidth = Math.max(bounds.width, 1);
      const imageHeight = Math.max(bounds.height, 1);
      const pageWidth = imageWidth + padding * 2;
      const pageHeight = imageHeight + padding * 2;
      const pdf = new jsPDF({
        orientation: pageWidth >= pageHeight ? "landscape" : "portrait",
        unit: "px",
        format: [pageWidth, pageHeight],
      });

      pdf.addImage(imageData, "PNG", padding, padding, imageWidth, imageHeight);

      const dateStamp = new Date().toISOString().slice(0, 10);
      pdf.save(`sprint-scoreboard-${dateStamp}.pdf`);
    } finally {
      setIsDownloadingScoreboard(false);
    }
  };

  const getPublicScoreboardUrl = () =>
    {
      const url = new URL("/public/current-sprint-scoreboard", window.location.origin);

      if (sprintId) url.searchParams.set("sprintId", sprintId);
      if (resolvedSprintName || sprintName) {
        url.searchParams.set("sprintName", resolvedSprintName || sprintName);
      }

      return url.toString();
    };

  const openPublicScoreboardPage = () => {
    window.open(getPublicScoreboardUrl(), "_blank", "noopener,noreferrer");
  };

  const copyPublicScoreboardLink = async () => {
    const publicUrl = getPublicScoreboardUrl();

    try {
      await navigator.clipboard.writeText(publicUrl);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = publicUrl;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setPublicLinkCopied(true);
    if (copyToastTimeoutRef.current) {
      window.clearTimeout(copyToastTimeoutRef.current);
    }
    copyToastTimeoutRef.current = window.setTimeout(() => {
      setPublicLinkCopied(false);
      copyToastTimeoutRef.current = null;
    }, 2200);
  };

  const renderStoryPointDoughnutCard = ({
    title,
    segments,
    chartSegments,
    gradientIdPrefix,
    totalValue = displayedTotalBoardStoryPoints,
    totalLabel = "TOTAL SP",
    unitLabel = "SP",
  }: {
    title: string;
    segments: ProjectStoryPointSegment[];
    chartSegments: ProjectStoryPointSegment[];
    gradientIdPrefix: string;
    totalValue?: number;
    totalLabel?: string;
    unitLabel?: string;
  }) => (
    <div
      className="sprint-project-chart-card"
      style={{
        padding: 11,
        borderRadius: 13,
        border: "1px solid rgba(167,139,250,0.24)",
        background:
          "linear-gradient(135deg, rgba(167,139,250,0.12), rgba(0,200,255,0.06), rgba(6,13,31,0.46))",
        boxShadow: "0 0 24px rgba(167,139,250,0.1)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          color: "rgba(100,180,255,0.55)",
          fontFamily: "'DM Mono', monospace",
          fontSize: 9,
          fontWeight: 900,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <DoughnutChart
        segments={chartSegments}
        geometry={{
          cx: 120,
          cy: 120,
          outerR: 102,
          innerR: 58,
          gap: 2.5,
        }}
        gradientIdPrefix={gradientIdPrefix}
        maxWidth="clamp(280px, 34vw, 380px)"
        popOffset={4}
        renderCenter={({ hovered, cx, cy }) => {
          const active = hovered ?? null;
          const activeValue = active?.storyPoints ?? totalValue;
          const activePercent =
            totalValue > 0
              ? Math.round((activeValue / totalValue) * 100)
              : 0;

          return (
            <>
              <text
                x={cx}
                y={cy - 8}
                textAnchor="middle"
                fill={active?.color ?? "#00e5a0"}
                fontFamily="'DM Mono', monospace"
                fontSize="28"
                fontWeight="900"
              >
                {activeValue}
              </text>
              <text
                x={cx}
                y={cy + 10}
                textAnchor="middle"
                fill="rgba(160,210,255,0.66)"
                fontFamily="'DM Mono', monospace"
                fontSize="10"
                fontWeight="900"
              >
                {active ? `${activePercent}%` : totalLabel}
              </text>
            </>
          );
        }}
        renderLegend={({ segments: builtSegments, hov, setHov }) => {
          const chartSegmentByLabel = new Map(
            builtSegments.map((project) => [project.label, project]),
          );

          return (
            <div
              style={{
                flex: "1 1 260px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                minWidth: 0,
              }}
            >
              {segments.map((project) => {
                const chartSegment = chartSegmentByLabel.get(project.label);
                const percent =
                  totalValue > 0
                    ? Math.round(
                        (project.storyPoints / totalValue) * 100,
                      )
                    : 0;
                const isActive = chartSegment ? hov === chartSegment.i : false;

                return (
                  <button
                    className="project-score-legend-item"
                    key={project.label}
                    type="button"
                    onMouseEnter={() => setHov(chartSegment?.i ?? null)}
                    onMouseLeave={() => setHov(null)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto minmax(0, 1fr) auto",
                      alignItems: "center",
                      gap: 7,
                      padding: "5px 7px",
                      borderRadius: 10,
                      border: `1px solid ${
                        isActive ? project.color : "rgba(100,180,255,0.08)"
                      }`,
                      background: isActive
                        ? `${project.color}16`
                        : "rgba(255,255,255,0.025)",
                      cursor: chartSegment ? "pointer" : "default",
                      opacity: project.storyPoints > 0 ? 1 : 0.62,
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: project.color,
                        boxShadow:
                          project.storyPoints > 0
                            ? `0 0 8px ${project.color}88`
                            : "none",
                      }}
                    />
                    <span
                      style={{
                        color: "rgba(220,238,255,0.82)",
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 10,
                        fontWeight: 800,
                        lineHeight: 1.15,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {project.label}
                    </span>
                    <span
                      className="project-score-legend-value"
                      style={{
                        color: project.color,
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 11,
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {project.storyPoints} {unitLabel} · {percent}%
                    </span>
                  </button>
                );
              })}
            </div>
          );
        }}
      />
    </div>
  );

  return (
    <>
      {showScrollLink ? (
        <a
          href="#sprint-scoreboard"
          onClick={(event) => {
            event.preventDefault();
            scrollToScoreboard();
          }}
          aria-label="Scroll to scoreboard section"
          style={{
            flexShrink: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
            alignSelf: "center",
            marginTop: 4,
            padding: "7px 4px",
            color: "#00c8ff",
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            textDecoration: "none",
            textShadow: "0 0 16px rgba(0,200,255,0.35)",
            transition: "transform 0.2s ease, color 0.2s ease, text-shadow 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(1px)";
            e.currentTarget.style.color = "#00e5a0";
            e.currentTarget.style.textShadow = "0 0 18px rgba(0,229,160,0.45)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.color = "#00c8ff";
            e.currentTarget.style.textShadow = "0 0 16px rgba(0,200,255,0.35)";
          }}
        >
          <span>Scoreboard below</span>
          <span
            style={{
              color: "#00e5a0",
              display: "inline-block",
            }}
          >
            ↓
          </span>
        </a>
      ) : null}

      {publicLinkCopied ? (
        <div
          aria-live="polite"
          className="sprint-scoreboard-copy-toast"
          role="status"
        >
          <span aria-hidden="true">✓</span>
          Public scoreboard URL copied
        </div>
      ) : null}

      <section
        className="sprint-scoreboard"
        id="sprint-scoreboard"
        ref={scoreboardRef}
        style={{
          flexShrink: 0,
          scrollMarginTop: 12,
          marginTop: 10,
          marginBottom: 0,
          borderRadius: 16,
          border: "1px solid rgba(100,180,255,0.1)",
          background: "rgba(255,255,255,0.025)",
          padding: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
        <div style={{ textAlign: "left" }}>
          <div
            style={{
              fontSize: 10,
              fontFamily: "'DM Mono', monospace",
              color: "rgba(100,180,255,0.55)",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              fontWeight: 800,
              marginBottom: 2,
              textAlign: "left",
            }}
          >
            {scoreboardTitle}
          </div>
          <h3
            style={{
              margin: 0,
              color: "#e8f4ff",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 16,
              fontWeight: 800,
              textAlign: "left",
            }}
          >
            {scoreboardHeading}
          </h3>
        </div>
        <div className="sprint-scoreboard-header-actions">
          {showPublicViewButton ? (
            <button
              aria-label="Open public scoreboard page"
              className="sprint-scoreboard-header-action sprint-scoreboard-open-public"
              onClick={openPublicScoreboardPage}
              title="Open public scoreboard page"
              type="button"
            >
              <svg
                aria-hidden="true"
                fill="none"
                height="18"
                viewBox="0 0 24 24"
                width="18"
              >
                <path
                  d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
                <path
                  d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </button>
          ) : null}
          {showPublicViewButton ? (
            <button
              aria-label={
                publicLinkCopied
                  ? "Public scoreboard link copied"
                  : "Copy public scoreboard link"
              }
              className="sprint-scoreboard-header-action sprint-scoreboard-copy-public"
              onClick={() => {
                void copyPublicScoreboardLink();
              }}
              title={
                publicLinkCopied
                  ? "Public scoreboard link copied"
                  : "Copy public scoreboard link"
              }
              type="button"
            >
              {publicLinkCopied ? (
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="18"
                  viewBox="0 0 24 24"
                  width="18"
                >
                  <path
                    d="m5 12 4 4L19 6"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.3"
                  />
                </svg>
              ) : (
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="18"
                  viewBox="0 0 24 24"
                  width="18"
                >
                  <path
                    d="M9 9h9a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V9Z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                  <path
                    d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              )}
            </button>
          ) : null}
          <button
            aria-label="Download scoreboard as PDF"
            className="sprint-scoreboard-header-action sprint-scoreboard-download"
            disabled={isDownloadingScoreboard}
            onClick={() => {
              void downloadScoreboardPdf();
            }}
            title="Download scoreboard as PDF"
            type="button"
          >
            {isDownloadingScoreboard ? (
              <span className="sprint-action-loader" aria-hidden="true" />
            ) : (
              <svg
                aria-hidden="true"
                fill="none"
                height="18"
                viewBox="0 0 24 24"
                width="18"
              >
                <path
                  d="M12 3v11m0 0 4-4m-4 4-4-4"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
                <path
                  d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          className="sprint-scoreboard-top"
          style={{
            display: "grid",
            gridTemplateColumns: equalTopColumnWidths
              ? "repeat(2, minmax(0, 1fr))"
              : "minmax(260px, 0.75fr) minmax(420px, 1.35fr)",
            gap: 10,
          }}
        >
          <div
            className="sprint-total-card"
            style={{
              padding: 11,
              borderRadius: 13,
              border: "1px solid rgba(0,200,255,0.28)",
              background:
                "linear-gradient(135deg, rgba(0,200,255,0.12), rgba(0,229,160,0.06), rgba(6,13,31,0.46))",
              boxShadow: "0 0 24px rgba(0,200,255,0.12)",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              minHeight: 0,
            }}
          >
            <div
              className="sprint-total-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gridAutoRows: "minmax(128px, 1fr)",
                gap: 8,
                flex: 1,
                minHeight: 0,
              }}
            >
              {[
                {
                  label: "Planned",
                  value: displayedPlannedStoryPoints,
                  color: "#00c8ff",
                  footer:
                    displayedTotalBoardStoryPoints > 0
                      ? `${Math.round(
                          (displayedPlannedStoryPoints /
                            displayedTotalBoardStoryPoints) *
                            100,
                        )}% of total`
                      : "0% of total",
                },
                {
                  label: "Adhoc",
                  value: displayedAdhocStoryPoints,
                  color: "#ff9f43",
                  taskCount: displayedAdhocTaskCount,
                  footer:
                    displayedTotalBoardStoryPoints > 0
                      ? `${Math.round(
                          (displayedAdhocStoryPoints /
                            displayedTotalBoardStoryPoints) *
                            100,
                        )}% of total`
                      : "0% of total",
                },
                {
                  label: "SP Total",
                  value: displayedTotalBoardStoryPoints,
                  color: "#00e5a0",
                  taskCount: displayedTotalTaskCount,
                  footer: "planned + adhoc",
                  blockedCount,
                },
                {
                  label: "Completed",
                  value: displayedCompletedBoardStoryPoints,
                  color: displayedCompletedBoardColor,
                  taskCount: displayedCompletedTaskCount,
                  footer: "",
                  percent: displayedCompletedBoardRate,
                },
              ].map((item) => {
                const { label, value, color, footer, percent, taskCount, blockedCount: itemBlockedCount } = item;
                const labelText = label as string;
                const storyPoints = value as number;
                const accentColor = color as string;
                const isCompleted = labelText === "Completed";
                const isPlanned = labelText === "Planned";
                const hasTaskCount = typeof taskCount === "number";
                const isSpTotal = labelText === "SP Total";

                return (
                  <div
                    className="sprint-total-block"
                    key={labelText}
                    style={{
                      padding: "11px 12px",
                      borderRadius: 14,
                      background: `linear-gradient(135deg, ${accentColor}24, ${accentColor}10)`,
                      border: `1px solid ${accentColor}66`,
                      boxShadow: `0 0 22px ${accentColor}1f, inset 0 0 0 1px rgba(255,255,255,0.04)`,
                      color: accentColor,
                      transform: "none",
                      alignSelf: "stretch",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      minHeight: 0,
                    }}
                  >
                    <div
                      style={{
                        color: "rgba(232,244,255,0.82)",
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 9,
                        fontWeight: 900,
                        textTransform: "uppercase",
                        marginBottom: 4,
                      }}
                    >
                      {labelText}
                    </div>
                    <div
                      style={{
                        color: accentColor,
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 32,
                        fontWeight: 900,
                        letterSpacing: "-0.09em",
                        lineHeight: 0.9,
                        textShadow: `0 0 14px ${accentColor}55`,
                      }}
                    >
                      {isCompleted ? (
                        <>
                          {percent}
                          <span
                            style={{
                              color: "rgba(160,210,255,0.68)",
                              fontSize: 16,
                              marginLeft: 6,
                              letterSpacing: 0,
                            }}
                          >
                            %
                          </span>
                          <span
                            style={{
                              display: "block",
                              color: "rgba(160,210,255,0.68)",
                              fontSize: 12,
                              letterSpacing: 0,
                              marginTop: 6,
                              textShadow: "none",
                            }}
                          >
                            Avg {displayedAverageMemberCompletionRate}%
                          </span>
                        </>
                      ) : (
                        <>
                          {storyPoints}
                          <span
                            style={{
                              color: "rgba(160,210,255,0.6)",
                              fontSize: 9,
                              marginLeft: 4,
                              letterSpacing: 0,
                            }}
                          >
                            SP
                          </span>
                        </>
                      )}
                    </div>
                    {isPlanned ||
                    (hasTaskCount && (labelText === "Adhoc" || isSpTotal || isCompleted)) ? (
                      <div
                        style={{
                          marginTop: 6,
                          color: "rgba(160,210,255,0.68)",
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 10,
                          fontWeight: 900,
                          letterSpacing: "0.02em",
                          textTransform: "uppercase",
                        }}
                      >
                        {(isPlanned ? displayedPlannedTaskCount : taskCount) ?? 0} TASKS
                      </div>
                    ) : null}
                    {isCompleted ? (
                      <div
                        style={{
                          marginTop: 4,
                          color: accentColor,
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 9,
                          fontWeight: 900,
                          textTransform: "uppercase",
                        }}
                      >
                        {displayedCompletedBoardStoryPoints} SP COMPLETED
                      </div>
                    ) : null}
                    {footer ? (
                      <div
                        style={{
                          marginTop: 4,
                          color: isCompleted ? accentColor : "rgba(160,210,255,0.55)",
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 9,
                          fontWeight: 800,
                        }}
                      >
                        {footer}
                      </div>
                    ) : null}
                    {isSpTotal && typeof itemBlockedCount === "number" ? (
                      <div
                        style={{
                          marginTop: 4,
                          color: itemBlockedCount > 0 ? "#ff4757" : "#00e5a0",
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 9,
                          fontWeight: 900,
                          textTransform: "uppercase",
                        }}
                      >
                        Blocked: {itemBlockedCount}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="sprint-assignee-completion-card"
            style={{
              padding: 11,
              borderRadius: 13,
              border: "1px solid rgba(0,229,160,0.22)",
              background:
                "linear-gradient(135deg, rgba(0,229,160,0.1), rgba(0,200,255,0.06), rgba(6,13,31,0.46))",
              boxShadow: "0 0 24px rgba(0,229,160,0.1)",
              minWidth: 0,
            }}
          >
            <div
              style={{
                color: "rgba(100,180,255,0.55)",
                fontFamily: "'DM Mono', monospace",
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Assignee Completed vs Not Completed
            </div>
            <div
              style={{
                margin: "8px 6px 0",
                padding: "8px 8px 6px",
                borderRadius: 11,
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(100,180,255,0.08)",
              }}
            >
              {useDialCompletionChart ? (
                <div
                  style={{
                    alignItems: "center",
                    display: "grid",
                    gap: 14,
                    gridTemplateColumns: "minmax(180px, 0.9fr) minmax(0, 1.1fr)",
                    minHeight: 302,
                  }}
                >
                  <div
                    style={{
                      alignItems: "center",
                      display: "flex",
                      justifyContent: "center",
                      minWidth: 0,
                    }}
                  >
                    <svg
                      aria-label={`Completion dial ${dialCompletionPercent}%`}
                      role="img"
                      style={{ maxWidth: "100%", overflow: "visible" }}
                      viewBox="0 0 190 190"
                      width="220"
                    >
                      <defs>
                        <filter id="completion-dial-glow" x="-40%" y="-40%" width="180%" height="180%">
                          <feGaussianBlur stdDeviation="4" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <circle
                        cx="95"
                        cy="95"
                        fill="rgba(255,255,255,0.025)"
                        r="78"
                        stroke="rgba(160,210,255,0.12)"
                        strokeWidth="10"
                      />
                      <circle
                        cx="95"
                        cy="95"
                        fill="none"
                        r="72"
                        stroke="rgba(160,210,255,0.14)"
                        strokeLinecap="round"
                        strokeWidth="13"
                      />
                      <circle
                        cx="95"
                        cy="95"
                        fill="none"
                        filter="url(#completion-dial-glow)"
                        r="72"
                        stroke={dialAccentColor}
                        strokeDasharray={dialCircumference}
                        strokeDashoffset={dialDashOffset}
                        strokeLinecap="round"
                        strokeWidth="13"
                        style={{
                          transform: "rotate(-90deg)",
                          transformOrigin: "95px 95px",
                          transition: "stroke-dashoffset 0.35s ease",
                        }}
                      />
                      <text
                        fill={dialAccentColor}
                        fontFamily="'DM Mono', monospace"
                        fontSize="34"
                        fontWeight="900"
                        textAnchor="middle"
                        x="95"
                        y="91"
                      >
                        {dialCompletionPercent}%
                      </text>
                      <text
                        fill="rgba(160,210,255,0.68)"
                        fontFamily="'DM Mono', monospace"
                        fontSize="10"
                        fontWeight="900"
                        letterSpacing="1"
                        textAnchor="middle"
                        x="95"
                        y="113"
                      >
                        COMPLETED
                      </text>
                    </svg>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      minWidth: 0,
                    }}
                  >
                    {[
                      {
                        label: "Completed",
                        value: `${dialCompletedPoints} SP`,
                        color: dialAccentColor,
                      },
                      {
                        label: "Not Completed",
                        value: `${dialNotCompletedPoints} SP`,
                        color: "rgba(160,210,255,0.68)",
                      },
                      {
                        label: "Total Assigned",
                        value: `${dialTotalPoints} SP`,
                        color: "#00c8ff",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        style={{
                          border: `1px solid ${item.color}44`,
                          borderRadius: 12,
                          background: `linear-gradient(135deg, ${item.color}1f, rgba(255,255,255,0.025))`,
                          padding: "10px 12px",
                        }}
                      >
                        <div
                          style={{
                            color: "rgba(160,210,255,0.6)",
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 9,
                            fontWeight: 900,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                          }}
                        >
                          {item.label}
                        </div>
                        <div
                          style={{
                            color: item.color,
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 22,
                            fontWeight: 900,
                            marginTop: 4,
                          }}
                        >
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <StackedColumnChart
                  segments={assigneeCompletionSegments}
                  max={maxAssigneeCompletionTotal}
                  barAreaHeight={280}
                  gap={10}
                  gridTicks={assigneeCompletionGridTicks}
                  legend={[
                    {
                      color: Chart.completed,
                      label: "Completed portion uses assignee color",
                    },
                    {
                      color: Chart.remaining,
                      label: "Remaining uses muted assignee color",
                    },
                  ]}
                  renderTooltip={(member) => (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 290,
                      background: Background.tooltip,
                      border: `1px solid ${Border.tooltip}`,
                      borderRadius: 8,
                      padding: "8px 12px",
                      zIndex: 10,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: member.color,
                        fontFamily: "'DM Sans', sans-serif",
                        marginBottom: 4,
                        fontWeight: 800,
                      }}
                    >
                      {member.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: member.color,
                        fontFamily: "'DM Mono', monospace",
                        fontWeight: 700,
                      }}
                    >
                      Completed: {member.completed} SP
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#00e5a0",
                        fontFamily: "'DM Mono', monospace",
                        fontWeight: 800,
                      }}
                    >
                      Completion: {member.completedPercent}%
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: `${member.color}99`,
                        fontFamily: "'DM Mono', monospace",
                        fontWeight: 700,
                      }}
                    >
                      Not Completed: {member.notDone} SP
                    </div>
                  </div>
                  )}
                />
              )}
            </div>
          </div>

          <div
            className="sprint-project-chart-row"
            style={{
              gridColumn: "1 / -1",
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 10,
              minWidth: 0,
            }}
          >
            <div
              className="sprint-project-chart-card"
              style={{
                padding: 11,
                borderRadius: 13,
                border: "1px solid rgba(167,139,250,0.24)",
                background:
                  "linear-gradient(135deg, rgba(167,139,250,0.12), rgba(0,200,255,0.06), rgba(6,13,31,0.46))",
                boxShadow: "0 0 24px rgba(167,139,250,0.1)",
                minWidth: 0,
              }}
            >
            <div
              style={{
                color: "rgba(100,180,255,0.55)",
                fontFamily: "'DM Mono', monospace",
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Story Points Breakdown
            </div>
            <DoughnutChart
              segments={projectStoryPointChartSegments}
              geometry={{
                cx: 120,
                cy: 120,
                outerR: 102,
                innerR: 58,
                gap: 2.5,
              }}
              gradientIdPrefix="project-sp"
              maxWidth="clamp(280px, 34vw, 380px)"
              popOffset={4}
              renderCenter={({ hovered, cx, cy }) => {
                const active = hovered ?? null;
                const activeValue =
                  active?.storyPoints ?? displayedTotalBoardStoryPoints;
                const activePercent =
                  displayedTotalBoardStoryPoints > 0
                    ? Math.round((activeValue / displayedTotalBoardStoryPoints) * 100)
                    : 0;

                return (
                  <>
                    <text
                      x={cx}
                      y={cy - 8}
                      textAnchor="middle"
                      fill={active?.color ?? "#00e5a0"}
                      fontFamily="'DM Mono', monospace"
                      fontSize="28"
                      fontWeight="900"
                    >
                      {activeValue}
                    </text>
                    <text
                      x={cx}
                      y={cy + 10}
                      textAnchor="middle"
                      fill="rgba(160,210,255,0.66)"
                      fontFamily="'DM Mono', monospace"
                      fontSize="10"
                      fontWeight="900"
                    >
                      {active ? `${activePercent}%` : "TOTAL SP"}
                    </text>
                  </>
                );
              }}
              renderLegend={({ segments, hov, setHov }) => {
                const chartSegmentByLabel = new Map(
                  segments.map((project) => [project.label, project]),
                );

                return (
                <div
                  style={{
                    flex: "1 1 260px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  {projectStoryPointSegments.map((project) => {
                    const chartSegment = chartSegmentByLabel.get(project.label);
                    const percent =
                      displayedTotalBoardStoryPoints > 0
                        ? Math.round(
                            (project.storyPoints / displayedTotalBoardStoryPoints) *
                              100,
                          )
                        : 0;
                    const isActive = chartSegment ? hov === chartSegment.i : false;

                    return (
                      <button
                        className="project-score-legend-item"
                        key={project.label}
                        type="button"
                        onMouseEnter={() => setHov(chartSegment?.i ?? null)}
                        onMouseLeave={() => setHov(null)}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "auto minmax(0, 1fr) auto",
                          alignItems: "center",
                          gap: 7,
                          padding: "5px 7px",
                          borderRadius: 10,
                          border: `1px solid ${
                            isActive ? project.color : "rgba(100,180,255,0.08)"
                          }`,
                          background: isActive
                            ? `${project.color}16`
                            : "rgba(255,255,255,0.025)",
                          cursor: chartSegment ? "pointer" : "default",
                          opacity: project.storyPoints > 0 ? 1 : 0.62,
                          textAlign: "left",
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: project.color,
                            boxShadow:
                              project.storyPoints > 0
                                ? `0 0 8px ${project.color}88`
                                : "none",
                          }}
                        />
                        <span
                          style={{
                            color: "rgba(220,238,255,0.82)",
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: 10,
                            fontWeight: 800,
                            lineHeight: 1.15,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {project.label}
                        </span>
                        <span
                          className="project-score-legend-value"
                          style={{
                            color: project.color,
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 11,
                            fontWeight: 900,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {project.storyPoints} SP · {percent}%
                        </span>
                      </button>
                    );
                  })}
                </div>
                );
              }}
            />
            </div>

            {renderStoryPointDoughnutCard({
              title: "Story Points By Project",
              segments: taskProjectStoryPointSegments,
              chartSegments: taskProjectStoryPointChartSegments,
              gradientIdPrefix: "task-project-sp",
              totalValue: displayedTotalTaskCount,
              totalLabel: "TOTAL TASKS",
              unitLabel: "TASKS",
            })}
          </div>
        </div>

        <div
          className="sprint-assignee-grid"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${memberStoryPointCards.length}, minmax(0, 1fr))`,
            gap: 8,
            overflowX: "auto",
            paddingBottom: 2,
          }}
        >
          {memberStoryPointCards.map((member) => (
            <div
              className="sprint-assignee-card"
              key={member.id}
              style={{
                flex: "1 1 150px",
                minWidth: 0,
                padding: 9,
                borderRadius: 13,
                border: `1px solid ${member.color}33`,
                background: `linear-gradient(135deg, ${member.color}14, rgba(6,13,31,0.48))`,
                boxShadow: `0 0 18px ${member.color}12`,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 7,
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: member.color,
                    color: "#060d1f",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 10,
                    fontWeight: 900,
                    boxShadow: `0 0 12px ${member.color}66`,
                    flexShrink: 0,
                  }}
                >
                  {member.initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: "rgba(230,245,255,0.92)",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 11,
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {member.name}
                  </div>
                  <div
                    style={{
                      color: "rgba(140,185,230,0.65)",
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 8,
                      fontWeight: 800,
                    }}
                  >
                    Story points
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 8,
                    width: "100%",
                    flex: 1,
                  }}
                >
                  {[
                    ["Planned", member.plannedStoryPoints, "#00c8ff", "SP"],
                    ["Adhoc", member.adhocStoryPoints, "#ff9f43", "SP"],
                    ["Completed", member.completedStoryPoints, "#00e5a0", "SP"],
                    ["Rate", member.completedRate, "#00e5a0", "%"],
                  ].map(([label, value, color, unit]) => {
                    const labelText = label as string;
                    const metricValue = value as number;
                    const accentColor = labelText === "Rate"
                      ? getRateProgressColor(metricValue)
                      : color as string;
                    const metricUnit = unit as string;

                    return (
                      <div
                        className="sprint-assignee-metric-box"
                        key={labelText}
                        style={{
                          padding: "6px 7px",
                          borderRadius: 10,
                          background: `${accentColor}10`,
                          border: `1px solid ${accentColor}33`,
                          color: accentColor,
                          minHeight: 58,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                        }}
                      >
                        <div
                          style={{
                            color: "rgba(160,210,255,0.62)",
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 8,
                            fontWeight: 900,
                            textTransform: "uppercase",
                            marginBottom: 3,
                          }}
                        >
                          {labelText}
                        </div>
                        <div
                          style={{
                            color: accentColor,
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 18,
                            fontWeight: 900,
                            letterSpacing: "-0.05em",
                            lineHeight: 1,
                          }}
                        >
                          {metricValue}
                          <span
                            style={{
                              color: "rgba(160,210,255,0.55)",
                              fontSize: 9,
                              marginLeft: 3,
                              letterSpacing: 0,
                            }}
                          >
                            {metricUnit}
                          </span>
                        </div>
                        {labelText === "Rate" && (
                          <div
                            style={{
                              height: 3,
                              background: "rgba(255,255,255,0.07)",
                              borderRadius: 99,
                              overflow: "hidden",
                              marginTop: 5,
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.min(metricValue, 100)}%`,
                                background: accentColor,
                                borderRadius: 99,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
        </div>
      </section>
    </>
  );
}
