import { SPRINT_BOARD_ASSIGNEE_CONTRIBUTIONS } from "@/data/SprintBoard.data";
import { SPRINT_DATES } from "@/data/Sprints.data";

const BREAKDOWN_WEIGHTS = [
  0.08,
  0.06,
  0.07,
  0.12,
  0.24,
  0.18,
  0.14,
  0.07,
  0.04,
];

type StoryPointValuesRow = {
  values: number[];
};

export type BreakdownRow = {
  label: string;
  values: number[];
  highlighted?: boolean;
  isTotal?: boolean;
};

export const getHistoricalStoryPoints = (base: number, assigneeIndex: number) =>
  SPRINT_DATES.map((_, sprintIndex) => {
    if (sprintIndex === 0) return base;

    const adjustment = ((assigneeIndex * 3 + sprintIndex * 2) % 7) - 3;
    const cadence = sprintIndex % 5 === 0 ? 2 : sprintIndex % 4 === 0 ? -2 : 0;

    return Math.max(0, base + adjustment + cadence);
  });

export const averageSprintColumns = (sprintColumnValues: number[]) =>
  sprintColumnValues.length > 0
    ? sprintColumnValues.reduce((sum, value) => sum + value, 0) /
      sprintColumnValues.length
    : 0;

export const distributeStoryPoints = (total: number) => {
  const rawValues = BREAKDOWN_WEIGHTS.map((weight) => total * weight);
  const values = rawValues.map(Math.floor);
  let remainder = total - values.reduce((sum, value) => sum + value, 0);

  rawValues
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction)
    .forEach(({ index }) => {
      if (remainder <= 0) return;
      values[index] += 1;
      remainder -= 1;
    });

  return values;
};

export const getBreakdownRowValues = (
  sprintBreakdownValues: number[][],
  rowIndex: number,
) => sprintBreakdownValues.map((values) => values[rowIndex]);

export const sumRows = (rows: StoryPointValuesRow[]) =>
  SPRINT_DATES.map((_, sprintIndex) =>
    rows.reduce((sum, row) => sum + row.values[sprintIndex], 0),
  );

export const assigneeRows = SPRINT_BOARD_ASSIGNEE_CONTRIBUTIONS.map(
  (assignee, index) => {
    const values = getHistoricalStoryPoints(assignee.storyPoints, index);

    return {
      ...assignee,
      values,
      average: averageSprintColumns(values),
    };
  },
);

export const sprintTotals = SPRINT_DATES.map((_, sprintIndex) =>
  assigneeRows.reduce((sum, assignee) => sum + assignee.values[sprintIndex], 0),
);

export const totalAverage = averageSprintColumns(sprintTotals);

export const sprintBreakdownValues = sprintTotals.map(distributeStoryPoints);

export const breakdownBaseRows: BreakdownRow[] = [
  {
    label: "Code Review",
    values: getBreakdownRowValues(sprintBreakdownValues, 0),
  },
  {
    label: "Research and Documentation",
    values: getBreakdownRowValues(sprintBreakdownValues, 1),
  },
  {
    label: "Architecture",
    values: getBreakdownRowValues(sprintBreakdownValues, 2),
  },
  {
    label: "Bugs",
    values: getBreakdownRowValues(sprintBreakdownValues, 3),
    highlighted: true,
  },
  {
    label: "Business Logic / Back-end Pstock",
    values: getBreakdownRowValues(sprintBreakdownValues, 4),
  },
  {
    label: "Business Logic / Back-end - Marketplaces (Amazon, Shopify)",
    values: getBreakdownRowValues(sprintBreakdownValues, 5),
  },
  {
    label: "Plumbersstock & SW Plumbing (SEO, images & bugs)",
    values: getBreakdownRowValues(sprintBreakdownValues, 6),
  },
  {
    label: "Marketplace Frontend",
    values: getBreakdownRowValues(sprintBreakdownValues, 7),
  },
  {
    label: "Go Green",
    values: getBreakdownRowValues(sprintBreakdownValues, 8),
  },
];

export const adminBugRows = breakdownBaseRows.slice(0, 3);
export const featureRows = breakdownBaseRows.slice(4, 9);

export const adminBugTotalRow: BreakdownRow = {
  label: "Admin/Bugs Tot",
  values: sumRows(adminBugRows),
  highlighted: true,
};

export const featureTotalRow: BreakdownRow = {
  label: "Feature Tot",
  values: sumRows(featureRows),
  highlighted: true,
};

export const spBreakdownRows: (BreakdownRow & { average: number })[] = [
  ...adminBugRows,
  adminBugTotalRow,
  breakdownBaseRows[3],
  ...featureRows,
  featureTotalRow,
  {
    label: "Total",
    values: SPRINT_DATES.map(
      (_, sprintIndex) =>
        adminBugTotalRow.values[sprintIndex] +
        breakdownBaseRows[3].values[sprintIndex] +
        featureTotalRow.values[sprintIndex],
    ),
    highlighted: true,
    isTotal: true,
  },
].map((row) => ({
  ...row,
  average: averageSprintColumns(row.values),
}));
