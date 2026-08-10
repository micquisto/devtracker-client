import type { PerformanceScoreGrade } from "@/lib/utils/scrum/evaluateMemberPerformance.utils";
import type { SkillRadarKey, SkillRadarValues } from "@/lib/utils/scrum/statisticsRadar.utils";

export type AccountabilitiesSummaryMetric = {
  key: SkillRadarKey;
  label: string;
  current: number | null;
  previous: number | null;
  changeDirection: "up" | "down" | "flat" | "none";
  changeDelta: number | null;
  comments: string[];
};

export type AccountabilitiesSummaryProject = {
  name: string;
  comments: string[];
};

export type AccountabilitiesSummaryRankingEntry = {
  rank: number;
  name: string;
  grade: PerformanceScoreGrade | null;
  scorePoints: number | null;
};

export type AccountabilitiesSummarySnapshot = {
  periodLabel: string | null;
  overallScore: {
    current: number | null;
    previous: number | null;
    changeDirection: "up" | "down" | "flat" | "none";
    changeDelta: number | null;
  };
  teamGrade: string;
  outputTotals: {
    storyPoints: string;
    tasks: string;
    hours: string;
  };
  skillRadar: SkillRadarValues;
  metrics: AccountabilitiesSummaryMetric[];
  projects: AccountabilitiesSummaryProject[];
  challenges: string[];
  plans: string[];
  teamGoals: string[];
  notableHighlights: string[];
  ranking: AccountabilitiesSummaryRankingEntry[];
};

export type AccountabilitiesSummaryResult = {
  summary: string;
  source: "ai" | "local";
};

function formatScore(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "n/a";
  }

  return `${value.toFixed(2)}%`;
}

function formatDelta(delta: number | null): string {
  if (delta === null || !Number.isFinite(delta)) {
    return "";
  }

  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(2)}%`;
}

function bulletList(items: string[], emptyLabel: string): string {
  if (items.length === 0) {
    return emptyLabel;
  }

  return items.map((item) => `- ${item}`).join("\n");
}

export function buildLocalAccountabilitiesSummary(
  snapshot: AccountabilitiesSummarySnapshot,
): string {
  const period = snapshot.periodLabel ?? "the selected period";
  const overallDelta = formatDelta(snapshot.overallScore.changeDelta);
  const overallTrend =
    snapshot.overallScore.changeDirection === "up"
      ? `improved${overallDelta ? ` (${overallDelta})` : ""} versus the prior month`
      : snapshot.overallScore.changeDirection === "down"
        ? `declined${overallDelta ? ` (${overallDelta})` : ""} versus the prior month`
        : snapshot.overallScore.changeDirection === "flat"
          ? "held steady versus the prior month"
          : "does not have a prior-month comparison";

  const metricHighlights = snapshot.metrics
    .filter((metric) => metric.current !== null)
    .sort((left, right) => (right.current ?? 0) - (left.current ?? 0))
    .slice(0, 3)
    .map((metric) => {
      const delta = formatDelta(metric.changeDelta);
      const trend =
        metric.changeDirection === "up"
          ? "up"
          : metric.changeDirection === "down"
            ? "down"
            : metric.changeDirection === "flat"
              ? "flat"
              : "unchanged";
      return `${metric.label} at ${formatScore(metric.current)} (${trend}${delta ? ` ${delta}` : ""})`;
    });

  const topRanked = snapshot.ranking.slice(0, 3).map((entry) => {
    const grade = entry.grade ?? "—";
    const score =
      entry.scorePoints === null || !Number.isFinite(entry.scorePoints)
        ? "n/a"
        : entry.scorePoints.toFixed(2);
    return `#${entry.rank} ${entry.name} (grade ${grade}, ${score} pts)`;
  });

  const commentCount = snapshot.metrics.reduce(
    (sum, metric) => sum + metric.comments.length,
    0,
  );

  const paragraphs = [
    `AI Summary for ${period}: team grade is ${snapshot.teamGrade} with an overall score of ${formatScore(snapshot.overallScore.current)}. Performance ${overallTrend}. Output for the period is ${snapshot.outputTotals.storyPoints} story points, ${snapshot.outputTotals.tasks} tasks, and ${snapshot.outputTotals.hours} hours.`,
    metricHighlights.length > 0
      ? `Strongest skill signals this period: ${metricHighlights.join("; ")}. Across metrics there are ${commentCount} accountability notes capturing context behind the numbers.`
      : `Skill metric values are limited for this period, so the summary leans on qualitative notes and ranking instead.`,
    snapshot.projects.length > 0
      ? `Ongoing projects (${snapshot.projects.length}): ${snapshot.projects
          .map((project) => {
            const updateCount = project.comments.length;
            return `${project.name}${updateCount > 0 ? ` — ${updateCount} update${updateCount === 1 ? "" : "s"}` : ""}`;
          })
          .join("; ")}.`
      : `No ongoing project updates were recorded for this period.`,
    [
      `Challenges:\n${bulletList(snapshot.challenges, "- None recorded.")}`,
      `Plans and next steps:\n${bulletList(snapshot.plans, "- None recorded.")}`,
      `Team goals:\n${bulletList(snapshot.teamGoals, "- None recorded.")}`,
      `Notable highlights:\n${bulletList(snapshot.notableHighlights, "- None recorded.")}`,
    ].join("\n\n"),
    topRanked.length > 0
      ? `Team stack ranking leaders: ${topRanked.join("; ")}. Use this ranking with the qualitative notes above to coach both top performers and members needing support.`
      : `Team stack ranking is unavailable for this period.`,
  ];

  return paragraphs.filter(Boolean).join("\n\n");
}

export function buildAccountabilitiesSummaryPrompt(
  snapshot: AccountabilitiesSummarySnapshot,
): string {
  return [
    "You are an engineering manager writing a concise executive accountability summary.",
    "Write 3-5 short paragraphs in plain language for leadership.",
    "Cover performance trend, skill strengths/risks, project status, challenges/plans/goals/highlights, and ranking implications.",
    "Do not invent facts. If a section is empty, say so briefly.",
    "Avoid markdown headings and bullet symbols unless listing challenges/plans/goals/highlights.",
    "",
    "DATA:",
    JSON.stringify(snapshot, null, 2),
  ].join("\n");
}
