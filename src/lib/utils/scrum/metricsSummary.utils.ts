import type { PerformanceScoreGrade } from "@/lib/utils/scrum/evaluateMemberPerformance.utils";
import type { SkillRadarValues } from "@/lib/utils/scrum/statisticsRadar.utils";

export type MetricsSummarySnapshot = {
  periodLabel: string | null;
  dateRangeLabel: string | null;
  subjectLabel: string;
  showMode: "year" | "quarter" | "month" | "sprint";
  scorePoints: string;
  storyPoints: string;
  grade: string;
  skillRadar: SkillRadarValues;
  contribution: Array<{
    name: string;
    storyPoints: number;
    contribution: number;
  }>;
  ranking: Array<{
    sectionLabel: string | null;
    entries: Array<{
      rank: number;
      name: string;
      grade: PerformanceScoreGrade | null;
      scorePoints: number | null;
    }>;
  }>;
  performanceStats: Array<{
    label: string;
    value: number;
    max: number;
    unit: string;
  }>;
};

export function getMetricsSummarySnapshotKey(
  snapshot: MetricsSummarySnapshot,
): string {
  return JSON.stringify(snapshot);
}

export function buildLocalMetricsSummary(snapshot: MetricsSummarySnapshot): string {
  const period = snapshot.periodLabel ?? "the selected Metrics period";
  const dateRange = snapshot.dateRangeLabel
    ? ` (${snapshot.dateRangeLabel})`
    : "";
  const topContribution = [...snapshot.contribution]
    .sort((left, right) => right.contribution - left.contribution)
    .slice(0, 3)
    .map(
      (entry) =>
        `${entry.name} (${entry.contribution.toFixed(1)}%, ${entry.storyPoints.toFixed(1)} SP)`,
    );
  const rankingLeaders = snapshot.ranking
    .flatMap((section) =>
      section.entries.slice(0, 3).map((entry) => {
        const sectionPrefix = section.sectionLabel
          ? `${section.sectionLabel}: `
          : "";
        const grade = entry.grade ?? "—";
        const score =
          entry.scorePoints === null || !Number.isFinite(entry.scorePoints)
            ? "n/a"
            : entry.scorePoints.toFixed(2);
        return `${sectionPrefix}#${entry.rank} ${entry.name} (grade ${grade}, ${score} pts)`;
      }),
    )
    .slice(0, 5);

  const radarHighlights = Object.entries(snapshot.skillRadar)
    .map(([key, value]) => ({ key, value }))
    .filter((entry) => Number.isFinite(entry.value))
    .sort((left, right) => right.value - left.value)
    .slice(0, 3)
    .map((entry) => `${entry.key} ${entry.value.toFixed(1)}%`);

  const statsLine =
    snapshot.performanceStats.length > 0
      ? snapshot.performanceStats
          .map(
            (stat) =>
              `${stat.label}: ${stat.value}${stat.unit}${
                stat.max > 0 ? ` / ${stat.max}${stat.unit}` : ""
              }`,
          )
          .join("; ")
      : "No additional performance bars available.";

  return [
    `AI Summary for ${period}${dateRange}, focused on ${snapshot.subjectLabel}. Score points are ${snapshot.scorePoints}, story points are ${snapshot.storyPoints}, and grade is ${snapshot.grade}. View mode: ${snapshot.showMode}.`,
    radarHighlights.length > 0
      ? `Skill radar highlights: ${radarHighlights.join("; ")}.`
      : `Skill radar data is limited for this selection.`,
    topContribution.length > 0
      ? `Top contribution share: ${topContribution.join("; ")}.`
      : `Contribution breakdown is unavailable for this selection.`,
    `Supporting bars — ${statsLine}`,
    rankingLeaders.length > 0
      ? `Leaderboard signals: ${rankingLeaders.join("; ")}.`
      : `No leaderboard entries are available for this selection.`,
  ].join("\n\n");
}

export function buildMetricsSummaryPrompt(snapshot: MetricsSummarySnapshot): string {
  return [
    "You are an engineering manager writing a concise Metrics page executive summary.",
    "Write 3-5 short paragraphs for leadership in plain language.",
    "Cover period/context, score/grade/output, skill radar strengths and risks, contribution leaders, and ranking implications.",
    "Do not invent facts. If a section is empty, say so briefly.",
    "Avoid markdown headings.",
    "",
    "DATA:",
    JSON.stringify(snapshot, null, 2),
  ].join("\n");
}
