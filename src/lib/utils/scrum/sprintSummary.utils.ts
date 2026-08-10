export type SprintSummarySnapshot = {
  sprintName: string | null;
  sprintStatus: string | null;
  periodLabel: string | null;
  memberFilterLabel: string;
  taskCount: number;
  plannedPoints: number | null;
  completedPoints: number | null;
  memberScores: Array<{
    name: string;
    plannedStoryPoints: number | null;
    completedStoryPoints: number | null;
    completedTasks: number | null;
    averageScore: number | null;
  }>;
};

export function getSprintSummarySnapshotKey(
  snapshot: SprintSummarySnapshot,
): string {
  return JSON.stringify(snapshot);
}

export function buildLocalSprintSummary(snapshot: SprintSummarySnapshot): string {
  const sprint = snapshot.sprintName ?? "the selected sprint";
  const period = snapshot.periodLabel ? ` (${snapshot.periodLabel})` : "";
  const planned =
    snapshot.plannedPoints === null || !Number.isFinite(snapshot.plannedPoints)
      ? "n/a"
      : String(snapshot.plannedPoints);
  const completed =
    snapshot.completedPoints === null ||
    !Number.isFinite(snapshot.completedPoints)
      ? "n/a"
      : String(snapshot.completedPoints);
  const completion =
    snapshot.plannedPoints &&
    snapshot.plannedPoints > 0 &&
    snapshot.completedPoints !== null
      ? `${Math.round((snapshot.completedPoints / snapshot.plannedPoints) * 100)}%`
      : "n/a";

  const topCompleters = [...snapshot.memberScores]
    .filter((entry) => entry.completedStoryPoints !== null)
    .sort(
      (left, right) =>
        (right.completedStoryPoints ?? 0) - (left.completedStoryPoints ?? 0),
    )
    .slice(0, 3)
    .map((entry) => {
      const score =
        entry.averageScore === null || !Number.isFinite(entry.averageScore)
          ? "n/a"
          : `${entry.averageScore.toFixed(2)}%`;
      return `${entry.name} (${entry.completedStoryPoints ?? 0} SP completed, score ${score})`;
    });

  return [
    `AI Summary for ${sprint}${period}. Status: ${snapshot.sprintStatus ?? "unknown"}. Viewing ${snapshot.memberFilterLabel}.`,
    `Board load is ${snapshot.taskCount} active-list tasks. Planned points ${planned}, completed points ${completed} (completion ${completion}).`,
    topCompleters.length > 0
      ? `Top delivery signals: ${topCompleters.join("; ")}.`
      : `Member delivery scores are limited for this sprint/filter.`,
    `Use the Kanban flow and scoreboard below this summary to validate blockers, adhoc load, and who needs coaching before sprint close.`,
  ].join("\n\n");
}

export function buildSprintSummaryPrompt(snapshot: SprintSummarySnapshot): string {
  return [
    "You are a scrum master writing a concise sprint status summary.",
    "Write 3-4 short paragraphs for the team lead in plain language.",
    "Cover sprint status, planned vs completed points, task load, and member delivery/score signals.",
    "Do not invent facts. If a section is empty, say so briefly.",
    "Avoid markdown headings.",
    "",
    "DATA:",
    JSON.stringify(snapshot, null, 2),
  ].join("\n");
}
