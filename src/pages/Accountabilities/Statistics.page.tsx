import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { DropArrow, StyledSelect } from "@/components/shared/Elements";
import { PageAiSummary } from "@/components/shared/PageAiSummary";
import SprintGroupedSelect from "@/components/scrum/sprint/SprintGroupedSelect";
import { StoryPointsHoursLineChart, PerformanceScoresBySprintLineChart, SkillRadarPanel, TeamContributionDoughnut, getTeamContributionMemberColor, GradeDial, PERFORMANCE_GRADE_COLORS, type PerformanceScoresBySprintPoint, type TeamContributionSegment } from "@/components/dashboard";
import { getSupabaseRows, getSupabaseSession } from "@/lib/supabase";
import { Palette, chartLabelStyle } from "@/lib/theme";
import { sanitizeHtml2CanvasClone } from "@/lib/utils/html2canvas.utils";
import {
  isScoreboardIncludedMember,
  isScoreboardIncludedMemberRole,
  sortMembersByLastName,
} from "@/lib/utils/scrum/scoreboardMembers.utils";
import {
  getAvailableSprintYearMonths,
  getAvailableSprintYearQuarters,
  getAvailableSprintYears,
  getSprintListingMonth,
  getSprintListingQuarter,
  getSprintListingSortTimestamp,
  getSprintListingYear,
  getSprintMonthShortLabel,
} from "@/lib/utils/scrum/sprintListing.utils";
import {
  evaluateMemberPerformanceForYear,
  resolvePerformanceScoreGrade,
  type EvaluateYearResult,
  type PerformanceScoreGrade,
} from "@/lib/utils/scrum/evaluateMemberPerformance.utils";
import {
  buildLocalMetricsSummary,
  buildMetricsSummaryPrompt,
  getMetricsSummarySnapshotKey,
  type MetricsSummarySnapshot,
} from "@/lib/utils/scrum/metricsSummary.utils";
import {
  buildSkillRadarValues,
  DEFAULT_SKILL_CHART_SCALE,
  EMPTY_SKILL_RADAR_VALUES,
  getSkillChartTicks,
  isSkillValuePassing,
  normalizeSkillRadarValues,
  normalizeSkillValueForChart,
  SKILL_RADAR_KEYS,
  type MemberSprintCriteriaScoreRow,
  type SkillChartScale,
  type SkillRadarValues,
} from "@/lib/utils/scrum/statisticsRadar.utils";
import "@/assets/styles/Statistics.page.css";
import "@/assets/styles/AiSummary.css";

const RADAR_LABELS = [
  "Productivity",
  "Efficiency",
  "Quality",
  "Collaboration",
  "Velocity",
  "Professionalism",
];
const RADAR_KEYS = SKILL_RADAR_KEYS;
const TEAM_FILTER_VALUE = "team";

const MEMBER_RANKING_COLORS = [
  "#ffe566", // gold (lighter highlight for rank 1)
  "#00e5a0", // green
  "#00c8ff", // blue
  "#c2783a", // dull orange
  "#a78bfa", // purple
  "#b87333", // brown
  "#ef4444", // red
] as const;

function getMemberRankingColor(rank: number): string {
  if (rank <= 0) {
    return MEMBER_RANKING_COLORS[MEMBER_RANKING_COLORS.length - 1];
  }

  if (rank >= MEMBER_RANKING_COLORS.length) {
    return MEMBER_RANKING_COLORS[MEMBER_RANKING_COLORS.length - 1];
  }

  return MEMBER_RANKING_COLORS[rank - 1];
}

function getMemberRankingHighlightIntensity(rank: number, total: number): number {
  if (total <= 1) {
    return 1;
  }

  // Rank 1 stays near full glow; lower ranks fall off quickly toward dim.
  const progress = (Math.max(rank, 1) - 1) / (total - 1);
  const eased = progress * progress;
  return Math.max(0.08, 1 - eased * 0.92);
}

function getSkillValueGradeColor(
  value: number,
  passingThreshold: number,
): string {
  return PERFORMANCE_GRADE_COLORS[
    resolvePerformanceScoreGrade(value, passingThreshold)
  ];
}

type StatBar = {
  label: string;
  value: number;
  max: number;
  unit: string;
  highlighted?: boolean;
  changeDirection?: "up" | "down" | "flat" | "none";
  changeDelta?: number | null;
  changeLabel?: string | null;
};

type StatisticsShowMode = "year" | "quarter" | "month" | "sprint";

type StatisticsSprintRow = {
  id: string;
  name: string | null;
  sprint_number: number | null;
  sprint_year: number | null;
  sprint_quarter: number | null;
  sprint_month: number | null;
  month: number | null;
  start_date: string | null;
  end_date: string | null;
  is_current: number | boolean | null;
};

type StatisticsMemberRow = {
  id: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
};

type MemberPerformanceScoreRow = {
  member_id: string;
  sprint_id: string;
  average_score: number | null;
  score_grade: PerformanceScoreGrade | null;
  total_story_points: number | null;
  assigned_story_points: number | null;
  extra_points: number | null;
  velocity_by_hour: number | null;
};

type MemberSprintScoreRow = {
  member_id: string;
  sprint_id: string;
  completed_story_points: number | null;
  completed_tasks_count: number | null;
  accumulated_hours: number | null;
};

type ProfessionalismItemRow = {
  id: string;
  name: string | null;
  code: string | null;
  value: number | null;
};

type MemberSprintProfessionalismScoreRow = {
  member_id: string;
  sprint_id: string;
  item_id: string;
  score: number | null;
};

type MemberRankingProfessionalismItem = {
  itemId: string;
  label: string;
  score: number | null;
  max: number;
};

type MemberRankingEntry = {
  memberId: string;
  name: string;
  rank: number;
  scorePoints: number | null;
  grade: PerformanceScoreGrade | null;
  rates: SkillRadarValues;
  professionalismItems: MemberRankingProfessionalismItem[];
};

type MemberRankingSection = {
  key: string;
  label: string | null;
  peerCount: number;
  entries: MemberRankingEntry[];
};

const MEMBER_RANKING_COLUMNS = [
  { key: "rank", label: "Rank" },
  { key: "name", label: "Name" },
  { key: "grade", label: "Grade" },
  { key: "score", label: "Score Points" },
  { key: "scoreBreakdown", label: "Score Breakdown" },
  { key: "professionalism", label: "Professionalism" },
] as const;

const MEMBER_RANKING_RATE_METRICS: Array<{
  key: keyof SkillRadarValues;
  label: string;
}> = [
  { key: "productivity", label: "Productivity" },
  { key: "efficiency", label: "Efficiency" },
  { key: "quality", label: "Quality" },
  { key: "collaboration", label: "Collaboration" },
  { key: "velocity", label: "Velocity" },
  { key: "professionalism", label: "Professionalism" },
];

const PROFESSIONALISM_PIP_COUNT = 5;

function getProfessionalismScoreColor(score: number): string {
  if (!Number.isFinite(score) || score < 2) {
    return "#ef4444"; // red
  }
  if (score < 3) {
    return "#f97316"; // orange
  }
  if (score < 4) {
    return "#f5c842"; // yellow
  }
  if (score < 5) {
    return "#a3e635"; // yellow green
  }
  return "#00e5a0"; // green
}

const SHOW_MODE_OPTIONS: Array<{ value: StatisticsShowMode; label: string }> = [
  { value: "year", label: "By Year" },
  { value: "quarter", label: "By Quarter" },
  { value: "month", label: "By Month" },
  { value: "sprint", label: "By Sprint" },
];

const devData = {
  score: 8420,
  grade: "A",
  stats: [
    { label: "Tasks Completed", value: 142, max: 200, unit: "" },
    { label: "Average Velocity", value: 89, max: 100, unit: "" },
    { label: "Velocity By Hour (Story Points per Hour)", value: 2, max: 5, unit: "" },
    { label: "Best Story Points", value: 89, max: 100, unit: "" },
    { label: "Assigned Story Points", value: 76, max: 90, unit: "" },
    { label: "Accumulated Hours", value: 40, max: 80, unit: "" },
    { label: "Bonus Points", value: 12, max: 20, unit: "" },
  ],
  radar: {
    productivity: 87,
    efficiency: 92,
    quality: 78,
    collaboration: 95,
    velocity: 83,
    professionalism: 88,
  } satisfies SkillRadarValues,
};

function formatStatisticsSprintLabel(sprint: StatisticsSprintRow): string {
  const name = sprint.name?.trim();
  if (name) {
    return name;
  }

  if (sprint.sprint_number) {
    return `Sprint ${sprint.sprint_number}`;
  }

  return "Sprint";
}

function formatStatisticsSprintTrendLabelLines(
  sprint: StatisticsSprintRow,
): string[] {
  const year = getSprintListingYear(sprint);
  const quarter = getSprintListingQuarter(sprint);
  const sprintNumber = Number(sprint.sprint_number);

  const lines: string[] = [];
  if (Number.isFinite(year) && year > 0) {
    lines.push(String(year));
  }
  if (Number.isFinite(quarter) && quarter > 0) {
    lines.push(`Q${quarter}`);
  }
  if (Number.isFinite(sprintNumber) && sprintNumber > 0) {
    lines.push(`S${sprintNumber}`);
  } else {
    const name = sprint.name?.trim();
    if (name) {
      // Prefer short tokens so dense sprint axes stay readable.
      const compact = name
        .replace(/\bsprint\s*/iu, "S")
        .replace(/\s+/gu, " ")
        .trim();
      lines.push(compact.length > 8 ? compact.slice(0, 7) : compact);
    } else {
      lines.push("S");
    }
  }

  return lines;
}

function formatStatisticsSprintStartDateLabel(
  startDate: string | null | undefined,
): string | null {
  if (!startDate) {
    return null;
  }

  const parsed = new Date(startDate);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatStatisticsSprintTrendDateLabel(
  startDate: string | null | undefined,
): string | null {
  if (!startDate) {
    return null;
  }

  const parsed = new Date(startDate);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }

  return `${parsed.getMonth() + 1}/${parsed.getDate()}`;
}

function formatStatisticsSprintFullDateLabel(
  dateValue: string | null | undefined,
): string | null {
  if (!dateValue) {
    return null;
  }

  const parsed = new Date(dateValue);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatInvolvedSprintDateRangeLabel(
  sprints: StatisticsSprintRow[],
): string | null {
  if (sprints.length === 0) {
    return null;
  }

  const getStartSortTimestamp = (sprint: StatisticsSprintRow): number => {
    if (sprint.start_date) {
      const startTime = new Date(sprint.start_date).getTime();
      if (Number.isFinite(startTime)) {
        return startTime;
      }
    }

    if (sprint.end_date) {
      const endTime = new Date(sprint.end_date).getTime();
      if (Number.isFinite(endTime)) {
        return endTime;
      }
    }

    return 0;
  };

  const sortedSprints = [...sprints].sort(
    (sprintA, sprintB) =>
      getStartSortTimestamp(sprintA) - getStartSortTimestamp(sprintB),
  );
  const firstSprint = sortedSprints[0];
  const lastSprint = sortedSprints[sortedSprints.length - 1];
  const startLabel = formatStatisticsSprintFullDateLabel(firstSprint.start_date);
  const endLabel = formatStatisticsSprintFullDateLabel(lastSprint.end_date);

  if (startLabel && endLabel) {
    return `${startLabel} – ${endLabel}`;
  }

  return startLabel ?? endLabel;
}

function formatMemberSprintRankingLabel(sprint: StatisticsSprintRow): string {
  const quarter = getSprintListingQuarter(sprint);
  const sprintNumber = Number(sprint.sprint_number);
  const sprintPart = Number.isFinite(sprintNumber) && sprintNumber > 0
    ? `Sprint ${sprintNumber}`
    : formatStatisticsSprintLabel(sprint);

  if (Number.isFinite(quarter) && quarter > 0) {
    return `Quarter ${quarter} ${sprintPart}`;
  }

  return sprintPart;
}

function compareSprintsByQuarterThenNumberDesc(
  left: StatisticsSprintRow,
  right: StatisticsSprintRow,
): number {
  const quarterDiff =
    getSprintListingQuarter(right) - getSprintListingQuarter(left);
  if (quarterDiff !== 0) {
    return quarterDiff;
  }

  const leftNumber = Number(left.sprint_number);
  const rightNumber = Number(right.sprint_number);
  const safeLeft = Number.isFinite(leftNumber) ? leftNumber : -1;
  const safeRight = Number.isFinite(rightNumber) ? rightNumber : -1;
  if (safeRight !== safeLeft) {
    return safeRight - safeLeft;
  }

  return formatStatisticsSprintLabel(left).localeCompare(
    formatStatisticsSprintLabel(right),
  );
}

function getStatisticsMemberName(member: StatisticsMemberRow): string {
  return (
    member.full_name?.trim() ||
    [member.first_name, member.last_name].filter(Boolean).join(" ") ||
    "Unnamed member"
  );
}

function formatScorePoints(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function formatStoryPoints(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return Math.ceil(value).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
}

function formatAccumulatedHours(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return (Math.round(value * 10) / 10).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

function averageFiniteScores(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function parseSelectedMonthValue(
  value: string,
): { year: number; month: number } | null {
  const match = value.match(/^(\d+)-(\d+)$/u);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year <= 0 || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}

function parseSelectedQuarterValue(
  value: string,
): { year: number; quarter: number } | null {
  const match = value.match(/^(\d+)-Q([1-4])$/iu);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const quarter = Number(match[2]);
  if (year <= 0 || quarter < 1 || quarter > 4) {
    return null;
  }

  return { year, quarter };
}

function getStatisticsActiveSprintIds(
  showMode: StatisticsShowMode,
  sprints: StatisticsSprintRow[],
  filters: {
    selectedYear: string;
    selectedQuarter: string;
    selectedMonth: string;
    selectedSprintId: string;
  },
): string[] {
  if (showMode === "sprint") {
    return filters.selectedSprintId ? [filters.selectedSprintId] : [];
  }

  return sprints
    .filter((sprint) => {
      const year = getSprintListingYear(sprint);

      if (showMode === "year") {
        if (!filters.selectedYear) {
          return false;
        }

        return year === Number(filters.selectedYear);
      }

      if (showMode === "quarter") {
        const parsedQuarter = parseSelectedQuarterValue(filters.selectedQuarter);
        if (!parsedQuarter) {
          return false;
        }

        return (
          year === parsedQuarter.year &&
          getSprintListingQuarter(sprint) === parsedQuarter.quarter
        );
      }

      if (showMode === "month") {
        const parsedMonth = parseSelectedMonthValue(filters.selectedMonth);
        if (!parsedMonth) {
          return false;
        }

        const month = getSprintListingMonth(sprint);
        return year === parsedMonth.year && month === parsedMonth.month;
      }

      return false;
    })
    .map((sprint) => sprint.id);
}

function getStatisticsPreviousPeriodSprintIds(
  showMode: StatisticsShowMode,
  sprints: StatisticsSprintRow[],
  filters: {
    selectedYear: string;
    selectedQuarter: string;
    selectedMonth: string;
    selectedSprintId: string;
  },
): string[] {
  if (showMode === "year") {
    const year = Number(filters.selectedYear);
    if (!filters.selectedYear || !Number.isFinite(year) || year <= 1) {
      return [];
    }

    return getStatisticsActiveSprintIds("year", sprints, {
      ...filters,
      selectedYear: String(year - 1),
    });
  }

  if (showMode === "quarter") {
    const parsedQuarter = parseSelectedQuarterValue(filters.selectedQuarter);
    if (!parsedQuarter) {
      return [];
    }

    const previousQuarter =
      parsedQuarter.quarter === 1
        ? { year: parsedQuarter.year - 1, quarter: 4 }
        : { year: parsedQuarter.year, quarter: parsedQuarter.quarter - 1 };

    return getStatisticsActiveSprintIds("quarter", sprints, {
      ...filters,
      selectedQuarter: `${previousQuarter.year}-Q${previousQuarter.quarter}`,
    });
  }

  if (showMode === "month") {
    const parsedMonth = parseSelectedMonthValue(filters.selectedMonth);
    if (!parsedMonth) {
      return [];
    }

    const previousMonth =
      parsedMonth.month === 1
        ? { year: parsedMonth.year - 1, month: 12 }
        : { year: parsedMonth.year, month: parsedMonth.month - 1 };

    return getStatisticsActiveSprintIds("month", sprints, {
      ...filters,
      selectedMonth: `${previousMonth.year}-${previousMonth.month}`,
    });
  }

  if (!filters.selectedSprintId) {
    return [];
  }

  const orderedSprints = [...sprints].sort(
    (sprintA, sprintB) =>
      getSprintListingSortTimestamp(sprintA) -
      getSprintListingSortTimestamp(sprintB),
  );
  const selectedIndex = orderedSprints.findIndex(
    (sprint) => sprint.id === filters.selectedSprintId,
  );

  if (selectedIndex <= 0) {
    return [];
  }

  return [orderedSprints[selectedIndex - 1].id];
}

function getStatisticsPreviousPeriodLabel(
  showMode: StatisticsShowMode,
): string {
  if (showMode === "year") {
    return "vs previous year";
  }
  if (showMode === "quarter") {
    return "vs previous quarter";
  }
  if (showMode === "month") {
    return "vs previous month";
  }
  return "vs previous sprint";
}

function getQuarterEndMonth(quarter: number): number {
  return Math.min(Math.max(quarter, 1), 4) * 3;
}

function getStatisticsMetricsTrendLabel(
  showMode: StatisticsShowMode,
): string {
  if (showMode === "year") {
    return "Year Metrics Trend";
  }
  if (showMode === "quarter") {
    return "Quarter Metrics Trend";
  }
  if (showMode === "month") {
    return "Month Metrics Trend";
  }
  return "Sprint Metrics Trend";
}

function getMetricChange(
  previousValue: number | null,
  currentValue: number | null,
): {
  direction: "up" | "down" | "flat" | "none";
  delta: number | null;
} {
  if (
    previousValue === null ||
    currentValue === null ||
    !Number.isFinite(previousValue) ||
    !Number.isFinite(currentValue)
  ) {
    return { direction: "none", delta: null };
  }

  const delta = Math.round((currentValue - previousValue) * 100) / 100;
  if (delta > 0) {
    return { direction: "up", delta };
  }
  if (delta < 0) {
    return { direction: "down", delta };
  }
  return { direction: "flat", delta: 0 };
}

function formatStatChangeDelta(delta: number | null): string {
  if (delta === null || !Number.isFinite(delta)) {
    return "—";
  }

  const abs = Math.abs(delta);
  const formatted =
    abs >= 10
      ? String(Math.round(delta))
      : (Math.round(delta * 10) / 10).toFixed(abs % 1 === 0 ? 0 : 1);

  return `${delta > 0 ? "+" : ""}${formatted}`;
}

function getMemberPerformanceFieldAverage(
  rows: MemberPerformanceScoreRow[],
  memberId: string,
  field: "average_score" | "total_story_points" | "velocity_by_hour",
): number | null {
  const values = rows
    .filter((row) => {
      if (row.member_id !== memberId) {
        return false;
      }

      const value = row[field];
      return value !== null && Number.isFinite(Number(value));
    })
    .map((row) => Number(row[field]));

  return averageFiniteScores(values);
}

function getTeamPerformanceFieldAverage(
  rows: MemberPerformanceScoreRow[],
  memberIds: string[],
  field: "average_score" | "total_story_points" | "velocity_by_hour",
): number | null {
  const memberAverages = memberIds
    .map((memberId) => getMemberPerformanceFieldAverage(rows, memberId, field))
    .filter((value): value is number => value !== null);

  return averageFiniteScores(memberAverages);
}

function getMemberAssignedStoryPointsTotal(
  rows: MemberPerformanceScoreRow[],
  memberId: string,
): number | null {
  const values = rows
    .filter((row) => {
      if (row.member_id !== memberId) {
        return false;
      }

      return (
        row.assigned_story_points !== null &&
        Number.isFinite(Number(row.assigned_story_points))
      );
    })
    .map((row) => Number(row.assigned_story_points));

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0);
}

function getTeamAssignedStoryPointsTotal(
  rows: MemberPerformanceScoreRow[],
  memberIds: string[],
): number | null {
  const memberTotals = memberIds
    .map((memberId) => getMemberAssignedStoryPointsTotal(rows, memberId))
    .filter((value): value is number => value !== null);

  if (memberTotals.length === 0) {
    return null;
  }

  return memberTotals.reduce((sum, value) => sum + value, 0);
}

function getTeamAssignedStoryPointsAverage(
  rows: MemberPerformanceScoreRow[],
  memberIds: string[],
): number | null {
  const memberTotals = memberIds
    .map((memberId) => getMemberAssignedStoryPointsTotal(rows, memberId))
    .filter((value): value is number => value !== null);

  return averageFiniteScores(memberTotals);
}

function getMemberExtraPointsTotal(
  rows: MemberPerformanceScoreRow[],
  memberId: string,
): number | null {
  const values = rows
    .filter((row) => {
      if (row.member_id !== memberId) {
        return false;
      }

      return (
        row.extra_points !== null && Number.isFinite(Number(row.extra_points))
      );
    })
    .map((row) => Number(row.extra_points));

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0);
}

function getTeamExtraPointsTotal(
  rows: MemberPerformanceScoreRow[],
  memberIds: string[],
): number | null {
  const memberTotals = memberIds
    .map((memberId) => getMemberExtraPointsTotal(rows, memberId))
    .filter((value): value is number => value !== null);

  if (memberTotals.length === 0) {
    return null;
  }

  return memberTotals.reduce((sum, value) => sum + value, 0);
}

function getTeamExtraPointsAverage(
  rows: MemberPerformanceScoreRow[],
  memberIds: string[],
): number | null {
  const memberTotals = memberIds
    .map((memberId) => getMemberExtraPointsTotal(rows, memberId))
    .filter((value): value is number => value !== null);

  return averageFiniteScores(memberTotals);
}

function getMemberProfessionalismItemAverage(
  rows: MemberSprintProfessionalismScoreRow[],
  memberId: string,
  itemId: string,
): number | null {
  const values = rows
    .filter((row) => {
      if (row.member_id !== memberId || row.item_id !== itemId) {
        return false;
      }

      return row.score !== null && Number.isFinite(Number(row.score));
    })
    .map((row) => Number(row.score));

  return averageFiniteScores(values);
}

function getTeamProfessionalismItemAverage(
  rows: MemberSprintProfessionalismScoreRow[],
  memberIds: string[],
  itemId: string,
): number | null {
  const memberAverages = memberIds
    .map((memberId) =>
      getMemberProfessionalismItemAverage(rows, memberId, itemId),
    )
    .filter((value): value is number => value !== null);

  return averageFiniteScores(memberAverages);
}

function getMemberSprintScoreFieldAverage(
  rows: MemberSprintScoreRow[],
  memberId: string,
  field:
    | "completed_story_points"
    | "completed_tasks_count"
    | "accumulated_hours",
): number | null {
  const values = rows
    .filter((row) => {
      if (row.member_id !== memberId) {
        return false;
      }

      const value = row[field];
      return value !== null && Number.isFinite(Number(value));
    })
    .map((row) => Number(row[field]));

  return averageFiniteScores(values);
}

function getTeamSprintScoreFieldAverage(
  rows: MemberSprintScoreRow[],
  memberIds: string[],
  field:
    | "completed_story_points"
    | "completed_tasks_count"
    | "accumulated_hours",
): number | null {
  const memberAverages = memberIds
    .map((memberId) => getMemberSprintScoreFieldAverage(rows, memberId, field))
    .filter((value): value is number => value !== null);

  return averageFiniteScores(memberAverages);
}

function getMemberSprintScoreFieldTotal(
  rows: MemberSprintScoreRow[],
  memberId: string,
  field:
    | "completed_story_points"
    | "completed_tasks_count"
    | "accumulated_hours",
): number | null {
  const values = rows
    .filter((row) => {
      if (row.member_id !== memberId) {
        return false;
      }

      const value = row[field];
      return value !== null && Number.isFinite(Number(value));
    })
    .map((row) => Number(row[field]));

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0);
}

function getTeamSprintScoreFieldTotal(
  rows: MemberSprintScoreRow[],
  memberIds: string[],
  field:
    | "completed_story_points"
    | "completed_tasks_count"
    | "accumulated_hours",
): number | null {
  const memberIdsSet = new Set(memberIds);
  const values = rows
    .filter((row) => {
      if (!memberIdsSet.has(row.member_id)) {
        return false;
      }

      const value = row[field];
      return value !== null && Number.isFinite(Number(value));
    })
    .map((row) => Number(row[field]));

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0);
}

function getMemberCompletedStoryPointsAverage(
  rows: MemberSprintScoreRow[],
  memberId: string,
): number | null {
  return getMemberSprintScoreFieldAverage(
    rows,
    memberId,
    "completed_story_points",
  );
}

function getCompletedStoryPointsTotal(
  rows: MemberSprintScoreRow[],
  memberId?: string,
): number | null {
  const values = rows
    .filter((row) => {
      if (memberId && row.member_id !== memberId) {
        return false;
      }

      return (
        row.completed_story_points !== null &&
        Number.isFinite(Number(row.completed_story_points))
      );
    })
    .map((row) => Number(row.completed_story_points));

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0);
}

function getHighestCompletedStoryPoints(
  rows: MemberSprintScoreRow[],
  memberId?: string,
): number | null {
  const values = rows
    .filter((row) => {
      if (memberId && row.member_id !== memberId) {
        return false;
      }

      return (
        row.completed_story_points !== null &&
        Number.isFinite(Number(row.completed_story_points))
      );
    })
    .map((row) => Number(row.completed_story_points));

  if (values.length === 0) {
    return null;
  }

  return Math.max(...values);
}

type PassingScoreRow = {
  level: string | null;
  value: number | null;
};

function SkillBarChart({
  values,
  scale,
}: {
  values: SkillRadarValues;
  scale: SkillChartScale;
}) {
  const [heights, setHeights] = useState(RADAR_KEYS.map(() => 0));
  const chartH = 160;
  const labelH = 48;
  const chartTicks = getSkillChartTicks(scale);

  useEffect(() => {
    const t = setTimeout(
      () =>
        setHeights(
          RADAR_KEYS.map((k) => normalizeSkillValueForChart(values[k], scale)),
        ),
      300,
    );
    return () => clearTimeout(t);
  }, [scale, values]);

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          height: chartH + labelH,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: labelH,
            height: chartH,
            pointerEvents: "none",
          }}
        >
          {chartTicks.map((tick) => {
            const normalizedTick = normalizeSkillValueForChart(tick, scale);
            return (
              <div
                key={tick}
                style={{
                  position: "absolute",
                  bottom: `${normalizedTick}%`,
                  left: 0,
                  right: 0,
                  borderTop: `1px dashed ${tick === Math.round(scale.minValue) ? "rgba(255,71,87,0.28)" : "rgba(100,180,255,0.1)"}`,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    ...chartLabelStyle,
                    color:
                      tick === Math.round(scale.minValue)
                        ? "rgba(255,120,130,0.7)"
                        : "rgba(100,160,210,0.45)",
                    marginTop: -8,
                    paddingRight: 4,
                    minWidth: 24,
                    textAlign: "right",
                  }}
                >
                  {tick}
                </span>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            width: "100%",
            height: chartH,
            marginBottom: labelH,
            paddingLeft: 28,
            position: "relative",
            zIndex: 1,
          }}
        >
          {RADAR_KEYS.map((k, i) => {
            const actualValue = values[k];
            const passed = isSkillValuePassing(actualValue, scale);
            const barColor = getSkillValueGradeColor(actualValue, scale.minValue);
            const barHeight = (heights[i] / 100) * chartH;

            return (
              <div
                key={k}
                style={{
                  flex: 1,
                  position: "relative",
                  height: "100%",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    bottom: `calc(${barHeight}px + 4px)`,
                    left: "50%",
                    transform: "translateX(-50%)",
                    ...chartLabelStyle,
                    color: barColor,
                    opacity: heights[i] > 0 || !passed ? 1 : 0,
                    transition: "opacity 0.5s ease, bottom 1s cubic-bezier(0.23,1,0.32,1)",
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                  }}
                >
                  {actualValue}%
                </span>
                <div
                  style={{
                    width: "100%",
                    height: `${barHeight}px`,
                    transition: "height 1s cubic-bezier(0.23,1,0.32,1)",
                    borderRadius: "6px 6px 3px 3px",
                    background: `linear-gradient(180deg,${barColor} 0%,${barColor}55 100%)`,
                    boxShadow: `0 0 14px ${barColor}44`,
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    ...chartLabelStyle,
                    color: "rgba(150,200,240,0.7)",
                    textAlign: "center",
                    width: "100%",
                    maxWidth: "100%",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical" as const,
                    overflow: "hidden",
                  }}
                >
                  {RADAR_LABELS[i]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatBar2({
  label,
  value,
  max,
  unit,
  index,
  highlighted = false,
  changeDirection = "none",
  changeDelta = null,
  changeLabel = null,
}: StatBar & { index: number }) {
  const [w, setW] = useState(0);
  const pct = Math.round((value / max) * 100);

  useEffect(() => {
    const t = setTimeout(() => setW(pct), 200 + index * 60);
    return () => clearTimeout(t);
  }, [pct, index]);

  const color = pct >= 85 ? "#00e5a0" : pct >= 65 ? "#00c8ff" : pct >= 45 ? "#f5c842" : "#ff6b6b";
  const changeArrow =
    changeDirection === "up"
      ? "▲"
      : changeDirection === "down"
        ? "▼"
        : changeDirection === "flat"
          ? "●"
          : "—";

  return (
    <div
      className={`statistics-stat-bar${highlighted ? " statistics-stat-bar--highlighted" : ""}`}
    >
      <div className="statistics-stat-bar__header">
        <span className="statistics-stat-bar__label">{label}</span>
        <span className="statistics-stat-bar__meta">
          <span
            className={`statistics-stat-bar__change statistics-stat-bar__change--${changeDirection}`}
            title={changeLabel ?? undefined}
            aria-label={
              changeLabel
                ? `${changeLabel}: ${formatStatChangeDelta(changeDelta)}`
                : undefined
            }
          >
            <span className="statistics-stat-bar__change-arrow" aria-hidden="true">
              {changeArrow}
            </span>
            <span className="statistics-stat-bar__change-delta">
              {formatStatChangeDelta(changeDelta)}
            </span>
          </span>
          <span className="statistics-stat-bar__value" style={{ color }}>
            {value}
            {unit}
            <span className="statistics-stat-bar__max">
              /{max}
              {unit}
            </span>
          </span>
        </span>
      </div>
      <div className="statistics-stat-bar__track">
        <div
          className="statistics-stat-bar__fill"
          style={{
            width: `${w}%`,
            background: `linear-gradient(90deg,${color}88,${color})`,
          }}
        />
      </div>
    </div>
  );
}

const DEFAULT_PASSING_THRESHOLD = 75;

function ScoreCircle2({
  value,
  label,
  color,
  delay = 0,
  size = "default",
}: {
  value: string | number;
  label: string;
  color: string;
  delay?: number;
  size?: "default" | "compact";
}) {
  const [show, setShow] = useState(false);
  const isCompact = size === "compact";
  const dialSize = isCompact ? 72 : 110;
  const valueFontSize = isCompact ? 15 : 22;

  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: isCompact ? 6 : 8 }}>
      <div
        style={{
          width: dialSize,
          height: dialSize,
          borderRadius: "50%",
          border: `3px solid ${color}`,
          boxShadow: `0 0 24px ${color}44,inset 0 0 20px ${color}11`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(10,20,40,0.6)",
          transition: `all 0.7s cubic-bezier(0.23,1,0.32,1) ${delay}ms`,
          transform: show ? "scale(1)" : "scale(0.6)",
          opacity: show ? 1 : 0,
        }}
      >
        <span
          style={{
            fontSize: valueFontSize,
            fontWeight: 800,
            fontFamily: "'DM Mono',monospace",
            color,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          {value}
        </span>
      </div>
      <span
        style={{
          fontSize: isCompact ? 9 : 10,
          fontFamily: "'DM Sans',sans-serif",
          color: "rgba(160,200,240,0.7)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function HoursRangeCircle({
  min,
  avg,
  max,
  label = "Accumulated Hours",
  color = "#00c8ff",
  delay = 0,
}: {
  min: string;
  avg: string;
  max: string;
  label?: string;
  color?: string;
  delay?: number;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className="statistics-hours-range">
      <div
        className="statistics-hours-range__circle"
        style={{
          borderColor: color,
          boxShadow: `0 0 24px ${color}44, inset 0 0 20px ${color}11`,
          transition: `all 0.7s cubic-bezier(0.23,1,0.32,1) ${delay}ms`,
          transform: show ? "scale(1)" : "scale(0.6)",
          opacity: show ? 1 : 0,
        }}
      >
        <div className="statistics-hours-range__values">
          <span
            className="statistics-hours-range__value statistics-hours-range__value--min"
            style={{ color }}
          >
            {min}
          </span>
          <span
            className="statistics-hours-range__value statistics-hours-range__value--avg"
            style={{ color }}
          >
            {avg}
          </span>
          <span
            className="statistics-hours-range__value statistics-hours-range__value--max"
            style={{ color }}
          >
            {max}
          </span>
        </div>
      </div>
      <span className="statistics-hours-range__label">{label}</span>
    </div>
  );
}

type StatisticsPageProps = {
  showPublicViewButton?: boolean;
  showEvaluateButton?: boolean;
  showFilters?: boolean;
  showMemberFilter?: boolean;
  initialShowMode?: StatisticsShowMode;
  initialYear?: string;
  initialQuarter?: string;
  initialMonth?: string;
  initialSprintId?: string;
  initialOfValue?: string;
};

function isStatisticsShowMode(value: string | null | undefined): value is StatisticsShowMode {
  return value === "year" || value === "quarter" || value === "month" || value === "sprint";
}

export default function StatisticsPage({
  showPublicViewButton = true,
  showEvaluateButton = true,
  showFilters = true,
  showMemberFilter,
  initialShowMode = "sprint",
  initialYear = "",
  initialQuarter = "",
  initialMonth = "",
  initialSprintId = "",
  initialOfValue = TEAM_FILTER_VALUE,
}: StatisticsPageProps) {
  const allowMemberFilter = showMemberFilter ?? true;
  const pageRef = useRef<HTMLDivElement | null>(null);
  const copyToastTimeoutRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [publicLinkCopied, setPublicLinkCopied] = useState(false);
  const [isDownloadingStatistics, setIsDownloadingStatistics] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showMode, setShowMode] = useState<StatisticsShowMode>(
    isStatisticsShowMode(initialShowMode) ? initialShowMode : "sprint",
  );
  const [sprints, setSprints] = useState<StatisticsSprintRow[]>([]);
  const [members, setMembers] = useState<StatisticsMemberRow[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [filtersError, setFiltersError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedQuarter, setSelectedQuarter] = useState(initialQuarter);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedSprintId, setSelectedSprintId] = useState(initialSprintId);
  const [selectedOfValue, setSelectedOfValue] = useState(
    initialOfValue || TEAM_FILTER_VALUE,
  );
  const [lockedOfMemberId, setLockedOfMemberId] = useState<string | null>(null);
  const [isEvaluateConfirmOpen, setIsEvaluateConfirmOpen] = useState(false);
  const [evaluateYear, setEvaluateYear] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluateError, setEvaluateError] = useState<string | null>(null);
  const [evaluateResult, setEvaluateResult] = useState<EvaluateYearResult | null>(
    null,
  );
  const [sprintPerformanceScores, setSprintPerformanceScores] = useState<
    MemberPerformanceScoreRow[]
  >([]);
  const [sprintCriteriaScores, setSprintCriteriaScores] = useState<
    MemberSprintCriteriaScoreRow[]
  >([]);
  const [sprintMemberScores, setSprintMemberScores] = useState<
    MemberSprintScoreRow[]
  >([]);
  const [professionalismItems, setProfessionalismItems] = useState<
    ProfessionalismItemRow[]
  >([]);
  const [professionalismScores, setProfessionalismScores] = useState<
    MemberSprintProfessionalismScoreRow[]
  >([]);
  const [, setPassingScores] = useState<PassingScoreRow[]>([]);
  const [scorePointsLoading, setScorePointsLoading] = useState(false);

  const yearOptions = useMemo(() => getAvailableSprintYears(sprints), [sprints]);
  const quarterOptions = useMemo(
    () => getAvailableSprintYearQuarters(sprints),
    [sprints],
  );
  const monthOptions = useMemo(
    () => getAvailableSprintYearMonths(sprints),
    [sprints],
  );
  const selectableSprints = useMemo(
    () =>
      sprints.filter(
        (sprint) => Number(sprint.is_current) !== 1 && sprint.is_current !== true,
      ),
    [sprints],
  );
  const memberOptions = useMemo(
    () =>
      sortMembersByLastName(
        members.filter((member): member is StatisticsMemberRow & { id: string } =>
          isScoreboardIncludedMember(member),
        ),
      ),
    [members],
  );
  const summarySubjectLabel = useMemo(() => {
    if (selectedOfValue === TEAM_FILTER_VALUE) {
      return "Team";
    }

    const selectedMember = memberOptions.find(
      (member) => member.id === selectedOfValue,
    );

    return selectedMember
      ? getStatisticsMemberName(selectedMember)
      : "Team";
  }, [memberOptions, selectedOfValue]);

  const periodPerformanceTitle = useMemo(() => {
    let periodLabel: string | null = null;

    if (showMode === "year") {
      periodLabel = selectedYear ? `${selectedYear} Performance` : null;
    } else if (showMode === "quarter") {
      const option = quarterOptions.find(
        (entry) => entry.value === selectedQuarter,
      );
      periodLabel = option ? `${option.label} Performance` : null;
    } else if (showMode === "month") {
      const option = monthOptions.find((entry) => entry.value === selectedMonth);
      periodLabel = option ? `${option.label} Performance` : null;
    } else {
      const sprint = selectableSprints.find(
        (entry) => entry.id === selectedSprintId,
      );
      periodLabel = sprint
        ? `${formatStatisticsSprintLabel(sprint)} Performance`
        : null;
    }

    return periodLabel ? `${periodLabel} - ${summarySubjectLabel}` : null;
  }, [
    monthOptions,
    quarterOptions,
    selectableSprints,
    selectedMonth,
    selectedQuarter,
    selectedSprintId,
    selectedYear,
    showMode,
    summarySubjectLabel,
  ]);

  const scoreboardMemberIds = useMemo(
    () => new Set(memberOptions.map((member) => member.id)),
    [memberOptions],
  );
  const scoreboardMemberIdList = useMemo(
    () => memberOptions.map((member) => member.id),
    [memberOptions],
  );

  const activeSprintIds = useMemo(
    () =>
      getStatisticsActiveSprintIds(showMode, selectableSprints, {
        selectedYear,
        selectedQuarter,
        selectedMonth,
        selectedSprintId,
      }),
    [
      selectableSprints,
      selectedMonth,
      selectedQuarter,
      selectedSprintId,
      selectedYear,
      showMode,
    ],
  );

  const previousSprintIds = useMemo(
    () =>
      getStatisticsPreviousPeriodSprintIds(showMode, selectableSprints, {
        selectedYear,
        selectedQuarter,
        selectedMonth,
        selectedSprintId,
      }),
    [
      selectableSprints,
      selectedMonth,
      selectedQuarter,
      selectedSprintId,
      selectedYear,
      showMode,
    ],
  );

  const metricsTrendSprintIds = useMemo(() => {
    if (showMode === "year") {
      const year = Number(selectedYear);
      if (!selectedYear || !Number.isFinite(year)) {
        return [] as string[];
      }

      return selectableSprints
        .filter((sprint) => getSprintListingYear(sprint) === year)
        .map((sprint) => sprint.id);
    }

    if (showMode === "month") {
      const parsedMonth = parseSelectedMonthValue(selectedMonth);
      if (!parsedMonth) {
        return [] as string[];
      }

      return selectableSprints
        .filter((sprint) => {
          const month = getSprintListingMonth(sprint);
          return (
            getSprintListingYear(sprint) === parsedMonth.year &&
            month !== null &&
            month <= parsedMonth.month
          );
        })
        .map((sprint) => sprint.id);
    }

    if (showMode === "quarter") {
      const parsedQuarter = parseSelectedQuarterValue(selectedQuarter);
      if (!parsedQuarter) {
        return [] as string[];
      }

      const endMonth = getQuarterEndMonth(parsedQuarter.quarter);
      return selectableSprints
        .filter((sprint) => {
          const month = getSprintListingMonth(sprint);
          return (
            getSprintListingYear(sprint) === parsedQuarter.year &&
            month !== null &&
            month <= endMonth
          );
        })
        .map((sprint) => sprint.id);
    }

    if (!selectedSprintId) {
      return [] as string[];
    }

    const selectedSprint = selectableSprints.find(
      (sprint) => sprint.id === selectedSprintId,
    );
    if (!selectedSprint) {
      return [] as string[];
    }

    const selectedTimestamp = getSprintListingSortTimestamp(selectedSprint);
    const selectedYearValue = getSprintListingYear(selectedSprint);

    return selectableSprints
      .filter((sprint) => {
        if (getSprintListingYear(sprint) !== selectedYearValue) {
          return false;
        }

        return getSprintListingSortTimestamp(sprint) <= selectedTimestamp;
      })
      .map((sprint) => sprint.id);
  }, [
    selectableSprints,
    selectedMonth,
    selectedQuarter,
    selectedSprintId,
    selectedYear,
    showMode,
  ]);

  const scoreFetchSprintIds = useMemo(
    () =>
      [
        ...new Set([
          ...activeSprintIds,
          ...previousSprintIds,
          ...metricsTrendSprintIds,
        ]),
      ],
    [activeSprintIds, metricsTrendSprintIds, previousSprintIds],
  );

  const previousPeriodComparisonLabel = useMemo(
    () => getStatisticsPreviousPeriodLabel(showMode),
    [showMode],
  );

  const periodPerformanceDateRangeLabel = useMemo(() => {
    const involvedSprints = selectableSprints.filter((sprint) =>
      activeSprintIds.includes(sprint.id),
    );

    return formatInvolvedSprintDateRangeLabel(involvedSprints);
  }, [activeSprintIds, selectableSprints]);

  const relevantPerformanceRows = useMemo(
    () =>
      sprintPerformanceScores.filter(
        (row) =>
          activeSprintIds.includes(row.sprint_id) &&
          scoreboardMemberIds.has(row.member_id),
      ),
    [activeSprintIds, scoreboardMemberIds, sprintPerformanceScores],
  );

  const scorePointsValue = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    if (selectedOfValue === TEAM_FILTER_VALUE) {
      return getTeamPerformanceFieldAverage(
        relevantPerformanceRows,
        scoreboardMemberIdList,
        "average_score",
      );
    }

    return getMemberPerformanceFieldAverage(
      relevantPerformanceRows,
      selectedOfValue,
      "average_score",
    );
  }, [
    activeSprintIds,
    relevantPerformanceRows,
    scoreboardMemberIdList,
    selectedOfValue,
  ]);

  const displayedScorePoints = scorePointsLoading
    ? "…"
    : formatScorePoints(scorePointsValue);

  const storyPointsValue = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    const relevantRows = sprintMemberScores.filter(
      (row) =>
        activeSprintIds.includes(row.sprint_id) &&
        scoreboardMemberIds.has(row.member_id),
    );

    if (selectedOfValue === TEAM_FILTER_VALUE) {
      return getCompletedStoryPointsTotal(relevantRows);
    }

    return getCompletedStoryPointsTotal(relevantRows, selectedOfValue);
  }, [
    activeSprintIds,
    scoreboardMemberIds,
    selectedOfValue,
    sprintMemberScores,
  ]);

  const displayedStoryPoints = scorePointsLoading
    ? "…"
    : formatStoryPoints(storyPointsValue);

  const gradeValue = useMemo((): PerformanceScoreGrade | null => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    if (
      showMode === "sprint" &&
      selectedOfValue !== TEAM_FILTER_VALUE &&
      activeSprintIds.length === 1
    ) {
      const memberScore = relevantPerformanceRows.find(
        (row) => row.member_id === selectedOfValue,
      );

      if (memberScore?.score_grade) {
        return memberScore.score_grade;
      }
    }

    if (scorePointsValue === null) {
      return null;
    }

    return resolvePerformanceScoreGrade(
      scorePointsValue,
      DEFAULT_PASSING_THRESHOLD,
    );
  }, [
    activeSprintIds,
    relevantPerformanceRows,
    scorePointsValue,
    selectedOfValue,
    showMode,
  ]);

  const displayedGrade = scorePointsLoading ? "…" : (gradeValue ?? "—");
  const gradeColor = gradeValue
    ? PERFORMANCE_GRADE_COLORS[gradeValue]
    : "#fff";

  const relevantCriteriaRows = useMemo(
    () =>
      sprintCriteriaScores.filter(
        (row) =>
          activeSprintIds.includes(row.sprint_id) &&
          scoreboardMemberIds.has(row.member_id),
      ),
    [activeSprintIds, scoreboardMemberIds, sprintCriteriaScores],
  );

  const skillChartScale = useMemo<SkillChartScale>(
    () => ({
      minValue: 60,
      maxValue: DEFAULT_SKILL_CHART_SCALE.maxValue,
    }),
    [],
  );

  const teamContributionSegments = useMemo((): TeamContributionSegment[] => {
    if (activeSprintIds.length === 0) {
      return [];
    }

    const relevantRows = sprintMemberScores.filter(
      (row) =>
        activeSprintIds.includes(row.sprint_id) &&
        scoreboardMemberIds.has(row.member_id),
    );

    const memberSegments = memberOptions
      .map((member, index) => {
        const averageCompletedStoryPoints = getMemberCompletedStoryPointsAverage(
          relevantRows,
          member.id,
        );

        if (averageCompletedStoryPoints === null) {
          return null;
        }

        return {
          memberId: member.id,
          name: getStatisticsMemberName(member),
          color: getTeamContributionMemberColor(member.id, index),
          storyPoints: averageCompletedStoryPoints,
          contribution: 0,
        };
      })
      .filter((segment): segment is Omit<TeamContributionSegment, "contribution"> & { contribution: number } => segment !== null && segment.storyPoints > 0);

    const totalStoryPoints = memberSegments.reduce(
      (sum, segment) => sum + segment.storyPoints,
      0,
    );

    return memberSegments
      .map((segment) => ({
        ...segment,
        contribution:
          totalStoryPoints > 0
            ? Math.round((segment.storyPoints / totalStoryPoints) * 10000) / 100
            : 0,
      }))
      .sort((segmentA, segmentB) => segmentB.storyPoints - segmentA.storyPoints);
  }, [activeSprintIds, memberOptions, scoreboardMemberIds, sprintMemberScores]);

  const relevantMemberScoreRows = useMemo(
    () =>
      sprintMemberScores.filter(
        (row) =>
          activeSprintIds.includes(row.sprint_id) &&
          scoreboardMemberIds.has(row.member_id),
      ),
    [activeSprintIds, scoreboardMemberIds, sprintMemberScores],
  );

  const storyPointsHoursTrendEntries = useMemo(() => {
    if (showMode === "sprint" || activeSprintIds.length === 0) {
      return [];
    }

    const activeSprints = selectableSprints
      .filter((sprint) => activeSprintIds.includes(sprint.id))
      .sort(
        (sprintA, sprintB) =>
          getSprintListingSortTimestamp(sprintA) -
          getSprintListingSortTimestamp(sprintB),
      );

    return activeSprints.map((sprint) => {
      const sprintRows = relevantMemberScoreRows.filter((row) => {
        if (row.sprint_id !== sprint.id) {
          return false;
        }

        if (selectedOfValue === TEAM_FILTER_VALUE) {
          return true;
        }

        return row.member_id === selectedOfValue;
      });

      const storyPointsDone = sprintRows.reduce((sum, row) => {
        const value = Number(row.completed_story_points);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);

      const hoursSpent = sprintRows.reduce((sum, row) => {
        const value = Number(row.accumulated_hours);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);

      return {
        id: sprint.id,
        label: formatStatisticsSprintLabel(sprint),
        sublabel: formatStatisticsSprintStartDateLabel(sprint.start_date),
        storyPointsDone: Math.round(storyPointsDone * 100) / 100,
        hoursSpent: Math.round(hoursSpent * 100) / 100,
      };
    });
  }, [
    activeSprintIds,
    relevantMemberScoreRows,
    selectableSprints,
    selectedOfValue,
    showMode,
  ]);

  const tasksCompletedValue = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    if (selectedOfValue === TEAM_FILTER_VALUE) {
      return getTeamSprintScoreFieldTotal(
        relevantMemberScoreRows,
        scoreboardMemberIdList,
        "completed_tasks_count",
      );
    }

    return getMemberSprintScoreFieldTotal(
      relevantMemberScoreRows,
      selectedOfValue,
      "completed_tasks_count",
    );
  }, [
    activeSprintIds,
    relevantMemberScoreRows,
    scoreboardMemberIdList,
    selectedOfValue,
  ]);

  const highestCompletedTasksAmongMembers = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    const memberTotals = scoreboardMemberIdList
      .map((memberId) =>
        getMemberSprintScoreFieldTotal(
          relevantMemberScoreRows,
          memberId,
          "completed_tasks_count",
        ),
      )
      .filter((value): value is number => value !== null);

    if (memberTotals.length === 0) {
      return null;
    }

    return Math.max(...memberTotals);
  }, [activeSprintIds, relevantMemberScoreRows, scoreboardMemberIdList]);

  const averageVelocityValue = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    if (selectedOfValue === TEAM_FILTER_VALUE) {
      return getTeamSprintScoreFieldAverage(
        relevantMemberScoreRows,
        scoreboardMemberIdList,
        "completed_story_points",
      );
    }

    return getMemberSprintScoreFieldAverage(
      relevantMemberScoreRows,
      selectedOfValue,
      "completed_story_points",
    );
  }, [
    activeSprintIds,
    relevantMemberScoreRows,
    scoreboardMemberIdList,
    selectedOfValue,
  ]);

  const highestAverageVelocityAmongMembers = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    const memberAverages = scoreboardMemberIdList
      .map((memberId) =>
        getMemberSprintScoreFieldAverage(
          relevantMemberScoreRows,
          memberId,
          "completed_story_points",
        ),
      )
      .filter((value): value is number => value !== null);

    if (memberAverages.length === 0) {
      return null;
    }

    return Math.max(...memberAverages);
  }, [activeSprintIds, relevantMemberScoreRows, scoreboardMemberIdList]);

  const velocityByHourValue = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    if (selectedOfValue === TEAM_FILTER_VALUE) {
      return getTeamPerformanceFieldAverage(
        relevantPerformanceRows,
        scoreboardMemberIdList,
        "velocity_by_hour",
      );
    }

    return getMemberPerformanceFieldAverage(
      relevantPerformanceRows,
      selectedOfValue,
      "velocity_by_hour",
    );
  }, [
    activeSprintIds,
    relevantPerformanceRows,
    scoreboardMemberIdList,
    selectedOfValue,
  ]);

  const highestVelocityByHourAmongMembers = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    const memberAverages = scoreboardMemberIdList
      .map((memberId) =>
        getMemberPerformanceFieldAverage(
          relevantPerformanceRows,
          memberId,
          "velocity_by_hour",
        ),
      )
      .filter((value): value is number => value !== null);

    if (memberAverages.length === 0) {
      return null;
    }

    return Math.max(...memberAverages);
  }, [activeSprintIds, relevantPerformanceRows, scoreboardMemberIdList]);

  const bestStoryPointsValue = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    if (selectedOfValue === TEAM_FILTER_VALUE) {
      return getHighestCompletedStoryPoints(relevantMemberScoreRows);
    }

    return getHighestCompletedStoryPoints(
      relevantMemberScoreRows,
      selectedOfValue,
    );
  }, [activeSprintIds, relevantMemberScoreRows, selectedOfValue]);

  const highestBestStoryPointsAmongMembers = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    return getHighestCompletedStoryPoints(relevantMemberScoreRows);
  }, [activeSprintIds, relevantMemberScoreRows]);

  const assignedStoryPointsValue = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    if (selectedOfValue === TEAM_FILTER_VALUE) {
      return getTeamAssignedStoryPointsTotal(
        relevantPerformanceRows,
        scoreboardMemberIdList,
      );
    }

    return getMemberAssignedStoryPointsTotal(
      relevantPerformanceRows,
      selectedOfValue,
    );
  }, [
    activeSprintIds,
    relevantPerformanceRows,
    scoreboardMemberIdList,
    selectedOfValue,
  ]);

  const teamAssignedStoryPointsTotal = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    return getTeamAssignedStoryPointsTotal(
      relevantPerformanceRows,
      scoreboardMemberIdList,
    );
  }, [activeSprintIds, relevantPerformanceRows, scoreboardMemberIdList]);

  const teamAssignedStoryPointsAverage = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    return getTeamAssignedStoryPointsAverage(
      relevantPerformanceRows,
      scoreboardMemberIdList,
    );
  }, [activeSprintIds, relevantPerformanceRows, scoreboardMemberIdList]);

  const bonusPointsValue = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    if (selectedOfValue === TEAM_FILTER_VALUE) {
      return getTeamExtraPointsTotal(
        relevantPerformanceRows,
        scoreboardMemberIdList,
      );
    }

    return getMemberExtraPointsTotal(
      relevantPerformanceRows,
      selectedOfValue,
    );
  }, [
    activeSprintIds,
    relevantPerformanceRows,
    scoreboardMemberIdList,
    selectedOfValue,
  ]);

  const accumulatedHoursValue = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    if (selectedOfValue === TEAM_FILTER_VALUE) {
      return getTeamSprintScoreFieldTotal(
        relevantMemberScoreRows,
        scoreboardMemberIdList,
        "accumulated_hours",
      );
    }

    return getMemberSprintScoreFieldTotal(
      relevantMemberScoreRows,
      selectedOfValue,
      "accumulated_hours",
    );
  }, [
    activeSprintIds,
    relevantMemberScoreRows,
    scoreboardMemberIdList,
    selectedOfValue,
  ]);

  const highestAccumulatedHoursAmongMembers = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    const memberTotals = scoreboardMemberIdList
      .map((memberId) =>
        getMemberSprintScoreFieldTotal(
          relevantMemberScoreRows,
          memberId,
          "accumulated_hours",
        ),
      )
      .filter((value): value is number => value !== null);

    if (memberTotals.length === 0) {
      return null;
    }

    return Math.max(...memberTotals);
  }, [activeSprintIds, relevantMemberScoreRows, scoreboardMemberIdList]);

  const accumulatedHoursRange = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return { min: null, avg: null, max: null };
    }

    const perSprintRanges = activeSprintIds
      .map((sprintId) => {
        const memberHours = (
          selectedOfValue === TEAM_FILTER_VALUE
            ? scoreboardMemberIdList
            : [selectedOfValue]
        )
          .map((memberId) => {
            const row = relevantMemberScoreRows.find(
              (entry) =>
                entry.sprint_id === sprintId && entry.member_id === memberId,
            );

            if (!row) {
              return null;
            }

            const value = Number(row.accumulated_hours);
            return Number.isFinite(value) ? value : null;
          })
          .filter((value): value is number => value !== null);

        if (memberHours.length === 0) {
          return null;
        }

        return {
          min: Math.min(...memberHours),
          avg: averageFiniteScores(memberHours),
          max: Math.max(...memberHours),
        };
      })
      .filter(
        (
          range,
        ): range is { min: number; avg: number; max: number } =>
          range !== null && range.avg !== null,
      );

    if (perSprintRanges.length === 0) {
      return { min: null, avg: null, max: null };
    }

    const sprintAverages = perSprintRanges.map((range) => range.avg);

    return {
      min: Math.min(...perSprintRanges.map((range) => range.min)),
      avg: averageFiniteScores(sprintAverages),
      max: Math.max(...perSprintRanges.map((range) => range.max)),
    };
  }, [
    activeSprintIds,
    relevantMemberScoreRows,
    scoreboardMemberIdList,
    selectedOfValue,
  ]);

  const displayedHoursRangeMin = scorePointsLoading
    ? "…"
    : formatAccumulatedHours(accumulatedHoursRange.min);
  const displayedHoursRangeAvg = scorePointsLoading
    ? "…"
    : formatAccumulatedHours(accumulatedHoursRange.avg);
  const displayedHoursRangeMax = scorePointsLoading
    ? "…"
    : formatAccumulatedHours(accumulatedHoursRange.max);

  const teamBonusPointsTotal = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    return getTeamExtraPointsTotal(
      relevantPerformanceRows,
      scoreboardMemberIdList,
    );
  }, [activeSprintIds, relevantPerformanceRows, scoreboardMemberIdList]);

  const teamBonusPointsAverage = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    return getTeamExtraPointsAverage(
      relevantPerformanceRows,
      scoreboardMemberIdList,
    );
  }, [activeSprintIds, relevantPerformanceRows, scoreboardMemberIdList]);

  const relevantProfessionalismScores = useMemo(
    () =>
      professionalismScores.filter(
        (row) =>
          activeSprintIds.includes(row.sprint_id) &&
          scoreboardMemberIds.has(row.member_id),
      ),
    [activeSprintIds, professionalismScores, scoreboardMemberIds],
  );

  const sortedProfessionalismItems = useMemo(
    () =>
      [...professionalismItems].sort((left, right) => {
        const leftLabel = (left.name ?? left.code ?? "").trim().toLowerCase();
        const rightLabel = (right.name ?? right.code ?? "").trim().toLowerCase();
        return leftLabel.localeCompare(rightLabel);
      }),
    [professionalismItems],
  );

  const memberRankingSections = useMemo((): MemberRankingSection[] => {
    if (activeSprintIds.length === 0) {
      return [];
    }

    const buildRankingEntries = (input: {
      performanceRows: MemberPerformanceScoreRow[];
      criteriaRows: MemberSprintCriteriaScoreRow[];
      professionalismRows: MemberSprintProfessionalismScoreRow[];
      useStoredGrade: boolean;
    }): MemberRankingEntry[] => {
      const ranked = memberOptions
        .map((member) => {
          const scorePoints = getMemberPerformanceFieldAverage(
            input.performanceRows,
            member.id,
            "average_score",
          );

          let grade: PerformanceScoreGrade | null = null;

          if (input.useStoredGrade) {
            const memberScore = input.performanceRows.find(
              (row) => row.member_id === member.id,
            );
            grade = memberScore?.score_grade ?? null;
          }

          if (grade === null && scorePoints !== null) {
            grade = resolvePerformanceScoreGrade(
              scorePoints,
              DEFAULT_PASSING_THRESHOLD,
            );
          }

          const rates = buildSkillRadarValues({
            criteriaScoreRows: input.criteriaRows,
            performanceRows: input.performanceRows,
            memberIds: scoreboardMemberIdList,
            selectedMemberId: member.id,
            professionalismScoreRows: input.professionalismRows,
            professionalismItems: sortedProfessionalismItems,
          });

          const professionalismItemScores = sortedProfessionalismItems.map(
            (item) => {
              const averageValue = getMemberProfessionalismItemAverage(
                input.professionalismRows,
                member.id,
                item.id,
              );

              return {
                itemId: item.id,
                label:
                  item.name?.trim() || item.code?.trim() || "Professionalism",
                score:
                  averageValue === null
                    ? null
                    : Math.round(averageValue * 10) / 10,
                max: Math.max(
                  Number(item.value) || PROFESSIONALISM_PIP_COUNT,
                  1,
                ),
              };
            },
          );

          return {
            memberId: member.id,
            name: getStatisticsMemberName(member),
            scorePoints,
            grade,
            rates,
            professionalismItems: professionalismItemScores,
          };
        })
        .sort((entryA, entryB) => {
          const scoreA = entryA.scorePoints;
          const scoreB = entryB.scorePoints;

          if (scoreA === null && scoreB === null) {
            return entryA.name.localeCompare(entryB.name);
          }

          if (scoreA === null) {
            return 1;
          }

          if (scoreB === null) {
            return -1;
          }

          if (scoreB !== scoreA) {
            return scoreB - scoreA;
          }

          return entryA.name.localeCompare(entryB.name);
        });

      return ranked.map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
    };

    const buildSprintRankingSection = (
      sprint: StatisticsSprintRow,
      performanceRows: MemberPerformanceScoreRow[],
      criteriaRows: MemberSprintCriteriaScoreRow[],
      professionalismRows: MemberSprintProfessionalismScoreRow[],
      memberId: string,
    ): MemberRankingSection | null => {
      const sprintPerformanceRows = performanceRows.filter(
        (row) => row.sprint_id === sprint.id,
      );
      const sprintCriteriaRows = criteriaRows.filter(
        (row) => row.sprint_id === sprint.id,
      );
      const sprintProfessionalismRows = professionalismRows.filter(
        (row) => row.sprint_id === sprint.id,
      );

      const allSprintEntries = buildRankingEntries({
        performanceRows: sprintPerformanceRows,
        criteriaRows: sprintCriteriaRows,
        professionalismRows: sprintProfessionalismRows,
        useStoredGrade: true,
      });
      const sprintEntries = allSprintEntries.filter(
        (entry) => entry.memberId === memberId,
      );

      if (sprintEntries.length === 0) {
        return null;
      }

      return {
        key: sprint.id,
        label: formatMemberSprintRankingLabel(sprint),
        peerCount: Math.max(allSprintEntries.length, 1),
        entries: sprintEntries,
      };
    };

    const getMemberInvolvedSprints = (
      performanceRows: MemberPerformanceScoreRow[],
      memberId: string,
      sprintIds?: string[],
    ) =>
      selectableSprints
        .filter((sprint) =>
          sprintIds ? sprintIds.includes(sprint.id) : true,
        )
        .filter((sprint) =>
          performanceRows.some(
            (row) =>
              row.sprint_id === sprint.id && row.member_id === memberId,
          ),
        )
        .sort(compareSprintsByQuarterThenNumberDesc);

    const getPeriodOverallRankingLabel = (): string | null => {
      if (showMode === "year" && selectedYear) {
        return `${selectedYear} Overall`;
      }

      if (showMode === "quarter") {
        const option = quarterOptions.find(
          (entry) => entry.value === selectedQuarter,
        );
        return option ? `${option.label} Overall` : null;
      }

      if (showMode === "month") {
        const option = monthOptions.find(
          (entry) => entry.value === selectedMonth,
        );
        return option ? `${option.label} Overall` : null;
      }

      return null;
    };

    const isMemberFiltered = selectedOfValue !== TEAM_FILTER_VALUE;

    if (
      isMemberFiltered &&
      (showMode === "year" || showMode === "quarter" || showMode === "month")
    ) {
      const sections: MemberRankingSection[] = [];

      const allPeriodEntries = buildRankingEntries({
        performanceRows: relevantPerformanceRows,
        criteriaRows: relevantCriteriaRows,
        professionalismRows: relevantProfessionalismScores,
        useStoredGrade: false,
      });
      const memberPeriodEntries = allPeriodEntries.filter(
        (entry) => entry.memberId === selectedOfValue,
      );

      if (memberPeriodEntries.length > 0) {
        sections.push({
          key: "period-overall",
          label: getPeriodOverallRankingLabel(),
          peerCount: Math.max(allPeriodEntries.length, 1),
          entries: memberPeriodEntries,
        });
      }

      const involvedSprints = getMemberInvolvedSprints(
        relevantPerformanceRows,
        selectedOfValue,
        activeSprintIds,
      );

      for (const sprint of involvedSprints) {
        const section = buildSprintRankingSection(
          sprint,
          relevantPerformanceRows,
          relevantCriteriaRows,
          relevantProfessionalismScores,
          selectedOfValue,
        );

        if (section) {
          sections.push(section);
        }
      }

      return sections;
    }

    if (isMemberFiltered && showMode === "sprint") {
      const allPerformanceRows = sprintPerformanceScores.filter((row) =>
        scoreboardMemberIds.has(row.member_id),
      );
      const allCriteriaRows = sprintCriteriaScores.filter((row) =>
        scoreboardMemberIds.has(row.member_id),
      );
      const allProfessionalismRows = professionalismScores.filter((row) =>
        scoreboardMemberIds.has(row.member_id),
      );

      const memberInvolvedSprints = getMemberInvolvedSprints(
        allPerformanceRows,
        selectedOfValue,
      );
      const selectedSprint = selectableSprints.find(
        (sprint) => sprint.id === selectedSprintId,
      );
      const otherSprints = memberInvolvedSprints.filter(
        (sprint) => sprint.id !== selectedSprintId,
      );
      const orderedSprints = [
        ...(selectedSprint &&
        memberInvolvedSprints.some((sprint) => sprint.id === selectedSprintId)
          ? [selectedSprint]
          : []),
        ...otherSprints,
      ];

      const sections: MemberRankingSection[] = [];

      for (const sprint of orderedSprints) {
        const section = buildSprintRankingSection(
          sprint,
          allPerformanceRows,
          allCriteriaRows,
          allProfessionalismRows,
          selectedOfValue,
        );

        if (section) {
          sections.push(section);
        }
      }

      return sections;
    }

    const allPeriodEntries = buildRankingEntries({
      performanceRows: relevantPerformanceRows,
      criteriaRows: relevantCriteriaRows,
      professionalismRows: relevantProfessionalismScores,
      useStoredGrade: showMode === "sprint" && activeSprintIds.length === 1,
    });
    const periodEntries = allPeriodEntries.filter((entry) =>
      selectedOfValue === TEAM_FILTER_VALUE
        ? true
        : entry.memberId === selectedOfValue,
    );

    if (periodEntries.length === 0) {
      return [];
    }

    return [
      {
        key: "period",
        label: null,
        peerCount: Math.max(allPeriodEntries.length, 1),
        entries: periodEntries,
      },
    ];
  }, [
    activeSprintIds,
    memberOptions,
    monthOptions,
    professionalismScores,
    quarterOptions,
    relevantCriteriaRows,
    relevantPerformanceRows,
    relevantProfessionalismScores,
    scoreboardMemberIdList,
    scoreboardMemberIds,
    selectableSprints,
    selectedMonth,
    selectedOfValue,
    selectedQuarter,
    selectedSprintId,
    selectedYear,
    showMode,
    sortedProfessionalismItems,
    sprintCriteriaScores,
    sprintPerformanceScores,
  ]);

  const professionalismTotalAverageMetric = useMemo(() => {
    const totalMax = sortedProfessionalismItems.reduce(
      (sum, item) => sum + Math.max(Number(item.value) || 0, 0),
      0,
    );

    if (activeSprintIds.length === 0 || sortedProfessionalismItems.length === 0) {
      return { value: 0, max: Math.max(totalMax, 1) };
    }

    const totalValue = sortedProfessionalismItems.reduce((sum, item) => {
      const averageValue =
        selectedOfValue === TEAM_FILTER_VALUE
          ? getTeamProfessionalismItemAverage(
              relevantProfessionalismScores,
              scoreboardMemberIdList,
              item.id,
            )
          : getMemberProfessionalismItemAverage(
              relevantProfessionalismScores,
              selectedOfValue,
              item.id,
            );

      return sum + (averageValue === null ? 0 : Math.round(averageValue * 10) / 10);
    }, 0);

    return {
      value: Math.round(totalValue * 10) / 10,
      max: Math.max(totalMax, 1),
    };
  }, [
    activeSprintIds,
    relevantProfessionalismScores,
    scoreboardMemberIdList,
    selectedOfValue,
    sortedProfessionalismItems,
  ]);

  const skillRadarValues = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return EMPTY_SKILL_RADAR_VALUES;
    }

    const builtValues = buildSkillRadarValues({
      criteriaScoreRows: relevantCriteriaRows,
      performanceRows: relevantPerformanceRows,
      memberIds: scoreboardMemberIdList,
      selectedMemberId:
        selectedOfValue === TEAM_FILTER_VALUE ? null : selectedOfValue,
      professionalismScoreRows: relevantProfessionalismScores,
      professionalismItems: sortedProfessionalismItems,
    });

    // Exact same ratio as Professionalism Total Average (e.g. 18.8/25 → 75.2%).
    const professionalismPercent =
      (professionalismTotalAverageMetric.value /
        professionalismTotalAverageMetric.max) *
      100;

    return normalizeSkillRadarValues({
      ...builtValues,
      professionalism: professionalismPercent,
    });
  }, [
    activeSprintIds,
    professionalismTotalAverageMetric.max,
    professionalismTotalAverageMetric.value,
    relevantCriteriaRows,
    relevantPerformanceRows,
    relevantProfessionalismScores,
    scoreboardMemberIdList,
    selectedOfValue,
    sortedProfessionalismItems,
  ]);

  const displayedSkillRadarValues = scorePointsLoading
    ? EMPTY_SKILL_RADAR_VALUES
    : skillRadarValues;

  const performanceScoresBySprintEntries = useMemo(() => {
    if (showMode === "sprint" || activeSprintIds.length === 0) {
      return [];
    }

    const selectedMemberId =
      selectedOfValue === TEAM_FILTER_VALUE ? null : selectedOfValue;

    const activeSprints = selectableSprints
      .filter((sprint) => activeSprintIds.includes(sprint.id))
      .sort(
        (sprintA, sprintB) =>
          getSprintListingSortTimestamp(sprintA) -
          getSprintListingSortTimestamp(sprintB),
      );

    return activeSprints.map((sprint) => {
      const sprintCriteriaRows = relevantCriteriaRows.filter(
        (row) => row.sprint_id === sprint.id,
      );
      const sprintPerformanceRows = relevantPerformanceRows.filter(
        (row) => row.sprint_id === sprint.id,
      );
      const sprintProfessionalismRows = relevantProfessionalismScores.filter(
        (row) => row.sprint_id === sprint.id,
      );

      const skillValues = normalizeSkillRadarValues(
        buildSkillRadarValues({
          criteriaScoreRows: sprintCriteriaRows,
          performanceRows: sprintPerformanceRows,
          memberIds: scoreboardMemberIdList,
          selectedMemberId,
          professionalismScoreRows: sprintProfessionalismRows,
          professionalismItems: sortedProfessionalismItems,
        }),
      );

      return {
        id: sprint.id,
        label: formatStatisticsSprintLabel(sprint),
        sublabel: formatStatisticsSprintStartDateLabel(sprint.start_date),
        productivity: skillValues.productivity,
        efficiency: skillValues.efficiency,
        quality: skillValues.quality,
        collaboration: skillValues.collaboration,
        velocity: skillValues.velocity,
        professionalism: skillValues.professionalism,
      };
    });
  }, [
    activeSprintIds,
    relevantCriteriaRows,
    relevantPerformanceRows,
    relevantProfessionalismScores,
    scoreboardMemberIdList,
    selectableSprints,
    selectedOfValue,
    showMode,
    sortedProfessionalismItems,
  ]);

  const metricsComparisonTrendMeta = useMemo(() => {
    const title = getStatisticsMetricsTrendLabel(showMode);
    if (showMode === "year") {
      return {
        title: selectedYear ? `${title} — ${selectedYear}` : title,
        emptyPreviousLabel: "No previous month",
        emptyEntriesLabel: "No monthly score data for the selected year.",
      };
    }

    if (showMode === "month") {
      const option = monthOptions.find((entry) => entry.value === selectedMonth);
      return {
        title: option ? `${title} — ${option.label}` : title,
        emptyPreviousLabel: "No previous month",
        emptyEntriesLabel: "No monthly score data for the selected period.",
      };
    }

    if (showMode === "quarter") {
      const option = quarterOptions.find(
        (entry) => entry.value === selectedQuarter,
      );
      return {
        title: option ? `${title} — ${option.label}` : title,
        emptyPreviousLabel: "No previous month",
        emptyEntriesLabel: "No monthly score data for the selected quarter.",
      };
    }

    const sprint = selectableSprints.find(
      (entry) => entry.id === selectedSprintId,
    );
    return {
      title: sprint
        ? `${title} — ${formatStatisticsSprintLabel(sprint)}`
        : title,
      emptyPreviousLabel: "No previous sprint",
      emptyEntriesLabel: "No sprint score data for the selected period.",
    };
  }, [
    monthOptions,
    quarterOptions,
    selectableSprints,
    selectedMonth,
    selectedQuarter,
    selectedSprintId,
    selectedYear,
    showMode,
  ]);

  const metricsComparisonTrendEntries = useMemo((): PerformanceScoresBySprintPoint[] => {
    if (metricsTrendSprintIds.length === 0) {
      return [];
    }

    const selectedMemberId =
      selectedOfValue === TEAM_FILTER_VALUE ? null : selectedOfValue;

    const buildPointForSprintIds = (input: {
      id: string;
      label: string;
      labelLines?: string[];
      sublabel?: string | null;
      sprintIds: string[];
    }): PerformanceScoresBySprintPoint => {
      const sprintIdSet = new Set(input.sprintIds);
      const criteriaRows = sprintCriteriaScores.filter(
        (row) =>
          sprintIdSet.has(row.sprint_id) &&
          scoreboardMemberIds.has(row.member_id),
      );
      const performanceRows = sprintPerformanceScores.filter(
        (row) =>
          sprintIdSet.has(row.sprint_id) &&
          scoreboardMemberIds.has(row.member_id),
      );
      const professionalismRows = professionalismScores.filter(
        (row) =>
          sprintIdSet.has(row.sprint_id) &&
          scoreboardMemberIds.has(row.member_id),
      );
      const memberScoreRows = sprintMemberScores.filter(
        (row) =>
          sprintIdSet.has(row.sprint_id) &&
          scoreboardMemberIds.has(row.member_id),
      );

      const skillValues = normalizeSkillRadarValues(
        buildSkillRadarValues({
          criteriaScoreRows: criteriaRows,
          performanceRows,
          memberIds: scoreboardMemberIdList,
          selectedMemberId,
          professionalismScoreRows: professionalismRows,
          professionalismItems: sortedProfessionalismItems,
        }),
      );

      const professionalismTotalMax = sortedProfessionalismItems.reduce(
        (sum, item) => sum + Math.max(Number(item.value) || 0, 0),
        0,
      );
      const professionalismTotalValue = sortedProfessionalismItems.reduce(
        (sum, item) => {
          const averageValue =
            selectedOfValue === TEAM_FILTER_VALUE
              ? getTeamProfessionalismItemAverage(
                  professionalismRows,
                  scoreboardMemberIdList,
                  item.id,
                )
              : getMemberProfessionalismItemAverage(
                  professionalismRows,
                  selectedOfValue,
                  item.id,
                );

          return (
            sum +
            (averageValue === null ? 0 : Math.round(averageValue * 10) / 10)
          );
        },
        0,
      );
      const professionalismPercent =
        professionalismTotalMax > 0
          ? (Math.round(professionalismTotalValue * 10) /
              10 /
              professionalismTotalMax) *
            100
          : skillValues.professionalism;

      const overallScore =
        selectedOfValue === TEAM_FILTER_VALUE
          ? getTeamPerformanceFieldAverage(
              performanceRows,
              scoreboardMemberIdList,
              "average_score",
            )
          : getMemberPerformanceFieldAverage(
              performanceRows,
              selectedOfValue,
              "average_score",
            );

      const hoursAccumulated =
        selectedOfValue === TEAM_FILTER_VALUE
          ? getTeamSprintScoreFieldTotal(
              memberScoreRows,
              scoreboardMemberIdList,
              "accumulated_hours",
            )
          : getMemberSprintScoreFieldTotal(
              memberScoreRows,
              selectedOfValue,
              "accumulated_hours",
            );

      return {
        id: input.id,
        label: input.label,
        labelLines: input.labelLines,
        sublabel: input.sublabel ?? null,
        productivity: skillValues.productivity,
        efficiency: skillValues.efficiency,
        quality: skillValues.quality,
        collaboration: skillValues.collaboration,
        velocity: skillValues.velocity,
        professionalism: professionalismPercent,
        overallScore: overallScore ?? 0,
        hoursAccumulated:
          hoursAccumulated === null
            ? 0
            : Math.round(hoursAccumulated * 10) / 10,
      };
    };

    if (showMode === "sprint") {
      const trendSprints = selectableSprints
        .filter((sprint) => metricsTrendSprintIds.includes(sprint.id))
        .sort(
          (sprintA, sprintB) =>
            getSprintListingSortTimestamp(sprintA) -
            getSprintListingSortTimestamp(sprintB),
        );

      return trendSprints.map((sprint) =>
        buildPointForSprintIds({
          id: sprint.id,
          label: formatStatisticsSprintLabel(sprint),
          labelLines: formatStatisticsSprintTrendLabelLines(sprint),
          sublabel: formatStatisticsSprintTrendDateLabel(sprint.start_date),
          sprintIds: [sprint.id],
        }),
      );
    }

    let year = 0;
    let endMonth = 12;

    if (showMode === "year") {
      year = Number(selectedYear);
      endMonth = 12;
    } else if (showMode === "month") {
      const parsedMonth = parseSelectedMonthValue(selectedMonth);
      if (!parsedMonth) {
        return [];
      }
      year = parsedMonth.year;
      endMonth = parsedMonth.month;
    } else {
      const parsedQuarter = parseSelectedQuarterValue(selectedQuarter);
      if (!parsedQuarter) {
        return [];
      }
      year = parsedQuarter.year;
      endMonth = getQuarterEndMonth(parsedQuarter.quarter);
    }

    if (!Number.isFinite(year) || year <= 0) {
      return [];
    }

    const monthsInRange = [
      ...new Set(
        selectableSprints
          .filter((sprint) => metricsTrendSprintIds.includes(sprint.id))
          .map((sprint) => getSprintListingMonth(sprint))
          .filter(
            (month): month is number =>
              month !== null && month >= 1 && month <= endMonth,
          ),
      ),
    ].sort((monthA, monthB) => monthA - monthB);

    if (
      (showMode === "month" || showMode === "quarter") &&
      !monthsInRange.includes(endMonth)
    ) {
      monthsInRange.push(endMonth);
    }

    return monthsInRange.map((month) => {
      const monthSprintIds = selectableSprints
        .filter((sprint) => {
          if (!metricsTrendSprintIds.includes(sprint.id)) {
            return false;
          }

          return (
            getSprintListingYear(sprint) === year &&
            getSprintListingMonth(sprint) === month
          );
        })
        .map((sprint) => sprint.id);

      return buildPointForSprintIds({
        id: `${year}-${month}`,
        label: getSprintMonthShortLabel(month),
        sublabel: String(year),
        sprintIds: monthSprintIds,
      });
    });
  }, [
    metricsTrendSprintIds,
    professionalismScores,
    scoreboardMemberIdList,
    scoreboardMemberIds,
    selectableSprints,
    selectedMonth,
    selectedOfValue,
    selectedQuarter,
    selectedYear,
    showMode,
    sortedProfessionalismItems,
    sprintCriteriaScores,
    sprintMemberScores,
    sprintPerformanceScores,
  ]);

  const performanceStats = useMemo((): StatBar[] => {
    const previousMemberScoreRows = sprintMemberScores.filter(
      (row) =>
        previousSprintIds.includes(row.sprint_id) &&
        scoreboardMemberIds.has(row.member_id),
    );
    const previousPerformanceRows = sprintPerformanceScores.filter(
      (row) =>
        previousSprintIds.includes(row.sprint_id) &&
        scoreboardMemberIds.has(row.member_id),
    );
    const previousProfessionalismRows = professionalismScores.filter(
      (row) =>
        previousSprintIds.includes(row.sprint_id) &&
        scoreboardMemberIds.has(row.member_id),
    );

    const hasPreviousPeriod = previousSprintIds.length > 0;
    const changeLabel = hasPreviousPeriod
      ? previousPeriodComparisonLabel
      : null;

    const withChange = (
      stat: StatBar,
      currentRaw: number | null,
      previousRaw: number | null,
    ): StatBar => {
      const change = getMetricChange(previousRaw, currentRaw);
      return {
        ...stat,
        changeDirection: change.direction,
        changeDelta: change.delta,
        changeLabel,
      };
    };

    const previousCompletedTasksRaw =
      !hasPreviousPeriod
        ? null
        : selectedOfValue === TEAM_FILTER_VALUE
          ? getTeamSprintScoreFieldTotal(
              previousMemberScoreRows,
              scoreboardMemberIdList,
              "completed_tasks_count",
            )
          : getMemberSprintScoreFieldTotal(
              previousMemberScoreRows,
              selectedOfValue,
              "completed_tasks_count",
            );
    const previousAverageVelocityRaw =
      !hasPreviousPeriod
        ? null
        : selectedOfValue === TEAM_FILTER_VALUE
          ? getTeamSprintScoreFieldAverage(
              previousMemberScoreRows,
              scoreboardMemberIdList,
              "completed_story_points",
            )
          : getMemberSprintScoreFieldAverage(
              previousMemberScoreRows,
              selectedOfValue,
              "completed_story_points",
            );
    const previousVelocityByHourRaw =
      !hasPreviousPeriod
        ? null
        : selectedOfValue === TEAM_FILTER_VALUE
          ? getTeamPerformanceFieldAverage(
              previousPerformanceRows,
              scoreboardMemberIdList,
              "velocity_by_hour",
            )
          : getMemberPerformanceFieldAverage(
              previousPerformanceRows,
              selectedOfValue,
              "velocity_by_hour",
            );
    const previousBestStoryPointsRaw =
      !hasPreviousPeriod
        ? null
        : selectedOfValue === TEAM_FILTER_VALUE
          ? getHighestCompletedStoryPoints(previousMemberScoreRows)
          : getHighestCompletedStoryPoints(
              previousMemberScoreRows,
              selectedOfValue,
            );
    const previousAssignedStoryPointsRaw =
      !hasPreviousPeriod
        ? null
        : selectedOfValue === TEAM_FILTER_VALUE
          ? getTeamAssignedStoryPointsTotal(
              previousPerformanceRows,
              scoreboardMemberIdList,
            )
          : getMemberAssignedStoryPointsTotal(
              previousPerformanceRows,
              selectedOfValue,
            );
    const previousAccumulatedHoursRaw =
      !hasPreviousPeriod
        ? null
        : selectedOfValue === TEAM_FILTER_VALUE
          ? getTeamSprintScoreFieldTotal(
              previousMemberScoreRows,
              scoreboardMemberIdList,
              "accumulated_hours",
            )
          : getMemberSprintScoreFieldTotal(
              previousMemberScoreRows,
              selectedOfValue,
              "accumulated_hours",
            );
    const previousBonusPointsRaw =
      !hasPreviousPeriod
        ? null
        : selectedOfValue === TEAM_FILTER_VALUE
          ? getTeamExtraPointsTotal(
              previousPerformanceRows,
              scoreboardMemberIdList,
            )
          : getMemberExtraPointsTotal(
              previousPerformanceRows,
              selectedOfValue,
            );

    const completedTasks =
      tasksCompletedValue === null ? null : Math.round(tasksCompletedValue);
    const previousCompletedTasks =
      previousCompletedTasksRaw === null
        ? null
        : Math.round(previousCompletedTasksRaw);
    const highestCompletedTasks =
      highestCompletedTasksAmongMembers === null
        ? null
        : Math.round(highestCompletedTasksAmongMembers);
    const averageVelocity =
      averageVelocityValue === null ? null : Math.round(averageVelocityValue);
    const previousAverageVelocity =
      previousAverageVelocityRaw === null
        ? null
        : Math.round(previousAverageVelocityRaw);
    const highestAverageVelocity =
      highestAverageVelocityAmongMembers === null
        ? null
        : Math.round(highestAverageVelocityAmongMembers);
    const velocityByHour =
      velocityByHourValue === null
        ? null
        : Math.round(velocityByHourValue * 100) / 100;
    const previousVelocityByHour =
      previousVelocityByHourRaw === null
        ? null
        : Math.round(previousVelocityByHourRaw * 100) / 100;
    const highestVelocityByHour =
      highestVelocityByHourAmongMembers === null
        ? null
        : Math.round(highestVelocityByHourAmongMembers * 100) / 100;
    const bestStoryPoints =
      bestStoryPointsValue === null
        ? null
        : Math.ceil(bestStoryPointsValue);
    const previousBestStoryPoints =
      previousBestStoryPointsRaw === null
        ? null
        : Math.ceil(previousBestStoryPointsRaw);
    const highestBestStoryPoints =
      highestBestStoryPointsAmongMembers === null
        ? null
        : Math.ceil(highestBestStoryPointsAmongMembers);
    const assignedStoryPoints =
      assignedStoryPointsValue === null
        ? null
        : Math.round(assignedStoryPointsValue);
    const previousAssignedStoryPoints =
      previousAssignedStoryPointsRaw === null
        ? null
        : Math.round(previousAssignedStoryPointsRaw);
    const assignedStoryPointsMax =
      selectedOfValue === TEAM_FILTER_VALUE
        ? teamAssignedStoryPointsTotal === null
          ? null
          : Math.round(teamAssignedStoryPointsTotal)
        : teamAssignedStoryPointsAverage === null
          ? null
          : Math.round(teamAssignedStoryPointsAverage);
    const bonusPoints =
      bonusPointsValue === null ? null : Math.round(bonusPointsValue);
    const previousBonusPoints =
      previousBonusPointsRaw === null ? null : Math.round(previousBonusPointsRaw);
    const bonusPointsMax =
      selectedOfValue === TEAM_FILTER_VALUE
        ? teamBonusPointsTotal === null
          ? null
          : Math.round(teamBonusPointsTotal)
        : teamBonusPointsAverage === null
          ? null
          : Math.round(teamBonusPointsAverage);
    const accumulatedHours =
      accumulatedHoursValue === null
        ? null
        : Math.round(accumulatedHoursValue * 10) / 10;
    const previousAccumulatedHours =
      previousAccumulatedHoursRaw === null
        ? null
        : Math.round(previousAccumulatedHoursRaw * 10) / 10;
    const highestAccumulatedHours =
      highestAccumulatedHoursAmongMembers === null
        ? null
        : Math.round(highestAccumulatedHoursAmongMembers * 10) / 10;

    const baseStats = devData.stats.map((stat) => {
      if (stat.label === "Tasks Completed") {
        if (scorePointsLoading) {
          return withChange(
            { ...stat, value: 0, max: Math.max(stat.max, 1) },
            null,
            null,
          );
        }

        const value = completedTasks ?? 0;
        const max = Math.max(highestCompletedTasks ?? 0, value, 1);

        return withChange(
          { ...stat, value, max },
          completedTasks,
          previousCompletedTasks,
        );
      }

      if (stat.label === "Average Velocity") {
        if (scorePointsLoading) {
          return withChange(
            { ...stat, value: 0, max: Math.max(stat.max, 1) },
            null,
            null,
          );
        }

        const value = averageVelocity ?? 0;
        const max = Math.max(highestAverageVelocity ?? 0, value, 1);

        return withChange(
          { ...stat, value, max },
          averageVelocity,
          previousAverageVelocity,
        );
      }

      if (stat.label === "Velocity By Hour (Story Points per Hour)") {
        if (scorePointsLoading) {
          return withChange(
            { ...stat, value: 0, max: Math.max(stat.max, 1) },
            null,
            null,
          );
        }

        const value = velocityByHour ?? 0;
        const max = Math.max(highestVelocityByHour ?? 0, value, 0.01);

        return withChange(
          { ...stat, value, max },
          velocityByHour,
          previousVelocityByHour,
        );
      }

      if (stat.label === "Best Story Points") {
        if (scorePointsLoading) {
          return withChange(
            { ...stat, value: 0, max: Math.max(stat.max, 1) },
            null,
            null,
          );
        }

        const value = bestStoryPoints ?? 0;
        const max = Math.max(highestBestStoryPoints ?? 0, value, 1);

        return withChange(
          { ...stat, value, max },
          bestStoryPoints,
          previousBestStoryPoints,
        );
      }

      if (stat.label === "Assigned Story Points") {
        if (scorePointsLoading) {
          return withChange(
            { ...stat, value: 0, max: Math.max(stat.max, 1) },
            null,
            null,
          );
        }

        const value = assignedStoryPoints ?? 0;
        const max = Math.max(assignedStoryPointsMax ?? 0, value, 1);

        return withChange(
          { ...stat, value, max },
          assignedStoryPoints,
          previousAssignedStoryPoints,
        );
      }

      if (stat.label === "Accumulated Hours") {
        if (scorePointsLoading) {
          return withChange(
            { ...stat, value: 0, max: Math.max(stat.max, 1) },
            null,
            null,
          );
        }

        const value = accumulatedHours ?? 0;
        const max = Math.max(highestAccumulatedHours ?? 0, value, 1);

        return withChange(
          { ...stat, value, max },
          accumulatedHours,
          previousAccumulatedHours,
        );
      }

      if (stat.label === "Bonus Points") {
        if (scorePointsLoading) {
          return withChange(
            { ...stat, value: 0, max: Math.max(stat.max, 1) },
            null,
            null,
          );
        }

        const value = bonusPoints ?? 0;
        const max = Math.max(bonusPointsMax ?? 0, value, 1);

        return withChange(
          { ...stat, value, max },
          bonusPoints,
          previousBonusPoints,
        );
      }

      return withChange(stat, null, null);
    });

    const professionalismStats: StatBar[] = sortedProfessionalismItems.map(
      (item) => {
        const label = item.name?.trim() || item.code?.trim() || "Professionalism";
        const itemMax = Math.max(Number(item.value) || 0, 1);

        if (scorePointsLoading || activeSprintIds.length === 0) {
          return withChange(
            {
              label,
              value: 0,
              max: itemMax,
              unit: "",
            },
            null,
            null,
          );
        }

        const averageValue =
          selectedOfValue === TEAM_FILTER_VALUE
            ? getTeamProfessionalismItemAverage(
                relevantProfessionalismScores,
                scoreboardMemberIdList,
                item.id,
              )
            : getMemberProfessionalismItemAverage(
                relevantProfessionalismScores,
                selectedOfValue,
                item.id,
              );

        const previousAverageValue = !hasPreviousPeriod
          ? null
          : selectedOfValue === TEAM_FILTER_VALUE
            ? getTeamProfessionalismItemAverage(
                previousProfessionalismRows,
                scoreboardMemberIdList,
                item.id,
              )
            : getMemberProfessionalismItemAverage(
                previousProfessionalismRows,
                selectedOfValue,
                item.id,
              );

        const value =
          averageValue === null
            ? 0
            : Math.round(averageValue * 10) / 10;
        const previousValue =
          previousAverageValue === null
            ? null
            : Math.round(previousAverageValue * 10) / 10;

        return withChange(
          {
            label,
            value,
            max: itemMax,
            unit: "",
          },
          averageValue === null ? null : value,
          previousValue,
        );
      },
    );

    const professionalismTotalMax = professionalismTotalAverageMetric.max;
    const professionalismTotalValue = professionalismTotalAverageMetric.value;

    const previousProfessionalismTotalValue = !hasPreviousPeriod
      ? null
      : sortedProfessionalismItems.reduce((sum, item) => {
          const averageValue =
            selectedOfValue === TEAM_FILTER_VALUE
              ? getTeamProfessionalismItemAverage(
                  previousProfessionalismRows,
                  scoreboardMemberIdList,
                  item.id,
                )
              : getMemberProfessionalismItemAverage(
                  previousProfessionalismRows,
                  selectedOfValue,
                  item.id,
                );

          return (
            sum +
            (averageValue === null ? 0 : Math.round(averageValue * 10) / 10)
          );
        }, 0);

    const professionalismTotalAverage: StatBar = withChange(
      {
        label: "Professionalism Total Average",
        value:
          scorePointsLoading || activeSprintIds.length === 0
            ? 0
            : professionalismTotalValue,
        max: Math.max(professionalismTotalMax, 1),
        unit: "",
        highlighted: true,
      },
      scorePointsLoading || activeSprintIds.length === 0
        ? null
        : professionalismTotalValue,
      previousProfessionalismTotalValue === null
        ? null
        : Math.round(previousProfessionalismTotalValue * 10) / 10,
    );

    return [
      ...baseStats,
      ...professionalismStats,
      ...(sortedProfessionalismItems.length > 0
        ? [professionalismTotalAverage]
        : []),
    ];
  }, [
    accumulatedHoursValue,
    activeSprintIds,
    assignedStoryPointsValue,
    averageVelocityValue,
    bestStoryPointsValue,
    bonusPointsValue,
    highestAccumulatedHoursAmongMembers,
    highestAverageVelocityAmongMembers,
    highestBestStoryPointsAmongMembers,
    highestCompletedTasksAmongMembers,
    highestVelocityByHourAmongMembers,
    previousPeriodComparisonLabel,
    previousSprintIds,
    professionalismScores,
    professionalismTotalAverageMetric.max,
    professionalismTotalAverageMetric.value,
    relevantProfessionalismScores,
    scorePointsLoading,
    scoreboardMemberIdList,
    scoreboardMemberIds,
    selectedOfValue,
    sortedProfessionalismItems,
    sprintMemberScores,
    sprintPerformanceScores,
    tasksCompletedValue,
    teamAssignedStoryPointsAverage,
    teamAssignedStoryPointsTotal,
    teamBonusPointsAverage,
    teamBonusPointsTotal,
    velocityByHourValue,
  ]);

  useEffect(() => {
    setTimeout(() => setMounted(true), 100);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSprintPerformanceScores() {
      if (activeSprintIds.length === 0) {
        if (!cancelled) {
          setSprintPerformanceScores([]);
          setSprintCriteriaScores([]);
          setSprintMemberScores([]);
          setProfessionalismScores([]);
          setScorePointsLoading(false);
        }
        return;
      }

      setScorePointsLoading(true);

      try {
        const performanceQueryOptions =
          scoreFetchSprintIds.length === 1
            ? {
                select:
                  "member_id,sprint_id,average_score,score_grade,total_story_points,assigned_story_points,extra_points,velocity_by_hour",
                eq: { sprint_id: scoreFetchSprintIds[0] },
              }
            : {
                select:
                  "member_id,sprint_id,average_score,score_grade,total_story_points,assigned_story_points,extra_points,velocity_by_hour",
                in: { sprint_id: scoreFetchSprintIds },
              };

        const criteriaQueryOptions =
          scoreFetchSprintIds.length === 1
            ? {
                select: "member_id,sprint_id,rate,criteria:criteria_id(type)",
                eq: { sprint_id: scoreFetchSprintIds[0] },
              }
            : {
                select: "member_id,sprint_id,rate,criteria:criteria_id(type)",
                in: { sprint_id: scoreFetchSprintIds },
              };

        const memberSprintScoreQueryOptions =
          scoreFetchSprintIds.length === 1
            ? {
                select:
                  "member_id,sprint_id,completed_story_points,completed_tasks_count,accumulated_hours",
                eq: { sprint_id: scoreFetchSprintIds[0] },
              }
            : {
                select:
                  "member_id,sprint_id,completed_story_points,completed_tasks_count,accumulated_hours",
                in: { sprint_id: scoreFetchSprintIds },
              };

        const professionalismScoreQueryOptions =
          scoreFetchSprintIds.length === 1
            ? {
                select: "member_id,sprint_id,item_id,score",
                eq: { sprint_id: scoreFetchSprintIds[0] },
              }
            : {
                select: "member_id,sprint_id,item_id,score",
                in: { sprint_id: scoreFetchSprintIds },
              };

        const [
          performanceRows,
          criteriaRows,
          memberSprintScoreRows,
          professionalismScoreRows,
        ] = await Promise.all([
          getSupabaseRows<MemberPerformanceScoreRow>(
            "members_performance_scores",
            performanceQueryOptions,
          ),
          getSupabaseRows<MemberSprintCriteriaScoreRow>(
            "member_sprint_criteria_scores",
            criteriaQueryOptions,
          ),
          getSupabaseRows<MemberSprintScoreRow>(
            "members_sprint_scores",
            memberSprintScoreQueryOptions,
          ),
          getSupabaseRows<MemberSprintProfessionalismScoreRow>(
            "member_sprint_professionalism_scores",
            professionalismScoreQueryOptions,
          ),
        ]);

        if (!cancelled) {
          setSprintPerformanceScores(performanceRows);
          setSprintCriteriaScores(criteriaRows);
          setSprintMemberScores(memberSprintScoreRows);
          setProfessionalismScores(professionalismScoreRows);
        }
      } catch {
        if (!cancelled) {
          setSprintPerformanceScores([]);
          setSprintCriteriaScores([]);
          setSprintMemberScores([]);
          setProfessionalismScores([]);
        }
      } finally {
        if (!cancelled) {
          setScorePointsLoading(false);
        }
      }
    }

    void loadSprintPerformanceScores();

    return () => {
      cancelled = true;
    };
  }, [activeSprintIds, evaluateResult, scoreFetchSprintIds]);

  useEffect(() => {
    let cancelled = false;

    async function loadFilterOptions() {
      setFiltersLoading(true);
      setFiltersError(null);

      try {
        const [sprintRows, memberRows, passingScoreRows, professionalismItemRows] =
          await Promise.all([
            getSupabaseRows<StatisticsSprintRow>("sprints", {
              select:
                "id,name,sprint_number,sprint_year,sprint_quarter,sprint_month,month,start_date,end_date,is_current",
              order: { column: "start_date", ascending: false },
            }),
            getSupabaseRows<StatisticsMemberRow>("members", {
              select: "id,full_name,first_name,last_name,role",
            }),
            getSupabaseRows<PassingScoreRow>("passing_scores", {
              select: "level,value",
            }),
            getSupabaseRows<ProfessionalismItemRow>("professionalism_items", {
              select: "id,name,code,value",
              order: { column: "name", ascending: true },
            }),
          ]);

        let nextLockedOfMemberId: string | null = null;

        // On the authenticated Statistics page, restrict IC roles to their own "of" view.
        if (showFilters) {
          const session = await getSupabaseSession();
          if (session?.user) {
            const [memberByEmail] = session.user.email
              ? await getSupabaseRows<StatisticsMemberRow>("members", {
                  select: "id,full_name,first_name,last_name,role",
                  eq: { email: session.user.email },
                  limit: 1,
                })
              : [];
            const [memberByAuthUserId] =
              !memberByEmail && session.user.id
                ? await getSupabaseRows<StatisticsMemberRow>("members", {
                    select: "id,full_name,first_name,last_name,role",
                    eq: { auth_user_id: session.user.id },
                    limit: 1,
                  })
                : [];
            const loggedInMember = memberByEmail ?? memberByAuthUserId ?? null;

            if (
              loggedInMember?.id &&
              isScoreboardIncludedMemberRole(loggedInMember.role)
            ) {
              nextLockedOfMemberId = loggedInMember.id;
            }
          }
        }

        if (!cancelled) {
          setSprints(sprintRows);
          setMembers(memberRows);
          setPassingScores(passingScoreRows);
          setProfessionalismItems(professionalismItemRows);
          setLockedOfMemberId(nextLockedOfMemberId);
          if (nextLockedOfMemberId) {
            setSelectedOfValue(nextLockedOfMemberId);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setSprints([]);
          setMembers([]);
          setProfessionalismItems([]);
          setLockedOfMemberId(null);
          setFiltersError(
            error instanceof Error
              ? error.message
              : "Unable to load filter options.",
          );
        }
      } finally {
        if (!cancelled) {
          setFiltersLoading(false);
        }
      }
    }

    void loadFilterOptions();

    return () => {
      cancelled = true;
    };
  }, [showFilters]);

  useEffect(() => {
    setSelectedOfValue((currentValue) => {
      if (lockedOfMemberId) {
        return lockedOfMemberId;
      }

      if (currentValue === TEAM_FILTER_VALUE) {
        return currentValue;
      }

      if (memberOptions.length === 0) {
        return currentValue;
      }

      if (memberOptions.some((member) => member.id === currentValue)) {
        return currentValue;
      }

      return TEAM_FILTER_VALUE;
    });
  }, [lockedOfMemberId, memberOptions]);

  useEffect(() => {
    if (!isEvaluateConfirmOpen) {
      return;
    }

    setEvaluateYear((currentYear) => {
      if (yearOptions.length === 0) {
        return "";
      }

      if (currentYear && yearOptions.includes(Number(currentYear))) {
        return currentYear;
      }

      if (selectedYear && yearOptions.includes(Number(selectedYear))) {
        return selectedYear;
      }

      const currentCalendarYear = new Date().getFullYear();
      if (yearOptions.includes(currentCalendarYear)) {
        return String(currentCalendarYear);
      }

      return String(yearOptions[0]);
    });
  }, [isEvaluateConfirmOpen, selectedYear, yearOptions]);

  async function runEvaluate(): Promise<void> {
    if (!evaluateYear || isEvaluating) {
      return;
    }

    setIsEvaluating(true);
    setEvaluateError(null);
    setEvaluateResult(null);

    try {
      const result = await evaluateMemberPerformanceForYear(evaluateYear);
      setEvaluateResult(result);
      setIsEvaluateConfirmOpen(false);
    } catch (error) {
      setEvaluateError(
        error instanceof Error
          ? error.message
          : "Unable to evaluate member performance for the selected year.",
      );
    } finally {
      setIsEvaluating(false);
    }
  }

  useEffect(() => {
    return () => {
      if (copyToastTimeoutRef.current) {
        window.clearTimeout(copyToastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!downloadError) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDownloadError(null);
    }, 4200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [downloadError]);

  const getPublicStatisticsUrl = () => {
    const url = new URL("/public/statistics", window.location.origin);
    url.searchParams.set("show", showMode);

    if (selectedYear) {
      url.searchParams.set("year", selectedYear);
    }
    if (selectedQuarter) {
      url.searchParams.set("quarter", selectedQuarter);
    }
    if (selectedMonth) {
      url.searchParams.set("month", selectedMonth);
    }
    if (selectedSprintId) {
      url.searchParams.set("sprintId", selectedSprintId);
    }
    url.searchParams.set("of", selectedOfValue || TEAM_FILTER_VALUE);

    return url.toString();
  };

  const openPublicStatisticsPage = () => {
    window.open(getPublicStatisticsUrl(), "_blank", "noopener,noreferrer");
  };

  const copyPublicStatisticsLink = async () => {
    const publicUrl = getPublicStatisticsUrl();

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

  const downloadStatisticsPdf = async () => {
    const target = pageRef.current;
    if (!target || isDownloadingStatistics) return;

    setIsDownloadingStatistics(true);
    setDownloadError(null);

    try {
      const sourceWidth = Math.max(target.scrollWidth, target.clientWidth, 1);
      const sourceHeight = Math.max(target.scrollHeight, target.clientHeight, 1);
      // Stay under browser canvas limits so tall public pages still render.
      const maxDimension = 8192;
      const maxArea = 16_777_216;
      let scale = Math.min(window.devicePixelRatio || 1, 1.5);
      while (
        scale > 0.35 &&
        (sourceWidth * scale > maxDimension ||
          sourceHeight * scale > maxDimension ||
          sourceWidth * scale * sourceHeight * scale > maxArea)
      ) {
        scale *= 0.85;
      }

      const canvas = await html2canvas(target, {
        backgroundColor: "#060d1f",
        ignoreElements: (element) =>
          element.classList.contains("statistics-header-action") ||
          element.classList.contains("statistics-page-toolbar") ||
          element.classList.contains("statistics-copy-toast"),
        scale,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: sourceWidth,
        windowHeight: sourceHeight,
        onclone: (clonedDocument, clonedElement) => {
          sanitizeHtml2CanvasClone(target, clonedDocument, clonedElement);

          if (clonedElement instanceof HTMLElement) {
            clonedElement.style.height = "auto";
            clonedElement.style.maxHeight = "none";
            clonedElement.style.overflow = "visible";
          }

          clonedDocument
            .querySelectorAll<HTMLElement>(
              ".statistics-public-filter, .statistics-member-ranking__header",
            )
            .forEach((element) => {
              element.style.position = "static";
              element.style.top = "auto";
              element.style.zIndex = "auto";
            });
        },
      });

      if (canvas.width < 2 || canvas.height < 2) {
        throw new Error("Unable to capture the statistics page for download.");
      }

      const imageData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;
      const renderedHeight = (canvas.height * contentWidth) / canvas.width;

      let heightLeft = renderedHeight;
      let offsetY = margin;

      pdf.addImage(
        imageData,
        "JPEG",
        margin,
        offsetY,
        contentWidth,
        renderedHeight,
        undefined,
        "FAST",
      );
      heightLeft -= contentHeight;

      while (heightLeft > 1) {
        offsetY = margin - (renderedHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(
          imageData,
          "JPEG",
          margin,
          offsetY,
          contentWidth,
          renderedHeight,
          undefined,
          "FAST",
        );
        heightLeft -= contentHeight;
      }

      const dateStamp = new Date().toISOString().slice(0, 10);
      const ofLabel =
        selectedOfValue === TEAM_FILTER_VALUE ? "team" : "member";
      pdf.save(`statistics-${showMode}-${ofLabel}-${dateStamp}.pdf`);
    } catch (error) {
      console.error("Failed to download statistics PDF", error);
      setDownloadError(
        error instanceof Error
          ? error.message
          : "Unable to download statistics PDF. Try again.",
      );
    } finally {
      setIsDownloadingStatistics(false);
    }
  };

  useEffect(() => {
    if (showMode !== "year") {
      return;
    }

    setSelectedYear((currentYear) => {
      if (yearOptions.length === 0) {
        return currentYear;
      }

      if (currentYear && yearOptions.includes(Number(currentYear))) {
        return currentYear;
      }

      return showFilters ? String(yearOptions[0]) : currentYear;
    });
  }, [showFilters, showMode, yearOptions]);

  useEffect(() => {
    if (showMode !== "quarter") {
      return;
    }

    setSelectedQuarter((currentQuarter) => {
      if (quarterOptions.length === 0) {
        return currentQuarter;
      }

      if (
        currentQuarter &&
        quarterOptions.some((option) => option.value === currentQuarter)
      ) {
        return currentQuarter;
      }

      return showFilters ? (quarterOptions[0]?.value ?? "") : currentQuarter;
    });
  }, [quarterOptions, showFilters, showMode]);

  useEffect(() => {
    if (showMode !== "month") {
      return;
    }

    setSelectedMonth((currentMonth) => {
      if (monthOptions.length === 0) {
        return currentMonth;
      }

      if (
        currentMonth &&
        monthOptions.some((option) => option.value === currentMonth)
      ) {
        return currentMonth;
      }

      return showFilters ? (monthOptions[0]?.value ?? "") : currentMonth;
    });
  }, [monthOptions, showFilters, showMode]);

  useEffect(() => {
    if (showMode !== "sprint") {
      return;
    }

    setSelectedSprintId((currentSprintId) => {
      if (selectableSprints.length === 0) {
        return currentSprintId;
      }

      if (
        currentSprintId &&
        selectableSprints.some((sprint) => sprint.id === currentSprintId)
      ) {
        return currentSprintId;
      }

      return showFilters ? (selectableSprints[0]?.id ?? "") : currentSprintId;
    });
  }, [selectableSprints, showFilters, showMode]);

  const metricsAiSummarySnapshot = useMemo((): MetricsSummarySnapshot | null => {
    if (!periodPerformanceTitle) {
      return null;
    }

    return {
      periodLabel: periodPerformanceTitle,
      dateRangeLabel: periodPerformanceDateRangeLabel,
      subjectLabel: summarySubjectLabel,
      showMode,
      scorePoints: String(displayedScorePoints),
      storyPoints: String(displayedStoryPoints),
      grade: String(displayedGrade),
      skillRadar: displayedSkillRadarValues,
      contribution: teamContributionSegments.map((segment) => ({
        name: segment.name,
        storyPoints: segment.storyPoints,
        contribution: segment.contribution,
      })),
      ranking: memberRankingSections.map((section) => ({
        sectionLabel: section.label,
        entries: section.entries.map((entry) => ({
          rank: entry.rank,
          name: entry.name,
          grade: entry.grade,
          scorePoints: entry.scorePoints,
        })),
      })),
      performanceStats: performanceStats.map((stat) => ({
        label: stat.label,
        value: stat.value,
        max: stat.max,
        unit: stat.unit,
      })),
    };
  }, [
    displayedGrade,
    displayedScorePoints,
    displayedSkillRadarValues,
    displayedStoryPoints,
    memberRankingSections,
    performanceStats,
    periodPerformanceDateRangeLabel,
    periodPerformanceTitle,
    showMode,
    summarySubjectLabel,
    teamContributionSegments,
  ]);

  return (
    <div className="statistics-page" ref={pageRef} style={{ padding: "24px 0" }}>
      {publicLinkCopied ? (
        <div
          aria-live="polite"
          className="statistics-copy-toast"
          role="status"
        >
          <span aria-hidden="true">✓</span>
          Public statistics URL copied
        </div>
      ) : null}

      {downloadError ? (
        <div
          aria-live="polite"
          className="statistics-copy-toast statistics-copy-toast--error"
          role="alert"
        >
          {downloadError}
        </div>
      ) : null}

      <div className="statistics-page-toolbar">
        <div className="statistics-header-actions">
          {showPublicViewButton ? (
            <button
              aria-label="Open public statistics page"
              className="statistics-header-action statistics-open-public"
              onClick={openPublicStatisticsPage}
              title="Open public statistics page"
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
                  ? "Public statistics link copied"
                  : "Copy public statistics link"
              }
              className="statistics-header-action statistics-copy-public"
              onClick={() => {
                void copyPublicStatisticsLink();
              }}
              title={
                publicLinkCopied
                  ? "Public statistics link copied"
                  : "Copy public statistics link"
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
            aria-label="Download statistics as PDF"
            className="statistics-header-action statistics-download"
            disabled={isDownloadingStatistics}
            onClick={() => {
              void downloadStatisticsPdf();
            }}
            title="Download statistics as PDF"
            type="button"
          >
            {isDownloadingStatistics ? (
              <span className="statistics-action-loader" aria-hidden="true" />
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

      {!showFilters && allowMemberFilter ? (
        <div className="statistics-public-filter" role="region" aria-label="Filter statistics view">
          <div className="statistics-public-filter__copy">
            <span className="statistics-public-filter__eyebrow">Filter this page</span>
            <p className="statistics-public-filter__title">
              Choose Team or a member
            </p>
            <p className="statistics-public-filter__hint">
              Scores, charts, and ranking update instantly for the selected view.
            </p>
          </div>
          <div className="statistics-public-filter__control">
            <span className="statistics-public-filter__label">
              Showing
            </span>
            {filtersLoading ? (
              <span className="statistics-show-filter__status">Loading filters…</span>
            ) : filtersError ? (
              <span className="statistics-show-filter__status">{filtersError}</span>
            ) : (
              <div className="statistics-public-filter__select">
                <StyledSelect
                  value={selectedOfValue}
                  onChange={setSelectedOfValue}
                  accent={Palette.cyan}
                >
                  <option value={TEAM_FILTER_VALUE}>Team</option>
                  {memberOptions.map((member) => (
                    <option key={member.id} value={member.id}>
                      {getStatisticsMemberName(member)}
                    </option>
                  ))}
                </StyledSelect>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {showFilters ? (
        <div className="statistics-show-filter">
          <span className="statistics-show-filter__label">Show</span>
          <div className="statistics-show-filter__selects">
            <StyledSelect
              value={showMode}
              onChange={(value) => setShowMode(value as StatisticsShowMode)}
              accent={Palette.cyan}
            >
              {SHOW_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </StyledSelect>

            {filtersLoading ? (
              <span className="statistics-show-filter__status">Loading filters…</span>
            ) : filtersError ? (
              <span className="statistics-show-filter__status">{filtersError}</span>
            ) : (
              <>
                <DropArrow />
                {showMode === "year" ? (
                  <StyledSelect
                    value={selectedYear}
                    onChange={setSelectedYear}
                    placeholder="Select year…"
                    accent={Palette.cyan}
                  >
                    {yearOptions.length === 0 ? (
                      <option value="">No years available</option>
                    ) : (
                      yearOptions.map((year) => (
                        <option key={year} value={String(year)}>
                          {year}
                        </option>
                      ))
                    )}
                  </StyledSelect>
                ) : null}

                {showMode === "quarter" ? (
                  <StyledSelect
                    value={selectedQuarter}
                    onChange={setSelectedQuarter}
                    placeholder="Select quarter…"
                    accent={Palette.cyan}
                  >
                    {quarterOptions.length === 0 ? (
                      <option value="">No quarters available</option>
                    ) : (
                      quarterOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))
                    )}
                  </StyledSelect>
                ) : null}

                {showMode === "month" ? (
                  <StyledSelect
                    value={selectedMonth}
                    onChange={setSelectedMonth}
                    placeholder="Select month…"
                    accent={Palette.cyan}
                  >
                    {monthOptions.length === 0 ? (
                      <option value="">No months available</option>
                    ) : (
                      monthOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))
                    )}
                  </StyledSelect>
                ) : null}

                {showMode === "sprint" ? (
                  <SprintGroupedSelect
                    sprints={selectableSprints}
                    value={selectedSprintId}
                    onChange={setSelectedSprintId}
                    getLabel={formatStatisticsSprintLabel}
                    placeholder="Select sprint…"
                    accent={Palette.cyan}
                    emptyMessage="No sprints available"
                  />
                ) : null}

                {allowMemberFilter ? (
                  <>
                    <span className="statistics-show-filter__label">of</span>
                    {lockedOfMemberId ? (
                      <span className="statistics-show-filter__locked-of">
                        {summarySubjectLabel}
                      </span>
                    ) : (
                      <StyledSelect
                        value={selectedOfValue}
                        onChange={setSelectedOfValue}
                        accent={Palette.cyan}
                      >
                        <option value={TEAM_FILTER_VALUE}>Team</option>
                        {memberOptions.map((member) => (
                          <option key={member.id} value={member.id}>
                            {getStatisticsMemberName(member)}
                          </option>
                        ))}
                      </StyledSelect>
                    )}
                  </>
                ) : null}

                {showEvaluateButton && !lockedOfMemberId ? (
                  <button
                    className="statistics-evaluate-button"
                    type="button"
                    disabled={isEvaluating}
                    onClick={() => {
                      setEvaluateError(null);
                      setIsEvaluateConfirmOpen(true);
                    }}
                  >
                    {isEvaluating ? "Evaluating…" : "Evaluate"}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      {periodPerformanceTitle ? (
        <div className="statistics-period-title-block">
          <h2 className="statistics-period-title">{periodPerformanceTitle}</h2>
          {periodPerformanceDateRangeLabel ? (
            <p className="statistics-period-dates">
              {periodPerformanceDateRangeLabel}
            </p>
          ) : null}
        </div>
      ) : null}

      {evaluateResult ? (
        <div className="statistics-evaluate-result" role="status">
          Evaluated {evaluateResult.year}: {evaluateResult.sprintsProcessed} sprint
          {evaluateResult.sprintsProcessed === 1 ? "" : "s"},{" "}
          {evaluateResult.membersProcessed} member score
          {evaluateResult.membersProcessed === 1 ? "" : "s"},{" "}
          {evaluateResult.criteriaRowsUpserted} criteria row
          {evaluateResult.criteriaRowsUpserted === 1 ? "" : "s"},{" "}
          {evaluateResult.performanceRowsUpserted} performance row
          {evaluateResult.performanceRowsUpserted === 1 ? "" : "s"}
          {evaluateResult.skippedSprints.length + evaluateResult.skippedMembers.length >
          0
            ? ` · skipped ${evaluateResult.skippedSprints.length} sprint(s), ${evaluateResult.skippedMembers.length} member(s)`
            : ""}
          .
          {evaluateResult.skippedSprints.length > 0 ? (
            <div className="statistics-evaluate-result__details">
              Skipped sprints:{" "}
              {evaluateResult.skippedSprints
                .map((entry) => entry.reason)
                .join(" · ")}
            </div>
          ) : null}
        </div>
      ) : null}

      {isEvaluateConfirmOpen ? (
        <div
          className="statistics-confirmation-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isEvaluating) {
              setIsEvaluateConfirmOpen(false);
              setEvaluateError(null);
            }
          }}
        >
          <section
            aria-labelledby="statistics-evaluate-confirm-title"
            aria-modal="true"
            className="statistics-confirmation-dialog"
            role="dialog"
          >
            <div className="statistics-confirmation-glow" />
            <div className="statistics-confirmation-header">
              <span className="statistics-confirmation-icon">!</span>
              <div>
                <div className="statistics-confirmation-eyebrow">Confirm Action</div>
                <h2
                  className="statistics-confirmation-title"
                  id="statistics-evaluate-confirm-title"
                >
                  Evaluate statistics?
                </h2>
              </div>
            </div>
            <p className="statistics-confirmation-message">
              This rebuilds criteria and performance scores for every sprint in
              the selected year from members_sprint_scores and related tables.
            </p>
            <label className="statistics-confirmation-field">
              <span>Year to evaluate</span>
              <StyledSelect
                value={evaluateYear}
                onChange={setEvaluateYear}
                placeholder="Select year…"
                accent={Palette.cyan}
                disabled={isEvaluating}
              >
                {yearOptions.length === 0 ? (
                  <option value="">No years available</option>
                ) : (
                  yearOptions.map((year) => (
                    <option key={year} value={String(year)}>
                      {year}
                    </option>
                  ))
                )}
              </StyledSelect>
            </label>
            {evaluateError ? (
              <p className="statistics-confirmation-error">{evaluateError}</p>
            ) : null}
            <div className="statistics-confirmation-actions">
              <button
                className="statistics-confirmation-button statistics-confirmation-button--secondary"
                type="button"
                disabled={isEvaluating}
                onClick={() => {
                  if (!isEvaluating) {
                    setIsEvaluateConfirmOpen(false);
                    setEvaluateError(null);
                  }
                }}
              >
                Cancel
              </button>
              <button
                className="statistics-confirmation-button statistics-confirmation-button--primary"
                type="button"
                disabled={isEvaluating || !evaluateYear}
                onClick={() => {
                  void runEvaluate();
                }}
              >
                {isEvaluating ? "Evaluating…" : "OK"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <div className="scard" style={{ animation: mounted ? "fadeUp 0.5s ease both" : "none" }}>
        <div className="stitle stitle--summary">
          Summary — {summarySubjectLabel}
        </div>
        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
          <ScoreCircle2 value={displayedScorePoints} label="Score Points" color="#ff6eb4" delay={200} />
          <ScoreCircle2 value={displayedStoryPoints} label="Story Points" color="#f5c842" delay={350} />
          <HoursRangeCircle
            min={displayedHoursRangeMin}
            avg={displayedHoursRangeAvg}
            max={displayedHoursRangeMax}
            color="#00c8ff"
            delay={425}
          />
          <GradeDial
            grade={displayedGrade}
            color={gradeColor}
            delay={575}
            glowFilterId="statistics-summary-grade-dial-glow"
          />
        </div>
      </div>

      <div className="two-col">
        <div className="scard">
          <div className="stitle">
            Performance Scores
            <span className="statistics-performance-compare-hint">
              {previousSprintIds.length > 0
                ? previousPeriodComparisonLabel
                : "no prior period"}
            </span>
          </div>
          {performanceStats.map((s, i) => (
            <div key={s.label}>
              <StatBar2 {...s} index={i} />
              {s.label === "Bonus Points" ? (
                <div
                  className="statistics-performance-separator"
                  role="separator"
                  aria-label="Professionalism"
                >
                  <span className="statistics-performance-separator__line" />
                  <span className="statistics-performance-separator__label">
                    Professionalism
                  </span>
                  <span className="statistics-performance-separator__line" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <div className="scard">
          <div className="stitle">Performance Radar</div>
          <SkillRadarPanel values={displayedSkillRadarValues} scale={skillChartScale} />
        </div>
      </div>

      <div className="scard statistics-metrics-trend">
        <div className="stitle">{metricsComparisonTrendMeta.title}</div>
        {scorePointsLoading ? (
          <div className="statistics-member-ranking__empty">
            Loading metrics trend…
          </div>
        ) : (
          <PerformanceScoresBySprintLineChart
            entries={metricsComparisonTrendEntries}
            includeOverallScore
            includeHoursAccumulated
            glowFilterId="statistics-metrics-comparison-trend-glow"
            emptyPreviousLabel={metricsComparisonTrendMeta.emptyPreviousLabel}
            emptyEntriesLabel={metricsComparisonTrendMeta.emptyEntriesLabel}
          />
        )}
      </div>

      <div className="statistics-skill-breakdown-row">
        <div className="scard">
          <div className="stitle">Team Contribution</div>
          <TeamContributionDoughnut
            segments={teamContributionSegments}
            loading={scorePointsLoading}
          />
        </div>
        <div className="scard">
          <div className="stitle">Performance Breakdown — Bar Chart</div>
          <SkillBarChart values={displayedSkillRadarValues} scale={skillChartScale} />
        </div>
      </div>

      {showMode === "year" ||
      showMode === "quarter" ||
      showMode === "month" ? (
        <>
          <div className="scard">
            <div className="stitle">
              Completed Story Points vs Hours Spent
            </div>
            <StoryPointsHoursLineChart
              entries={storyPointsHoursTrendEntries}
              glowFilterId="statisticsStoryPointsHoursGlow"
            />
          </div>

          <div className="scard">
            <div className="stitle">Performance Scores By Sprint</div>
            <PerformanceScoresBySprintLineChart
              entries={performanceScoresBySprintEntries}
              glowFilterId="statisticsPerformanceScoresBySprintGlow"
            />
          </div>
        </>
      ) : null}

      <div className="scard">
        <div className="stitle">
          {selectedOfValue !== TEAM_FILTER_VALUE ? "Sprint Ranking" : "Leaderboard"}
        </div>
        {scorePointsLoading ? (
          <div className="statistics-member-ranking__empty">Loading leaderboard…</div>
        ) : memberRankingSections.length === 0 ? (
          <div className="statistics-member-ranking__empty">
            No member scores for the selected period.
          </div>
        ) : (
          <div className="statistics-member-ranking">
            <div className="statistics-member-ranking__table">
              <div className="statistics-member-ranking__header" role="row">
                {MEMBER_RANKING_COLUMNS.map((column) => (
                  <div
                    key={column.key}
                    className={`statistics-member-ranking__head-cell${
                      column.key === "name"
                        ? " statistics-member-ranking__head-cell--name"
                        : ""
                    }${
                      column.key === "rank"
                        ? " statistics-member-ranking__head-cell--rank"
                        : ""
                    }`}
                    role="columnheader"
                  >
                    {column.label}
                  </div>
                ))}
              </div>

              <ul className="statistics-member-ranking__list">
                {memberRankingSections.map((section) => (
                  <li
                    key={section.key}
                    className="statistics-member-ranking__section"
                  >
                    {section.label ? (
                      <div
                        className={`statistics-member-ranking__sprint-label${
                          section.key === "period-overall"
                            ? " statistics-member-ranking__sprint-label--overall"
                            : ""
                        }`}
                      >
                        {section.label}
                      </div>
                    ) : null}

                    <ul className="statistics-member-ranking__section-list">
                      {section.entries.map((entry) => {
                  const entryGrade = entry.grade ?? "—";
                  const entryGradeColor = entry.grade
                    ? PERFORMANCE_GRADE_COLORS[entry.grade]
                    : "rgba(220, 235, 255, 0.92)";
                  const rankColor = getMemberRankingColor(entry.rank);
                  const highlightIntensity = getMemberRankingHighlightIntensity(
                    entry.rank,
                    section.peerCount,
                  );
                  const nameColor = `color-mix(in srgb, rgba(230, 240, 255, 0.98) ${Math.round(
                    highlightIntensity * 100,
                  )}%, rgba(140, 170, 200, 0.55))`;

                  const cells = [
                    {
                      key: "rank",
                      label: "Rank",
                      value: String(entry.rank),
                      color: rankColor,
                      className:
                        "statistics-member-ranking__box statistics-member-ranking__box--rank",
                      valueClassName:
                        "statistics-member-ranking__box-value statistics-member-ranking__box-value--rank",
                    },
                    {
                      key: "name",
                      label: "Name",
                      value: entry.name,
                      color: nameColor,
                      className:
                        "statistics-member-ranking__box statistics-member-ranking__box--name",
                      valueClassName:
                        "statistics-member-ranking__box-value statistics-member-ranking__box-value--name",
                    },
                    {
                      key: "grade",
                      label: "Grade",
                      value: entryGrade,
                      color: entryGradeColor,
                      className: "statistics-member-ranking__box",
                      valueClassName:
                        "statistics-member-ranking__box-value statistics-member-ranking__box-value--grade",
                    },
                    {
                      key: "score",
                      label: "Score Points",
                      value: formatScorePoints(entry.scorePoints),
                      color: entryGradeColor,
                      className: "statistics-member-ranking__box",
                      valueClassName:
                        "statistics-member-ranking__box-value statistics-member-ranking__box-value--score",
                    },
                  ];

                  return (
                    <li
                      key={`${section.key}-${entry.memberId}`}
                      className="statistics-member-ranking__card"
                      style={
                        {
                          "--ranking-accent": rankColor,
                          "--ranking-intensity": String(highlightIntensity),
                        } as CSSProperties
                      }
                    >
                      <div
                        className="statistics-member-ranking__grid"
                        role="row"
                        aria-label={`${section.label ? `${section.label}, ` : ""}${entry.name}, rank ${entry.rank}`}
                      >
                        {cells.map((cell) => (
                          <div
                            key={`${section.key}-${entry.memberId}-${cell.key}`}
                            className={cell.className}
                            data-label={cell.label}
                            role="cell"
                          >
                            <span
                              className={cell.valueClassName}
                              style={{ color: cell.color }}
                            >
                              {cell.value}
                            </span>
                          </div>
                        ))}

                        <div
                          className="statistics-member-ranking__box statistics-member-ranking__box--breakdown"
                          data-label="Score Breakdown"
                          role="cell"
                        >
                          <ul className="statistics-member-ranking__breakdown">
                            {MEMBER_RANKING_RATE_METRICS.map((metric) => {
                              const rateValue = entry.rates[metric.key];
                              const safeValue = Number.isFinite(rateValue)
                                ? Math.max(0, Math.min(100, rateValue))
                                : 0;
                              const isPerfect = safeValue >= 100;
                              const barColor = getSkillValueGradeColor(
                                safeValue,
                                skillChartScale.minValue,
                              );

                              return (
                                <li
                                  key={`${section.key}-${entry.memberId}-${metric.key}`}
                                  className={`statistics-member-ranking__breakdown-item${
                                    isPerfect
                                      ? " statistics-member-ranking__breakdown-item--perfect"
                                      : ""
                                  }`}
                                >
                                  <div className="statistics-member-ranking__breakdown-header">
                                    <span className="statistics-member-ranking__breakdown-label">
                                      {metric.label}
                                    </span>
                                    <span
                                      className="statistics-member-ranking__breakdown-value"
                                      style={{
                                        color: barColor,
                                        textShadow: isPerfect
                                          ? `0 0 10px ${barColor}`
                                          : undefined,
                                      }}
                                    >
                                      {Math.round(safeValue)}%
                                    </span>
                                  </div>
                                  <div className="statistics-member-ranking__breakdown-track">
                                    <div
                                      className="statistics-member-ranking__breakdown-fill"
                                      style={{
                                        width: `${safeValue}%`,
                                        background: barColor,
                                        boxShadow: isPerfect
                                          ? `0 0 10px ${barColor}, 0 0 18px ${barColor}cc`
                                          : `0 0 6px ${barColor}44`,
                                      }}
                                    />
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>

                        <div
                          className="statistics-member-ranking__box statistics-member-ranking__box--professionalism"
                          data-label="Professionalism"
                          role="cell"
                        >
                          {entry.professionalismItems.length === 0 ? (
                            <span className="statistics-member-ranking__breakdown-label">
                              No professionalism items
                            </span>
                          ) : (
                            <ul className="statistics-member-ranking__breakdown">
                              {entry.professionalismItems.map((item) => {
                                const scoreValue =
                                  item.score === null || !Number.isFinite(item.score)
                                    ? 0
                                    : Math.max(0, Math.min(item.max, item.score));
                                const isPerfect =
                                  item.score !== null && scoreValue >= item.max;
                                const filledCount = Math.round(
                                  (scoreValue / item.max) * PROFESSIONALISM_PIP_COUNT,
                                );
                                const pipColor = getProfessionalismScoreColor(scoreValue);

                                return (
                                  <li
                                    key={`${section.key}-${entry.memberId}-${item.itemId}`}
                                    className={`statistics-member-ranking__breakdown-item${
                                      isPerfect
                                        ? " statistics-member-ranking__breakdown-item--perfect"
                                        : ""
                                    }`}
                                  >
                                    <div className="statistics-member-ranking__breakdown-header">
                                      <span className="statistics-member-ranking__breakdown-label">
                                        {item.label}
                                      </span>
                                      <span
                                        className="statistics-member-ranking__breakdown-value"
                                        style={{
                                          color: pipColor,
                                          textShadow: isPerfect
                                            ? `0 0 10px ${pipColor}`
                                            : undefined,
                                        }}
                                      >
                                        {item.score === null
                                          ? "—"
                                          : `${scoreValue}/${item.max}`}
                                      </span>
                                    </div>
                                    <div
                                      className={`statistics-member-ranking__pips${
                                        isPerfect
                                          ? " statistics-member-ranking__pips--perfect"
                                          : ""
                                      }`}
                                      aria-label={`${item.label} ${
                                        item.score === null
                                          ? "no score"
                                          : `${scoreValue} out of ${item.max}`
                                      }`}
                                    >
                                      {Array.from(
                                        { length: PROFESSIONALISM_PIP_COUNT },
                                        (_, pipIndex) => {
                                          const isFilled = pipIndex < filledCount;
                                          return (
                                            <span
                                              key={`${item.itemId}-pip-${pipIndex}`}
                                              className={`statistics-member-ranking__pip${
                                                isFilled
                                                  ? " statistics-member-ranking__pip--filled"
                                                  : ""
                                              }${
                                                isFilled && isPerfect
                                                  ? " statistics-member-ranking__pip--perfect"
                                                  : ""
                                              }`}
                                              style={
                                                isFilled
                                                  ? {
                                                      background: pipColor,
                                                      borderColor: pipColor,
                                                      boxShadow: isPerfect
                                                        ? `0 0 8px ${pipColor}, 0 0 16px ${pipColor}bb`
                                                        : `0 0 5px ${pipColor}55`,
                                                    }
                                                  : undefined
                                              }
                                            />
                                          );
                                        },
                                      )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <PageAiSummary
        title="AI Metrics Summary:"
        snapshot={metricsAiSummarySnapshot}
        disabled={filtersLoading || scorePointsLoading || !periodPerformanceTitle}
        emptyMessage="Select Metrics filters to generate an AI summary of this view."
        loadingMessage="Preparing metrics summary…"
        buildLocalSummary={buildLocalMetricsSummary}
        buildPrompt={buildMetricsSummaryPrompt}
        getSnapshotKey={getMetricsSummarySnapshotKey}
      />
    </div>
  );
}
