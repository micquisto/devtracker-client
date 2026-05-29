import type { SprintTask, TeamMember, ChartPoint, SprintMeta } from "@/interfaces";
import { Team } from "@/lib/theme";
import { generateSprints } from "@/lib/utils/dashboard.utils";

export const AVAILABLE_YEARS = [2023, 2024, 2025, 2026];
export const CURRENT_YEAR = 2026;
export const CURRENT_SPRINT_ID = "2025-S9";
export const MONTHS = [
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
export const CURRENT_MONTH = 4; // May (0-indexed)
export const SPRINTS_BY_YEAR: Record<number, SprintMeta[]> = {};
AVAILABLE_YEARS.forEach((y) => {
  SPRINTS_BY_YEAR[y] = generateSprints(y);
});

export const MONTH_PERF: Record<string, number[]> = {
  Jan: [
    62, 65, 60, 70, 58, 63, 67, 71, 66, 68, 72, 75, 70, 73, 69, 72, 75, 78, 74,
    76, 80, 77, 79, 82, 78, 80, 83, 80, 82, 85, 82,
  ],
  Feb: [
    70, 72, 68, 74, 71, 75, 73, 77, 74, 78, 76, 80, 78, 82, 80, 84, 82, 85, 83,
    86, 84, 87, 85, 88, 86, 89, 87, 90, 88,
  ],
  Mar: [
    75, 78, 76, 80, 78, 82, 80, 84, 82, 86, 84, 87, 85, 88, 83, 86, 84, 87, 82,
    85, 83, 80, 78, 76, 74, 72, 70, 68, 66, 64, 62,
  ],
  Apr: [
    60, 63, 65, 68, 70, 72, 74, 76, 78, 80, 79, 81, 83, 85, 84, 86, 88, 87, 89,
    91, 90, 92, 91, 93, 92, 94, 93, 95, 94, 96,
  ],
  May: [
    88, 90, 87, 91, 89, 93, 91, 88, 92, 90, 94, 92, 89, 93, 91, 95, 93, 97, 95,
    92, 96, 94, 91, 95, 93, 97, 95, 92, 96, 94, 97,
  ],
};

export const TEAM_MEMBERS: TeamMember[] = [
  { name: "John Doe", initials: "JD", color: Team.john, contribution: 27 },
  { name: "Sarah Kim", initials: "SK", color: Team.sarah, contribution: 23 },
  { name: "Alex Rivera", initials: "AR", color: Team.alex, contribution: 20 },
  { name: "Mia Chen", initials: "MC", color: Team.mia, contribution: 18 },
  { name: "Leo Santos", initials: "LS", color: Team.leo, contribution: 12 },
];

export const SPRINT_TASKS: SprintTask[] = [
  {
    id: "T-101",
    title: "Auth service token refresh",
    assignee: "JD",
    severity: "Critical",
    priority: "P0",
    status: "Done",
    points: 8,
  },
  {
    id: "T-102",
    title: "Dashboard line chart filter",
    assignee: "SK",
    severity: "High",
    priority: "P1",
    status: "In Progress",
    points: 5,
  },
  {
    id: "T-103",
    title: "Fix payment gateway timeout",
    assignee: "AR",
    severity: "Critical",
    priority: "P0",
    status: "Blocked",
    points: 13,
  },
  {
    id: "T-104",
    title: "Add unit tests for user module",
    assignee: "MC",
    severity: "Medium",
    priority: "P2",
    status: "Review",
    points: 3,
  },
  {
    id: "T-105",
    title: "Migrate legacy DB schema",
    assignee: "JD",
    severity: "High",
    priority: "P1",
    status: "In Progress",
    points: 8,
  },
  {
    id: "T-106",
    title: "API rate limiter implementation",
    assignee: "LS",
    severity: "High",
    priority: "P1",
    status: "Done",
    points: 5,
  },
  {
    id: "T-107",
    title: "Mobile nav burger menu",
    assignee: "SK",
    severity: "Medium",
    priority: "P2",
    status: "Done",
    points: 3,
  },
  {
    id: "T-108",
    title: "CI/CD pipeline optimisation",
    assignee: "AR",
    severity: "Low",
    priority: "P3",
    status: "Todo",
    points: 2,
  },
  {
    id: "T-109",
    title: "SSO integration with Google",
    assignee: "MC",
    severity: "High",
    priority: "P1",
    status: "In Progress",
    points: 8,
  },
  {
    id: "T-110",
    title: "Update design system tokens",
    assignee: "LS",
    severity: "Low",
    priority: "P3",
    status: "Todo",
    points: 1,
  },
  {
    id: "T-111",
    title: "Performance profiling report",
    assignee: "JD",
    severity: "Medium",
    priority: "P2",
    status: "Review",
    points: 3,
  },
  {
    id: "T-112",
    title: "E2E tests for checkout flow",
    assignee: "SK",
    severity: "High",
    priority: "P1",
    status: "Todo",
    points: 5,
  },
];

export const SPRINT_HISTORY = [
  {
    sprint: "Sprint 18",
    velocity: 38,
    completed: 9,
    total: 13,
    storyPointsDone: 38,
    hoursSpent: 156,
    performanceMetrics: {
      productivity: 76,
      efficiency: 72,
      quality: 82,
      collaboration: 78,
      velocity: 69,
    },
  },
  {
    sprint: "Sprint 19",
    velocity: 42,
    completed: 11,
    total: 14,
    storyPointsDone: 42,
    hoursSpent: 168,
    performanceMetrics: {
      productivity: 82,
      efficiency: 75,
      quality: 85,
      collaboration: 81,
      velocity: 76,
    },
  },
  {
    sprint: "Sprint 20",
    velocity: 35,
    completed: 8,
    total: 12,
    storyPointsDone: 35,
    hoursSpent: 150,
    performanceMetrics: {
      productivity: 70,
      efficiency: 68,
      quality: 79,
      collaboration: 74,
      velocity: 64,
    },
  },
  {
    sprint: "Sprint 21",
    velocity: 47,
    completed: 12,
    total: 14,
    storyPointsDone: 47,
    hoursSpent: 176,
    performanceMetrics: {
      productivity: 88,
      efficiency: 80,
      quality: 86,
      collaboration: 84,
      velocity: 85,
    },
  },
  {
    sprint: "Sprint 22 (Current)",
    velocity: 44,
    completed: 7,
    total: 12,
    storyPointsDone: 44,
    hoursSpent: 162,
    performanceMetrics: {
      productivity: 84,
      efficiency: 82,
      quality: 88,
      collaboration: 87,
      velocity: 80,
    },
  },
];

export const QUARTER_PERF: Record<string, ChartPoint[]> = {
  "Q1 2025": [
    {
      label: "Jan",
      value: Math.round(
        MONTH_PERF.Jan.reduce((a, v) => a + v, 0) / MONTH_PERF.Jan.length,
      ),
    },
    {
      label: "Feb",
      value: Math.round(
        MONTH_PERF.Feb.reduce((a, v) => a + v, 0) / MONTH_PERF.Feb.length,
      ),
    },
    {
      label: "Mar",
      value: Math.round(
        MONTH_PERF.Mar.reduce((a, v) => a + v, 0) / MONTH_PERF.Mar.length,
      ),
    },
  ],
  "Q2 2025": [
    {
      label: "Apr",
      value: Math.round(
        MONTH_PERF.Apr.reduce((a, v) => a + v, 0) / MONTH_PERF.Apr.length,
      ),
    },
    {
      label: "May",
      value: Math.round(
        MONTH_PERF.May.reduce((a, v) => a + v, 0) / MONTH_PERF.May.length,
      ),
    },
  ],
};

export const YEAR_PERF: Record<string, ChartPoint[]> = {
  "2025": MONTHS.slice(0, CURRENT_MONTH + 1).map((m) => ({
    label: m,
    value: Math.round(
      MONTH_PERF[m].reduce((a, v) => a + v, 0) / MONTH_PERF[m].length,
    ),
  })),
  "2024": [
    { label: "Jan", value: 58 },
    { label: "Feb", value: 62 },
    { label: "Mar", value: 60 },
    { label: "Apr", value: 65 },
    { label: "May", value: 63 },
    { label: "Jun", value: 68 },
    { label: "Jul", value: 71 },
    { label: "Aug", value: 74 },
    { label: "Sep", value: 72 },
    { label: "Oct", value: 76 },
    { label: "Nov", value: 78 },
    { label: "Dec", value: 80 },
  ],
  "2023": [
    { label: "Jan", value: 50 },
    { label: "Feb", value: 53 },
    { label: "Mar", value: 55 },
    { label: "Apr", value: 54 },
    { label: "May", value: 57 },
    { label: "Jun", value: 60 },
    { label: "Jul", value: 62 },
    { label: "Aug", value: 64 },
    { label: "Sep", value: 63 },
    { label: "Oct", value: 66 },
    { label: "Nov", value: 68 },
    { label: "Dec", value: 70 },
  ],
};
export const QUARTERS = ["1st Quarter", "2nd Quarter", "3rd Quarter", "4th Quarter"];
export const QUARTER_SPRINT_COUNT = 7;
export const FILTER_YEARS = [2023, 2024, 2025];