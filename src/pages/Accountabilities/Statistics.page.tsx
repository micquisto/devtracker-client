import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { DropArrow, StyledSelect } from "@/components/shared/Elements";
import SprintGroupedSelect from "@/components/scrum/sprint/SprintGroupedSelect";
import { StoryPointsHoursLineChart, PerformanceScoresBySprintLineChart } from "@/components/dashboard";
import { getSupabaseRows } from "@/lib/supabase";
import { Palette, chartLabelStyle, chartLabelSvgProps } from "@/lib/theme";
import {
  isScoreboardIncludedMember,
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
} from "@/lib/utils/scrum/sprintListing.utils";
import {
  evaluateMemberPerformanceForYear,
  resolvePerformanceScoreGrade,
  type EvaluateYearResult,
  type PerformanceScoreGrade,
} from "@/lib/utils/scrum/evaluateMemberPerformance.utils";
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

const PERFORMANCE_GRADE_COLORS: Record<PerformanceScoreGrade, string> = {
  S: "#ffcc00",
  A: "#00e5a0",
  B: "#00c8ff",
  C: "#f97316",
  D: "#a78bfa",
  E: "#b87333",
  F: "#ef4444",
};

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

function colorWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red},${green},${blue},${alpha})`;
}

type StatBar = {
  label: string;
  value: number;
  max: number;
  unit: string;
  highlighted?: boolean;
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

type TeamContributionSegment = {
  memberId: string;
  name: string;
  color: string;
  storyPoints: number;
  contribution: number;
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

const TEAM_CONTRIBUTION_COLORS = [
  "#00c8ff",
  "#00e5a0",
  "#f5c842",
  "#a78bfa",
  "#ff6eb4",
  "#ff9f43",
  "#6b89ff",
  "#ff6b6b",
];

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

function getTeamContributionMemberColor(memberId: string, index: number): string {
  const hash = Array.from(memberId).reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );

  return TEAM_CONTRIBUTION_COLORS[
    (hash + index) % TEAM_CONTRIBUTION_COLORS.length
  ];
}

function formatContributionStoryPoints(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

type PassingScoreRow = {
  level: string | null;
  value: number | null;
};

function RadarChart({
  values,
  scale,
  hideValueLabels = false,
}: {
  values: SkillRadarValues;
  scale: SkillChartScale;
  hideValueLabels?: boolean;
}) {
  const cx = 200, cy = 200, maxR = 150, levels = 5, n = RADAR_KEYS.length;
  const chartTicks = getSkillChartTicks(scale);
  const polygonPoints = (r: number) => Array.from({ length: n }, (_, i) => {
    const p = polarToCartesian(cx, cy, r, (360 / n) * i);
    return `${p.x},${p.y}`;
  }).join(" ");
  const passingThreshold = scale.minValue;
  const dataPoints = RADAR_KEYS.map((k, i) => {
    const actualValue = values[k];
    const chartValue = normalizeSkillValueForChart(actualValue, scale);
    const r = (chartValue / 100) * maxR;
    const color = getSkillValueGradeColor(actualValue, passingThreshold);
    return {
      ...polarToCartesian(cx, cy, r, (360 / n) * i),
      value: actualValue,
      passed: isSkillValuePassing(actualValue, scale),
      color,
      label: RADAR_LABELS[i],
    };
  });
  const [anim, setAnim] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnim(true), 400);
    return () => clearTimeout(t);
  }, [scale, values]);

  return (
    <svg viewBox="0 0 400 440" className="statistics-skill-radar__svg">
      {Array.from({ length: levels }, (_, i) => (
        <polygon
          key={i}
          points={polygonPoints((maxR / levels) * (i + 1))}
          fill="none"
          stroke="rgba(100,220,255,0.12)"
          strokeWidth="1"
        />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const p = polarToCartesian(cx, cy, maxR, (360 / n) * i);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="rgba(100,220,255,0.15)"
            strokeWidth="1"
          />
        );
      })}
      {dataPoints.map((p, i) => {
        const next = dataPoints[(i + 1) % n];
        return (
          <polygon
            key={`wedge-${i}`}
            points={`${cx},${cy} ${p.x},${p.y} ${next.x},${next.y}`}
            fill={colorWithAlpha(p.color, 0.24)}
            stroke="none"
            style={{
              transition: "all 1s cubic-bezier(0.23,1,0.32,1)",
              opacity: anim ? 1 : 0,
              transform: anim ? "scale(1)" : "scale(0.3)",
              transformOrigin: `${cx}px ${cy}px`,
            }}
          />
        );
      })}
      {dataPoints.map((p, i) => {
        const next = dataPoints[(i + 1) % n];
        return (
          <line
            key={`edge-${i}`}
            x1={p.x}
            y1={p.y}
            x2={next.x}
            y2={next.y}
            stroke={colorWithAlpha(p.color, 0.9)}
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{
              transition: "all 1s cubic-bezier(0.23,1,0.32,1)",
              opacity: anim ? 1 : 0,
            }}
          />
        );
      })}
      {dataPoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={5}
          fill={p.color}
          style={{ transition: `all 1s ease ${i * 0.08}s`, opacity: anim ? 1 : 0 }}
        />
      ))}
      {dataPoints.map((p, i) => {
        const labelPoint = polarToCartesian(cx, cy, maxR + 24, (360 / n) * i);
        const valuePoint = polarToCartesian(cx, cy, maxR + 42, (360 / n) * i);
        return (
          <g key={`label-${i}`}>
            <text
              x={labelPoint.x}
              y={labelPoint.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(180,230,255,0.9)"
              {...chartLabelSvgProps}
            >
              {p.label}
            </text>
            {!hideValueLabels ? (
              <text
                x={valuePoint.x}
                y={valuePoint.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={p.color}
                {...chartLabelSvgProps}
                style={{
                  ...chartLabelSvgProps.style,
                  opacity: anim ? 1 : 0,
                  transition: `opacity 0.6s ease ${i * 0.08 + 0.2}s`,
                }}
              >
                {p.value}%
              </text>
            ) : null}
          </g>
        );
      })}
      <text
        x={cx}
        y={410}
        textAnchor="middle"
        fill="rgba(150,200,240,0.65)"
        {...chartLabelSvgProps}
      >
        Passing min {Math.round(scale.minValue)}% · scale {chartTicks.join(" / ")}%
      </text>
    </svg>
  );
}

function SkillRadarPanel({
  values,
  scale,
}: {
  values: SkillRadarValues;
  scale: SkillChartScale;
}) {
  const passingThreshold = scale.minValue;
  const criteriaItems = RADAR_KEYS.map((key, index) => {
    const value = values[key];
    const grade = resolvePerformanceScoreGrade(value, passingThreshold);

    return {
      key,
      label: RADAR_LABELS[index],
      value,
      grade,
      color: getSkillValueGradeColor(value, passingThreshold),
      passed: isSkillValuePassing(value, scale),
    };
  });

  return (
    <div className="statistics-skill-radar">
      <div className="statistics-skill-radar__chart">
        <RadarChart values={values} scale={scale} hideValueLabels />
      </div>
      <aside className="statistics-skill-radar__legend" aria-label="Criteria values">
        <div className="statistics-skill-radar__legend-title">Criteria Values</div>
        <ul className="statistics-skill-radar__legend-list">
          {criteriaItems.map((item) => (
            <li
              key={item.key}
              className={`statistics-skill-radar__legend-item${item.passed ? "" : " statistics-skill-radar__legend-item--failed"}`}
            >
              <span
                className="statistics-skill-radar__legend-swatch"
                style={{ background: item.color, boxShadow: `0 0 10px ${item.color}66` }}
                aria-hidden="true"
              />
              <div className="statistics-skill-radar__legend-copy">
                <span className="statistics-skill-radar__legend-label">{item.label}</span>
                <span className="statistics-skill-radar__legend-meta">
                  {item.passed ? "Passing" : "Below passing"}
                </span>
              </div>
              <div className="statistics-skill-radar__legend-stats">
                <span
                  className="statistics-skill-radar__legend-value"
                  style={{ color: item.color }}
                >
                  {item.value}%
                </span>
                <span
                  className="statistics-skill-radar__legend-grade"
                  style={{
                    color: item.color,
                    borderColor: `${item.color}55`,
                    background: `${item.color}14`,
                  }}
                >
                  {item.grade}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="statistics-skill-radar__legend-footnote">
          Passing min {Math.round(scale.minValue)}%
        </p>
      </aside>
    </div>
  );
}

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

function TeamContributionDoughnut({
  segments,
  loading = false,
}: {
  segments: TeamContributionSegment[];
  loading?: boolean;
}) {
  const [anim, setAnim] = useState(false);
  const [hov, setHov] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setAnim(true), 400);
    return () => clearTimeout(t);
  }, [segments]);

  if (loading) {
    return (
      <div className="statistics-team-contribution statistics-team-contribution--loading">
        Loading team contribution…
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="statistics-team-contribution statistics-team-contribution--empty">
        No completed story points for the selected period.
      </div>
    );
  }

  const cx = 130;
  const cy = 130;
  const outerR = 100;
  const innerR = 56;
  const gap = 2;
  const totalStoryPoints = segments.reduce(
    (sum, segment) => sum + segment.storyPoints,
    0,
  );
  let cursor = -Math.PI / 2;
  const chartSegments = segments.map((segment, index) => {
    const frac =
      totalStoryPoints > 0 ? segment.storyPoints / totalStoryPoints : 0;
    const angle = frac * 2 * Math.PI - (gap * Math.PI) / 180;
    const start = cursor;
    const end = cursor + angle;
    cursor += frac * 2 * Math.PI;
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = cx + outerR * Math.cos(start);
    const y1 = cy + outerR * Math.sin(start);
    const x2 = cx + outerR * Math.cos(end);
    const y2 = cy + outerR * Math.sin(end);
    const x3 = cx + innerR * Math.cos(end);
    const y3 = cy + innerR * Math.sin(end);
    const x4 = cx + innerR * Math.cos(start);
    const y4 = cy + innerR * Math.sin(start);
    const mid = (start + end) / 2;
    const lx = cx + (outerR + 20) * Math.cos(mid);
    const ly = cy + (outerR + 20) * Math.sin(mid);

    return {
      ...segment,
      index,
      frac,
      mid,
      lx,
      ly,
      d: `M${x1},${y1} A${outerR},${outerR} 0 ${largeArc} 1 ${x2},${y2} L${x3},${y3} A${innerR},${innerR} 0 ${largeArc} 0 ${x4},${y4} Z`,
    };
  });
  const hoveredSegment = hov !== null ? chartSegments[hov] : null;

  return (
    <div className="statistics-team-contribution">
      <svg
        viewBox="0 0 260 260"
        className="statistics-team-contribution__chart"
        onMouseLeave={() => setHov(null)}
      >
        <defs>
          {chartSegments.map((segment) => (
            <radialGradient
              key={segment.memberId}
              id={`tc-dg-${segment.memberId}`}
              cx="50%"
              cy="50%"
              r="50%"
            >
              <stop offset="0%" stopColor={segment.color} />
              <stop offset="100%" stopColor={segment.color} stopOpacity=".7" />
            </radialGradient>
          ))}
        </defs>
        {chartSegments.map((segment, index) => (
          <g
            key={segment.memberId}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHov(index)}
          >
            <path
              d={segment.d}
              fill={`url(#tc-dg-${segment.memberId})`}
              stroke="rgba(6,13,31,0.8)"
              strokeWidth="2"
              style={{
                transform:
                  hov === index
                    ? `translate(${Math.cos(segment.mid) * 6}px,${Math.sin(segment.mid) * 6}px)`
                    : "none",
                transition: "transform 0.25s ease",
                opacity: anim ? 1 : 0,
                transitionDelay: `${index * 0.07}s`,
                transformOrigin: `${cx}px ${cy}px`,
              }}
            />
            {segment.contribution >= 8 ? (
              <text
                x={segment.lx}
                y={segment.ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={segment.color}
                {...chartLabelSvgProps}
                style={{
                  ...chartLabelSvgProps.style,
                  opacity: anim ? 1 : 0,
                  transition: `opacity 0.5s ease ${index * 0.07 + 0.3}s`,
                }}
              >
                {segment.contribution}%
              </text>
            ) : null}
          </g>
        ))}
        <circle cx={cx} cy={cy} r={innerR - 3} fill="rgba(6,13,31,0.85)" />
        {hoveredSegment ? (
          <>
            <text
              x={cx}
              y={cy - 12}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="20"
              fill={hoveredSegment.color}
              fontFamily="'DM Mono',monospace"
              fontWeight="800"
            >
              {hoveredSegment.contribution}%
            </text>
            <text
              x={cx}
              y={cy + 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(160,210,255,0.7)"
              {...chartLabelSvgProps}
            >
              {hoveredSegment.name}
            </text>
            <text
              x={cx}
              y={cy + 22}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={hoveredSegment.color}
              {...chartLabelSvgProps}
            >
              {formatContributionStoryPoints(hoveredSegment.storyPoints)} SP
            </text>
          </>
        ) : (
          <>
            <text
              x={cx}
              y={cy - 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="22"
              fill="#e8f4ff"
              fontFamily="'DM Mono',monospace"
              fontWeight="800"
            >
              {formatContributionStoryPoints(totalStoryPoints)}
            </text>
            <text
              x={cx}
              y={cy + 12}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(120,180,240,0.55)"
              {...chartLabelSvgProps}
            >
              Team SP
            </text>
          </>
        )}
      </svg>
      <div className="statistics-team-contribution__legend">
        {chartSegments.map((segment, index) => (
          <div
            key={segment.memberId}
            className="statistics-team-contribution__legend-item"
            onMouseEnter={() => setHov(index)}
            onMouseLeave={() => setHov(null)}
          >
            <span
              className="statistics-team-contribution__legend-swatch"
              style={{
                background: segment.color,
                boxShadow: `0 0 8px ${segment.color}88`,
              }}
            />
            <div className="statistics-team-contribution__legend-copy">
              <span className="statistics-team-contribution__legend-name">
                {segment.name}
              </span>
              <span className="statistics-team-contribution__legend-points">
                {formatContributionStoryPoints(segment.storyPoints)} SP
              </span>
            </div>
            <span
              className="statistics-team-contribution__legend-share"
              style={{ color: segment.color }}
            >
              {segment.contribution}%
            </span>
          </div>
        ))}
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
}: StatBar & { index: number }) {
  const [w, setW] = useState(0);
  const pct = Math.round((value / max) * 100);

  useEffect(() => {
    const t = setTimeout(() => setW(pct), 200 + index * 60);
    return () => clearTimeout(t);
  }, [pct, index]);

  const color = pct >= 85 ? "#00e5a0" : pct >= 65 ? "#00c8ff" : pct >= 45 ? "#f5c842" : "#ff6b6b";

  return (
    <div
      className={`statistics-stat-bar${highlighted ? " statistics-stat-bar--highlighted" : ""}`}
    >
      <div className="statistics-stat-bar__header">
        <span className="statistics-stat-bar__label">{label}</span>
        <span className="statistics-stat-bar__value" style={{ color }}>
          {value}
          {unit}
          <span className="statistics-stat-bar__max">
            /{max}
            {unit}
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

const GRADE_DIAL_FILL_PERCENT: Record<PerformanceScoreGrade, number> = {
  S: 100,
  A: 95,
  B: 85,
  C: 75,
  D: 65,
  E: 57,
  F: 50,
};

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

function GradeDial({
  grade,
  color,
  delay = 0,
  size = "default",
  glowFilterId = "statistics-grade-dial-glow",
}: {
  grade: string;
  color: string;
  delay?: number;
  size?: "default" | "compact";
  glowFilterId?: string;
}) {
  const [show, setShow] = useState(false);
  const isCompact = size === "compact";
  const isTopGrade = grade === "S";
  const fillPercent =
    GRADE_DIAL_FILL_PERCENT[grade as PerformanceScoreGrade] ?? 50;
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (fillPercent / 100) * circumference;
  const topGlowFilterId = `${glowFilterId}-s`;
  const dialWidth = isCompact ? (isTopGrade ? 96 : 90) : isTopGrade ? 158 : 148;
  // SVG fontSize is viewBox units; scale so rendered letter stays readable at dialWidth.
  const gradeFontSize = isCompact ? (isTopGrade ? 52 : 48) : isTopGrade ? 46 : 42;

  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: isCompact ? 3 : 8 }}>
      <svg
        aria-label={`Grade ${grade}`}
        role="img"
        viewBox="0 0 190 190"
        style={{
          width: dialWidth,
          height: dialWidth,
          opacity: show ? 1 : 0,
          transform: show ? "scale(1)" : "scale(0.6)",
          transition: `all 0.7s cubic-bezier(0.23,1,0.32,1) ${delay}ms`,
          filter: isTopGrade ? `drop-shadow(0 0 18px ${color}aa)` : undefined,
        }}
      >
        <defs>
          <filter id={glowFilterId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {isTopGrade ? (
            <filter id={topGlowFilterId} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="7" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ) : null}
        </defs>
        {isTopGrade ? (
          <circle
            cx="95"
            cy="95"
            fill="none"
            r="84"
            stroke={colorWithAlpha(color, 0.28)}
            strokeWidth="4"
          />
        ) : null}
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
          r={radius}
          stroke="rgba(160,210,255,0.14)"
          strokeLinecap="round"
          strokeWidth="13"
        />
        <circle
          cx="95"
          cy="95"
          fill="none"
          filter={isTopGrade ? `url(#${topGlowFilterId})` : `url(#${glowFilterId})`}
          r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={show ? dashOffset : circumference}
          strokeLinecap="round"
          strokeWidth={isTopGrade ? 15 : 13}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "95px 95px",
            transition: `stroke-dashoffset 0.9s cubic-bezier(0.23,1,0.32,1) ${delay + 100}ms`,
          }}
        />
        <text
          dominantBaseline="middle"
          fill={color}
          fontFamily="'DM Mono', monospace"
          fontSize={gradeFontSize}
          fontWeight="900"
          textAnchor="middle"
          x="95"
          y="95"
        >
          {grade}
        </text>
      </svg>
      <span
        style={{
          fontSize: isCompact ? 11 : 12,
          fontFamily: "'DM Sans',sans-serif",
          color: "rgba(160,200,240,0.78)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 700,
        }}
      >
        Grade
      </span>
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
            ? Math.round((segment.storyPoints / totalStoryPoints) * 100)
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

  const memberRankingEntries = useMemo((): MemberRankingEntry[] => {
    if (activeSprintIds.length === 0) {
      return [];
    }

    const ranked = memberOptions
      .map((member) => {
        const scorePoints = getMemberPerformanceFieldAverage(
          relevantPerformanceRows,
          member.id,
          "average_score",
        );

        let grade: PerformanceScoreGrade | null = null;

        if (showMode === "sprint" && activeSprintIds.length === 1) {
          const memberScore = relevantPerformanceRows.find(
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
          criteriaScoreRows: relevantCriteriaRows,
          performanceRows: relevantPerformanceRows,
          memberIds: scoreboardMemberIdList,
          selectedMemberId: member.id,
          professionalismScoreRows: relevantProfessionalismScores,
          professionalismItems: sortedProfessionalismItems,
        });

        const professionalismItemScores = sortedProfessionalismItems.map(
          (item) => {
            const averageValue = getMemberProfessionalismItemAverage(
              relevantProfessionalismScores,
              member.id,
              item.id,
            );

            return {
              itemId: item.id,
              label: item.name?.trim() || item.code?.trim() || "Professionalism",
              score:
                averageValue === null
                  ? null
                  : Math.round(averageValue * 10) / 10,
              max: Math.max(Number(item.value) || PROFESSIONALISM_PIP_COUNT, 1),
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

    return ranked
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }))
      .filter((entry) =>
        selectedOfValue === TEAM_FILTER_VALUE
          ? true
          : entry.memberId === selectedOfValue,
      );
  }, [
    activeSprintIds,
    memberOptions,
    relevantCriteriaRows,
    relevantPerformanceRows,
    relevantProfessionalismScores,
    scoreboardMemberIdList,
    selectedOfValue,
    showMode,
    sortedProfessionalismItems,
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

  const performanceStats = useMemo((): StatBar[] => {
    const completedTasks =
      tasksCompletedValue === null ? null : Math.round(tasksCompletedValue);
    const highestCompletedTasks =
      highestCompletedTasksAmongMembers === null
        ? null
        : Math.round(highestCompletedTasksAmongMembers);
    const averageVelocity =
      averageVelocityValue === null ? null : Math.round(averageVelocityValue);
    const highestAverageVelocity =
      highestAverageVelocityAmongMembers === null
        ? null
        : Math.round(highestAverageVelocityAmongMembers);
    const velocityByHour =
      velocityByHourValue === null
        ? null
        : Math.round(velocityByHourValue * 100) / 100;
    const highestVelocityByHour =
      highestVelocityByHourAmongMembers === null
        ? null
        : Math.round(highestVelocityByHourAmongMembers * 100) / 100;
    const bestStoryPoints =
      bestStoryPointsValue === null
        ? null
        : Math.ceil(bestStoryPointsValue);
    const highestBestStoryPoints =
      highestBestStoryPointsAmongMembers === null
        ? null
        : Math.ceil(highestBestStoryPointsAmongMembers);
    const assignedStoryPoints =
      assignedStoryPointsValue === null
        ? null
        : Math.round(assignedStoryPointsValue);
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
    const highestAccumulatedHours =
      highestAccumulatedHoursAmongMembers === null
        ? null
        : Math.round(highestAccumulatedHoursAmongMembers * 10) / 10;

    const baseStats = devData.stats.map((stat) => {
      if (stat.label === "Tasks Completed") {
        if (scorePointsLoading) {
          return { ...stat, value: 0, max: Math.max(stat.max, 1) };
        }

        const value = completedTasks ?? 0;
        const max = Math.max(highestCompletedTasks ?? 0, value, 1);

        return {
          ...stat,
          value,
          max,
        };
      }

      if (stat.label === "Average Velocity") {
        if (scorePointsLoading) {
          return { ...stat, value: 0, max: Math.max(stat.max, 1) };
        }

        const value = averageVelocity ?? 0;
        const max = Math.max(highestAverageVelocity ?? 0, value, 1);

        return {
          ...stat,
          value,
          max,
        };
      }

      if (stat.label === "Velocity By Hour (Story Points per Hour)") {
        if (scorePointsLoading) {
          return { ...stat, value: 0, max: Math.max(stat.max, 1) };
        }

        const value = velocityByHour ?? 0;
        const max = Math.max(highestVelocityByHour ?? 0, value, 0.01);

        return {
          ...stat,
          value,
          max,
        };
      }

      if (stat.label === "Best Story Points") {
        if (scorePointsLoading) {
          return { ...stat, value: 0, max: Math.max(stat.max, 1) };
        }

        const value = bestStoryPoints ?? 0;
        const max = Math.max(highestBestStoryPoints ?? 0, value, 1);

        return {
          ...stat,
          value,
          max,
        };
      }

      if (stat.label === "Assigned Story Points") {
        if (scorePointsLoading) {
          return { ...stat, value: 0, max: Math.max(stat.max, 1) };
        }

        const value = assignedStoryPoints ?? 0;
        const max = Math.max(assignedStoryPointsMax ?? 0, value, 1);

        return {
          ...stat,
          value,
          max,
        };
      }

      if (stat.label === "Accumulated Hours") {
        if (scorePointsLoading) {
          return { ...stat, value: 0, max: Math.max(stat.max, 1) };
        }

        const value = accumulatedHours ?? 0;
        const max = Math.max(highestAccumulatedHours ?? 0, value, 1);

        return {
          ...stat,
          value,
          max,
        };
      }

      if (stat.label === "Bonus Points") {
        if (scorePointsLoading) {
          return { ...stat, value: 0, max: Math.max(stat.max, 1) };
        }

        const value = bonusPoints ?? 0;
        const max = Math.max(bonusPointsMax ?? 0, value, 1);

        return {
          ...stat,
          value,
          max,
        };
      }

      return stat;
    });

    const professionalismStats: StatBar[] = sortedProfessionalismItems.map(
      (item) => {
        const label = item.name?.trim() || item.code?.trim() || "Professionalism";
        const itemMax = Math.max(Number(item.value) || 0, 1);

        if (scorePointsLoading || activeSprintIds.length === 0) {
          return {
            label,
            value: 0,
            max: itemMax,
            unit: "",
          };
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

        const value =
          averageValue === null
            ? 0
            : Math.round(averageValue * 10) / 10;

        return {
          label,
          value,
          max: itemMax,
          unit: "",
        };
      },
    );

    const professionalismTotalMax = professionalismTotalAverageMetric.max;
    const professionalismTotalValue = professionalismTotalAverageMetric.value;

    const professionalismTotalAverage: StatBar = {
      label: "Professionalism Total Average",
      value:
        scorePointsLoading || activeSprintIds.length === 0
          ? 0
          : professionalismTotalValue,
      max: Math.max(professionalismTotalMax, 1),
      unit: "",
      highlighted: true,
    };

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
    professionalismTotalAverageMetric.max,
    professionalismTotalAverageMetric.value,
    relevantProfessionalismScores,
    scorePointsLoading,
    scoreboardMemberIdList,
    selectedOfValue,
    sortedProfessionalismItems,
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
          activeSprintIds.length === 1
            ? {
                select:
                  "member_id,sprint_id,average_score,score_grade,total_story_points,assigned_story_points,extra_points,velocity_by_hour",
                eq: { sprint_id: activeSprintIds[0] },
              }
            : {
                select:
                  "member_id,sprint_id,average_score,score_grade,total_story_points,assigned_story_points,extra_points,velocity_by_hour",
                in: { sprint_id: activeSprintIds },
              };

        const criteriaQueryOptions =
          activeSprintIds.length === 1
            ? {
                select: "member_id,sprint_id,rate,criteria:criteria_id(type)",
                eq: { sprint_id: activeSprintIds[0] },
              }
            : {
                select: "member_id,sprint_id,rate,criteria:criteria_id(type)",
                in: { sprint_id: activeSprintIds },
              };

        const memberSprintScoreQueryOptions =
          activeSprintIds.length === 1
            ? {
                select:
                  "member_id,sprint_id,completed_story_points,completed_tasks_count,accumulated_hours",
                eq: { sprint_id: activeSprintIds[0] },
              }
            : {
                select:
                  "member_id,sprint_id,completed_story_points,completed_tasks_count,accumulated_hours",
                in: { sprint_id: activeSprintIds },
              };

        const professionalismScoreQueryOptions =
          activeSprintIds.length === 1
            ? {
                select: "member_id,sprint_id,item_id,score",
                eq: { sprint_id: activeSprintIds[0] },
              }
            : {
                select: "member_id,sprint_id,item_id,score",
                in: { sprint_id: activeSprintIds },
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
  }, [activeSprintIds, evaluateResult]);

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

        if (!cancelled) {
          setSprints(sprintRows);
          setMembers(memberRows);
          setPassingScores(passingScoreRows);
          setProfessionalismItems(professionalismItemRows);
        }
      } catch (error) {
        if (!cancelled) {
          setSprints([]);
          setMembers([]);
          setProfessionalismItems([]);
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
  }, []);

  useEffect(() => {
    setSelectedOfValue((currentValue) => {
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
  }, [memberOptions]);

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

    try {
      const canvas = await html2canvas(target, {
        backgroundColor: "#060d1f",
        ignoreElements: (element) =>
          element.classList.contains("statistics-header-action"),
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
      pdf.save(`statistics-${dateStamp}.pdf`);
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
                  </>
                ) : null}

                {showEvaluateButton ? (
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
          <GradeDial
            grade={displayedGrade}
            color={gradeColor}
            delay={500}
            glowFilterId="statistics-summary-grade-dial-glow"
          />
        </div>
      </div>

      <div className="two-col">
        <div className="scard">
          <div className="stitle">Performance Scores</div>
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
        <div className="stitle">Leaderboard</div>
        {scorePointsLoading ? (
          <div className="statistics-member-ranking__empty">Loading leaderboard…</div>
        ) : memberRankingEntries.length === 0 ? (
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
                {memberRankingEntries.map((entry) => {
                  const entryGrade = entry.grade ?? "—";
                  const entryGradeColor = entry.grade
                    ? PERFORMANCE_GRADE_COLORS[entry.grade]
                    : "rgba(220, 235, 255, 0.92)";
                  const rankColor = getMemberRankingColor(entry.rank);
                  const highlightIntensity = getMemberRankingHighlightIntensity(
                    entry.rank,
                    memberRankingEntries.length,
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
                      valueClassName: "statistics-member-ranking__box-value",
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
                      key={entry.memberId}
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
                        aria-label={`${entry.name}, rank ${entry.rank}`}
                      >
                        {cells.map((cell) => (
                          <div
                            key={`${entry.memberId}-${cell.key}`}
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
                              const barColor = getSkillValueGradeColor(
                                safeValue,
                                skillChartScale.minValue,
                              );

                              return (
                                <li
                                  key={`${entry.memberId}-${metric.key}`}
                                  className="statistics-member-ranking__breakdown-item"
                                >
                                  <div className="statistics-member-ranking__breakdown-header">
                                    <span className="statistics-member-ranking__breakdown-label">
                                      {metric.label}
                                    </span>
                                    <span
                                      className="statistics-member-ranking__breakdown-value"
                                      style={{ color: barColor }}
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
                                        boxShadow: `0 0 8px ${barColor}55`,
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
                                const filledCount = Math.round(
                                  (scoreValue / item.max) * PROFESSIONALISM_PIP_COUNT,
                                );
                                const pipColor = getProfessionalismScoreColor(scoreValue);

                                return (
                                  <li
                                    key={`${entry.memberId}-${item.itemId}`}
                                    className="statistics-member-ranking__breakdown-item"
                                  >
                                    <div className="statistics-member-ranking__breakdown-header">
                                      <span className="statistics-member-ranking__breakdown-label">
                                        {item.label}
                                      </span>
                                      <span
                                        className="statistics-member-ranking__breakdown-value"
                                        style={{ color: pipColor }}
                                      >
                                        {item.score === null
                                          ? "—"
                                          : `${scoreValue}/${item.max}`}
                                      </span>
                                    </div>
                                    <div
                                      className="statistics-member-ranking__pips"
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
                                              }`}
                                              style={
                                                isFilled
                                                  ? {
                                                      background: pipColor,
                                                      borderColor: pipColor,
                                                      boxShadow: `0 0 6px ${pipColor}66`,
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
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
