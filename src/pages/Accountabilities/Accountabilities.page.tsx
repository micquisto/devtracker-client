import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  SkillRadarPanel,
  TeamContributionDoughnut,
  getTeamContributionMemberColor,
  GradeDial,
  PERFORMANCE_GRADE_COLORS,
  type TeamContributionSegment,
} from "@/components/dashboard";
import {
  AccountabilitiesSortableList,
  persistAccountabilitiesSortOrder,
  withUpdatedSortOrder,
} from "@/components/accountabilities/AccountabilitiesSortableList";
import { AccountabilitiesAiSummary } from "@/components/accountabilities/AccountabilitiesAiSummary";
import { StyledSelect } from "@/components/shared/Elements";
import { Title } from "@/components/shared/page";
import { getSupabaseRows, insertSupabaseRows, updateSupabaseRows, deleteSupabaseRows } from "@/lib/supabase";
import { Palette } from "@/lib/theme";
import { sanitizeHtml2CanvasClone } from "@/lib/utils/html2canvas.utils";
import {
  resolvePerformanceScoreGrade,
  type PerformanceScoreGrade,
} from "@/lib/utils/scrum/evaluateMemberPerformance.utils";
import {
  isScoreboardIncludedMember,
  sortMembersByLastName,
} from "@/lib/utils/scrum/scoreboardMembers.utils";
import type { AccountabilitiesSummarySnapshot } from "@/lib/utils/scrum/accountabilitiesSummary.utils";
import {
  getAvailableSprintYearMonths,
  getAvailableSprintYears,
  getSprintListingMonth,
  getSprintListingYear,
  getSprintMonthShortLabel,
} from "@/lib/utils/scrum/sprintListing.utils";
import {
  buildSkillRadarValues,
  DEFAULT_SKILL_CHART_SCALE,
  EMPTY_SKILL_RADAR_VALUES,
  normalizeSkillRadarValues,
  type MemberSprintCriteriaScoreRow,
  type SkillRadarKey,
  type SkillRadarValues,
} from "@/lib/utils/scrum/statisticsRadar.utils";
import "@/assets/styles/Accountabilities.page.css";
import "@/assets/styles/Statistics.page.css";

const SKILL_METRIC_ROWS: Array<{ key: SkillRadarKey; label: string }> = [
  { key: "productivity", label: "Productivity" },
  { key: "efficiency", label: "Efficiency" },
  { key: "quality", label: "Quality" },
  { key: "collaboration", label: "Collaboration" },
  { key: "velocity", label: "Velocity" },
  { key: "professionalism", label: "Professionalism" },
];

const DEFAULT_PASSING_THRESHOLD = 60;
const GRADE_PASSING_THRESHOLD = 75;
const PROFESSIONALISM_PIP_COUNT = 5;

const MEMBER_RANKING_COLORS = [
  "#ffe566", // gold (lighter highlight for rank 1)
  "#00e5a0", // green
  "#00c8ff", // blue
  "#c2783a", // dull orange
  "#a78bfa", // purple
  "#b87333", // brown
  "#ef4444", // red
] as const;

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

type TeamStackRankingProfessionalismItem = {
  itemId: string;
  label: string;
  score: number | null;
  max: number;
};

type TeamStackRankingEntry = {
  memberId: string;
  name: string;
  rank: number;
  scorePoints: number | null;
  grade: PerformanceScoreGrade | null;
  rates: SkillRadarValues;
  professionalismItems: TeamStackRankingProfessionalismItem[];
};

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

function getProfessionalismScoreColor(score: number): string {
  if (!Number.isFinite(score) || score < 2) {
    return "#ef4444";
  }
  if (score < 3) {
    return "#f97316";
  }
  if (score < 4) {
    return "#f5c842";
  }
  if (score < 5) {
    return "#a3e635";
  }
  return "#00e5a0";
}

function formatScorePoints(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

type AccountabilitiesSprintRow = {
  id: string | null;
  sprint_year: number | string | null;
  sprint_month: number | string | null;
  month: number | string | null;
  start_date: string | null;
  end_date: string | null;
  is_current?: number | boolean | null;
};

type AccountabilitiesMemberRow = {
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
  total_story_points: number | null;
  assigned_story_points: number | null;
  velocity_by_hour: number | null;
};

type MemberSprintScoreRow = {
  member_id: string;
  sprint_id: string;
  completed_story_points: number | null;
  completed_tasks_count: number | null;
  accumulated_hours: number | null;
};

type MemberSprintProfessionalismScoreRow = {
  member_id: string;
  sprint_id: string;
  item_id: string;
  score: number | null;
};

type ProfessionalismItemRow = {
  id: string;
  name: string | null;
  code: string | null;
  value: number | null;
};

type MetricCommentRow = {
  id: string;
  sprint_year: number;
  sprint_month: number;
  metric_key: SkillRadarKey;
  comment_text: string;
  sort_order: number;
  created_at: string | null;
};

type MetricCommentInsertRow = {
  sprint_year: number;
  sprint_month: number;
  metric_key: SkillRadarKey;
  comment_text: string;
  sort_order: number;
};

type OngoingProjectRow = {
  id: string;
  sprint_year: number;
  sprint_month: number;
  name: string;
  sort_order: number;
  created_at: string | null;
};

type OngoingProjectInsertRow = {
  sprint_year: number;
  sprint_month: number;
  name: string;
  sort_order: number;
};

type OngoingProjectCommentRow = {
  id: string;
  project_id: string;
  comment_text: string;
  sort_order: number;
  created_at: string | null;
};

type OngoingProjectCommentInsertRow = {
  project_id: string;
  comment_text: string;
  sort_order: number;
};

type ChallengeRow = {
  id: string;
  sprint_year: number;
  sprint_month: number;
  comment_text: string;
  sort_order: number;
  created_at: string | null;
};

type ChallengeInsertRow = {
  sprint_year: number;
  sprint_month: number;
  comment_text: string;
  sort_order: number;
};

type PlanNextStepRow = {
  id: string;
  sprint_year: number;
  sprint_month: number;
  comment_text: string;
  sort_order: number;
  created_at: string | null;
};

type PlanNextStepInsertRow = {
  sprint_year: number;
  sprint_month: number;
  comment_text: string;
  sort_order: number;
};

type TeamGoalRow = {
  id: string;
  sprint_year: number;
  sprint_month: number;
  comment_text: string;
  sort_order: number;
  created_at: string | null;
};

type TeamGoalInsertRow = {
  sprint_year: number;
  sprint_month: number;
  comment_text: string;
  sort_order: number;
};

type NotableHighlightRow = {
  id: string;
  sprint_year: number;
  sprint_month: number;
  comment_text: string;
  sort_order: number;
  created_at: string | null;
};

type NotableHighlightInsertRow = {
  sprint_year: number;
  sprint_month: number;
  comment_text: string;
  sort_order: number;
};

function compareSortOrder(
  left: { sort_order: number; created_at: string | null },
  right: { sort_order: number; created_at: string | null },
) {
  if (left.sort_order !== right.sort_order) {
    return left.sort_order - right.sort_order;
  }

  return (left.created_at ?? "").localeCompare(right.created_at ?? "");
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error && typeof error === "object") {
    const { message, details, hint, code } = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    const parts = [
      typeof message === "string" ? message : null,
      typeof details === "string" ? details : null,
      typeof hint === "string" ? hint : null,
      typeof code === "string" ? `Code: ${code}` : null,
    ].filter((value): value is string => Boolean(value && value.trim()));

    if (parts.length > 0) {
      return parts.join(" ");
    }
  }

  return fallback;
}

function getOngoingProjectsLoadErrorMessage(error: unknown): string {
  const message = getErrorMessage(error, "Unable to load ongoing projects.");

  if (
    /could not find the table|relation .* does not exist|schema cache/i.test(
      message,
    )
  ) {
    return "Ongoing projects tables are missing. Run the latest Supabase migration (accountabilities_ongoing_projects).";
  }

  return message;
}

function getChallengesLoadErrorMessage(error: unknown): string {
  const message = getErrorMessage(error, "Unable to load challenges.");

  if (
    /could not find the table|relation .* does not exist|schema cache/i.test(
      message,
    )
  ) {
    return "Challenges table is missing. Run the latest Supabase migration (accountabilities_challenges).";
  }

  return message;
}

function getPlansNextStepsLoadErrorMessage(error: unknown): string {
  const message = getErrorMessage(error, "Unable to load plans and next steps.");

  if (
    /could not find the table|relation .* does not exist|schema cache/i.test(
      message,
    )
  ) {
    return "Plans and next steps table is missing. Run the latest Supabase migration (accountabilities_plans_next_steps).";
  }

  return message;
}

function getTeamGoalsLoadErrorMessage(error: unknown): string {
  const message = getErrorMessage(error, "Unable to load team goals.");

  if (
    /could not find the table|relation .* does not exist|schema cache/i.test(
      message,
    )
  ) {
    return "Team goals table is missing. Run the latest Supabase migration (accountabilities_team_goals).";
  }

  return message;
}

function getNotableHighlightsLoadErrorMessage(error: unknown): string {
  const message = getErrorMessage(error, "Unable to load notable highlights.");

  if (
    /could not find the table|relation .* does not exist|schema cache/i.test(
      message,
    )
  ) {
    return "Notable highlights table is missing. Run the latest Supabase migration (accountabilities_notable_highlights).";
  }

  return message;
}

type YearMonthPeriod = {
  year: number;
  month: number;
};

function averageFiniteScores(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getPreviousYearMonth(period: YearMonthPeriod): YearMonthPeriod {
  if (period.month <= 1) {
    return { year: period.year - 1, month: 12 };
  }

  return { year: period.year, month: period.month - 1 };
}

function formatYearMonthLabel(period: YearMonthPeriod): string {
  return `${getSprintMonthShortLabel(period.month)} ${period.year}`;
}

function formatSkillPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return `${value.toFixed(2)}%`;
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

function formatChangeDelta(delta: number | null): string {
  if (delta === null || !Number.isFinite(delta)) {
    return "—";
  }

  return `${delta > 0 ? "+" : ""}${delta.toFixed(2)}%`;
}

function getAccountabilitiesMemberName(member: AccountabilitiesMemberRow): string {
  return (
    member.full_name?.trim() ||
    [member.first_name, member.last_name].filter(Boolean).join(" ") ||
    "Unnamed member"
  );
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

function formatHoursTotal(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}

function CommentEditIcon() {
  return (
    <svg
      aria-hidden="true"
      className="accountabilities-metric-details__edit-icon"
      fill="none"
      height="14"
      viewBox="0 0 16 16"
      width="14"
    >
      <path
        d="M9.5 3.2 12.8 6.5M2.8 13.2l3.2-.7 6.9-6.9a1.6 1.6 0 0 0-2.3-2.3L3.6 10.3l-.8 2.9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function getMemberCompletedStoryPointsAverage(
  rows: MemberSprintScoreRow[],
  memberId: string,
): number | null {
  const values = rows
    .filter((row) => {
      if (row.member_id !== memberId) {
        return false;
      }

      return (
        row.completed_story_points !== null &&
        Number.isFinite(Number(row.completed_story_points))
      );
    })
    .map((row) => Number(row.completed_story_points));

  return averageFiniteScores(values);
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

function formatOutputTotal(
  value: number | null,
  options?: { ceil?: boolean },
): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  const displayValue = options?.ceil ? Math.ceil(value) : Math.round(value);
  return displayValue.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
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

function buildTeamSkillRadarForSprints(input: {
  sprintIds: string[];
  memberIds: string[];
  memberIdSet: Set<string>;
  performanceScores: MemberPerformanceScoreRow[];
  criteriaScores: MemberSprintCriteriaScoreRow[];
  professionalismScores: MemberSprintProfessionalismScoreRow[];
  professionalismItems: ProfessionalismItemRow[];
}): SkillRadarValues {
  const {
    sprintIds,
    memberIds,
    memberIdSet,
    performanceScores,
    criteriaScores,
    professionalismScores,
    professionalismItems,
  } = input;

  if (sprintIds.length === 0 || memberIds.length === 0) {
    return EMPTY_SKILL_RADAR_VALUES;
  }

  const relevantPerformanceRows = performanceScores.filter(
    (row) => sprintIds.includes(row.sprint_id) && memberIdSet.has(row.member_id),
  );
  const relevantCriteriaRows = criteriaScores.filter(
    (row) => sprintIds.includes(row.sprint_id) && memberIdSet.has(row.member_id),
  );
  const relevantProfessionalismScores = professionalismScores.filter(
    (row) => sprintIds.includes(row.sprint_id) && memberIdSet.has(row.member_id),
  );

  const builtValues = buildSkillRadarValues({
    criteriaScoreRows: relevantCriteriaRows,
    performanceRows: relevantPerformanceRows,
    memberIds,
    selectedMemberId: null,
    professionalismScoreRows: relevantProfessionalismScores,
    professionalismItems,
  });

  const totalMax = professionalismItems.reduce(
    (sum, item) => sum + Math.max(Number(item.value) || 0, 0),
    0,
  );
  const totalValue = professionalismItems.reduce((sum, item) => {
    const averageValue = getTeamProfessionalismItemAverage(
      relevantProfessionalismScores,
      memberIds,
      item.id,
    );

    return sum + (averageValue === null ? 0 : Math.round(averageValue * 10) / 10);
  }, 0);
    const professionalismPercent =
      (Math.round(totalValue * 100) / 100 / Math.max(totalMax, 1)) * 100;

  return normalizeSkillRadarValues({
    ...builtValues,
    professionalism: professionalismPercent,
  });
}

function PercentDial({
  value,
  label,
  glowFilterId,
  size = "default",
  dimmed = false,
}: {
  value: number | null;
  label: string;
  glowFilterId: string;
  size?: "default" | "compact";
  dimmed?: boolean;
}) {
  const hasValue = value !== null && Number.isFinite(value);
  const clamped = hasValue ? Math.max(0, Math.min(100, value)) : 0;
  const color = hasValue
    ? getSkillValueGradeColor(clamped, DEFAULT_PASSING_THRESHOLD)
    : "rgba(120,170,215,0.45)";
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;
  const isCompact = size === "compact";

  return (
    <div
      className={`accountabilities-metric-dial${
        isCompact ? " accountabilities-metric-dial--compact" : ""
      }${dimmed ? " accountabilities-metric-dial--dimmed" : ""}`}
    >
      <svg
        aria-label={`${label} ${formatSkillPercent(value)}`}
        className="accountabilities-metric-dial__svg"
        role="img"
        viewBox="0 0 190 190"
      >
        <defs>
          <filter id={glowFilterId} x="-40%" y="-40%" width="180%" height="180%">
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
          r={radius}
          stroke="rgba(160,210,255,0.14)"
          strokeLinecap="round"
          strokeWidth="13"
        />
        {hasValue ? (
          <circle
            cx="95"
            cy="95"
            fill="none"
            filter={`url(#${glowFilterId})`}
            r={radius}
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            strokeWidth="13"
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: "95px 95px",
              transition: "stroke-dashoffset 0.45s ease",
            }}
          />
        ) : null}
        <text
          fill={color}
          fontFamily="'DM Mono', monospace"
          fontSize={isCompact ? 26 : 32}
          fontWeight="800"
          textAnchor="middle"
          x="95"
          y="98"
        >
          {formatSkillPercent(value)}
        </text>
      </svg>
      <span className="accountabilities-metric-dial__label">{label}</span>
    </div>
  );
}

export default function AccountabilitiesPage({
  showFilters = true,
  showPublicViewButton = true,
  showCommentActions = true,
  showDownloadButton = false,
  initialYear = "",
  initialMonth = "",
}: {
  showFilters?: boolean;
  showPublicViewButton?: boolean;
  showCommentActions?: boolean;
  showDownloadButton?: boolean;
  initialYear?: string;
  initialMonth?: string;
} = {}) {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [sprints, setSprints] = useState<AccountabilitiesSprintRow[]>([]);
  const [members, setMembers] = useState<AccountabilitiesMemberRow[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [filtersError, setFiltersError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [performanceScores, setPerformanceScores] = useState<
    MemberPerformanceScoreRow[]
  >([]);
  const [memberSprintScores, setMemberSprintScores] = useState<
    MemberSprintScoreRow[]
  >([]);
  const [criteriaScores, setCriteriaScores] = useState<
    MemberSprintCriteriaScoreRow[]
  >([]);
  const [professionalismScores, setProfessionalismScores] = useState<
    MemberSprintProfessionalismScoreRow[]
  >([]);
  const [professionalismItems, setProfessionalismItems] = useState<
    ProfessionalismItemRow[]
  >([]);
  const [radarLoading, setRadarLoading] = useState(false);
  const [metricComments, setMetricComments] = useState<MetricCommentRow[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [addingMetricKey, setAddingMetricKey] = useState<SkillRadarKey | null>(
    null,
  );
  const [draftComments, setDraftComments] = useState<
    Partial<Record<SkillRadarKey, string>>
  >({});
  const [savingMetricKey, setSavingMetricKey] = useState<SkillRadarKey | null>(
    null,
  );
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
    null,
  );
  const [editingMetricCommentId, setEditingMetricCommentId] = useState<
    string | null
  >(null);
  const [editDraftMetricComments, setEditDraftMetricComments] = useState<
    Record<string, string>
  >({});
  const [savingEditedMetricCommentId, setSavingEditedMetricCommentId] =
    useState<string | null>(null);
  const [ongoingProjects, setOngoingProjects] = useState<OngoingProjectRow[]>(
    [],
  );
  const [ongoingProjectComments, setOngoingProjectComments] = useState<
    OngoingProjectCommentRow[]
  >([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [draftProjectName, setDraftProjectName] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null,
  );
  const [addingProjectCommentId, setAddingProjectCommentId] = useState<
    string | null
  >(null);
  const [draftProjectComments, setDraftProjectComments] = useState<
    Record<string, string>
  >({});
  const [savingProjectCommentId, setSavingProjectCommentId] = useState<
    string | null
  >(null);
  const [deletingProjectCommentId, setDeletingProjectCommentId] = useState<
    string | null
  >(null);
  const [editingProjectCommentId, setEditingProjectCommentId] = useState<
    string | null
  >(null);
  const [editDraftProjectComments, setEditDraftProjectComments] = useState<
    Record<string, string>
  >({});
  const [savingEditedProjectCommentId, setSavingEditedProjectCommentId] =
    useState<string | null>(null);

  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(false);
  const [challengesError, setChallengesError] = useState<string | null>(null);
  const [isAddingChallenge, setIsAddingChallenge] = useState(false);
  const [draftChallenge, setDraftChallenge] = useState("");
  const [savingChallenge, setSavingChallenge] = useState(false);
  const [deletingChallengeId, setDeletingChallengeId] = useState<string | null>(
    null,
  );
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(
    null,
  );
  const [editDraftChallenges, setEditDraftChallenges] = useState<
    Record<string, string>
  >({});
  const [savingEditedChallengeId, setSavingEditedChallengeId] = useState<
    string | null
  >(null);

  const [plansNextSteps, setPlansNextSteps] = useState<PlanNextStepRow[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [isAddingPlan, setIsAddingPlan] = useState(false);
  const [draftPlan, setDraftPlan] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editDraftPlans, setEditDraftPlans] = useState<Record<string, string>>(
    {},
  );
  const [savingEditedPlanId, setSavingEditedPlanId] = useState<string | null>(
    null,
  );

  const [teamGoals, setTeamGoals] = useState<TeamGoalRow[]>([]);
  const [teamGoalsLoading, setTeamGoalsLoading] = useState(false);
  const [teamGoalsError, setTeamGoalsError] = useState<string | null>(null);
  const [isAddingTeamGoal, setIsAddingTeamGoal] = useState(false);
  const [draftTeamGoal, setDraftTeamGoal] = useState("");
  const [savingTeamGoal, setSavingTeamGoal] = useState(false);
  const [deletingTeamGoalId, setDeletingTeamGoalId] = useState<string | null>(
    null,
  );
  const [editingTeamGoalId, setEditingTeamGoalId] = useState<string | null>(
    null,
  );
  const [editDraftTeamGoals, setEditDraftTeamGoals] = useState<
    Record<string, string>
  >({});
  const [savingEditedTeamGoalId, setSavingEditedTeamGoalId] = useState<
    string | null
  >(null);

  const [notableHighlights, setNotableHighlights] = useState<
    NotableHighlightRow[]
  >([]);
  const [highlightsLoading, setHighlightsLoading] = useState(false);
  const [highlightsError, setHighlightsError] = useState<string | null>(null);
  const [isAddingHighlight, setIsAddingHighlight] = useState(false);
  const [draftHighlight, setDraftHighlight] = useState("");
  const [savingHighlight, setSavingHighlight] = useState(false);
  const [deletingHighlightId, setDeletingHighlightId] = useState<string | null>(
    null,
  );
  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(
    null,
  );
  const [editDraftHighlights, setEditDraftHighlights] = useState<
    Record<string, string>
  >({});
  const [savingEditedHighlightId, setSavingEditedHighlightId] = useState<
    string | null
  >(null);

  const canManageProjects = showCommentActions;
  const canManageChallenges = showCommentActions;
  const canManagePlans = showCommentActions;
  const canManageTeamGoals = showCommentActions;
  const canManageHighlights = showCommentActions;

  const selectableSprints = useMemo(
    () =>
      sprints.filter(
        (sprint) => Number(sprint.is_current) !== 1 && sprint.is_current !== true,
      ),
    [sprints],
  );

  const yearOptions = useMemo(() => getAvailableSprintYears(sprints), [sprints]);
  const monthOptions = useMemo(() => {
    if (!selectedYear) {
      return [];
    }

    const year = Number(selectedYear);
    return getAvailableSprintYearMonths(sprints)
      .filter((option) => option.year === year)
      .map((option) => ({
        value: String(option.month),
        label: getSprintMonthShortLabel(option.month),
      }));
  }, [selectedYear, sprints]);

  const memberOptions = useMemo(
    () =>
      sortMembersByLastName(
        members.filter(
          (member): member is AccountabilitiesMemberRow & { id: string } =>
            isScoreboardIncludedMember(member),
        ),
      ),
    [members],
  );
  const scoreboardMemberIdList = useMemo(
    () => memberOptions.map((member) => member.id),
    [memberOptions],
  );
  const scoreboardMemberIds = useMemo(
    () => new Set(scoreboardMemberIdList),
    [scoreboardMemberIdList],
  );

  // Match Statistics "By Month" + Team: only non-current sprints in the selected year/month.
  const selectedPeriod = useMemo((): YearMonthPeriod | null => {
    const year = Number(selectedYear);
    const month = Number(selectedMonth);
    if (!selectedYear || !selectedMonth || !Number.isFinite(year) || !Number.isFinite(month)) {
      return null;
    }

    return { year, month };
  }, [selectedMonth, selectedYear]);

  const previousPeriod = useMemo(
    () => (selectedPeriod ? getPreviousYearMonth(selectedPeriod) : null),
    [selectedPeriod],
  );

  const activeSprintIds = useMemo(() => {
    if (!selectedPeriod) {
      return [] as string[];
    }

    return selectableSprints
      .filter((sprint) => {
        if (!sprint.id) {
          return false;
        }

        return (
          getSprintListingYear(sprint) === selectedPeriod.year &&
          getSprintListingMonth(sprint) === selectedPeriod.month
        );
      })
      .map((sprint) => sprint.id as string);
  }, [selectableSprints, selectedPeriod]);

  const previousSprintIds = useMemo(() => {
    if (!previousPeriod) {
      return [] as string[];
    }

    return selectableSprints
      .filter((sprint) => {
        if (!sprint.id) {
          return false;
        }

        return (
          getSprintListingYear(sprint) === previousPeriod.year &&
          getSprintListingMonth(sprint) === previousPeriod.month
        );
      })
      .map((sprint) => sprint.id as string);
  }, [previousPeriod, selectableSprints]);

  const scoreFetchSprintIds = useMemo(
    () => [...new Set([...activeSprintIds, ...previousSprintIds])],
    [activeSprintIds, previousSprintIds],
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

  const skillChartScale = useMemo(
    () => ({
      minValue: 60,
      maxValue: DEFAULT_SKILL_CHART_SCALE.maxValue,
    }),
    [],
  );

  const teamSkillRadarValues = useMemo(
    (): SkillRadarValues =>
      buildTeamSkillRadarForSprints({
        sprintIds: activeSprintIds,
        memberIds: scoreboardMemberIdList,
        memberIdSet: scoreboardMemberIds,
        performanceScores,
        criteriaScores,
        professionalismScores,
        professionalismItems: sortedProfessionalismItems,
      }),
    [
      activeSprintIds,
      criteriaScores,
      performanceScores,
      professionalismScores,
      scoreboardMemberIdList,
      scoreboardMemberIds,
      sortedProfessionalismItems,
    ],
  );

  const previousTeamSkillRadarValues = useMemo(
    (): SkillRadarValues =>
      buildTeamSkillRadarForSprints({
        sprintIds: previousSprintIds,
        memberIds: scoreboardMemberIdList,
        memberIdSet: scoreboardMemberIds,
        performanceScores,
        criteriaScores,
        professionalismScores,
        professionalismItems: sortedProfessionalismItems,
      }),
    [
      criteriaScores,
      performanceScores,
      previousSprintIds,
      professionalismScores,
      scoreboardMemberIdList,
      scoreboardMemberIds,
      sortedProfessionalismItems,
    ],
  );

  const displayedSkillRadarValues = radarLoading
    ? EMPTY_SKILL_RADAR_VALUES
    : teamSkillRadarValues;

  const previousPeriodLabel = previousPeriod
    ? formatYearMonthLabel(previousPeriod)
    : "Previous month";
  const currentPeriodLabel = selectedPeriod
    ? formatYearMonthLabel(selectedPeriod)
    : "Selected month";

  const teamContributionSegments = useMemo((): TeamContributionSegment[] => {
    if (activeSprintIds.length === 0) {
      return [];
    }

    const relevantRows = memberSprintScores.filter(
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
          name: getAccountabilitiesMemberName(member),
          color: getTeamContributionMemberColor(member.id, index),
          storyPoints: averageCompletedStoryPoints,
          contribution: 0,
        };
      })
      .filter(
        (
          segment,
        ): segment is Omit<TeamContributionSegment, "contribution"> & {
          contribution: number;
        } => segment !== null && segment.storyPoints > 0,
      );

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
  }, [activeSprintIds, memberOptions, memberSprintScores, scoreboardMemberIds]);

  const relevantMemberScoreRows = useMemo(
    () =>
      memberSprintScores.filter(
        (row) =>
          activeSprintIds.includes(row.sprint_id) &&
          scoreboardMemberIds.has(row.member_id),
      ),
    [activeSprintIds, memberSprintScores, scoreboardMemberIds],
  );

  const totalStoryPointsValue = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    return getTeamSprintScoreFieldTotal(
      relevantMemberScoreRows,
      scoreboardMemberIdList,
      "completed_story_points",
    );
  }, [activeSprintIds, relevantMemberScoreRows, scoreboardMemberIdList]);

  const totalTasksValue = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    return getTeamSprintScoreFieldTotal(
      relevantMemberScoreRows,
      scoreboardMemberIdList,
      "completed_tasks_count",
    );
  }, [activeSprintIds, relevantMemberScoreRows, scoreboardMemberIdList]);

  const displayedTotalStoryPoints = radarLoading
    ? "…"
    : formatOutputTotal(totalStoryPointsValue, { ceil: true });
  const displayedTotalTasks = radarLoading
    ? "…"
    : formatOutputTotal(totalTasksValue);

  const currentOverallScore = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    const relevantRows = performanceScores.filter(
      (row) =>
        activeSprintIds.includes(row.sprint_id) &&
        scoreboardMemberIds.has(row.member_id),
    );

    return getTeamPerformanceFieldAverage(
      relevantRows,
      scoreboardMemberIdList,
      "average_score",
    );
  }, [
    activeSprintIds,
    performanceScores,
    scoreboardMemberIdList,
    scoreboardMemberIds,
  ]);

  const previousOverallScore = useMemo(() => {
    if (previousSprintIds.length === 0) {
      return null;
    }

    const relevantRows = performanceScores.filter(
      (row) =>
        previousSprintIds.includes(row.sprint_id) &&
        scoreboardMemberIds.has(row.member_id),
    );

    return getTeamPerformanceFieldAverage(
      relevantRows,
      scoreboardMemberIdList,
      "average_score",
    );
  }, [
    performanceScores,
    previousSprintIds,
    scoreboardMemberIdList,
    scoreboardMemberIds,
  ]);

  const overallScoreChange = useMemo(
    () =>
      getMetricChange(
        radarLoading ? null : previousOverallScore,
        radarLoading || activeSprintIds.length === 0
          ? null
          : currentOverallScore,
      ),
    [
      activeSprintIds.length,
      currentOverallScore,
      previousOverallScore,
      radarLoading,
    ],
  );

  const totalHoursValue = useMemo(() => {
    if (activeSprintIds.length === 0) {
      return null;
    }

    return getTeamSprintScoreFieldTotal(
      relevantMemberScoreRows,
      scoreboardMemberIdList,
      "accumulated_hours",
    );
  }, [activeSprintIds, relevantMemberScoreRows, scoreboardMemberIdList]);

  const displayedTotalHours = radarLoading
    ? "…"
    : formatHoursTotal(totalHoursValue);

  const teamGradeValue = useMemo((): PerformanceScoreGrade | null => {
    if (
      radarLoading ||
      activeSprintIds.length === 0 ||
      currentOverallScore === null
    ) {
      return null;
    }

    return resolvePerformanceScoreGrade(
      currentOverallScore,
      GRADE_PASSING_THRESHOLD,
    );
  }, [activeSprintIds.length, currentOverallScore, radarLoading]);

  const displayedTeamGrade = radarLoading
    ? "…"
    : (teamGradeValue ?? "—");
  const teamGradeColor = teamGradeValue
    ? PERFORMANCE_GRADE_COLORS[teamGradeValue]
    : "#fff";

  const commentsByMetric = useMemo(() => {
    const grouped: Record<SkillRadarKey, MetricCommentRow[]> = {
      productivity: [],
      efficiency: [],
      quality: [],
      collaboration: [],
      velocity: [],
      professionalism: [],
    };

    for (const comment of metricComments) {
      if (!grouped[comment.metric_key]) {
        continue;
      }
      grouped[comment.metric_key].push(comment);
    }

    for (const metricKey of SKILL_METRIC_ROWS.map((metric) => metric.key)) {
      grouped[metricKey].sort(compareSortOrder);
    }

    return grouped;
  }, [metricComments]);

  const commentsByProjectId = useMemo(() => {
    const grouped: Record<string, OngoingProjectCommentRow[]> = {};

    for (const comment of ongoingProjectComments) {
      if (!grouped[comment.project_id]) {
        grouped[comment.project_id] = [];
      }
      grouped[comment.project_id].push(comment);
    }

    for (const comments of Object.values(grouped)) {
      comments.sort(compareSortOrder);
    }

    return grouped;
  }, [ongoingProjectComments]);

  useEffect(() => {
    let cancelled = false;

    async function loadSprintsAndMembers() {
      setFiltersLoading(true);
      setFiltersError(null);

      try {
        const [sprintRows, memberRows, professionalismItemRows] =
          await Promise.all([
            getSupabaseRows<AccountabilitiesSprintRow>("sprints", {
              select:
                "id,sprint_year,sprint_month,month,start_date,end_date,is_current",
              order: { column: "start_date", ascending: false },
            }),
            getSupabaseRows<AccountabilitiesMemberRow>("members", {
              select: "id,full_name,first_name,last_name,role",
            }),
            getSupabaseRows<ProfessionalismItemRow>("professionalism_items", {
              select: "id,name,code,value",
              order: { column: "name", ascending: true },
            }),
          ]);

        if (!cancelled) {
          setSprints(sprintRows);
          setMembers(memberRows);
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
              : "Unable to load sprint filter options.",
          );
        }
      } finally {
        if (!cancelled) {
          setFiltersLoading(false);
        }
      }
    }

    void loadSprintsAndMembers();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (yearOptions.length === 0) {
      setSelectedYear("");
      return;
    }

    setSelectedYear((currentYear) => {
      if (currentYear && yearOptions.includes(Number(currentYear))) {
        return currentYear;
      }

      if (initialYear && yearOptions.includes(Number(initialYear))) {
        return initialYear;
      }

      return String(yearOptions[0]);
    });
  }, [initialYear, yearOptions]);

  useEffect(() => {
    if (monthOptions.length === 0) {
      setSelectedMonth("");
      return;
    }

    setSelectedMonth((currentMonth) => {
      if (currentMonth && monthOptions.some((option) => option.value === currentMonth)) {
        return currentMonth;
      }

      if (
        initialMonth &&
        monthOptions.some((option) => option.value === initialMonth)
      ) {
        return initialMonth;
      }

      return monthOptions[0].value;
    });
  }, [initialMonth, monthOptions]);

  function getPublicAccountabilitiesUrl() {
    const url = new URL("/public/accountabilities", window.location.origin);
    if (selectedYear) {
      url.searchParams.set("year", selectedYear);
    }
    if (selectedMonth) {
      url.searchParams.set("month", selectedMonth);
    }
    return url.toString();
  }

  function openPublicAccountabilitiesPage() {
    window.open(getPublicAccountabilitiesUrl(), "_blank", "noopener,noreferrer");
  }

  useEffect(() => {
    let cancelled = false;

    async function loadRadarScores() {
      if (scoreFetchSprintIds.length === 0) {
        setPerformanceScores([]);
        setMemberSprintScores([]);
        setCriteriaScores([]);
        setProfessionalismScores([]);
        setRadarLoading(false);
        return;
      }

      setRadarLoading(true);

      try {
        const performanceQueryOptions =
          scoreFetchSprintIds.length === 1
            ? {
                select:
                  "member_id,sprint_id,average_score,total_story_points,assigned_story_points,velocity_by_hour",
                eq: { sprint_id: scoreFetchSprintIds[0] },
              }
            : {
                select:
                  "member_id,sprint_id,average_score,total_story_points,assigned_story_points,velocity_by_hour",
                in: { sprint_id: scoreFetchSprintIds },
              };

        const memberScoreQueryOptions =
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

        const professionalismQueryOptions =
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
          memberScoreRows,
          criteriaRows,
          professionalismRows,
        ] = await Promise.all([
          getSupabaseRows<MemberPerformanceScoreRow>(
            "members_performance_scores",
            performanceQueryOptions,
          ),
          getSupabaseRows<MemberSprintScoreRow>(
            "members_sprint_scores",
            memberScoreQueryOptions,
          ),
          getSupabaseRows<MemberSprintCriteriaScoreRow>(
            "member_sprint_criteria_scores",
            criteriaQueryOptions,
          ),
          getSupabaseRows<MemberSprintProfessionalismScoreRow>(
            "member_sprint_professionalism_scores",
            professionalismQueryOptions,
          ),
        ]);

        if (!cancelled) {
          setPerformanceScores(performanceRows);
          setMemberSprintScores(memberScoreRows);
          setCriteriaScores(criteriaRows);
          setProfessionalismScores(professionalismRows);
        }
      } catch {
        if (!cancelled) {
          setPerformanceScores([]);
          setMemberSprintScores([]);
          setCriteriaScores([]);
          setProfessionalismScores([]);
        }
      } finally {
        if (!cancelled) {
          setRadarLoading(false);
        }
      }
    }

    void loadRadarScores();

    return () => {
      cancelled = true;
    };
  }, [scoreFetchSprintIds]);

  useEffect(() => {
    let cancelled = false;

    async function loadMetricComments() {
      if (!selectedPeriod) {
        setMetricComments([]);
        setCommentsError(null);
        setCommentsLoading(false);
        return;
      }

      setCommentsLoading(true);
      setCommentsError(null);

      try {
        const rows = await getSupabaseRows<MetricCommentRow>(
          "accountabilities_metric_comments",
          {
            select:
              "id,sprint_year,sprint_month,metric_key,comment_text,sort_order,created_at",
            eq: {
              sprint_year: selectedPeriod.year,
              sprint_month: selectedPeriod.month,
            },
            order: { column: "sort_order", ascending: true },
          },
        );

        if (!cancelled) {
          setMetricComments(
            rows
              .filter((row): row is MetricCommentRow =>
                SKILL_METRIC_ROWS.some(
                  (metric) => metric.key === row.metric_key,
                ),
              )
              .sort(compareSortOrder),
          );
        }
      } catch (error) {
        if (!cancelled) {
          setMetricComments([]);
          setCommentsError(
            error instanceof Error
              ? error.message
              : "Unable to load metric comments.",
          );
        }
      } finally {
        if (!cancelled) {
          setCommentsLoading(false);
        }
      }
    }

    void loadMetricComments();

    return () => {
      cancelled = true;
    };
  }, [selectedPeriod]);

  async function handleAddMetricComment(metricKey: SkillRadarKey) {
    if (!selectedPeriod || savingMetricKey) {
      return;
    }

    const draft = (draftComments[metricKey] ?? "").trim();
    if (!draft) {
      return;
    }

    setSavingMetricKey(metricKey);
    setCommentsError(null);

    try {
      const nextSortOrder =
        metricComments
          .filter((comment) => comment.metric_key === metricKey)
          .reduce((max, comment) => Math.max(max, comment.sort_order), 0) + 1;

      const [created] = await insertSupabaseRows<
        MetricCommentRow,
        MetricCommentInsertRow
      >(
        "accountabilities_metric_comments",
        {
          sprint_year: selectedPeriod.year,
          sprint_month: selectedPeriod.month,
          metric_key: metricKey,
          comment_text: draft,
          sort_order: nextSortOrder,
        },
        "id,sprint_year,sprint_month,metric_key,comment_text,sort_order,created_at",
      );

      setMetricComments((current) => [...current, created]);
      setDraftComments((current) => ({ ...current, [metricKey]: "" }));
      setAddingMetricKey(null);
    } catch (error) {
      setCommentsError(
        error instanceof Error
          ? error.message
          : "Unable to save metric comment.",
      );
    } finally {
      setSavingMetricKey(null);
    }
  }

  async function handleDeleteMetricComment(commentId: string) {
    if (deletingCommentId) {
      return;
    }

    setDeletingCommentId(commentId);
    setCommentsError(null);

    try {
      await deleteSupabaseRows("accountabilities_metric_comments", {
        eq: { id: commentId },
      });
      setMetricComments((current) =>
        current.filter((comment) => comment.id !== commentId),
      );
      if (editingMetricCommentId === commentId) {
        setEditingMetricCommentId(null);
        setEditDraftMetricComments((current) => {
          const next = { ...current };
          delete next[commentId];
          return next;
        });
      }
    } catch (error) {
      setCommentsError(
        error instanceof Error
          ? error.message
          : "Unable to delete metric comment.",
      );
    } finally {
      setDeletingCommentId(null);
    }
  }

  async function handleUpdateMetricComment(commentId: string) {
    if (!showCommentActions || savingEditedMetricCommentId) {
      return;
    }

    const draft = (editDraftMetricComments[commentId] ?? "").trim();
    if (!draft) {
      return;
    }

    setSavingEditedMetricCommentId(commentId);
    setCommentsError(null);

    try {
      const [updated] = await updateSupabaseRows<
        MetricCommentRow,
        { comment_text: string }
      >(
        "accountabilities_metric_comments",
        { comment_text: draft },
        {
          select:
            "id,sprint_year,sprint_month,metric_key,comment_text,sort_order,created_at",
          eq: { id: commentId },
        },
      );

      if (!updated) {
        throw new Error("Unable to update metric comment.");
      }

      setMetricComments((current) =>
        current.map((comment) =>
          comment.id === commentId ? updated : comment,
        ),
      );
      setEditingMetricCommentId(null);
      setEditDraftMetricComments((current) => {
        const next = { ...current };
        delete next[commentId];
        return next;
      });
    } catch (error) {
      setCommentsError(
        error instanceof Error
          ? error.message
          : "Unable to update metric comment.",
      );
    } finally {
      setSavingEditedMetricCommentId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadOngoingProjects() {
      if (!selectedPeriod) {
        setOngoingProjects([]);
        setOngoingProjectComments([]);
        setProjectsError(null);
        setProjectsLoading(false);
        return;
      }

      setProjectsLoading(true);
      setProjectsError(null);

      try {
        const projectRows = await getSupabaseRows<OngoingProjectRow>(
          "accountabilities_ongoing_projects",
          {
            select: "id,sprint_year,sprint_month,name,sort_order,created_at",
            eq: {
              sprint_year: selectedPeriod.year,
              sprint_month: selectedPeriod.month,
            },
            order: { column: "sort_order", ascending: true },
          },
        );

        const sortedProjects = [...projectRows].sort(compareSortOrder);

        const projectIds = sortedProjects.map((project) => project.id);
        const commentRows =
          projectIds.length > 0
            ? await getSupabaseRows<OngoingProjectCommentRow>(
                "accountabilities_ongoing_project_comments",
                {
                  select: "id,project_id,comment_text,sort_order,created_at",
                  in: { project_id: projectIds },
                  order: { column: "sort_order", ascending: true },
                },
              )
            : [];

        if (!cancelled) {
          setOngoingProjects(sortedProjects);
          setOngoingProjectComments([...commentRows].sort(compareSortOrder));
        }
      } catch (error) {
        if (!cancelled) {
          setOngoingProjects([]);
          setOngoingProjectComments([]);
          setProjectsError(getOngoingProjectsLoadErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setProjectsLoading(false);
        }
      }
    }

    void loadOngoingProjects();

    return () => {
      cancelled = true;
    };
  }, [selectedPeriod]);

  async function handleAddOngoingProject() {
    if (!selectedPeriod || !canManageProjects || savingProject) {
      return;
    }

    const name = draftProjectName.trim();
    if (!name) {
      return;
    }

    setSavingProject(true);
    setProjectsError(null);

    try {
      const nextSortOrder =
        ongoingProjects.reduce(
          (max, project) => Math.max(max, project.sort_order),
          0,
        ) + 1;

      const [created] = await insertSupabaseRows<
        OngoingProjectRow,
        OngoingProjectInsertRow
      >(
        "accountabilities_ongoing_projects",
        {
          sprint_year: selectedPeriod.year,
          sprint_month: selectedPeriod.month,
          name,
          sort_order: nextSortOrder,
        },
        "id,sprint_year,sprint_month,name,sort_order,created_at",
      );

      if (!created?.id) {
        throw new Error("Project was not saved to Supabase.");
      }

      setOngoingProjects((current) => [...current, created]);
      setDraftProjectName("");
      setIsAddingProject(false);
    } catch (error) {
      setProjectsError(getErrorMessage(error, "Unable to add project."));
    } finally {
      setSavingProject(false);
    }
  }

  async function handleDeleteOngoingProject(projectId: string) {
    if (!canManageProjects || deletingProjectId) {
      return;
    }

    setDeletingProjectId(projectId);
    setProjectsError(null);

    try {
      await deleteSupabaseRows("accountabilities_ongoing_projects", {
        eq: { id: projectId },
      });
      setOngoingProjects((current) =>
        current.filter((project) => project.id !== projectId),
      );
      setOngoingProjectComments((current) =>
        current.filter((comment) => comment.project_id !== projectId),
      );
      setDraftProjectComments((current) => {
        const next = { ...current };
        delete next[projectId];
        return next;
      });
      if (addingProjectCommentId === projectId) {
        setAddingProjectCommentId(null);
      }
    } catch (error) {
      setProjectsError(getErrorMessage(error, "Unable to delete project."));
    } finally {
      setDeletingProjectId(null);
    }
  }

  async function handleAddOngoingProjectComment(projectId: string) {
    if (!canManageProjects || savingProjectCommentId) {
      return;
    }

    const draft = (draftProjectComments[projectId] ?? "").trim();
    if (!draft) {
      return;
    }

    if (!projectId) {
      setProjectsError("Unable to save project comment: missing project.");
      return;
    }

    setSavingProjectCommentId(projectId);
    setProjectsError(null);

    try {
      const nextSortOrder =
        ongoingProjectComments
          .filter((comment) => comment.project_id === projectId)
          .reduce((max, comment) => Math.max(max, comment.sort_order), 0) + 1;

      const inserted = await insertSupabaseRows<
        OngoingProjectCommentRow,
        OngoingProjectCommentInsertRow
      >(
        "accountabilities_ongoing_project_comments",
        {
          project_id: projectId,
          comment_text: draft,
          sort_order: nextSortOrder,
        },
        "id,project_id,comment_text,sort_order,created_at",
      );

      const created = inserted[0];
      if (!created?.id || created.project_id !== projectId) {
        throw new Error("Project comment was not saved to Supabase.");
      }

      setOngoingProjectComments((current) =>
        [...current, created].sort(compareSortOrder),
      );
      setDraftProjectComments((current) => ({ ...current, [projectId]: "" }));
      setAddingProjectCommentId(null);
    } catch (error) {
      setProjectsError(
        getErrorMessage(error, "Unable to save project comment."),
      );
    } finally {
      setSavingProjectCommentId(null);
    }
  }

  async function handleDeleteOngoingProjectComment(commentId: string) {
    if (!canManageProjects || deletingProjectCommentId) {
      return;
    }

    setDeletingProjectCommentId(commentId);
    setProjectsError(null);

    try {
      await deleteSupabaseRows("accountabilities_ongoing_project_comments", {
        eq: { id: commentId },
      });
      setOngoingProjectComments((current) =>
        current.filter((comment) => comment.id !== commentId),
      );
      if (editingProjectCommentId === commentId) {
        setEditingProjectCommentId(null);
        setEditDraftProjectComments((current) => {
          const next = { ...current };
          delete next[commentId];
          return next;
        });
      }
    } catch (error) {
      setProjectsError(
        getErrorMessage(error, "Unable to delete project comment."),
      );
    } finally {
      setDeletingProjectCommentId(null);
    }
  }

  async function handleUpdateOngoingProjectComment(commentId: string) {
    if (!canManageProjects || savingEditedProjectCommentId) {
      return;
    }

    const draft = (editDraftProjectComments[commentId] ?? "").trim();
    if (!draft) {
      return;
    }

    setSavingEditedProjectCommentId(commentId);
    setProjectsError(null);

    try {
      const updatedRows = await updateSupabaseRows<
        OngoingProjectCommentRow,
        { comment_text: string }
      >(
        "accountabilities_ongoing_project_comments",
        { comment_text: draft },
        {
          select: "id,project_id,comment_text,sort_order,created_at",
          eq: { id: commentId },
        },
      );

      const updated = updatedRows[0];
      if (!updated?.id) {
        throw new Error("Project comment was not updated in Supabase.");
      }

      setOngoingProjectComments((current) =>
        current.map((comment) =>
          comment.id === commentId ? updated : comment,
        ),
      );
      setEditingProjectCommentId(null);
      setEditDraftProjectComments((current) => {
        const next = { ...current };
        delete next[commentId];
        return next;
      });
    } catch (error) {
      setProjectsError(
        getErrorMessage(error, "Unable to update project comment."),
      );
    } finally {
      setSavingEditedProjectCommentId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadChallenges() {
      if (!selectedPeriod) {
        setChallenges([]);
        setChallengesError(null);
        setChallengesLoading(false);
        return;
      }

      setChallengesLoading(true);
      setChallengesError(null);

      try {
        const rows = await getSupabaseRows<ChallengeRow>(
          "accountabilities_challenges",
          {
            select:
              "id,sprint_year,sprint_month,comment_text,sort_order,created_at",
            eq: {
              sprint_year: selectedPeriod.year,
              sprint_month: selectedPeriod.month,
            },
            order: { column: "sort_order", ascending: true },
          },
        );

        if (!cancelled) {
          setChallenges([...rows].sort(compareSortOrder));
        }
      } catch (error) {
        if (!cancelled) {
          setChallenges([]);
          setChallengesError(getChallengesLoadErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setChallengesLoading(false);
        }
      }
    }

    void loadChallenges();

    return () => {
      cancelled = true;
    };
  }, [selectedPeriod]);

  async function handleAddChallenge() {
    if (!selectedPeriod || !canManageChallenges || savingChallenge) {
      return;
    }

    const draft = draftChallenge.trim();
    if (!draft) {
      return;
    }

    setSavingChallenge(true);
    setChallengesError(null);

    try {
      const nextSortOrder =
        challenges.reduce(
          (max, challenge) => Math.max(max, challenge.sort_order),
          0,
        ) + 1;

      const inserted = await insertSupabaseRows<ChallengeRow, ChallengeInsertRow>(
        "accountabilities_challenges",
        {
          sprint_year: selectedPeriod.year,
          sprint_month: selectedPeriod.month,
          comment_text: draft,
          sort_order: nextSortOrder,
        },
        "id,sprint_year,sprint_month,comment_text,sort_order,created_at",
      );

      const created = inserted[0];
      if (!created?.id) {
        throw new Error("Challenge was not saved to Supabase.");
      }

      setChallenges((current) => [...current, created]);
      setDraftChallenge("");
      setIsAddingChallenge(false);
    } catch (error) {
      setChallengesError(getErrorMessage(error, "Unable to save challenge."));
    } finally {
      setSavingChallenge(false);
    }
  }

  async function handleDeleteChallenge(challengeId: string) {
    if (!canManageChallenges || deletingChallengeId) {
      return;
    }

    setDeletingChallengeId(challengeId);
    setChallengesError(null);

    try {
      await deleteSupabaseRows("accountabilities_challenges", {
        eq: { id: challengeId },
      });
      setChallenges((current) =>
        current.filter((challenge) => challenge.id !== challengeId),
      );
      if (editingChallengeId === challengeId) {
        setEditingChallengeId(null);
        setEditDraftChallenges((current) => {
          const next = { ...current };
          delete next[challengeId];
          return next;
        });
      }
    } catch (error) {
      setChallengesError(getErrorMessage(error, "Unable to delete challenge."));
    } finally {
      setDeletingChallengeId(null);
    }
  }

  async function handleUpdateChallenge(challengeId: string) {
    if (!canManageChallenges || savingEditedChallengeId) {
      return;
    }

    const draft = (editDraftChallenges[challengeId] ?? "").trim();
    if (!draft) {
      return;
    }

    setSavingEditedChallengeId(challengeId);
    setChallengesError(null);

    try {
      const updatedRows = await updateSupabaseRows<
        ChallengeRow,
        { comment_text: string }
      >(
        "accountabilities_challenges",
        { comment_text: draft },
        {
          select:
            "id,sprint_year,sprint_month,comment_text,sort_order,created_at",
          eq: { id: challengeId },
        },
      );

      const updated = updatedRows[0];
      if (!updated?.id) {
        throw new Error("Challenge was not updated in Supabase.");
      }

      setChallenges((current) =>
        current.map((challenge) =>
          challenge.id === challengeId ? updated : challenge,
        ),
      );
      setEditingChallengeId(null);
      setEditDraftChallenges((current) => {
        const next = { ...current };
        delete next[challengeId];
        return next;
      });
    } catch (error) {
      setChallengesError(getErrorMessage(error, "Unable to update challenge."));
    } finally {
      setSavingEditedChallengeId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadPlansNextSteps() {
      if (!selectedPeriod) {
        setPlansNextSteps([]);
        setPlansError(null);
        setPlansLoading(false);
        return;
      }

      setPlansLoading(true);
      setPlansError(null);

      try {
        const rows = await getSupabaseRows<PlanNextStepRow>(
          "accountabilities_plans_next_steps",
          {
            select:
              "id,sprint_year,sprint_month,comment_text,sort_order,created_at",
            eq: {
              sprint_year: selectedPeriod.year,
              sprint_month: selectedPeriod.month,
            },
            order: { column: "sort_order", ascending: true },
          },
        );

        if (!cancelled) {
          setPlansNextSteps([...rows].sort(compareSortOrder));
        }
      } catch (error) {
        if (!cancelled) {
          setPlansNextSteps([]);
          setPlansError(getPlansNextStepsLoadErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setPlansLoading(false);
        }
      }
    }

    void loadPlansNextSteps();

    return () => {
      cancelled = true;
    };
  }, [selectedPeriod]);

  async function handleAddPlanNextStep() {
    if (!selectedPeriod || !canManagePlans || savingPlan) {
      return;
    }

    const draft = draftPlan.trim();
    if (!draft) {
      return;
    }

    setSavingPlan(true);
    setPlansError(null);

    try {
      const nextSortOrder =
        plansNextSteps.reduce(
          (max, plan) => Math.max(max, plan.sort_order),
          0,
        ) + 1;

      const inserted = await insertSupabaseRows<
        PlanNextStepRow,
        PlanNextStepInsertRow
      >(
        "accountabilities_plans_next_steps",
        {
          sprint_year: selectedPeriod.year,
          sprint_month: selectedPeriod.month,
          comment_text: draft,
          sort_order: nextSortOrder,
        },
        "id,sprint_year,sprint_month,comment_text,sort_order,created_at",
      );

      const created = inserted[0];
      if (!created?.id) {
        throw new Error("Plan item was not saved to Supabase.");
      }

      setPlansNextSteps((current) => [...current, created]);
      setDraftPlan("");
      setIsAddingPlan(false);
    } catch (error) {
      setPlansError(getErrorMessage(error, "Unable to save plan item."));
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleDeletePlanNextStep(planId: string) {
    if (!canManagePlans || deletingPlanId) {
      return;
    }

    setDeletingPlanId(planId);
    setPlansError(null);

    try {
      await deleteSupabaseRows("accountabilities_plans_next_steps", {
        eq: { id: planId },
      });
      setPlansNextSteps((current) =>
        current.filter((plan) => plan.id !== planId),
      );
      if (editingPlanId === planId) {
        setEditingPlanId(null);
        setEditDraftPlans((current) => {
          const next = { ...current };
          delete next[planId];
          return next;
        });
      }
    } catch (error) {
      setPlansError(getErrorMessage(error, "Unable to delete plan item."));
    } finally {
      setDeletingPlanId(null);
    }
  }

  async function handleUpdatePlanNextStep(planId: string) {
    if (!canManagePlans || savingEditedPlanId) {
      return;
    }

    const draft = (editDraftPlans[planId] ?? "").trim();
    if (!draft) {
      return;
    }

    setSavingEditedPlanId(planId);
    setPlansError(null);

    try {
      const updatedRows = await updateSupabaseRows<
        PlanNextStepRow,
        { comment_text: string }
      >(
        "accountabilities_plans_next_steps",
        { comment_text: draft },
        {
          select:
            "id,sprint_year,sprint_month,comment_text,sort_order,created_at",
          eq: { id: planId },
        },
      );

      const updated = updatedRows[0];
      if (!updated?.id) {
        throw new Error("Plan item was not updated in Supabase.");
      }

      setPlansNextSteps((current) =>
        current.map((plan) => (plan.id === planId ? updated : plan)),
      );
      setEditingPlanId(null);
      setEditDraftPlans((current) => {
        const next = { ...current };
        delete next[planId];
        return next;
      });
    } catch (error) {
      setPlansError(getErrorMessage(error, "Unable to update plan item."));
    } finally {
      setSavingEditedPlanId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadTeamGoals() {
      if (!selectedPeriod) {
        setTeamGoals([]);
        setTeamGoalsError(null);
        setTeamGoalsLoading(false);
        return;
      }

      setTeamGoalsLoading(true);
      setTeamGoalsError(null);

      try {
        const rows = await getSupabaseRows<TeamGoalRow>(
          "accountabilities_team_goals",
          {
            select:
              "id,sprint_year,sprint_month,comment_text,sort_order,created_at",
            eq: {
              sprint_year: selectedPeriod.year,
              sprint_month: selectedPeriod.month,
            },
            order: { column: "sort_order", ascending: true },
          },
        );

        if (!cancelled) {
          setTeamGoals([...rows].sort(compareSortOrder));
        }
      } catch (error) {
        if (!cancelled) {
          setTeamGoals([]);
          setTeamGoalsError(getTeamGoalsLoadErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setTeamGoalsLoading(false);
        }
      }
    }

    void loadTeamGoals();

    return () => {
      cancelled = true;
    };
  }, [selectedPeriod]);

  async function handleAddTeamGoal() {
    if (!selectedPeriod || !canManageTeamGoals || savingTeamGoal) {
      return;
    }

    const draft = draftTeamGoal.trim();
    if (!draft) {
      return;
    }

    setSavingTeamGoal(true);
    setTeamGoalsError(null);

    try {
      const nextSortOrder =
        teamGoals.reduce((max, goal) => Math.max(max, goal.sort_order), 0) + 1;

      const inserted = await insertSupabaseRows<TeamGoalRow, TeamGoalInsertRow>(
        "accountabilities_team_goals",
        {
          sprint_year: selectedPeriod.year,
          sprint_month: selectedPeriod.month,
          comment_text: draft,
          sort_order: nextSortOrder,
        },
        "id,sprint_year,sprint_month,comment_text,sort_order,created_at",
      );

      const created = inserted[0];
      if (!created?.id) {
        throw new Error("Team goal was not saved to Supabase.");
      }

      setTeamGoals((current) => [...current, created]);
      setDraftTeamGoal("");
      setIsAddingTeamGoal(false);
    } catch (error) {
      setTeamGoalsError(getErrorMessage(error, "Unable to save team goal."));
    } finally {
      setSavingTeamGoal(false);
    }
  }

  async function handleDeleteTeamGoal(goalId: string) {
    if (!canManageTeamGoals || deletingTeamGoalId) {
      return;
    }

    setDeletingTeamGoalId(goalId);
    setTeamGoalsError(null);

    try {
      await deleteSupabaseRows("accountabilities_team_goals", {
        eq: { id: goalId },
      });
      setTeamGoals((current) => current.filter((goal) => goal.id !== goalId));
      if (editingTeamGoalId === goalId) {
        setEditingTeamGoalId(null);
        setEditDraftTeamGoals((current) => {
          const next = { ...current };
          delete next[goalId];
          return next;
        });
      }
    } catch (error) {
      setTeamGoalsError(getErrorMessage(error, "Unable to delete team goal."));
    } finally {
      setDeletingTeamGoalId(null);
    }
  }

  async function handleUpdateTeamGoal(goalId: string) {
    if (!canManageTeamGoals || savingEditedTeamGoalId) {
      return;
    }

    const draft = (editDraftTeamGoals[goalId] ?? "").trim();
    if (!draft) {
      return;
    }

    setSavingEditedTeamGoalId(goalId);
    setTeamGoalsError(null);

    try {
      const updatedRows = await updateSupabaseRows<
        TeamGoalRow,
        { comment_text: string }
      >(
        "accountabilities_team_goals",
        { comment_text: draft },
        {
          select:
            "id,sprint_year,sprint_month,comment_text,sort_order,created_at",
          eq: { id: goalId },
        },
      );

      const updated = updatedRows[0];
      if (!updated?.id) {
        throw new Error("Team goal was not updated in Supabase.");
      }

      setTeamGoals((current) =>
        current.map((goal) => (goal.id === goalId ? updated : goal)),
      );
      setEditingTeamGoalId(null);
      setEditDraftTeamGoals((current) => {
        const next = { ...current };
        delete next[goalId];
        return next;
      });
    } catch (error) {
      setTeamGoalsError(getErrorMessage(error, "Unable to update team goal."));
    } finally {
      setSavingEditedTeamGoalId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadNotableHighlights() {
      if (!selectedPeriod) {
        setNotableHighlights([]);
        setHighlightsError(null);
        setHighlightsLoading(false);
        return;
      }

      setHighlightsLoading(true);
      setHighlightsError(null);

      try {
        const rows = await getSupabaseRows<NotableHighlightRow>(
          "accountabilities_notable_highlights",
          {
            select:
              "id,sprint_year,sprint_month,comment_text,sort_order,created_at",
            eq: {
              sprint_year: selectedPeriod.year,
              sprint_month: selectedPeriod.month,
            },
            order: { column: "sort_order", ascending: true },
          },
        );

        if (!cancelled) {
          setNotableHighlights([...rows].sort(compareSortOrder));
        }
      } catch (error) {
        if (!cancelled) {
          setNotableHighlights([]);
          setHighlightsError(getNotableHighlightsLoadErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setHighlightsLoading(false);
        }
      }
    }

    void loadNotableHighlights();

    return () => {
      cancelled = true;
    };
  }, [selectedPeriod]);

  async function handleAddNotableHighlight() {
    if (!selectedPeriod || !canManageHighlights || savingHighlight) {
      return;
    }

    const draft = draftHighlight.trim();
    if (!draft) {
      return;
    }

    setSavingHighlight(true);
    setHighlightsError(null);

    try {
      const nextSortOrder =
        notableHighlights.reduce(
          (max, highlight) => Math.max(max, highlight.sort_order),
          0,
        ) + 1;

      const inserted = await insertSupabaseRows<
        NotableHighlightRow,
        NotableHighlightInsertRow
      >(
        "accountabilities_notable_highlights",
        {
          sprint_year: selectedPeriod.year,
          sprint_month: selectedPeriod.month,
          comment_text: draft,
          sort_order: nextSortOrder,
        },
        "id,sprint_year,sprint_month,comment_text,sort_order,created_at",
      );

      const created = inserted[0];
      if (!created?.id) {
        throw new Error("Notable highlight was not saved to Supabase.");
      }

      setNotableHighlights((current) => [...current, created]);
      setDraftHighlight("");
      setIsAddingHighlight(false);
    } catch (error) {
      setHighlightsError(
        getErrorMessage(error, "Unable to save notable highlight."),
      );
    } finally {
      setSavingHighlight(false);
    }
  }

  async function handleDeleteNotableHighlight(highlightId: string) {
    if (!canManageHighlights || deletingHighlightId) {
      return;
    }

    setDeletingHighlightId(highlightId);
    setHighlightsError(null);

    try {
      await deleteSupabaseRows("accountabilities_notable_highlights", {
        eq: { id: highlightId },
      });
      setNotableHighlights((current) =>
        current.filter((highlight) => highlight.id !== highlightId),
      );
      if (editingHighlightId === highlightId) {
        setEditingHighlightId(null);
        setEditDraftHighlights((current) => {
          const next = { ...current };
          delete next[highlightId];
          return next;
        });
      }
    } catch (error) {
      setHighlightsError(
        getErrorMessage(error, "Unable to delete notable highlight."),
      );
    } finally {
      setDeletingHighlightId(null);
    }
  }

  async function handleUpdateNotableHighlight(highlightId: string) {
    if (!canManageHighlights || savingEditedHighlightId) {
      return;
    }

    const draft = (editDraftHighlights[highlightId] ?? "").trim();
    if (!draft) {
      return;
    }

    setSavingEditedHighlightId(highlightId);
    setHighlightsError(null);

    try {
      const updatedRows = await updateSupabaseRows<
        NotableHighlightRow,
        { comment_text: string }
      >(
        "accountabilities_notable_highlights",
        { comment_text: draft },
        {
          select:
            "id,sprint_year,sprint_month,comment_text,sort_order,created_at",
          eq: { id: highlightId },
        },
      );

      const updated = updatedRows[0];
      if (!updated?.id) {
        throw new Error("Notable highlight was not updated in Supabase.");
      }

      setNotableHighlights((current) =>
        current.map((highlight) =>
          highlight.id === highlightId ? updated : highlight,
        ),
      );
      setEditingHighlightId(null);
      setEditDraftHighlights((current) => {
        const next = { ...current };
        delete next[highlightId];
        return next;
      });
    } catch (error) {
      setHighlightsError(
        getErrorMessage(error, "Unable to update notable highlight."),
      );
    } finally {
      setSavingEditedHighlightId(null);
    }
  }

  async function handleReorderMetricComments(
    metricKey: SkillRadarKey,
    nextItems: MetricCommentRow[],
  ) {
    if (!showCommentActions) {
      return;
    }

    const ordered = withUpdatedSortOrder(nextItems);
    const previous = metricComments;

    setMetricComments((current) => [
      ...current.filter((comment) => comment.metric_key !== metricKey),
      ...ordered,
    ]);
    setCommentsError(null);

    try {
      await persistAccountabilitiesSortOrder(
        "accountabilities_metric_comments",
        ordered,
      );
    } catch (error) {
      setMetricComments(previous);
      setCommentsError(
        getErrorMessage(error, "Unable to reorder metric comments."),
      );
    }
  }

  async function handleReorderOngoingProjects(nextItems: OngoingProjectRow[]) {
    if (!canManageProjects) {
      return;
    }

    const ordered = withUpdatedSortOrder(nextItems);
    const previous = ongoingProjects;

    setOngoingProjects(ordered);
    setProjectsError(null);

    try {
      await persistAccountabilitiesSortOrder(
        "accountabilities_ongoing_projects",
        ordered,
      );
    } catch (error) {
      setOngoingProjects(previous);
      setProjectsError(
        getErrorMessage(error, "Unable to reorder ongoing projects."),
      );
    }
  }

  async function handleReorderOngoingProjectComments(
    projectId: string,
    nextItems: OngoingProjectCommentRow[],
  ) {
    if (!canManageProjects) {
      return;
    }

    const ordered = withUpdatedSortOrder(nextItems);
    const previous = ongoingProjectComments;

    setOngoingProjectComments((current) => [
      ...current.filter((comment) => comment.project_id !== projectId),
      ...ordered,
    ]);
    setProjectsError(null);

    try {
      await persistAccountabilitiesSortOrder(
        "accountabilities_ongoing_project_comments",
        ordered,
      );
    } catch (error) {
      setOngoingProjectComments(previous);
      setProjectsError(
        getErrorMessage(error, "Unable to reorder project comments."),
      );
    }
  }

  async function handleReorderChallenges(nextItems: ChallengeRow[]) {
    if (!canManageChallenges) {
      return;
    }

    const ordered = withUpdatedSortOrder(nextItems);
    const previous = challenges;

    setChallenges(ordered);
    setChallengesError(null);

    try {
      await persistAccountabilitiesSortOrder(
        "accountabilities_challenges",
        ordered,
      );
    } catch (error) {
      setChallenges(previous);
      setChallengesError(
        getErrorMessage(error, "Unable to reorder challenges."),
      );
    }
  }

  async function handleReorderPlansNextSteps(nextItems: PlanNextStepRow[]) {
    if (!canManagePlans) {
      return;
    }

    const ordered = withUpdatedSortOrder(nextItems);
    const previous = plansNextSteps;

    setPlansNextSteps(ordered);
    setPlansError(null);

    try {
      await persistAccountabilitiesSortOrder(
        "accountabilities_plans_next_steps",
        ordered,
      );
    } catch (error) {
      setPlansNextSteps(previous);
      setPlansError(
        getErrorMessage(error, "Unable to reorder plans and next steps."),
      );
    }
  }

  async function handleReorderTeamGoals(nextItems: TeamGoalRow[]) {
    if (!canManageTeamGoals) {
      return;
    }

    const ordered = withUpdatedSortOrder(nextItems);
    const previous = teamGoals;

    setTeamGoals(ordered);
    setTeamGoalsError(null);

    try {
      await persistAccountabilitiesSortOrder(
        "accountabilities_team_goals",
        ordered,
      );
    } catch (error) {
      setTeamGoals(previous);
      setTeamGoalsError(
        getErrorMessage(error, "Unable to reorder team goals."),
      );
    }
  }

  async function handleReorderNotableHighlights(
    nextItems: NotableHighlightRow[],
  ) {
    if (!canManageHighlights) {
      return;
    }

    const ordered = withUpdatedSortOrder(nextItems);
    const previous = notableHighlights;

    setNotableHighlights(ordered);
    setHighlightsError(null);

    try {
      await persistAccountabilitiesSortOrder(
        "accountabilities_notable_highlights",
        ordered,
      );
    } catch (error) {
      setNotableHighlights(previous);
      setHighlightsError(
        getErrorMessage(error, "Unable to reorder notable highlights."),
      );
    }
  }

  const selectedPeriodLabel = useMemo(() => {
    const monthNumber = Number(selectedMonth);
    const yearNumber = Number(selectedYear);

    if (!selectedYear || !selectedMonth || !Number.isFinite(yearNumber)) {
      return null;
    }

    const monthLabel =
      monthOptions.find((option) => option.value === selectedMonth)?.label ??
      (Number.isFinite(monthNumber)
        ? getSprintMonthShortLabel(monthNumber)
        : null);

    if (!monthLabel) {
      return null;
    }

    return `${monthLabel} ${yearNumber}`;
  }, [monthOptions, selectedMonth, selectedYear]);

  async function downloadAccountabilitiesPdf() {
    const target = pageRef.current;
    if (!target || isDownloadingPdf) {
      return;
    }

    setIsDownloadingPdf(true);
    setDownloadError(null);

    try {
      const sourceWidth = Math.max(target.scrollWidth, target.clientWidth, 1);
      const sourceHeight = Math.max(target.scrollHeight, target.clientHeight, 1);
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
          element.classList.contains("accountabilities-header-action") ||
          element.classList.contains("accountabilities-page-toolbar") ||
          element.classList.contains("accountabilities-download-error"),
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
              ".statistics-member-ranking__header",
            )
            .forEach((element) => {
              element.style.position = "static";
              element.style.top = "auto";
              element.style.zIndex = "auto";
            });
        },
      });

      if (canvas.width < 2 || canvas.height < 2) {
        throw new Error(
          "Unable to capture the accountabilities page for download.",
        );
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

      const periodStamp = selectedPeriodLabel
        ? selectedPeriodLabel.replace(/\s+/g, "-").toLowerCase()
        : "period";
      const dateStamp = new Date().toISOString().slice(0, 10);
      pdf.save(`accountabilities-${periodStamp}-${dateStamp}.pdf`);
    } catch (error) {
      setDownloadError(
        error instanceof Error
          ? error.message
          : "Unable to download accountabilities PDF.",
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  useEffect(() => {
    if (!downloadError) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDownloadError(null);
    }, 4000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [downloadError]);

  const teamStackRankingEntries = useMemo((): TeamStackRankingEntry[] => {
    if (activeSprintIds.length === 0 || memberOptions.length === 0) {
      return [];
    }

    const performanceRows = performanceScores.filter(
      (row) =>
        activeSprintIds.includes(row.sprint_id) &&
        scoreboardMemberIds.has(row.member_id),
    );
    const criteriaRows = criteriaScores.filter(
      (row) =>
        activeSprintIds.includes(row.sprint_id) &&
        scoreboardMemberIds.has(row.member_id),
    );
    const professionalismRows = professionalismScores.filter(
      (row) =>
        activeSprintIds.includes(row.sprint_id) &&
        scoreboardMemberIds.has(row.member_id),
    );

    const ranked = memberOptions
      .map((member) => {
        const scorePoints = getMemberPerformanceFieldAverage(
          performanceRows,
          member.id,
          "average_score",
        );

        const grade =
          scorePoints === null
            ? null
            : resolvePerformanceScoreGrade(
                scorePoints,
                DEFAULT_PASSING_THRESHOLD,
              );

        const rates = buildSkillRadarValues({
          criteriaScoreRows: criteriaRows,
          performanceRows,
          memberIds: scoreboardMemberIdList,
          selectedMemberId: member.id,
          professionalismScoreRows: professionalismRows,
          professionalismItems: sortedProfessionalismItems,
        });

        const professionalismItemScores = sortedProfessionalismItems.map(
          (item) => {
            const averageValue = getMemberProfessionalismItemAverage(
              professionalismRows,
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
              max: Math.max(Number(item.value) || PROFESSIONALISM_PIP_COUNT, 1),
            };
          },
        );

        return {
          memberId: member.id,
          name: getAccountabilitiesMemberName(member),
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
  }, [
    activeSprintIds,
    criteriaScores,
    memberOptions,
    performanceScores,
    professionalismScores,
    scoreboardMemberIdList,
    scoreboardMemberIds,
    sortedProfessionalismItems,
  ]);

  const aiSummarySnapshot = useMemo((): AccountabilitiesSummarySnapshot | null => {
    if (!selectedPeriod) {
      return null;
    }

    return {
      periodLabel: selectedPeriodLabel,
      overallScore: {
        current: radarLoading ? null : currentOverallScore,
        previous:
          radarLoading || previousSprintIds.length === 0
            ? null
            : previousOverallScore,
        changeDirection: overallScoreChange.direction,
        changeDelta: overallScoreChange.delta,
      },
      teamGrade: String(displayedTeamGrade),
      outputTotals: {
        storyPoints: String(displayedTotalStoryPoints),
        tasks: String(displayedTotalTasks),
        hours: String(displayedTotalHours),
      },
      skillRadar: displayedSkillRadarValues,
      metrics: SKILL_METRIC_ROWS.map((metric) => {
        const previousValue =
          !radarLoading && previousSprintIds.length > 0
            ? previousTeamSkillRadarValues[metric.key]
            : null;
        const currentValue =
          !radarLoading && activeSprintIds.length > 0
            ? teamSkillRadarValues[metric.key]
            : null;
        const change = getMetricChange(previousValue, currentValue);

        return {
          key: metric.key,
          label: metric.label,
          current: currentValue,
          previous: previousValue,
          changeDirection: change.direction,
          changeDelta: change.delta,
          comments: (commentsByMetric[metric.key] ?? []).map(
            (comment) => comment.comment_text,
          ),
        };
      }),
      projects: ongoingProjects.map((project) => ({
        name: project.name,
        comments: (commentsByProjectId[project.id] ?? []).map(
          (comment) => comment.comment_text,
        ),
      })),
      challenges: challenges.map((item) => item.comment_text),
      plans: plansNextSteps.map((item) => item.comment_text),
      teamGoals: teamGoals.map((item) => item.comment_text),
      notableHighlights: notableHighlights.map((item) => item.comment_text),
      ranking: teamStackRankingEntries.map((entry) => ({
        rank: entry.rank,
        name: entry.name,
        grade: entry.grade,
        scorePoints: entry.scorePoints,
      })),
    };
  }, [
    activeSprintIds.length,
    challenges,
    commentsByMetric,
    commentsByProjectId,
    currentOverallScore,
    displayedSkillRadarValues,
    displayedTeamGrade,
    displayedTotalHours,
    displayedTotalStoryPoints,
    displayedTotalTasks,
    notableHighlights,
    ongoingProjects,
    overallScoreChange.delta,
    overallScoreChange.direction,
    plansNextSteps,
    previousOverallScore,
    previousSprintIds.length,
    previousTeamSkillRadarValues,
    radarLoading,
    selectedPeriod,
    selectedPeriodLabel,
    teamGoals,
    teamSkillRadarValues,
    teamStackRankingEntries,
  ]);

  return (
    <div className="accountabilities-page" ref={pageRef}>
      {showPublicViewButton || showDownloadButton ? (
        <div className="accountabilities-page-toolbar">
          {showPublicViewButton ? (
            <button
              aria-label="Open public accountabilities page"
              className="accountabilities-header-action accountabilities-open-public"
              onClick={openPublicAccountabilitiesPage}
              title="Open public accountabilities page"
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
          {showDownloadButton ? (
            <button
              aria-label="Download accountabilities as PDF"
              className="accountabilities-header-action accountabilities-download"
              disabled={isDownloadingPdf || radarLoading}
              onClick={() => {
                void downloadAccountabilitiesPdf();
              }}
              title="Download accountabilities as PDF"
              type="button"
            >
              {isDownloadingPdf ? (
                <span
                  className="accountabilities-action-loader"
                  aria-hidden="true"
                />
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
          ) : null}
        </div>
      ) : null}

      {downloadError ? (
        <div
          className="accountabilities-section__status accountabilities-section__status--error accountabilities-download-error"
          role="alert"
        >
          {downloadError}
        </div>
      ) : null}

      {showFilters ? (
      <div className="accountabilities-filters" role="region" aria-label="Period filters">
        {filtersLoading ? (
          <span className="accountabilities-filters__status">Loading filters…</span>
        ) : filtersError ? (
          <span className="accountabilities-filters__status accountabilities-filters__status--error">
            {filtersError}
          </span>
        ) : (
          <>
            <label className="accountabilities-filters__field">
              <span className="accountabilities-filters__label">Year</span>
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
            </label>

            <label className="accountabilities-filters__field">
              <span className="accountabilities-filters__label">Month</span>
              <StyledSelect
                value={selectedMonth}
                onChange={setSelectedMonth}
                placeholder="Select month…"
                accent={Palette.cyan}
                disabled={!selectedYear || monthOptions.length === 0}
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
            </label>
          </>
        )}
      </div>
      ) : null}

      <Title
        title={
          <>
            Team Accountabilities
            {selectedPeriodLabel ? (
              <>
                {" "}
                <span className="accountabilities-title__of">of</span>{" "}
                <span className="accountabilities-title__period">
                  {selectedPeriodLabel}
                </span>
              </>
            ) : null}
          </>
        }
        size="large"
      />

      <section
        className="accountabilities-section"
        aria-labelledby="accountabilities-key-accomplishments-title"
      >
        <h3
          id="accountabilities-key-accomplishments-title"
          className="accountabilities-section__title"
        >
          Key Accomplishments
        </h3>

        <div className="scard accountabilities-radar-card">
          {radarLoading ? (
            <div className="accountabilities-section__status">
              Loading team performance…
            </div>
          ) : activeSprintIds.length === 0 ? (
            <div className="accountabilities-section__status">
              No sprint data for the selected period.
            </div>
          ) : (
            <SkillRadarPanel
              values={displayedSkillRadarValues}
              scale={skillChartScale}
            />
          )}
        </div>

        <h4
          id="accountabilities-output-title"
          className="accountabilities-subsection__title"
        >
          Output
        </h4>
        <div
          className="scard accountabilities-output-card"
          aria-labelledby="accountabilities-output-title"
        >
          <div className="accountabilities-output-layout">
            <div className="accountabilities-output-layout__chart">
              <TeamContributionDoughnut
                segments={teamContributionSegments}
                loading={radarLoading}
              />
            </div>
            <div className="accountabilities-output-layout__totals">
              <div className="accountabilities-output-total">
                <span
                  className="accountabilities-output-total__value"
                  style={{ color: "#f5c842" }}
                >
                  {displayedTotalStoryPoints}
                </span>
                <span className="accountabilities-output-total__label">
                  Total Story Points
                </span>
              </div>
              <div className="accountabilities-output-total">
                <span
                  className="accountabilities-output-total__value"
                  style={{ color: "#00c8ff" }}
                >
                  {displayedTotalTasks}
                </span>
                <span className="accountabilities-output-total__label">
                  Total Tasks
                </span>
              </div>
            </div>
          </div>
        </div>

        {commentsError ? (
          <div className="accountabilities-section__status accountabilities-section__status--error">
            {commentsError}
          </div>
        ) : null}

        <div className="accountabilities-metric-rows">
          {SKILL_METRIC_ROWS.map((metric) => {
            const previousValue =
              !radarLoading && previousSprintIds.length > 0
                ? previousTeamSkillRadarValues[metric.key]
                : null;
            const currentValue =
              !radarLoading && activeSprintIds.length > 0
                ? teamSkillRadarValues[metric.key]
                : null;
            const change = getMetricChange(previousValue, currentValue);
            const changeDirectionLabel =
              change.direction === "up"
                ? "up"
                : change.direction === "down"
                  ? "down"
                  : change.direction === "flat"
                    ? "unchanged"
                    : "unavailable";
            const changeDeltaLabel = formatChangeDelta(change.delta);
            const metricDetailComments = commentsByMetric[metric.key];
            const isAdding = addingMetricKey === metric.key;
            const isSaving = savingMetricKey === metric.key;
            const draftValue = draftComments[metric.key] ?? "";

            return (
              <div
                key={metric.key}
                className="scard accountabilities-metric-row"
                aria-labelledby={`accountabilities-metric-${metric.key}-title`}
              >
                <div className="accountabilities-metric-row__header">
                  <h4
                    id={`accountabilities-metric-${metric.key}-title`}
                    className="accountabilities-metric-row__title"
                  >
                    {metric.label}
                  </h4>
                  {showCommentActions && !isAdding ? (
                    <button
                      type="button"
                      className="accountabilities-metric-details__button accountabilities-metric-details__button--primary"
                      disabled={
                        !selectedPeriod ||
                        commentsLoading ||
                        editingMetricCommentId !== null
                      }
                      onClick={() => {
                        setEditingMetricCommentId(null);
                        setAddingMetricKey(metric.key);
                      }}
                    >
                      Add comment
                    </button>
                  ) : null}
                </div>
                <div className="accountabilities-metric-row__body">
                  <div className="accountabilities-metric-row__scores">
                    <div className="accountabilities-metric-row__dials">
                      <PercentDial
                        value={previousValue}
                        label={previousPeriodLabel}
                        glowFilterId={`accountabilities-${metric.key}-previous-glow`}
                        dimmed
                      />
                      <div
                        className={`accountabilities-metric-change accountabilities-metric-change--${change.direction}`}
                        aria-label={`${metric.label} ${changeDirectionLabel}${
                          change.delta === null ? "" : ` ${changeDeltaLabel}`
                        }`}
                      >
                        <span
                          className="accountabilities-metric-change__arrow"
                          aria-hidden="true"
                        >
                          {change.direction === "up"
                            ? "▲"
                            : change.direction === "down"
                              ? "▼"
                              : change.direction === "flat"
                                ? "●"
                                : "—"}
                        </span>
                        <span className="accountabilities-metric-change__delta">
                          {changeDeltaLabel}
                        </span>
                      </div>
                      <PercentDial
                        value={currentValue}
                        label={currentPeriodLabel}
                        glowFilterId={`accountabilities-${metric.key}-current-glow`}
                      />
                    </div>
                  </div>

                  <div className="accountabilities-metric-row__details">
                    {commentsLoading ? (
                      <div className="accountabilities-metric-details__status">
                        Loading details…
                      </div>
                    ) : metricDetailComments.length === 0 && !isAdding ? (
                      <div className="accountabilities-metric-details__status">
                        No details yet.
                      </div>
                    ) : (
                      <AccountabilitiesSortableList
                        as="ul"
                        className="accountabilities-metric-details__list"
                        itemClassName="accountabilities-metric-details__item"
                        items={metricDetailComments}
                        disabled={!showCommentActions}
                        onReorder={(nextItems) => {
                          void handleReorderMetricComments(
                            metric.key,
                            nextItems,
                          );
                        }}
                        renderItem={(comment) => {
                          const isEditingComment =
                            editingMetricCommentId === comment.id;
                          const isSavingEditedComment =
                            savingEditedMetricCommentId === comment.id;
                          const editDraftValue =
                            editDraftMetricComments[comment.id] ??
                            comment.comment_text;

                          return isEditingComment ? (
                            <div className="accountabilities-metric-details__composer accountabilities-metric-details__composer--inline">
                              <textarea
                                className="accountabilities-metric-details__input"
                                value={editDraftValue}
                                rows={3}
                                disabled={isSavingEditedComment}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  setEditDraftMetricComments((current) => ({
                                    ...current,
                                    [comment.id]: nextValue,
                                  }));
                                }}
                              />
                              <div className="accountabilities-metric-details__composer-actions">
                                <button
                                  type="button"
                                  className="accountabilities-metric-details__button accountabilities-metric-details__button--secondary"
                                  disabled={isSavingEditedComment}
                                  onClick={() => {
                                    setEditingMetricCommentId(null);
                                    setEditDraftMetricComments((current) => {
                                      const next = { ...current };
                                      delete next[comment.id];
                                      return next;
                                    });
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="accountabilities-metric-details__button accountabilities-metric-details__button--primary"
                                  disabled={
                                    isSavingEditedComment ||
                                    !editDraftValue.trim()
                                  }
                                  onClick={() => {
                                    void handleUpdateMetricComment(comment.id);
                                  }}
                                >
                                  {isSavingEditedComment ? "Saving…" : "Save"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <span className="accountabilities-metric-details__text">
                                {comment.comment_text}
                              </span>
                              {showCommentActions ? (
                                <div className="accountabilities-metric-details__item-actions">
                                  <button
                                    type="button"
                                    className="accountabilities-metric-details__icon-button"
                                    disabled={
                                      deletingCommentId === comment.id ||
                                      editingMetricCommentId !== null ||
                                      addingMetricKey !== null
                                    }
                                    onClick={() => {
                                      setAddingMetricKey(null);
                                      setEditingMetricCommentId(comment.id);
                                      setEditDraftMetricComments((current) => ({
                                        ...current,
                                        [comment.id]: comment.comment_text,
                                      }));
                                    }}
                                    aria-label="Edit comment"
                                    title="Edit comment"
                                  >
                                    <CommentEditIcon />
                                  </button>
                                  <button
                                    type="button"
                                    className="accountabilities-metric-details__remove"
                                    disabled={
                                      deletingCommentId === comment.id ||
                                      editingMetricCommentId !== null
                                    }
                                    onClick={() => {
                                      void handleDeleteMetricComment(
                                        comment.id,
                                      );
                                    }}
                                    aria-label="Remove comment"
                                  >
                                    ×
                                  </button>
                                </div>
                              ) : null}
                            </>
                          );
                        }}
                      />
                    )}

                    {showCommentActions && isAdding ? (
                      <div className="accountabilities-metric-details__composer">
                        <textarea
                          className="accountabilities-metric-details__input"
                          value={draftValue}
                          rows={3}
                          placeholder={`Add a ${metric.label.toLowerCase()} detail…`}
                          disabled={isSaving || !selectedPeriod}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setDraftComments((current) => ({
                              ...current,
                              [metric.key]: nextValue,
                            }));
                          }}
                        />
                        <div className="accountabilities-metric-details__composer-actions">
                          <button
                            type="button"
                            className="accountabilities-metric-details__button accountabilities-metric-details__button--secondary"
                            disabled={isSaving}
                            onClick={() => {
                              setAddingMetricKey(null);
                              setDraftComments((current) => ({
                                ...current,
                                [metric.key]: "",
                              }));
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="accountabilities-metric-details__button accountabilities-metric-details__button--primary"
                            disabled={
                              isSaving || !draftValue.trim() || !selectedPeriod
                            }
                            onClick={() => {
                              void handleAddMetricComment(metric.key);
                            }}
                          >
                            {isSaving ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="scard accountabilities-summary-card"
          aria-label="Team overall summary"
        >
          <div className="accountabilities-summary-layout">
            <div className="accountabilities-summary-layout__part">
              <h4 className="accountabilities-summary-layout__title">
                Overall Score
              </h4>
              <div className="accountabilities-summary-layout__dials">
                <PercentDial
                  value={
                    !radarLoading && previousSprintIds.length > 0
                      ? previousOverallScore
                      : null
                  }
                  label={previousPeriodLabel}
                  glowFilterId="accountabilities-overall-previous-glow"
                  dimmed
                />
                <div
                  className={`accountabilities-metric-change accountabilities-metric-change--${overallScoreChange.direction}`}
                  aria-label={`Overall score ${
                    overallScoreChange.direction === "up"
                      ? "up"
                      : overallScoreChange.direction === "down"
                        ? "down"
                        : overallScoreChange.direction === "flat"
                          ? "unchanged"
                          : "unavailable"
                  }${
                    overallScoreChange.delta === null
                      ? ""
                      : ` ${formatChangeDelta(overallScoreChange.delta)}`
                  }`}
                >
                  <span
                    className="accountabilities-metric-change__arrow"
                    aria-hidden="true"
                  >
                    {overallScoreChange.direction === "up"
                      ? "▲"
                      : overallScoreChange.direction === "down"
                        ? "▼"
                        : overallScoreChange.direction === "flat"
                          ? "●"
                          : "—"}
                  </span>
                  <span className="accountabilities-metric-change__delta">
                    {formatChangeDelta(overallScoreChange.delta)}
                  </span>
                </div>
                <PercentDial
                  value={
                    !radarLoading && activeSprintIds.length > 0
                      ? currentOverallScore
                      : null
                  }
                  label={currentPeriodLabel}
                  glowFilterId="accountabilities-overall-current-glow"
                />
              </div>
            </div>

            <div className="accountabilities-summary-layout__part">
              <h4 className="accountabilities-summary-layout__title">
                Output Totals
              </h4>
              <div className="accountabilities-summary-layout__totals">
                <div className="accountabilities-output-total">
                  <span
                    className="accountabilities-output-total__value"
                    style={{ color: "#f5c842" }}
                  >
                    {displayedTotalStoryPoints}
                  </span>
                  <span className="accountabilities-output-total__label">
                    Story Points
                  </span>
                </div>
                <div className="accountabilities-output-total">
                  <span
                    className="accountabilities-output-total__value"
                    style={{ color: "#00e5a0" }}
                  >
                    {displayedTotalHours}
                  </span>
                  <span className="accountabilities-output-total__label">
                    Hours Accumulated
                  </span>
                </div>
              </div>
            </div>

            <div className="accountabilities-summary-layout__part accountabilities-summary-layout__part--grade">
              {radarLoading ? (
                <div className="accountabilities-section__status">Loading…</div>
              ) : (
                <GradeDial
                  grade={displayedTeamGrade}
                  color={teamGradeColor}
                  delay={200}
                  size="large"
                  glowFilterId="accountabilities-team-grade-dial-glow"
                />
              )}
            </div>
          </div>
        </div>
      </section>

      <section
        className="accountabilities-section"
        aria-labelledby="accountabilities-ongoing-projects-title"
      >
        <div className="accountabilities-section__header">
          <h3
            id="accountabilities-ongoing-projects-title"
            className="accountabilities-section__title"
          >
            Ongoing Projects:
          </h3>
          {canManageProjects && !isAddingProject ? (
            <button
              type="button"
              className="accountabilities-metric-details__button accountabilities-metric-details__button--primary"
              disabled={!selectedPeriod || projectsLoading}
              onClick={() => setIsAddingProject(true)}
            >
              Add project
            </button>
          ) : null}
        </div>

        <div className="accountabilities-ongoing-projects">
          <h4 className="accountabilities-ongoing-projects__subtitle">
            Project Updates
          </h4>

          {projectsError ? (
            <div className="accountabilities-section__status accountabilities-section__status--error">
              {projectsError}
            </div>
          ) : null}

          {canManageProjects && isAddingProject ? (
            <div className="scard accountabilities-ongoing-project-card accountabilities-ongoing-project-card--composer">
              <div className="accountabilities-metric-details__composer">
                <input
                  className="accountabilities-ongoing-project__name-input"
                  type="text"
                  value={draftProjectName}
                  placeholder="New project name…"
                  disabled={savingProject || !selectedPeriod}
                  onChange={(event) => setDraftProjectName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleAddOngoingProject();
                    }
                  }}
                />
                <div className="accountabilities-metric-details__composer-actions">
                  <button
                    type="button"
                    className="accountabilities-metric-details__button accountabilities-metric-details__button--secondary"
                    disabled={savingProject}
                    onClick={() => {
                      setIsAddingProject(false);
                      setDraftProjectName("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="accountabilities-metric-details__button accountabilities-metric-details__button--primary"
                    disabled={
                      savingProject ||
                      !draftProjectName.trim() ||
                      !selectedPeriod
                    }
                    onClick={() => {
                      void handleAddOngoingProject();
                    }}
                  >
                    {savingProject ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {projectsLoading ? (
            <div className="accountabilities-section__status">
              Loading project updates…
            </div>
          ) : !selectedPeriod ? (
            <div className="accountabilities-section__status">
              Select a year and month to view project updates.
            </div>
          ) : ongoingProjects.length === 0 && !isAddingProject ? (
            <div className="accountabilities-section__status">
              No project updates yet.
            </div>
          ) : (
            <AccountabilitiesSortableList
              className="accountabilities-ongoing-project-rows"
              itemClassName="scard accountabilities-ongoing-project-card"
              items={ongoingProjects}
              disabled={!canManageProjects}
              onReorder={(nextItems) => {
                void handleReorderOngoingProjects(nextItems);
              }}
              renderItem={(project) => {
                const projectComments = commentsByProjectId[project.id] ?? [];
                const isAddingComment = addingProjectCommentId === project.id;
                const isSavingComment = savingProjectCommentId === project.id;
                const draftValue = draftProjectComments[project.id] ?? "";

                return (
                  <>
                    <div className="accountabilities-ongoing-project-card__header">
                      <h5
                        id={`accountabilities-ongoing-project-${project.id}-title`}
                        className="accountabilities-ongoing-project-card__title"
                      >
                        {project.name}
                      </h5>
                      <div className="accountabilities-ongoing-project-card__actions">
                        {canManageProjects && !isAddingComment ? (
                          <button
                            type="button"
                            className="accountabilities-metric-details__button accountabilities-metric-details__button--primary"
                            disabled={
                              !selectedPeriod ||
                              editingProjectCommentId !== null
                            }
                            onClick={() => {
                              setEditingProjectCommentId(null);
                              setAddingProjectCommentId(project.id);
                            }}
                          >
                            Add comment
                          </button>
                        ) : null}
                        {canManageProjects ? (
                          <button
                            type="button"
                            className="accountabilities-metric-details__remove accountabilities-ongoing-project-card__remove"
                            disabled={deletingProjectId === project.id}
                            onClick={() => {
                              void handleDeleteOngoingProject(project.id);
                            }}
                            aria-label={`Remove ${project.name}`}
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="accountabilities-metric-row__details">
                      {projectComments.length === 0 && !isAddingComment ? (
                        <div className="accountabilities-metric-details__status">
                          No details yet.
                        </div>
                      ) : (
                        <AccountabilitiesSortableList
                          as="ul"
                          className="accountabilities-metric-details__list"
                          itemClassName="accountabilities-metric-details__item"
                          items={projectComments}
                          disabled={!canManageProjects}
                          onReorder={(nextItems) => {
                            void handleReorderOngoingProjectComments(
                              project.id,
                              nextItems,
                            );
                          }}
                          renderItem={(comment) => {
                            const isEditingComment =
                              editingProjectCommentId === comment.id;
                            const isSavingEditedComment =
                              savingEditedProjectCommentId === comment.id;
                            const editDraftValue =
                              editDraftProjectComments[comment.id] ??
                              comment.comment_text;

                            return isEditingComment ? (
                              <div className="accountabilities-metric-details__composer accountabilities-metric-details__composer--inline">
                                <textarea
                                  className="accountabilities-metric-details__input"
                                  value={editDraftValue}
                                  rows={3}
                                  disabled={isSavingEditedComment}
                                  onChange={(event) => {
                                    const nextValue = event.target.value;
                                    setEditDraftProjectComments((current) => ({
                                      ...current,
                                      [comment.id]: nextValue,
                                    }));
                                  }}
                                />
                                <div className="accountabilities-metric-details__composer-actions">
                                  <button
                                    type="button"
                                    className="accountabilities-metric-details__button accountabilities-metric-details__button--secondary"
                                    disabled={isSavingEditedComment}
                                    onClick={() => {
                                      setEditingProjectCommentId(null);
                                      setEditDraftProjectComments((current) => {
                                        const next = { ...current };
                                        delete next[comment.id];
                                        return next;
                                      });
                                    }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    className="accountabilities-metric-details__button accountabilities-metric-details__button--primary"
                                    disabled={
                                      isSavingEditedComment ||
                                      !editDraftValue.trim()
                                    }
                                    onClick={() => {
                                      void handleUpdateOngoingProjectComment(
                                        comment.id,
                                      );
                                    }}
                                  >
                                    {isSavingEditedComment
                                      ? "Saving…"
                                      : "Save"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <span className="accountabilities-metric-details__text">
                                  {comment.comment_text}
                                </span>
                                {canManageProjects ? (
                                  <div className="accountabilities-metric-details__item-actions">
                                    <button
                                      type="button"
                                      className="accountabilities-metric-details__icon-button"
                                      disabled={
                                        deletingProjectCommentId ===
                                          comment.id ||
                                        editingProjectCommentId !== null ||
                                        addingProjectCommentId !== null
                                      }
                                      onClick={() => {
                                        setAddingProjectCommentId(null);
                                        setEditingProjectCommentId(comment.id);
                                        setEditDraftProjectComments(
                                          (current) => ({
                                            ...current,
                                            [comment.id]: comment.comment_text,
                                          }),
                                        );
                                      }}
                                      aria-label="Edit comment"
                                      title="Edit comment"
                                    >
                                      <CommentEditIcon />
                                    </button>
                                    <button
                                      type="button"
                                      className="accountabilities-metric-details__remove"
                                      disabled={
                                        deletingProjectCommentId ===
                                          comment.id ||
                                        editingProjectCommentId !== null
                                      }
                                      onClick={() => {
                                        void handleDeleteOngoingProjectComment(
                                          comment.id,
                                        );
                                      }}
                                      aria-label="Remove comment"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ) : null}
                              </>
                            );
                          }}
                        />
                      )}

                      {canManageProjects && isAddingComment ? (
                        <div className="accountabilities-metric-details__composer">
                          <textarea
                            className="accountabilities-metric-details__input"
                            value={draftValue}
                            rows={3}
                            placeholder={`Add a ${project.name} update…`}
                            disabled={isSavingComment}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setDraftProjectComments((current) => ({
                                ...current,
                                [project.id]: nextValue,
                              }));
                            }}
                          />
                          <div className="accountabilities-metric-details__composer-actions">
                            <button
                              type="button"
                              className="accountabilities-metric-details__button accountabilities-metric-details__button--secondary"
                              disabled={isSavingComment}
                              onClick={() => {
                                setAddingProjectCommentId(null);
                                setDraftProjectComments((current) => ({
                                  ...current,
                                  [project.id]: "",
                                }));
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="accountabilities-metric-details__button accountabilities-metric-details__button--primary"
                              disabled={
                                isSavingComment || !draftValue.trim()
                              }
                              onClick={() => {
                                void handleAddOngoingProjectComment(project.id);
                              }}
                            >
                              {isSavingComment ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </>
                );
              }}
            />
          )}
        </div>
      </section>

      <section
        className="accountabilities-section"
        aria-labelledby="accountabilities-challenges-title"
      >
        <div className="accountabilities-section__header">
          <h3
            id="accountabilities-challenges-title"
            className="accountabilities-section__title"
          >
            Challenges:
          </h3>
          {canManageChallenges && !isAddingChallenge ? (
            <button
              type="button"
              className="accountabilities-metric-details__button accountabilities-metric-details__button--primary"
              disabled={!selectedPeriod || challengesLoading}
              onClick={() => {
                setEditingChallengeId(null);
                setIsAddingChallenge(true);
              }}
            >
              Add item
            </button>
          ) : null}
        </div>

        <div className="accountabilities-challenges">
          {challengesError ? (
            <div className="accountabilities-section__status accountabilities-section__status--error">
              {challengesError}
            </div>
          ) : null}

          {canManageChallenges && isAddingChallenge ? (
            <div className="scard accountabilities-challenge-card accountabilities-challenge-card--composer">
              <div className="accountabilities-metric-details__composer">
                <input
                  className="accountabilities-ongoing-project__name-input"
                  type="text"
                  value={draftChallenge}
                  placeholder="New challenge phrase…"
                  disabled={savingChallenge || !selectedPeriod}
                  onChange={(event) => setDraftChallenge(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleAddChallenge();
                    }
                  }}
                />
                <div className="accountabilities-metric-details__composer-actions">
                  <button
                    type="button"
                    className="accountabilities-metric-details__button accountabilities-metric-details__button--secondary"
                    disabled={savingChallenge}
                    onClick={() => {
                      setIsAddingChallenge(false);
                      setDraftChallenge("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="accountabilities-metric-details__button accountabilities-metric-details__button--primary"
                    disabled={
                      savingChallenge ||
                      !draftChallenge.trim() ||
                      !selectedPeriod
                    }
                    onClick={() => {
                      void handleAddChallenge();
                    }}
                  >
                    {savingChallenge ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {challengesLoading ? (
            <div className="accountabilities-section__status">
              Loading challenges…
            </div>
          ) : !selectedPeriod ? (
            <div className="accountabilities-section__status">
              Select a year and month to view challenges.
            </div>
          ) : challenges.length === 0 && !isAddingChallenge ? (
            <div className="accountabilities-section__status">
              No challenges yet.
            </div>
          ) : (
            <AccountabilitiesSortableList
              className="accountabilities-challenge-rows"
              itemClassName="scard accountabilities-challenge-card"
              items={challenges}
              disabled={!canManageChallenges}
              onReorder={(nextItems) => {
                void handleReorderChallenges(nextItems);
              }}
              renderItem={(challenge) => {
                const isEditingChallenge = editingChallengeId === challenge.id;
                const isSavingEditedChallenge =
                  savingEditedChallengeId === challenge.id;
                const editDraftValue =
                  editDraftChallenges[challenge.id] ?? challenge.comment_text;

                return (
                  <div className="accountabilities-challenge-card__header">
                    {isEditingChallenge ? (
                      <div className="accountabilities-metric-details__composer accountabilities-metric-details__composer--inline">
                        <input
                          className="accountabilities-ongoing-project__name-input"
                          type="text"
                          value={editDraftValue}
                          disabled={isSavingEditedChallenge}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setEditDraftChallenges((current) => ({
                              ...current,
                              [challenge.id]: nextValue,
                            }));
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void handleUpdateChallenge(challenge.id);
                            }
                          }}
                        />
                        <div className="accountabilities-metric-details__composer-actions">
                          <button
                            type="button"
                            className="accountabilities-metric-details__button accountabilities-metric-details__button--secondary"
                            disabled={isSavingEditedChallenge}
                            onClick={() => {
                              setEditingChallengeId(null);
                              setEditDraftChallenges((current) => {
                                const next = { ...current };
                                delete next[challenge.id];
                                return next;
                              });
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="accountabilities-metric-details__button accountabilities-metric-details__button--primary"
                            disabled={
                              isSavingEditedChallenge || !editDraftValue.trim()
                            }
                            onClick={() => {
                              void handleUpdateChallenge(challenge.id);
                            }}
                          >
                            {isSavingEditedChallenge ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h5
                          id={`accountabilities-challenge-${challenge.id}-title`}
                          className="accountabilities-challenge-card__title"
                        >
                          {challenge.comment_text}
                        </h5>
                        {canManageChallenges ? (
                          <div className="accountabilities-challenge-card__actions">
                            <button
                              type="button"
                              className="accountabilities-metric-details__icon-button"
                              disabled={
                                deletingChallengeId === challenge.id ||
                                editingChallengeId !== null ||
                                isAddingChallenge
                              }
                              onClick={() => {
                                setIsAddingChallenge(false);
                                setEditingChallengeId(challenge.id);
                                setEditDraftChallenges((current) => ({
                                  ...current,
                                  [challenge.id]: challenge.comment_text,
                                }));
                              }}
                              aria-label="Edit challenge"
                              title="Edit challenge"
                            >
                              <CommentEditIcon />
                            </button>
                            <button
                              type="button"
                              className="accountabilities-metric-details__remove accountabilities-challenge-card__remove"
                              disabled={
                                deletingChallengeId === challenge.id ||
                                editingChallengeId !== null
                              }
                              onClick={() => {
                                void handleDeleteChallenge(challenge.id);
                              }}
                              aria-label={`Remove ${challenge.comment_text}`}
                            >
                              ×
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                );
              }}
            />
          )}
        </div>
      </section>

      <section
        className="accountabilities-section"
        aria-labelledby="accountabilities-plans-title"
      >
        <div className="accountabilities-section__header">
          <h3
            id="accountabilities-plans-title"
            className="accountabilities-section__title"
          >
            Plans and Next Steps:
          </h3>
          {canManagePlans && !isAddingPlan ? (
            <button
              type="button"
              className="accountabilities-metric-details__button accountabilities-metric-details__button--primary"
              disabled={!selectedPeriod || plansLoading}
              onClick={() => {
                setEditingPlanId(null);
                setIsAddingPlan(true);
              }}
            >
              Add item
            </button>
          ) : null}
        </div>

        <div className="accountabilities-challenges">
          {plansError ? (
            <div className="accountabilities-section__status accountabilities-section__status--error">
              {plansError}
            </div>
          ) : null}

          {canManagePlans && isAddingPlan ? (
            <div className="scard accountabilities-challenge-card accountabilities-challenge-card--composer">
              <div className="accountabilities-metric-details__composer">
                <input
                  className="accountabilities-ongoing-project__name-input"
                  type="text"
                  value={draftPlan}
                  placeholder="New plan or next step…"
                  disabled={savingPlan || !selectedPeriod}
                  onChange={(event) => setDraftPlan(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleAddPlanNextStep();
                    }
                  }}
                />
                <div className="accountabilities-metric-details__composer-actions">
                  <button
                    type="button"
                    className="accountabilities-metric-details__button accountabilities-metric-details__button--secondary"
                    disabled={savingPlan}
                    onClick={() => {
                      setIsAddingPlan(false);
                      setDraftPlan("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="accountabilities-metric-details__button accountabilities-metric-details__button--primary"
                    disabled={
                      savingPlan || !draftPlan.trim() || !selectedPeriod
                    }
                    onClick={() => {
                      void handleAddPlanNextStep();
                    }}
                  >
                    {savingPlan ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {plansLoading ? (
            <div className="accountabilities-section__status">
              Loading plans and next steps…
            </div>
          ) : !selectedPeriod ? (
            <div className="accountabilities-section__status">
              Select a year and month to view plans and next steps.
            </div>
          ) : plansNextSteps.length === 0 && !isAddingPlan ? (
            <div className="accountabilities-section__status">
              No plans or next steps yet.
            </div>
          ) : (
            <AccountabilitiesSortableList
              className="accountabilities-challenge-rows"
              itemClassName="scard accountabilities-challenge-card"
              items={plansNextSteps}
              disabled={!canManagePlans}
              onReorder={(nextItems) => {
                void handleReorderPlansNextSteps(nextItems);
              }}
              renderItem={(plan) => {
                const isEditingPlan = editingPlanId === plan.id;
                const isSavingEditedPlan = savingEditedPlanId === plan.id;
                const editDraftValue =
                  editDraftPlans[plan.id] ?? plan.comment_text;

                return (
                  <div className="accountabilities-challenge-card__header">
                    {isEditingPlan ? (
                      <div className="accountabilities-metric-details__composer accountabilities-metric-details__composer--inline">
                        <input
                          className="accountabilities-ongoing-project__name-input"
                          type="text"
                          value={editDraftValue}
                          disabled={isSavingEditedPlan}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setEditDraftPlans((current) => ({
                              ...current,
                              [plan.id]: nextValue,
                            }));
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void handleUpdatePlanNextStep(plan.id);
                            }
                          }}
                        />
                        <div className="accountabilities-metric-details__composer-actions">
                          <button
                            type="button"
                            className="accountabilities-metric-details__button accountabilities-metric-details__button--secondary"
                            disabled={isSavingEditedPlan}
                            onClick={() => {
                              setEditingPlanId(null);
                              setEditDraftPlans((current) => {
                                const next = { ...current };
                                delete next[plan.id];
                                return next;
                              });
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="accountabilities-metric-details__button accountabilities-metric-details__button--primary"
                            disabled={
                              isSavingEditedPlan || !editDraftValue.trim()
                            }
                            onClick={() => {
                              void handleUpdatePlanNextStep(plan.id);
                            }}
                          >
                            {isSavingEditedPlan ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h5
                          id={`accountabilities-plan-${plan.id}-title`}
                          className="accountabilities-challenge-card__title"
                        >
                          {plan.comment_text}
                        </h5>
                        {canManagePlans ? (
                          <div className="accountabilities-challenge-card__actions">
                            <button
                              type="button"
                              className="accountabilities-metric-details__icon-button"
                              disabled={
                                deletingPlanId === plan.id ||
                                editingPlanId !== null ||
                                isAddingPlan
                              }
                              onClick={() => {
                                setIsAddingPlan(false);
                                setEditingPlanId(plan.id);
                                setEditDraftPlans((current) => ({
                                  ...current,
                                  [plan.id]: plan.comment_text,
                                }));
                              }}
                              aria-label="Edit plan item"
                              title="Edit plan item"
                            >
                              <CommentEditIcon />
                            </button>
                            <button
                              type="button"
                              className="accountabilities-metric-details__remove accountabilities-challenge-card__remove"
                              disabled={
                                deletingPlanId === plan.id ||
                                editingPlanId !== null
                              }
                              onClick={() => {
                                void handleDeletePlanNextStep(plan.id);
                              }}
                              aria-label={`Remove ${plan.comment_text}`}
                            >
                              ×
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                );
              }}
            />
          )}
        </div>
      </section>

      <section
        className="accountabilities-section"
        aria-labelledby="accountabilities-team-goals-title"
      >
        <div className="accountabilities-section__header">
          <h3
            id="accountabilities-team-goals-title"
            className="accountabilities-section__title"
          >
            Team Goals on end of quarter:
          </h3>
          {canManageTeamGoals && !isAddingTeamGoal ? (
            <button
              type="button"
              className="accountabilities-metric-details__button accountabilities-metric-details__button--primary"
              disabled={!selectedPeriod || teamGoalsLoading}
              onClick={() => {
                setEditingTeamGoalId(null);
                setIsAddingTeamGoal(true);
              }}
            >
              Add item
            </button>
          ) : null}
        </div>

        <div className="accountabilities-challenges">
          {teamGoalsError ? (
            <div className="accountabilities-section__status accountabilities-section__status--error">
              {teamGoalsError}
            </div>
          ) : null}

          {canManageTeamGoals && isAddingTeamGoal ? (
            <div className="scard accountabilities-challenge-card accountabilities-challenge-card--composer">
              <div className="accountabilities-metric-details__composer">
                <input
                  className="accountabilities-ongoing-project__name-input"
                  type="text"
                  value={draftTeamGoal}
                  placeholder="New team goal…"
                  disabled={savingTeamGoal || !selectedPeriod}
                  onChange={(event) => setDraftTeamGoal(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleAddTeamGoal();
                    }
                  }}
                />
                <div className="accountabilities-metric-details__composer-actions">
                  <button
                    type="button"
                    className="accountabilities-metric-details__button accountabilities-metric-details__button--secondary"
                    disabled={savingTeamGoal}
                    onClick={() => {
                      setIsAddingTeamGoal(false);
                      setDraftTeamGoal("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="accountabilities-metric-details__button accountabilities-metric-details__button--primary"
                    disabled={
                      savingTeamGoal ||
                      !draftTeamGoal.trim() ||
                      !selectedPeriod
                    }
                    onClick={() => {
                      void handleAddTeamGoal();
                    }}
                  >
                    {savingTeamGoal ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {teamGoalsLoading ? (
            <div className="accountabilities-section__status">
              Loading team goals…
            </div>
          ) : !selectedPeriod ? (
            <div className="accountabilities-section__status">
              Select a year and month to view team goals.
            </div>
          ) : teamGoals.length === 0 && !isAddingTeamGoal ? (
            <div className="accountabilities-section__status">
              No team goals yet.
            </div>
          ) : (
            <AccountabilitiesSortableList
              className="accountabilities-challenge-rows"
              itemClassName="scard accountabilities-challenge-card"
              items={teamGoals}
              disabled={!canManageTeamGoals}
              onReorder={(nextItems) => {
                void handleReorderTeamGoals(nextItems);
              }}
              renderItem={(goal) => {
                const isEditingGoal = editingTeamGoalId === goal.id;
                const isSavingEditedGoal = savingEditedTeamGoalId === goal.id;
                const editDraftValue =
                  editDraftTeamGoals[goal.id] ?? goal.comment_text;

                return (
                  <div className="accountabilities-challenge-card__header">
                    {isEditingGoal ? (
                      <div className="accountabilities-metric-details__composer accountabilities-metric-details__composer--inline">
                        <input
                          className="accountabilities-ongoing-project__name-input"
                          type="text"
                          value={editDraftValue}
                          disabled={isSavingEditedGoal}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setEditDraftTeamGoals((current) => ({
                              ...current,
                              [goal.id]: nextValue,
                            }));
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void handleUpdateTeamGoal(goal.id);
                            }
                          }}
                        />
                        <div className="accountabilities-metric-details__composer-actions">
                          <button
                            type="button"
                            className="accountabilities-metric-details__button accountabilities-metric-details__button--secondary"
                            disabled={isSavingEditedGoal}
                            onClick={() => {
                              setEditingTeamGoalId(null);
                              setEditDraftTeamGoals((current) => {
                                const next = { ...current };
                                delete next[goal.id];
                                return next;
                              });
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="accountabilities-metric-details__button accountabilities-metric-details__button--primary"
                            disabled={
                              isSavingEditedGoal || !editDraftValue.trim()
                            }
                            onClick={() => {
                              void handleUpdateTeamGoal(goal.id);
                            }}
                          >
                            {isSavingEditedGoal ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h5
                          id={`accountabilities-team-goal-${goal.id}-title`}
                          className="accountabilities-challenge-card__title"
                        >
                          {goal.comment_text}
                        </h5>
                        {canManageTeamGoals ? (
                          <div className="accountabilities-challenge-card__actions">
                            <button
                              type="button"
                              className="accountabilities-metric-details__icon-button"
                              disabled={
                                deletingTeamGoalId === goal.id ||
                                editingTeamGoalId !== null ||
                                isAddingTeamGoal
                              }
                              onClick={() => {
                                setIsAddingTeamGoal(false);
                                setEditingTeamGoalId(goal.id);
                                setEditDraftTeamGoals((current) => ({
                                  ...current,
                                  [goal.id]: goal.comment_text,
                                }));
                              }}
                              aria-label="Edit team goal"
                              title="Edit team goal"
                            >
                              <CommentEditIcon />
                            </button>
                            <button
                              type="button"
                              className="accountabilities-metric-details__remove accountabilities-challenge-card__remove"
                              disabled={
                                deletingTeamGoalId === goal.id ||
                                editingTeamGoalId !== null
                              }
                              onClick={() => {
                                void handleDeleteTeamGoal(goal.id);
                              }}
                              aria-label={`Remove ${goal.comment_text}`}
                            >
                              ×
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                );
              }}
            />
          )}
        </div>
      </section>

      <section
        className="accountabilities-section"
        aria-labelledby="accountabilities-notable-highlights-title"
      >
        <div className="accountabilities-section__header">
          <h3
            id="accountabilities-notable-highlights-title"
            className="accountabilities-section__title"
          >
            Notable Highlights:
          </h3>
          {canManageHighlights && !isAddingHighlight ? (
            <button
              type="button"
              className="accountabilities-metric-details__button accountabilities-metric-details__button--primary"
              disabled={!selectedPeriod || highlightsLoading}
              onClick={() => {
                setEditingHighlightId(null);
                setIsAddingHighlight(true);
              }}
            >
              Add item
            </button>
          ) : null}
        </div>

        <div className="accountabilities-challenges">
          {highlightsError ? (
            <div className="accountabilities-section__status accountabilities-section__status--error">
              {highlightsError}
            </div>
          ) : null}

          {canManageHighlights && isAddingHighlight ? (
            <div className="scard accountabilities-challenge-card accountabilities-challenge-card--composer">
              <div className="accountabilities-metric-details__composer">
                <input
                  className="accountabilities-ongoing-project__name-input"
                  type="text"
                  value={draftHighlight}
                  placeholder="New notable highlight…"
                  disabled={savingHighlight || !selectedPeriod}
                  onChange={(event) => setDraftHighlight(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleAddNotableHighlight();
                    }
                  }}
                />
                <div className="accountabilities-metric-details__composer-actions">
                  <button
                    type="button"
                    className="accountabilities-metric-details__button accountabilities-metric-details__button--secondary"
                    disabled={savingHighlight}
                    onClick={() => {
                      setIsAddingHighlight(false);
                      setDraftHighlight("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="accountabilities-metric-details__button accountabilities-metric-details__button--primary"
                    disabled={
                      savingHighlight ||
                      !draftHighlight.trim() ||
                      !selectedPeriod
                    }
                    onClick={() => {
                      void handleAddNotableHighlight();
                    }}
                  >
                    {savingHighlight ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {highlightsLoading ? (
            <div className="accountabilities-section__status">
              Loading notable highlights…
            </div>
          ) : !selectedPeriod ? (
            <div className="accountabilities-section__status">
              Select a year and month to view notable highlights.
            </div>
          ) : notableHighlights.length === 0 && !isAddingHighlight ? (
            <div className="accountabilities-section__status">
              No notable highlights yet.
            </div>
          ) : (
            <AccountabilitiesSortableList
              className="accountabilities-challenge-rows"
              itemClassName="scard accountabilities-challenge-card"
              items={notableHighlights}
              disabled={!canManageHighlights}
              onReorder={(nextItems) => {
                void handleReorderNotableHighlights(nextItems);
              }}
              renderItem={(highlight) => {
                const isEditingHighlight = editingHighlightId === highlight.id;
                const isSavingEditedHighlight =
                  savingEditedHighlightId === highlight.id;
                const editDraftValue =
                  editDraftHighlights[highlight.id] ?? highlight.comment_text;

                return (
                  <div className="accountabilities-challenge-card__header">
                    {isEditingHighlight ? (
                      <div className="accountabilities-metric-details__composer accountabilities-metric-details__composer--inline">
                        <input
                          className="accountabilities-ongoing-project__name-input"
                          type="text"
                          value={editDraftValue}
                          disabled={isSavingEditedHighlight}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setEditDraftHighlights((current) => ({
                              ...current,
                              [highlight.id]: nextValue,
                            }));
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void handleUpdateNotableHighlight(highlight.id);
                            }
                          }}
                        />
                        <div className="accountabilities-metric-details__composer-actions">
                          <button
                            type="button"
                            className="accountabilities-metric-details__button accountabilities-metric-details__button--secondary"
                            disabled={isSavingEditedHighlight}
                            onClick={() => {
                              setEditingHighlightId(null);
                              setEditDraftHighlights((current) => {
                                const next = { ...current };
                                delete next[highlight.id];
                                return next;
                              });
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="accountabilities-metric-details__button accountabilities-metric-details__button--primary"
                            disabled={
                              isSavingEditedHighlight || !editDraftValue.trim()
                            }
                            onClick={() => {
                              void handleUpdateNotableHighlight(highlight.id);
                            }}
                          >
                            {isSavingEditedHighlight ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h5
                          id={`accountabilities-highlight-${highlight.id}-title`}
                          className="accountabilities-challenge-card__title"
                        >
                          {highlight.comment_text}
                        </h5>
                        {canManageHighlights ? (
                          <div className="accountabilities-challenge-card__actions">
                            <button
                              type="button"
                              className="accountabilities-metric-details__icon-button"
                              disabled={
                                deletingHighlightId === highlight.id ||
                                editingHighlightId !== null ||
                                isAddingHighlight
                              }
                              onClick={() => {
                                setIsAddingHighlight(false);
                                setEditingHighlightId(highlight.id);
                                setEditDraftHighlights((current) => ({
                                  ...current,
                                  [highlight.id]: highlight.comment_text,
                                }));
                              }}
                              aria-label="Edit notable highlight"
                              title="Edit notable highlight"
                            >
                              <CommentEditIcon />
                            </button>
                            <button
                              type="button"
                              className="accountabilities-metric-details__remove accountabilities-challenge-card__remove"
                              disabled={
                                deletingHighlightId === highlight.id ||
                                editingHighlightId !== null
                              }
                              onClick={() => {
                                void handleDeleteNotableHighlight(highlight.id);
                              }}
                              aria-label={`Remove ${highlight.comment_text}`}
                            >
                              ×
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                );
              }}
            />
          )}
        </div>
      </section>

      <section
        className="accountabilities-section"
        aria-labelledby="accountabilities-team-stack-ranking-title"
      >
        <div className="accountabilities-section__header">
          <h3
            id="accountabilities-team-stack-ranking-title"
            className="accountabilities-section__title"
          >
            Team Stack Ranking
            {selectedPeriodLabel ? ` — ${selectedPeriodLabel}` : ""}:
          </h3>
        </div>

        <div className="scard">
          {radarLoading ? (
            <div className="statistics-member-ranking__empty">
              Loading team stack ranking…
            </div>
          ) : !selectedPeriod ? (
            <div className="statistics-member-ranking__empty">
              Select a year and month to view team stack ranking.
            </div>
          ) : teamStackRankingEntries.length === 0 ? (
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
                  {teamStackRankingEntries.map((entry) => {
                    const entryGrade = entry.grade ?? "—";
                    const entryGradeColor = entry.grade
                      ? PERFORMANCE_GRADE_COLORS[entry.grade]
                      : "rgba(220, 235, 255, 0.92)";
                    const rankColor = getMemberRankingColor(entry.rank);
                    const highlightIntensity =
                      getMemberRankingHighlightIntensity(
                        entry.rank,
                        teamStackRankingEntries.length,
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
                                const isPerfect = safeValue >= 100;
                                const barColor = getSkillValueGradeColor(
                                  safeValue,
                                  skillChartScale.minValue,
                                );

                                return (
                                  <li
                                    key={`${entry.memberId}-${metric.key}`}
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
                                    item.score === null ||
                                    !Number.isFinite(item.score)
                                      ? 0
                                      : Math.max(
                                          0,
                                          Math.min(item.max, item.score),
                                        );
                                  const isPerfect =
                                    item.score !== null &&
                                    scoreValue >= item.max;
                                  const filledCount = Math.round(
                                    (scoreValue / item.max) *
                                      PROFESSIONALISM_PIP_COUNT,
                                  );
                                  const pipColor =
                                    getProfessionalismScoreColor(scoreValue);

                                  return (
                                    <li
                                      key={`${entry.memberId}-${item.itemId}`}
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
                                          {
                                            length: PROFESSIONALISM_PIP_COUNT,
                                          },
                                          (_, pipIndex) => {
                                            const isFilled =
                                              pipIndex < filledCount;
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
                                                        boxShadow: isPerfect
                                                          ? `0 0 8px ${pipColor}`
                                                          : undefined,
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
      </section>

      <AccountabilitiesAiSummary
        snapshot={aiSummarySnapshot}
        disabled={!selectedPeriod || radarLoading}
      />
    </div>
  );
}
