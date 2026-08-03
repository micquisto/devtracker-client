import { useEffect, useMemo, useState } from "react";
import {
  SkillRadarPanel,
  TeamContributionDoughnut,
  getTeamContributionMemberColor,
  GradeDial,
  PERFORMANCE_GRADE_COLORS,
  type TeamContributionSegment,
} from "@/components/dashboard";
import { StyledSelect } from "@/components/shared/Elements";
import { Title } from "@/components/shared/page";
import { getSupabaseRows, insertSupabaseRows, deleteSupabaseRows } from "@/lib/supabase";
import { Palette } from "@/lib/theme";
import {
  resolvePerformanceScoreGrade,
  type PerformanceScoreGrade,
} from "@/lib/utils/scrum/evaluateMemberPerformance.utils";
import {
  isScoreboardIncludedMember,
  sortMembersByLastName,
} from "@/lib/utils/scrum/scoreboardMembers.utils";
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
  created_at: string | null;
};

type MetricCommentInsertRow = {
  sprint_year: number;
  sprint_month: number;
  metric_key: SkillRadarKey;
  comment_text: string;
};

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

function getSkillValueGradeColor(value: number): string {
  return PERFORMANCE_GRADE_COLORS[
    resolvePerformanceScoreGrade(value, DEFAULT_PASSING_THRESHOLD)
  ];
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
  const color = hasValue ? getSkillValueGradeColor(clamped) : "rgba(120,170,215,0.45)";
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
  initialYear = "",
  initialMonth = "",
}: {
  showFilters?: boolean;
  showPublicViewButton?: boolean;
  showCommentActions?: boolean;
  initialYear?: string;
  initialMonth?: string;
} = {}) {
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

    return grouped;
  }, [metricComments]);

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
            select: "id,sprint_year,sprint_month,metric_key,comment_text,created_at",
            eq: {
              sprint_year: selectedPeriod.year,
              sprint_month: selectedPeriod.month,
            },
            order: { column: "created_at", ascending: true },
          },
        );

        if (!cancelled) {
          setMetricComments(
            rows.filter((row): row is MetricCommentRow =>
              SKILL_METRIC_ROWS.some((metric) => metric.key === row.metric_key),
            ),
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
      const [created] = await insertSupabaseRows<
        MetricCommentRow,
        MetricCommentInsertRow
      >("accountabilities_metric_comments", {
        sprint_year: selectedPeriod.year,
        sprint_month: selectedPeriod.month,
        metric_key: metricKey,
        comment_text: draft,
      });

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

  return (
    <div className="accountabilities-page">
      {showPublicViewButton ? (
        <div className="accountabilities-page-toolbar">
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
                      disabled={!selectedPeriod || commentsLoading}
                      onClick={() => setAddingMetricKey(metric.key)}
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
                      <ul className="accountabilities-metric-details__list">
                        {metricDetailComments.map((comment) => (
                          <li
                            key={comment.id}
                            className="accountabilities-metric-details__item"
                          >
                            <span className="accountabilities-metric-details__text">
                              {comment.comment_text}
                            </span>
                            {showCommentActions ? (
                              <button
                                type="button"
                                className="accountabilities-metric-details__remove"
                                disabled={deletingCommentId === comment.id}
                                onClick={() => {
                                  void handleDeleteMetricComment(comment.id);
                                }}
                                aria-label="Remove comment"
                              >
                                ×
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
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
        <h3
          id="accountabilities-ongoing-projects-title"
          className="accountabilities-section__title"
        >
          Ongoing Projects:
        </h3>
        <div
          className="scard accountabilities-ongoing-projects-card"
          aria-labelledby="accountabilities-ongoing-projects-title"
        />
      </section>
    </div>
  );
}
