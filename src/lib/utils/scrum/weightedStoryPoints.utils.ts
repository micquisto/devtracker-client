import { getSupabaseRows } from "@/lib/supabase";

export const WEIGHTED_STORY_POINTS_CUTOFF_SPRINT_ID =
  "2589f9a4-4c73-4500-aabe-7d460a20378d";

type SprintWeightedStoryPointsRef = {
  id: string;
  start_date: string;
};

let cachedCutoffStartDate: string | null | undefined;

export async function getWeightedStoryPointsCutoffStartDate(): Promise<string | null> {
  if (cachedCutoffStartDate !== undefined) {
    return cachedCutoffStartDate;
  }

  const [cutoffSprint] = await getSupabaseRows<{ start_date: string }>("sprints", {
    select: "start_date",
    eq: { id: WEIGHTED_STORY_POINTS_CUTOFF_SPRINT_ID },
  });

  cachedCutoffStartDate = cutoffSprint?.start_date ?? null;
  return cachedCutoffStartDate;
}

export function isWeightedStoryPointsEnabledForSprint(
  sprint: SprintWeightedStoryPointsRef,
  cutoffStartDate: string | null,
): boolean {
  if (sprint.id === WEIGHTED_STORY_POINTS_CUTOFF_SPRINT_ID) {
    return true;
  }

  if (!cutoffStartDate) {
    return false;
  }

  return sprint.start_date >= cutoffStartDate;
}

export function resolveWeightedStoryPointsForSprint(
  sprint: SprintWeightedStoryPointsRef,
  cutoffStartDate: string | null,
  weightedValue: number,
): number {
  return isWeightedStoryPointsEnabledForSprint(sprint, cutoffStartDate)
    ? weightedValue
    : 0;
}
