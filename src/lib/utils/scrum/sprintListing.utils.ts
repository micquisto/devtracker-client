import { Palette } from "@/lib/theme";

export type SprintListingLike = {
  id: string;
  name?: string | null;
  sprint_number?: number | null;
  sprint_year?: number | null;
  sprint_quarter?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: number | boolean | null;
};

export type SprintQuarterColorScheme = {
  quarter: number;
  color: string;
  background: string;
  border: string;
  text: string;
};

export const SPRINT_QUARTER_COLOR_SCHEMES: Record<number, SprintQuarterColorScheme> =
  {
    1: {
      quarter: 1,
      color: Palette.cyan,
      background: "rgba(0,200,255,0.12)",
      border: "rgba(0,200,255,0.42)",
      text: "#8be9ff",
    },
    2: {
      quarter: 2,
      color: Palette.green,
      background: "rgba(0,229,160,0.12)",
      border: "rgba(0,229,160,0.42)",
      text: "#86efac",
    },
    3: {
      quarter: 3,
      color: Palette.gold,
      background: "rgba(245,200,66,0.12)",
      border: "rgba(245,200,66,0.42)",
      text: "#fde68a",
    },
    4: {
      quarter: 4,
      color: Palette.purple,
      background: "rgba(167,139,250,0.12)",
      border: "rgba(167,139,250,0.42)",
      text: "#d8b4fe",
    },
  };

function parseSprintListingDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isFinite(date.getTime()) ? date : null;
}

function getQuarterFromDate(date: Date): number {
  return Math.floor(date.getUTCMonth() / 3) + 1;
}

export function parseSprintListingPeriodFromName(
  name: string | null | undefined,
): {
  year: number | null;
  quarter: number | null;
} {
  const value = name?.trim() ?? "";
  const yearFromName = value.match(/^(\d{4})\b/u)?.[1];
  const quarterFromName = value.match(/\bQ([1-4])\b/iu)?.[1];

  return {
    year: yearFromName ? Number(yearFromName) : null,
    quarter: quarterFromName ? Number(quarterFromName) : null,
  };
}

export function getSprintListingYear(sprint: SprintListingLike): number {
  if (sprint.sprint_year !== null && sprint.sprint_year !== undefined) {
    return Number(sprint.sprint_year);
  }

  const fromName = parseSprintListingPeriodFromName(sprint.name);
  if (fromName.year !== null) {
    return fromName.year;
  }

  const startDate = parseSprintListingDate(sprint.start_date);
  return startDate?.getUTCFullYear() ?? 0;
}

export function getSprintListingQuarter(sprint: SprintListingLike): number {
  if (sprint.sprint_quarter !== null && sprint.sprint_quarter !== undefined) {
    return Number(sprint.sprint_quarter);
  }

  const fromName = parseSprintListingPeriodFromName(sprint.name);
  if (fromName.quarter !== null) {
    return fromName.quarter;
  }

  const startDate = parseSprintListingDate(sprint.start_date);
  return startDate ? getQuarterFromDate(startDate) : 0;
}

const SPRINT_MONTH_SHORT_LABELS = [
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
] as const;

export function getSprintListingMonth(sprint: SprintListingLike): number | null {
  const sprintWithMonth = sprint as SprintListingLike & {
    sprint_month?: number | null;
    month?: number | null;
  };

  const explicitMonth = sprintWithMonth.sprint_month ?? sprintWithMonth.month;
  if (
    explicitMonth !== null &&
    explicitMonth !== undefined &&
    Number.isFinite(Number(explicitMonth))
  ) {
    const month = Number(explicitMonth);
    if (month >= 1 && month <= 12) {
      return month;
    }
  }

  const startDate = parseSprintListingDate(sprint.start_date);
  if (!startDate) {
    return null;
  }

  return startDate.getUTCMonth() + 1;
}

export function getSprintMonthShortLabel(month: number): string {
  return SPRINT_MONTH_SHORT_LABELS[month - 1] ?? `M${month}`;
}

export function getAvailableSprintYears(
  sprints: SprintListingLike[],
): number[] {
  return [
    ...new Set(
      sprints
        .map((sprint) => getSprintListingYear(sprint))
        .filter((year) => year > 0),
    ),
  ].sort((yearA, yearB) => yearB - yearA);
}

export function getAvailableSprintYearQuarters(
  sprints: SprintListingLike[],
): Array<{ value: string; year: number; quarter: number; label: string }> {
  const entries = new Map<
    string,
    { value: string; year: number; quarter: number; label: string }
  >();

  for (const sprint of sprints) {
    const year = getSprintListingYear(sprint);
    const quarter = getSprintListingQuarter(sprint);
    if (year <= 0 || quarter <= 0) {
      continue;
    }

    const value = `${year}-Q${quarter}`;
    if (!entries.has(value)) {
      entries.set(value, {
        value,
        year,
        quarter,
        label: `${year} Quarter ${quarter}`,
      });
    }
  }

  return Array.from(entries.values()).sort((entryA, entryB) => {
    if (entryB.year !== entryA.year) {
      return entryB.year - entryA.year;
    }

    return entryB.quarter - entryA.quarter;
  });
}

export function getAvailableSprintYearMonths(
  sprints: SprintListingLike[],
): Array<{ value: string; year: number; month: number; label: string }> {
  const entries = new Map<
    string,
    { value: string; year: number; month: number; label: string }
  >();

  for (const sprint of sprints) {
    const year = getSprintListingYear(sprint);
    const month = getSprintListingMonth(sprint);
    if (year <= 0 || month === null) {
      continue;
    }

    const value = `${year}-${month}`;
    if (!entries.has(value)) {
      entries.set(value, {
        value,
        year,
        month,
        label: `${year} ${getSprintMonthShortLabel(month)}`,
      });
    }
  }

  return Array.from(entries.values()).sort((entryA, entryB) => {
    if (entryB.year !== entryA.year) {
      return entryB.year - entryA.year;
    }

    return entryB.month - entryA.month;
  });
}

export function getSprintQuarterColorScheme(
  quarter: number,
): SprintQuarterColorScheme {
  return (
    SPRINT_QUARTER_COLOR_SCHEMES[quarter] ?? {
      quarter,
      color: Palette.indigo,
      background: "rgba(107,137,255,0.12)",
      border: "rgba(107,137,255,0.42)",
      text: "#c7d2fe",
    }
  );
}

export function getSprintQuarterGroupLabel(year: number, quarter: number): string {
  return `${year} Q${quarter}`;
}

export function getSprintListingSortTimestamp(sprint: SprintListingLike): number {
  const endDate = parseSprintListingDate(sprint.end_date);
  if (endDate) {
    return endDate.getTime();
  }

  const startDate = parseSprintListingDate(sprint.start_date);
  if (startDate) {
    return startDate.getTime();
  }

  return 0;
}

export type SprintYearQuarterGroup<T extends SprintListingLike> = {
  year: number;
  quarter: number;
  key: string;
  label: string;
  colorScheme: SprintQuarterColorScheme;
  sprints: T[];
};

export function groupSprintsByYearQuarter<T extends SprintListingLike>(
  sprints: T[],
): SprintYearQuarterGroup<T>[] {
  const groups = new Map<string, SprintYearQuarterGroup<T>>();

  for (const sprint of sprints) {
    const year = getSprintListingYear(sprint);
    const quarter = getSprintListingQuarter(sprint);
    const key = `${year}-Q${quarter}`;
    const existing = groups.get(key);

    if (existing) {
      existing.sprints.push(sprint);
      continue;
    }

    groups.set(key, {
      year,
      quarter,
      key,
      label: getSprintQuarterGroupLabel(year, quarter),
      colorScheme: getSprintQuarterColorScheme(quarter),
      sprints: [sprint],
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      sprints: [...group.sprints].sort(
        (sprintA, sprintB) =>
          getSprintListingSortTimestamp(sprintB) -
          getSprintListingSortTimestamp(sprintA),
      ),
    }))
    .sort((groupA, groupB) => {
      if (groupB.year !== groupA.year) {
        return groupB.year - groupA.year;
      }

      return groupB.quarter - groupA.quarter;
    });
}
