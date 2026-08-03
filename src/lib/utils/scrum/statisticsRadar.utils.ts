import { calculateVelocityMetrics, type CriteriaType } from "./evaluateMemberPerformance.utils";

export const SKILL_RADAR_KEYS = [
  "productivity",
  "efficiency",
  "quality",
  "collaboration",
  "velocity",
  "professionalism",
] as const;

export type SkillRadarKey = (typeof SKILL_RADAR_KEYS)[number];
export type SkillRadarValues = Record<SkillRadarKey, number>;

type CriteriaRadarKey = Exclude<SkillRadarKey, "velocity" | "professionalism">;

export type MemberSprintCriteriaScoreRow = {
  member_id: string;
  sprint_id: string;
  rate: number | null;
  criteria:
    | { type: CriteriaType | null }
    | Array<{ type: CriteriaType | null }>
    | null;
};

export type MemberSprintPerformanceVelocityRow = {
  member_id: string;
  sprint_id: string;
  total_story_points: number | null;
  assigned_story_points: number | null;
};

export type ProfessionalismItemLike = {
  id: string;
  value: number | null;
};

export type MemberSprintProfessionalismScoreLike = {
  member_id: string;
  sprint_id: string;
  item_id: string;
  score: number | null;
};

function averageFiniteScores(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function getCriteriaType(row: MemberSprintCriteriaScoreRow): CriteriaType | null {
  const criteria = row.criteria;
  if (!criteria) {
    return null;
  }

  if (Array.isArray(criteria)) {
    return criteria[0]?.type ?? null;
  }

  return criteria.type ?? null;
}

function capPercentageRate(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return Math.min(100, Math.max(0, value));
}

function roundRadarValue(value: number | null): number {
  const capped = capPercentageRate(value);
  if (capped === null) {
    return 0;
  }

  return Math.round(capped * 100) / 100;
}

function getMemberCriteriaRateAverage(
  rows: MemberSprintCriteriaScoreRow[],
  memberId: string,
  type: CriteriaRadarKey,
): number | null {
  const values = rows
    .filter((row) => {
      if (row.member_id !== memberId || getCriteriaType(row) !== type) {
        return false;
      }

      return row.rate !== null && Number.isFinite(Number(row.rate));
    })
    .map((row) => capPercentageRate(Number(row.rate)))
    .filter((value): value is number => value !== null);

  return capPercentageRate(averageFiniteScores(values));
}

function getStoryPointsVelocityRate(
  completedStoryPoints: number | null,
  assignedStoryPoints: number | null,
): number | null {
  if (
    completedStoryPoints === null ||
    assignedStoryPoints === null ||
    !Number.isFinite(Number(completedStoryPoints)) ||
    !Number.isFinite(Number(assignedStoryPoints))
  ) {
    return null;
  }

  return capPercentageRate(
    calculateVelocityMetrics({
      completedStoryPoints: Number(completedStoryPoints),
      assignedStoryPoints: Number(assignedStoryPoints),
    }).velocityRate,
  );
}

function getMemberVelocityRateAverage(
  performanceRows: MemberSprintPerformanceVelocityRow[],
  memberId: string,
): number | null {
  const velocityRates = performanceRows
    .filter((row) => row.member_id === memberId)
    .map((row) =>
      getStoryPointsVelocityRate(
        row.total_story_points,
        row.assigned_story_points,
      ),
    )
    .filter((value): value is number => value !== null);

  return capPercentageRate(averageFiniteScores(velocityRates));
}

function getMemberProfessionalismItemAverage(
  rows: MemberSprintProfessionalismScoreLike[],
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
  rows: MemberSprintProfessionalismScoreLike[],
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

/**
 * Matches Statistics "Professionalism Total Average" percentage:
 * (rounded total of item averages / sum of item max values) × 100.
 * Example: 18.8/25 → 75.2
 */
function getProfessionalismTotalAverageRate(
  rows: MemberSprintProfessionalismScoreLike[],
  items: ProfessionalismItemLike[],
  memberIds: string[],
  selectedMemberId: string | null,
): number | null {
  const totalMax = items.reduce(
    (sum, item) => sum + Math.max(Number(item.value) || 0, 0),
    0,
  );
  if (totalMax <= 0 || items.length === 0) {
    return null;
  }

  const totalScore = items.reduce((sum, item) => {
    const averageValue = selectedMemberId
      ? getMemberProfessionalismItemAverage(rows, selectedMemberId, item.id)
      : getTeamProfessionalismItemAverage(rows, memberIds, item.id);

    // Same 1-decimal rounding used by Professionalism Total Average bars.
    const roundedItemAverage =
      averageValue === null ? 0 : Math.round(averageValue * 10) / 10;

    return sum + roundedItemAverage;
  }, 0);

  const roundedTotalScore = Math.round(totalScore * 10) / 10;
  return capPercentageRate((roundedTotalScore / totalMax) * 100);
}

function roundProfessionalismRadarValue(value: number | null): number {
  const capped = capPercentageRate(value);
  if (capped === null) {
    return 0;
  }

  return Math.round(capped * 100) / 100;
}

function getAggregateRadarRate(
  criteriaRows: MemberSprintCriteriaScoreRow[],
  performanceRows: MemberSprintPerformanceVelocityRow[],
  professionalismRows: MemberSprintProfessionalismScoreLike[],
  professionalismItems: ProfessionalismItemLike[],
  memberIds: string[],
  selectedMemberId: string | null,
  type: SkillRadarKey,
): number | null {
  if (type === "velocity") {
    if (selectedMemberId) {
      return getMemberVelocityRateAverage(performanceRows, selectedMemberId);
    }

    const memberAverages = memberIds
      .map((memberId) => getMemberVelocityRateAverage(performanceRows, memberId))
      .filter((value): value is number => value !== null);

    return capPercentageRate(averageFiniteScores(memberAverages));
  }

  if (type === "professionalism") {
    return getProfessionalismTotalAverageRate(
      professionalismRows,
      professionalismItems,
      memberIds,
      selectedMemberId,
    );
  }

  if (selectedMemberId) {
    return getMemberCriteriaRateAverage(criteriaRows, selectedMemberId, type);
  }

  const memberAverages = memberIds
    .map((memberId) => getMemberCriteriaRateAverage(criteriaRows, memberId, type))
    .filter((value): value is number => value !== null);

  return capPercentageRate(averageFiniteScores(memberAverages));
}

export function buildSkillRadarValues(input: {
  criteriaScoreRows: MemberSprintCriteriaScoreRow[];
  performanceRows: MemberSprintPerformanceVelocityRow[];
  memberIds: string[];
  selectedMemberId: string | null;
  professionalismScoreRows?: MemberSprintProfessionalismScoreLike[];
  professionalismItems?: ProfessionalismItemLike[];
}): SkillRadarValues {
  const professionalismScoreRows = input.professionalismScoreRows ?? [];
  const professionalismItems = input.professionalismItems ?? [];

  return SKILL_RADAR_KEYS.reduce<SkillRadarValues>((values, key) => {
    const rate = getAggregateRadarRate(
      input.criteriaScoreRows,
      input.performanceRows,
      professionalismScoreRows,
      professionalismItems,
      input.memberIds,
      input.selectedMemberId,
      key,
    );

    values[key] =
      key === "professionalism"
        ? roundProfessionalismRadarValue(rate)
        : roundRadarValue(rate);
    return values;
  }, {
    productivity: 0,
    efficiency: 0,
    quality: 0,
    collaboration: 0,
    velocity: 0,
    professionalism: 0,
  });
}

export const EMPTY_SKILL_RADAR_VALUES: SkillRadarValues = {
  productivity: 0,
  efficiency: 0,
  quality: 0,
  collaboration: 0,
  velocity: 0,
  professionalism: 0,
};

export type SkillChartScale = {
  minValue: number;
  maxValue: number;
};

export const DEFAULT_SKILL_CHART_SCALE: SkillChartScale = {
  minValue: 60,
  maxValue: 100,
};

export function capSkillPercentageValue(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function getAveragePassingScoreByLevel(
  rows: Array<{ level: string | null; value: number | null }>,
): number {
  const valuesByLevel = new Map<string, number[]>();

  for (const row of rows) {
    if (row.value === null || !Number.isFinite(Number(row.value))) {
      continue;
    }

    const level = row.level?.trim().toLowerCase();
    if (!level) {
      continue;
    }

    const levelValues = valuesByLevel.get(level) ?? [];
    levelValues.push(Number(row.value));
    valuesByLevel.set(level, levelValues);
  }

  const levelAverages = Array.from(valuesByLevel.values()).map((values) =>
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );

  if (levelAverages.length === 0) {
    return DEFAULT_SKILL_CHART_SCALE.minValue;
  }

  return (
    levelAverages.reduce((sum, value) => sum + value, 0) / levelAverages.length
  );
}

export function normalizeSkillValueForChart(
  value: number,
  scale: SkillChartScale = DEFAULT_SKILL_CHART_SCALE,
): number {
  const cappedValue = capSkillPercentageValue(value);
  const minValue = capSkillPercentageValue(scale.minValue);
  const maxValue = capSkillPercentageValue(scale.maxValue);

  if (maxValue <= minValue) {
    return cappedValue >= maxValue ? 100 : 0;
  }

  if (cappedValue <= minValue) {
    return 0;
  }

  if (cappedValue >= maxValue) {
    return 100;
  }

  return ((cappedValue - minValue) / (maxValue - minValue)) * 100;
}

export function isSkillValuePassing(
  value: number,
  scale: SkillChartScale = DEFAULT_SKILL_CHART_SCALE,
): boolean {
  return capSkillPercentageValue(value) >= capSkillPercentageValue(scale.minValue);
}

export function getSkillChartTicks(
  scale: SkillChartScale = DEFAULT_SKILL_CHART_SCALE,
): number[] {
  const minValue = Math.round(capSkillPercentageValue(scale.minValue));
  const maxValue = 100;
  const span = maxValue - minValue;

  if (span <= 0) {
    return [maxValue];
  }

  return [
    minValue,
    minValue + span * 0.25,
    minValue + span * 0.5,
    minValue + span * 0.75,
    maxValue,
  ].map((tick) => Math.round(tick));
}

export function normalizeSkillRadarValues(values: SkillRadarValues): SkillRadarValues {
  return SKILL_RADAR_KEYS.reduce<SkillRadarValues>((normalized, key) => {
    normalized[key] =
      key === "professionalism"
        ? roundProfessionalismRadarValue(values[key])
        : roundRadarValue(values[key]);
    return normalized;
  }, { ...EMPTY_SKILL_RADAR_VALUES });
}

export function normalizeSkillRadarValuesForChart(
  values: SkillRadarValues,
  scale: SkillChartScale = DEFAULT_SKILL_CHART_SCALE,
): SkillRadarValues {
  return SKILL_RADAR_KEYS.reduce<SkillRadarValues>((normalized, key) => {
    normalized[key] = Math.round(normalizeSkillValueForChart(values[key], scale));
    return normalized;
  }, { ...EMPTY_SKILL_RADAR_VALUES });
}
