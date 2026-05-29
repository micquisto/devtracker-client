import type { SprintMeta, FilterState } from "@/interfaces";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const QUARTERS = ["1st Quarter", "2nd Quarter", "3rd Quarter", "4th Quarter"];

export function generateSprints(year: number): SprintMeta[] {
  const sprints: SprintMeta[] = [];
  let start = new Date(year, 0, 8);
  let num = 1;
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  while (start.getFullYear() === year && num <= 27) {
    const end = new Date(start);
    end.setDate(end.getDate() + 13);
    sprints.push({
      id: `${year}-S${num}`,
      label: `Sprint ${num} (${fmt(start)} \u2013 ${fmt(end)})`,
      shortLabel: `S${num}`,
      start: new Date(start),
      end: new Date(end),
      monthIdx: start.getMonth(),
    });
    start = new Date(end);
    start.setDate(start.getDate() + 1);
    num++;
  }
  return sprints;
}

export function getFilterLabel(f: FilterState): string {
  switch (f.mode) {
    case "current":
      return "Current Sprint";
    case "year":
      return f.year ? String(f.year) : "By Year";
    case "month":
      return f.month !== undefined ? MONTHS[f.month] : "By Month";
    case "quarter":
      if (f.quarter !== undefined && f.quarterYear !== undefined)
        return `${QUARTERS[f.quarter - 1]} · ${f.quarterYear}`;
      if (f.quarterYear !== undefined) return `Year ${f.quarterYear}`;
      return "By Quarter";
    case "sprint":
      if (
        f.sprintNum !== undefined &&
        f.sprintQuarter !== undefined &&
        f.sprintYear !== undefined
      ) {
        const global = (f.sprintQuarter - 1) * 7 + f.sprintNum;
        return `Sprint ${global} · ${f.sprintYear}`;
      }
      if (f.sprintQuarter !== undefined && f.sprintYear !== undefined)
        return `${QUARTERS[f.sprintQuarter - 1]} · ${f.sprintYear}`;
      if (f.sprintYear !== undefined) return `Year ${f.sprintYear}`;
      return "By Sprint";
    default:
      return "Filter";
  }
}