import { getSupabaseRows, supabase } from "@/lib/supabase";
import type { RequirementLevel } from "./sprintRequirements.utils";

export type CriteriaType =
  | "productivity"
  | "efficiency"
  | "quality"
  | "collaboration"
  | "professionalism"
  | "velocity";

export type PerformanceScoreGrade = "S" | "A" | "B" | "C" | "D" | "E" | "F";

export type EvaluateYearResult = {
  year: number;
  sprintsProcessed: number;
  membersProcessed: number;
  criteriaRowsUpserted: number;
  performanceRowsUpserted: number;
  skippedSprints: Array<{ sprintId: string; reason: string }>;
  skippedMembers: Array<{ sprintId: string; memberId: string; reason: string }>;
};

type EvaluateSprintRow = {
  id: string;
  name: string | null;
  sprint_year: number | null;
  grading_set_id: string | null;
  criteria_set_id: string | null;
  start_date: string | null;
};

type EvaluateMemberRow = {
  id: string;
  level: RequirementLevel | null;
};

type CriteriaRow = {
  id: string;
  level: RequirementLevel;
  name: string;
  code: string;
  min: number | null;
  max: number | null;
  value: number | null;
  weight: number | null;
  type: CriteriaType | null;
  sort_number: number | null;
};

type CriteriaSetLinkRow = {
  set_id: string;
  criteria_id: string;
};

type PassingScoreRow = {
  grading_set_id: string;
  level: RequirementLevel;
  value: number;
};

type MemberSprintScoreRow = {
  member_id: string;
  sprint_id: string;
  planned_story_points: number | null;
  completed_story_points: number | null;
  weighted_story_points: number | null;
  accumulated_hours: number | null;
  collaboration: number | null;
  completed_tasks_count: number | null;
  total_reject_count: number | null;
  completion_rate_override: number | null;
  severity_rate_override: number | null;
};

type ProfessionalismScoreRow = {
  member_id: string;
  sprint_id: string;
  item_id: string;
  score: number | null;
};

type ProfessionalismItemRow = {
  id: string;
  value: number | null;
};

type MemberSprintCriteriaScoreInsert = {
  member_id: string;
  sprint_id: string;
  criteria_id: string;
  score: number;
  overall_score: number;
  rate: number;
  weight_rate: number;
};

type MembersPerformanceScoreInsert = {
  member_id: string;
  sprint_id: string;
  average_score: number;
  tasks_count: number;
  assigned_story_points: number;
  total_story_points: number;
  modified_story_points: number;
  hours_accumulated: number;
  extra_points: number;
  negative_accumulated_rate: number;
  velocity_by_hour: number;
  score_grade: PerformanceScoreGrade;
  actual_story_points: number;
};

export type ProductivityCalculation = {
  assignedStoryPoints: number;
  completedStoryPoints: number;
  weightedStoryPoints: number;
  productivityScore: number;
  delivery: number;
  extraPoints: number;
  requiredHours: number;
  timeEfficiency: number;
  productivityRate: number;
};

export type EfficiencyCalculation = {
  accumulatedHours: number;
  sclEfficiencyMax: number;
  sclEfficiencyMin: number;
  acceptedHours: number;
  productivityExcessNegativeRate: number;
  timeExcessNegativeRate: number;
  productivityDeductScore: number;
  timeDeductScore: number;
  rawEfficiencyRate: number;
  efficiencyRate: number;
};

export type QualityCalculation = {
  completedTasksCount: number;
  qualityLifeline: number;
  qualityExpectedTotal: number;
  qualityScore: number;
  qualityRate: number;
};

export type ProfessionalismCalculation = {
  professionalismExpectedTotal: number;
  professionalismScore: number;
  professionalismRate: number;
};

const CRITERIA_TYPES: CriteriaType[] = [
  "productivity",
  "efficiency",
  "quality",
  "collaboration",
  "professionalism",
  "velocity",
];

const GRADE_BANDS_ASCENDING: PerformanceScoreGrade[] = [
  "F",
  "E",
  "D",
  "C",
  "B",
  "A",
];

function toFiniteNumber(value: number | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return fallback;
  }
  return numerator / denominator;
}

function roundScore(value: number, digits = 6): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeCriteriaType(value: string | null | undefined): CriteriaType | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return CRITERIA_TYPES.includes(normalized as CriteriaType)
    ? (normalized as CriteriaType)
    : null;
}

function normalizeMemberLevel(
  level: string | null | undefined,
): Exclude<RequirementLevel, "all"> | null {
  const normalized = level?.trim().toLowerCase() ?? "";
  if (
    normalized === "intern" ||
    normalized === "junior" ||
    normalized === "middle" ||
    normalized === "senior" ||
    normalized === "lead"
  ) {
    return normalized;
  }
  return null;
}

/**
 * Grade bands:
 * - 100 → S (single top bucket)
 * - [passingThreshold, 100) → split evenly into F < E < D < C < B < A
 * - below passingThreshold → F
 *
 * Seven letter grades total (S + six bands), matching the performance grade enum.
 */
export function resolvePerformanceScoreGrade(
  averageScore: number,
  passingThreshold: number,
): PerformanceScoreGrade {
  const score = toFiniteNumber(averageScore, 0);
  const threshold = clamp(toFiniteNumber(passingThreshold, 0), 0, 100);

  if (score >= 100) {
    return "S";
  }

  if (score < threshold) {
    return "F";
  }

  const span = Math.max(100 - threshold, Number.EPSILON);
  const offset = score - threshold;
  const bandSize = span / GRADE_BANDS_ASCENDING.length;
  const bandIndex = Math.min(
    GRADE_BANDS_ASCENDING.length - 1,
    Math.floor(offset / bandSize),
  );

  return GRADE_BANDS_ASCENDING[bandIndex] ?? "F";
}

function resolveOverrideMultiplier(value: number | null | undefined): number {
  if (value === null || value === undefined) return 1;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return numeric;
}

export function calculateProductivityMetrics(input: {
  plannedStoryPoints: number;
  completedStoryPoints: number;
  weightedStoryPoints: number;
  completionRateOverride: number | null;
  severityRateOverride: number | null;
  accumulatedHours: number;
  efficiencyMinHours: number;
}): ProductivityCalculation {
  const assignedStoryPoints = Math.max(toFiniteNumber(input.plannedStoryPoints), 0);
  const completedStoryPoints = Math.max(toFiniteNumber(input.completedStoryPoints), 0);
  const weightedStoryPoints = Math.max(toFiniteNumber(input.weightedStoryPoints), 0);
  const baseCompletedPoints =
    weightedStoryPoints > 0 ? weightedStoryPoints : completedStoryPoints;
  const completionMultiplier = resolveOverrideMultiplier(input.completionRateOverride);
  const severityMultiplier = resolveOverrideMultiplier(input.severityRateOverride);
  const productivityScore = roundScore(
    baseCompletedPoints * completionMultiplier * severityMultiplier,
  );

  const delivery =
    assignedStoryPoints <= 0
      ? productivityScore > 0
        ? 100
        : 0
      : clamp(safeDivide(productivityScore, assignedStoryPoints) * 100, 0, 100);

  const requiredHours = Math.max(toFiniteNumber(input.efficiencyMinHours, 80), 0);
  const accumulatedHours = Math.max(toFiniteNumber(input.accumulatedHours), 0);

  let timeEfficiency = 1;
  if (completedStoryPoints < assignedStoryPoints) {
    // Under-delivered: reward staying within expected hours.
    // No hours logged → cannot prove efficiency → 0.
    timeEfficiency =
      accumulatedHours <= 0
        ? 0
        : clamp(safeDivide(requiredHours, accumulatedHours, 0), 0, 1);
  }

  const productivityRate = roundScore(clamp(delivery * timeEfficiency, 0, 100));

  return {
    assignedStoryPoints,
    completedStoryPoints,
    weightedStoryPoints,
    productivityScore,
    delivery: roundScore(delivery),
    extraPoints: roundScore(productivityScore - assignedStoryPoints),
    requiredHours,
    timeEfficiency: roundScore(timeEfficiency),
    productivityRate,
  };
}

export function calculateEfficiencyMetrics(input: {
  accumulatedHours: number;
  efficiencyMin: number;
  efficiencyMax: number;
  productivityScore: number;
  assignedStoryPoints: number;
}): EfficiencyCalculation {
  const accumulatedHours = Math.max(toFiniteNumber(input.accumulatedHours), 0);
  const sclEfficiencyMin = Math.max(toFiniteNumber(input.efficiencyMin, 80), Number.EPSILON);
  const sclEfficiencyMax = Math.max(
    toFiniteNumber(input.efficiencyMax, sclEfficiencyMin),
    sclEfficiencyMin,
  );
  const assignedStoryPoints = Math.max(toFiniteNumber(input.assignedStoryPoints), 0);
  const productivityScore = toFiniteNumber(input.productivityScore);
  const productivityDelta = productivityScore - assignedStoryPoints;

  const acceptedHours =
    accumulatedHours > sclEfficiencyMax ? sclEfficiencyMax : accumulatedHours;

  const productivityExcessNegativeRate =
    productivityDelta < 0 && assignedStoryPoints > 0
      ? roundScore((Math.abs(productivityDelta) / assignedStoryPoints) * 100)
      : 0;

  const timeExcessNegativeRate =
    accumulatedHours > sclEfficiencyMax
      ? roundScore(
          ((accumulatedHours - sclEfficiencyMax) / sclEfficiencyMin) * 100,
        )
      : 0;

  const productivityDeductScore =
    productivityDelta < 0 && assignedStoryPoints > 0
      ? roundScore(Math.abs(productivityDelta) / assignedStoryPoints)
      : 0;

  // Time deduct only applies when over the max hours AND under productivity target.
  const timeDeductScore =
    productivityScore >= assignedStoryPoints || accumulatedHours <= sclEfficiencyMax
      ? 0
      : roundScore(
          Math.max(
            ((accumulatedHours - sclEfficiencyMax) / sclEfficiencyMin) *
              ((accumulatedHours / sclEfficiencyMax) * sclEfficiencyMin),
            0,
          ),
        );

  let rawEfficiencyRate = 100;
  if (accumulatedHours > sclEfficiencyMax) {
    rawEfficiencyRate = 100;
  } else if (productivityExcessNegativeRate === 0) {
    rawEfficiencyRate = 100;
  } else {
    rawEfficiencyRate = clamp(
      safeDivide(accumulatedHours, sclEfficiencyMax) * 100,
      0,
      100,
    );
  }

  const deduct =
    productivityExcessNegativeRate > timeExcessNegativeRate
      ? productivityDeductScore
      : timeDeductScore;

  const efficiencyRate = roundScore(clamp(rawEfficiencyRate - deduct, 0, 100));

  return {
    accumulatedHours,
    sclEfficiencyMax,
    sclEfficiencyMin,
    acceptedHours,
    productivityExcessNegativeRate,
    timeExcessNegativeRate,
    productivityDeductScore,
    timeDeductScore: roundScore(Math.max(timeDeductScore, 0)),
    rawEfficiencyRate: roundScore(rawEfficiencyRate),
    efficiencyRate,
  };
}

export function calculateQualityMetrics(input: {
  completedTasksCount: number;
  qualityMax: number;
  totalRejectCount: number;
}): QualityCalculation {
  const completedTasksCount = Math.max(toFiniteNumber(input.completedTasksCount), 0);
  const qualityLifeline = Math.max(toFiniteNumber(input.qualityMax, 0), 0);
  const qualityExpectedTotal = roundScore(completedTasksCount * qualityLifeline);
  const totalRejectCount = Math.max(toFiniteNumber(input.totalRejectCount), 0);
  const qualityScore = roundScore(Math.max(qualityExpectedTotal - totalRejectCount, 0));
  const qualityRate =
    qualityExpectedTotal <= 0
      ? completedTasksCount === 0
        ? 100
        : 0
      : roundScore(clamp(safeDivide(qualityScore, qualityExpectedTotal) * 100, 0, 100));

  return {
    completedTasksCount,
    qualityLifeline,
    qualityExpectedTotal,
    qualityScore,
    qualityRate,
  };
}

export function calculateProfessionalismMetrics(input: {
  itemValues: number[];
  itemScores: number[];
}): ProfessionalismCalculation {
  const professionalismExpectedTotal = roundScore(
    input.itemValues.reduce((sum, value) => sum + Math.max(toFiniteNumber(value), 0), 0),
  );
  const professionalismScore = roundScore(
    input.itemScores.reduce((sum, value) => sum + Math.max(toFiniteNumber(value), 0), 0),
  );
  const professionalismRate =
    professionalismExpectedTotal <= 0
      ? 0
      : roundScore(
          clamp(
            safeDivide(professionalismScore, professionalismExpectedTotal) * 100,
            0,
            100,
          ),
        );

  return {
    professionalismExpectedTotal,
    professionalismScore,
    professionalismRate,
  };
}

export function calculateVelocityMetrics(input: {
  completedStoryPoints: number;
  assignedStoryPoints: number;
}): {
  velocityRate: number;
} {
  const completedStoryPoints = Math.max(
    toFiniteNumber(input.completedStoryPoints),
    0,
  );
  const assignedStoryPoints = Math.max(
    toFiniteNumber(input.assignedStoryPoints),
    0,
  );
  const velocityRate =
    assignedStoryPoints <= 0
      ? completedStoryPoints > 0
        ? 100
        : 0
      : roundScore(
          clamp(
            safeDivide(completedStoryPoints, assignedStoryPoints, 0) * 100,
            0,
            100,
          ),
        );

  return {
    velocityRate,
  };
}

function buildWeightRate(rate: number, weight: number | null | undefined): number {
  return roundScore((clamp(toFiniteNumber(rate), 0, 100) / 100) * toFiniteNumber(weight, 0));
}

function pickCriteriaForMemberLevel(
  criteriaRows: CriteriaRow[],
  level: Exclude<RequirementLevel, "all">,
  type: CriteriaType,
): CriteriaRow | null {
  const matches = criteriaRows.filter(
    (row) =>
      normalizeCriteriaType(row.type) === type &&
      (row.level === level || row.level === "all"),
  );

  if (matches.length === 0) return null;

  const exact = matches.find((row) => row.level === level);
  return exact ?? matches[0] ?? null;
}

async function loadYearSprints(year: number): Promise<EvaluateSprintRow[]> {
  return getSupabaseRows<EvaluateSprintRow>("sprints", {
    select: "id,name,sprint_year,grading_set_id,criteria_set_id,start_date",
    eq: { sprint_year: year },
    order: { column: "start_date", ascending: true },
  });
}

async function deleteCriteriaScoresForSprints(sprintIds: string[]): Promise<void> {
  if (sprintIds.length === 0) return;

  const { error } = await supabase
    .from("member_sprint_criteria_scores")
    .delete()
    .in("sprint_id", sprintIds);

  if (error) {
    throw error;
  }
}

async function deletePerformanceScoresForSprints(sprintIds: string[]): Promise<void> {
  if (sprintIds.length === 0) return;

  const { error } = await supabase
    .from("members_performance_scores")
    .delete()
    .in("sprint_id", sprintIds);

  if (error) {
    throw error;
  }
}

async function upsertCriteriaScoreRows(
  rows: MemberSprintCriteriaScoreInsert[],
): Promise<number> {
  if (rows.length === 0) return 0;

  const chunkSize = 200;
  let upserted = 0;

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from("member_sprint_criteria_scores")
      .upsert(chunk, { onConflict: "member_id,sprint_id,criteria_id" })
      .select("id");

    if (error) {
      throw error;
    }

    upserted += data?.length ?? chunk.length;
  }

  return upserted;
}

async function upsertPerformanceScoreRows(
  rows: MembersPerformanceScoreInsert[],
): Promise<number> {
  if (rows.length === 0) return 0;

  const chunkSize = 200;
  let upserted = 0;

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from("members_performance_scores")
      .upsert(chunk, { onConflict: "member_id,sprint_id" })
      .select("id");

    if (error) {
      throw error;
    }

    upserted += data?.length ?? chunk.length;
  }

  return upserted;
}

function evaluateMemberForSprint(input: {
  sprint: EvaluateSprintRow;
  member: EvaluateMemberRow;
  memberScore: MemberSprintScoreRow;
  criteriaByType: Map<CriteriaType, CriteriaRow>;
  passingThreshold: number;
  professionalismItemsById: Map<string, ProfessionalismItemRow>;
  professionalismScores: ProfessionalismScoreRow[];
}): {
  criteriaRows: MemberSprintCriteriaScoreInsert[];
  performanceRow: MembersPerformanceScoreInsert;
} {
  const memberLevel = normalizeMemberLevel(input.member.level);
  if (!memberLevel) {
    throw new Error("Member level is missing or unsupported.");
  }

  const productivityCriteria = input.criteriaByType.get("productivity") ?? null;
  const efficiencyCriteria = input.criteriaByType.get("efficiency") ?? null;
  const qualityCriteria = input.criteriaByType.get("quality") ?? null;
  const collaborationCriteria = input.criteriaByType.get("collaboration") ?? null;
  const professionalismCriteria = input.criteriaByType.get("professionalism") ?? null;
  const velocityCriteria = input.criteriaByType.get("velocity") ?? null;

  const productivity = calculateProductivityMetrics({
    plannedStoryPoints: toFiniteNumber(input.memberScore.planned_story_points),
    completedStoryPoints: toFiniteNumber(input.memberScore.completed_story_points),
    weightedStoryPoints: toFiniteNumber(input.memberScore.weighted_story_points),
    completionRateOverride: input.memberScore.completion_rate_override,
    severityRateOverride: input.memberScore.severity_rate_override,
    accumulatedHours: toFiniteNumber(input.memberScore.accumulated_hours),
    efficiencyMinHours: toFiniteNumber(efficiencyCriteria?.min, 80),
  });

  const efficiency = calculateEfficiencyMetrics({
    accumulatedHours: toFiniteNumber(input.memberScore.accumulated_hours),
    efficiencyMin: toFiniteNumber(efficiencyCriteria?.min, 80),
    efficiencyMax: toFiniteNumber(
      efficiencyCriteria?.max,
      toFiniteNumber(efficiencyCriteria?.min, 80),
    ),
    productivityScore: productivity.productivityScore,
    assignedStoryPoints: productivity.assignedStoryPoints,
  });

  const quality = calculateQualityMetrics({
    completedTasksCount: toFiniteNumber(input.memberScore.completed_tasks_count),
    qualityMax: toFiniteNumber(qualityCriteria?.max, 0),
    totalRejectCount: toFiniteNumber(input.memberScore.total_reject_count),
  });

  const collaborationScore = roundScore(
    clamp(toFiniteNumber(input.memberScore.collaboration), 0, 100),
  );

  const memberProfessionalismScores = input.professionalismScores.filter(
    (row) =>
      row.member_id === input.member.id && row.sprint_id === input.sprint.id,
  );
  const professionalism = calculateProfessionalismMetrics({
    itemValues: memberProfessionalismScores.map(
      (row) => input.professionalismItemsById.get(row.item_id)?.value ?? 0,
    ),
    itemScores: memberProfessionalismScores.map((row) => toFiniteNumber(row.score)),
  });

  // If the member has no professionalism score rows yet but criteria exists,
  // expected total falls back to 0 and rate stays neutral (100) so weight is not punished.
  const criteriaRows: MemberSprintCriteriaScoreInsert[] = [];

  if (productivityCriteria) {
    criteriaRows.push({
      member_id: input.member.id,
      sprint_id: input.sprint.id,
      criteria_id: productivityCriteria.id,
      score: productivity.productivityScore,
      overall_score: productivity.assignedStoryPoints,
      rate: productivity.productivityRate,
      weight_rate: buildWeightRate(
        productivity.productivityRate,
        productivityCriteria.weight,
      ),
    });
  }

  if (efficiencyCriteria) {
    criteriaRows.push({
      member_id: input.member.id,
      sprint_id: input.sprint.id,
      criteria_id: efficiencyCriteria.id,
      score: efficiency.efficiencyRate,
      overall_score: efficiency.rawEfficiencyRate,
      rate: efficiency.efficiencyRate,
      weight_rate: buildWeightRate(efficiency.efficiencyRate, efficiencyCriteria.weight),
    });
  }

  if (qualityCriteria) {
    criteriaRows.push({
      member_id: input.member.id,
      sprint_id: input.sprint.id,
      criteria_id: qualityCriteria.id,
      score: quality.qualityScore,
      overall_score: quality.qualityExpectedTotal,
      rate: quality.qualityRate,
      weight_rate: buildWeightRate(quality.qualityRate, qualityCriteria.weight),
    });
  }

  if (collaborationCriteria) {
    criteriaRows.push({
      member_id: input.member.id,
      sprint_id: input.sprint.id,
      criteria_id: collaborationCriteria.id,
      score: collaborationScore,
      overall_score: collaborationScore,
      rate: collaborationScore,
      weight_rate: buildWeightRate(collaborationScore, collaborationCriteria.weight),
    });
  }

  // Only score professionalism when checklist rows exist for this member/sprint.
  // Missing checklist data should not invent a perfect or zero-weight penalty.
  if (professionalismCriteria && memberProfessionalismScores.length > 0) {
    criteriaRows.push({
      member_id: input.member.id,
      sprint_id: input.sprint.id,
      criteria_id: professionalismCriteria.id,
      score: professionalism.professionalismScore,
      overall_score: professionalism.professionalismExpectedTotal,
      rate: professionalism.professionalismRate,
      weight_rate: buildWeightRate(
        professionalism.professionalismRate,
        professionalismCriteria.weight,
      ),
    });
  }

  const hoursAccumulated = Math.max(toFiniteNumber(input.memberScore.accumulated_hours), 0);

  if (velocityCriteria) {
    const velocity = calculateVelocityMetrics({
      completedStoryPoints: productivity.completedStoryPoints,
      assignedStoryPoints: productivity.assignedStoryPoints,
    });

    criteriaRows.push({
      member_id: input.member.id,
      sprint_id: input.sprint.id,
      criteria_id: velocityCriteria.id,
      score: velocity.velocityRate,
      overall_score: productivity.completedStoryPoints,
      rate: velocity.velocityRate,
      weight_rate: buildWeightRate(velocity.velocityRate, velocityCriteria.weight),
    });
  }

  const averageScore = roundScore(
    criteriaRows.reduce((sum, row) => sum + row.weight_rate, 0),
  );
  const negativeAccumulatedRate =
    efficiency.productivityExcessNegativeRate > efficiency.timeExcessNegativeRate
      ? efficiency.productivityExcessNegativeRate
      : efficiency.timeExcessNegativeRate;

  const performanceRow: MembersPerformanceScoreInsert = {
    member_id: input.member.id,
    sprint_id: input.sprint.id,
    average_score: averageScore,
    tasks_count: Math.round(toFiniteNumber(input.memberScore.completed_tasks_count)),
    assigned_story_points: Math.round(productivity.assignedStoryPoints),
    total_story_points: Math.round(productivity.completedStoryPoints),
    modified_story_points: productivity.productivityScore,
    hours_accumulated: hoursAccumulated,
    extra_points: productivity.extraPoints,
    negative_accumulated_rate: roundScore(negativeAccumulatedRate),
    velocity_by_hour: roundScore(
      safeDivide(productivity.completedStoryPoints, hoursAccumulated, 0),
    ),
    score_grade: resolvePerformanceScoreGrade(averageScore, input.passingThreshold),
    actual_story_points: productivity.completedStoryPoints,
  };

  return { criteriaRows, performanceRow };
}

/**
 * Rebuilds member_sprint_criteria_scores and members_performance_scores
 * for every sprint in the selected year.
 */
export async function evaluateMemberPerformanceForYear(
  yearInput: number | string,
): Promise<EvaluateYearResult> {
  const year = Number(yearInput);
  if (!Number.isFinite(year) || year <= 0) {
    throw new Error("Please select a valid year to evaluate.");
  }

  const sprints = await loadYearSprints(year);
  if (sprints.length === 0) {
    throw new Error(`No sprints found for year ${year}.`);
  }

  const sprintIds = sprints.map((sprint) => sprint.id);

  // Rebuild from a clean slate for the selected year.
  await deleteCriteriaScoresForSprints(sprintIds);
  await deletePerformanceScoresForSprints(sprintIds);

  const gradingSetIds = Array.from(
    new Set(
      sprints
        .map((sprint) => sprint.grading_set_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const criteriaSetIds = Array.from(
    new Set(
      sprints
        .map((sprint) => sprint.criteria_set_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const [
    passingScores,
    criteriaSetLinks,
    allCriteria,
    memberScores,
    members,
    professionalismScores,
    professionalismItems,
  ] = await Promise.all([
    gradingSetIds.length > 0
      ? supabase
          .from("passing_scores")
          .select("grading_set_id,level,value")
          .in("grading_set_id", gradingSetIds)
          .then(({ data, error }) => {
            if (error) throw error;
            return (data ?? []) as PassingScoreRow[];
          })
      : Promise.resolve([] as PassingScoreRow[]),
    criteriaSetIds.length > 0
      ? supabase
          .from("criteria_set_criteria")
          .select("set_id,criteria_id")
          .in("set_id", criteriaSetIds)
          .then(({ data, error }) => {
            if (error) throw error;
            return (data ?? []) as CriteriaSetLinkRow[];
          })
      : Promise.resolve([] as CriteriaSetLinkRow[]),
    getSupabaseRows<CriteriaRow>("criteria", {
      select: "id,level,name,code,min,max,value,weight,type,sort_number",
    }),
    supabase
      .from("members_sprint_scores")
      .select(
        "member_id,sprint_id,planned_story_points,completed_story_points,weighted_story_points,accumulated_hours,collaboration,completed_tasks_count,total_reject_count,completion_rate_override,severity_rate_override",
      )
      .in("sprint_id", sprintIds)
      .then(({ data, error }) => {
        if (error) throw error;
        return (data ?? []) as MemberSprintScoreRow[];
      }),
    getSupabaseRows<EvaluateMemberRow>("members", {
      select: "id,level",
    }),
    supabase
      .from("member_sprint_professionalism_scores")
      .select("member_id,sprint_id,item_id,score")
      .in("sprint_id", sprintIds)
      .then(({ data, error }) => {
        if (error) throw error;
        return (data ?? []) as ProfessionalismScoreRow[];
      }),
    getSupabaseRows<ProfessionalismItemRow>("professionalism_items", {
      select: "id,value",
    }),
  ]);

  const criteriaById = new Map(allCriteria.map((row) => [row.id, row]));
  const membersById = new Map(members.map((row) => [row.id, row]));
  const professionalismItemsById = new Map(
    professionalismItems.map((row) => [row.id, row]),
  );
  const passingByGradingSet = new Map<string, Map<string, number>>();
  for (const row of passingScores) {
    const byLevel = passingByGradingSet.get(row.grading_set_id) ?? new Map();
    byLevel.set(row.level, toFiniteNumber(row.value, 75));
    passingByGradingSet.set(row.grading_set_id, byLevel);
  }

  const criteriaIdsBySetId = new Map<string, string[]>();
  for (const link of criteriaSetLinks) {
    const list = criteriaIdsBySetId.get(link.set_id) ?? [];
    list.push(link.criteria_id);
    criteriaIdsBySetId.set(link.set_id, list);
  }

  const memberScoresBySprint = new Map<string, MemberSprintScoreRow[]>();
  for (const row of memberScores) {
    const list = memberScoresBySprint.get(row.sprint_id) ?? [];
    list.push(row);
    memberScoresBySprint.set(row.sprint_id, list);
  }

  const criteriaInsertRows: MemberSprintCriteriaScoreInsert[] = [];
  const performanceInsertRows: MembersPerformanceScoreInsert[] = [];
  const skippedSprints: EvaluateYearResult["skippedSprints"] = [];
  const skippedMembers: EvaluateYearResult["skippedMembers"] = [];
  let membersProcessed = 0;

  for (const sprint of sprints) {
    if (!sprint.grading_set_id) {
      skippedSprints.push({
        sprintId: sprint.id,
        reason: `Sprint "${sprint.name ?? sprint.id}" has no grading_set_id.`,
      });
      continue;
    }

    if (!sprint.criteria_set_id) {
      skippedSprints.push({
        sprintId: sprint.id,
        reason: `Sprint "${sprint.name ?? sprint.id}" has no criteria_set_id.`,
      });
      continue;
    }

    const linkedCriteriaIds = criteriaIdsBySetId.get(sprint.criteria_set_id) ?? [];
    const sprintCriteria = linkedCriteriaIds
      .map((criteriaId) => criteriaById.get(criteriaId))
      .filter((row): row is CriteriaRow => Boolean(row));

    if (sprintCriteria.length === 0) {
      skippedSprints.push({
        sprintId: sprint.id,
        reason: `Sprint "${sprint.name ?? sprint.id}" criteria set has no linked criteria.`,
      });
      continue;
    }

    const sprintMemberScores = memberScoresBySprint.get(sprint.id) ?? [];
    if (sprintMemberScores.length === 0) {
      skippedSprints.push({
        sprintId: sprint.id,
        reason: `Sprint "${sprint.name ?? sprint.id}" has no members_sprint_scores rows.`,
      });
      continue;
    }

    const passingByLevel = passingByGradingSet.get(sprint.grading_set_id) ?? new Map();

    for (const memberScore of sprintMemberScores) {
      const member = membersById.get(memberScore.member_id);
      if (!member) {
        skippedMembers.push({
          sprintId: sprint.id,
          memberId: memberScore.member_id,
          reason: "Member not found.",
        });
        continue;
      }

      const memberLevel = normalizeMemberLevel(member.level);
      if (!memberLevel) {
        skippedMembers.push({
          sprintId: sprint.id,
          memberId: member.id,
          reason: `Member level "${member.level ?? "null"}" is missing or unsupported.`,
        });
        continue;
      }

      const criteriaByType = new Map<CriteriaType, CriteriaRow>();
      for (const type of CRITERIA_TYPES) {
        const criteria = pickCriteriaForMemberLevel(sprintCriteria, memberLevel, type);
        if (criteria) {
          criteriaByType.set(type, criteria);
        }
      }

      if (criteriaByType.size === 0) {
        skippedMembers.push({
          sprintId: sprint.id,
          memberId: member.id,
          reason: `No criteria matched member level "${memberLevel}" for this sprint.`,
        });
        continue;
      }

      const passingThreshold =
        passingByLevel.get(memberLevel) ??
        passingByLevel.get("all") ??
        75;

      try {
        const evaluated = evaluateMemberForSprint({
          sprint,
          member,
          memberScore,
          criteriaByType,
          passingThreshold,
          professionalismItemsById,
          professionalismScores,
        });
        criteriaInsertRows.push(...evaluated.criteriaRows);
        performanceInsertRows.push(evaluated.performanceRow);
        membersProcessed += 1;
      } catch (error) {
        skippedMembers.push({
          sprintId: sprint.id,
          memberId: member.id,
          reason:
            error instanceof Error ? error.message : "Unable to evaluate member.",
        });
      }
    }
  }

  const [criteriaRowsUpserted, performanceRowsUpserted] = await Promise.all([
    upsertCriteriaScoreRows(criteriaInsertRows),
    upsertPerformanceScoreRows(performanceInsertRows),
  ]);

  return {
    year,
    sprintsProcessed: sprints.length - skippedSprints.length,
    membersProcessed,
    criteriaRowsUpserted,
    performanceRowsUpserted,
    skippedSprints,
    skippedMembers,
  };
}
