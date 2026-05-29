import type { SprintTask } from "@/interfaces";
import { SPRINT_HISTORY, SPRINT_TASKS, TEAM_MEMBERS } from "@/data/Mock.data";

export const SPRINT_BOARD_COLUMNS = [
  { id: "planned", label: "Planned", color: "#00c8ff" },
  { id: "in-dev", label: "In Dev", color: "#a78bfa" },
  { id: "for-dev-deployment", label: "For Dev Deployment", color: "#f5c842" },
  { id: "on-dev-environment", label: "On Dev Environment", color: "#6b89ff" },
  { id: "for-live-deployment", label: "For Live Deployment", color: "#ff6eb4" },
  { id: "live", label: "Live", color: "#00e5a0" },
  { id: "blocked", label: "Blocked", color: "#ff4757" },
] as const;

export const PROJECT_LABELS = [
  {
    label: "Business Logic / Back-end Pstock",
    color: "#00c8ff",
  },
  {
    label: "Business Logic / Back-end - Marketplaces (Amazon, Shopify)",
    color: "#a78bfa",
  },
  {
    label: "Plumbersstock & SW Plumbing (SEO, images & bugs)",
    color: "#f5c842",
  },
  {
    label: "Marketplace Frontend",
    color: "#ff6eb4",
  },
  {
    label: "Go Green",
    color: "#00e5a0",
  },
] as const;

export type BoardColumnId = (typeof SPRINT_BOARD_COLUMNS)[number]["id"];
export type ProjectLabel = (typeof PROJECT_LABELS)[number]["label"];
export type BoardTask = SprintTask & {
  boardColumn: BoardColumnId;
  isAdhoc?: boolean;
  project: ProjectLabel;
};

const NON_BLOCKED_COLUMNS = SPRINT_BOARD_COLUMNS.filter(
  (column) => column.id !== "blocked",
);

const EXTRA_BOARD_TASKS: BoardTask[] = [
  {
    id: "T-113",
    title: "Refine sprint acceptance criteria",
    assignee: "JD",
    severity: "Medium",
    priority: "P2",
    status: "Todo",
    points: 3,
    boardColumn: "planned",
    project: "Business Logic / Back-end Pstock",
  },
  {
    id: "T-114",
    title: "Hotfix timezone display issue",
    assignee: "SK",
    severity: "High",
    priority: "P1",
    status: "In Progress",
    points: 2,
    boardColumn: "in-dev",
    isAdhoc: true,
    project: "Plumbersstock & SW Plumbing (SEO, images & bugs)",
  },
  {
    id: "T-115",
    title: "Implement deployment health checks",
    assignee: "AR",
    severity: "High",
    priority: "P1",
    status: "In Progress",
    points: 5,
    boardColumn: "in-dev",
    project: "Business Logic / Back-end - Marketplaces (Amazon, Shopify)",
  },
  {
    id: "T-116",
    title: "Prepare release checklist automation",
    assignee: "MC",
    severity: "Medium",
    priority: "P2",
    status: "Review",
    points: 3,
    boardColumn: "for-dev-deployment",
    project: "Marketplace Frontend",
  },
  {
    id: "T-117",
    title: "Verify staging smoke test suite",
    assignee: "LS",
    severity: "Low",
    priority: "P3",
    status: "Review",
    points: 2,
    boardColumn: "on-dev-environment",
    project: "Go Green",
  },
  {
    id: "T-118",
    title: "Coordinate live release comms",
    assignee: "SK",
    severity: "Medium",
    priority: "P2",
    status: "Done",
    points: 2,
    boardColumn: "for-live-deployment",
    isAdhoc: true,
    project: "Marketplace Frontend",
  },
  {
    id: "T-119",
    title: "Post-release metrics validation",
    assignee: "JD",
    severity: "Low",
    priority: "P3",
    status: "Done",
    points: 1,
    boardColumn: "live",
    project: "Business Logic / Back-end Pstock",
  },
  {
    id: "T-120",
    title:
      "Investigate intermittent marketplace checkout reconciliation mismatch across Amazon and Shopify order imports",
    assignee: "AR",
    severity: "High",
    priority: "P1",
    status: "Todo",
    points: 8,
    boardColumn: "planned",
    project: "Business Logic / Back-end - Marketplaces (Amazon, Shopify)",
  },
];

const mappedSprintTasks: BoardTask[] = SPRINT_TASKS.map((task, index) => {
  const isAdhoc = ["T-103", "T-109"].includes(task.id);
  const boardColumn: BoardColumnId =
    task.status === "Blocked"
      ? "blocked"
      : NON_BLOCKED_COLUMNS[index % NON_BLOCKED_COLUMNS.length].id;

  return {
    ...task,
    boardColumn,
    isAdhoc,
    project: PROJECT_LABELS[index % PROJECT_LABELS.length].label,
  };
});

export const SPRINT_BOARD_TASKS: BoardTask[] = [
  ...mappedSprintTasks,
  ...EXTRA_BOARD_TASKS,
];

export const INCOMPLETE_BOARD_COLUMNS: BoardColumnId[] = [
  "planned",
  "in-dev",
  "for-dev-deployment",
  "blocked",
];

export const SPRINT_BOARD_COMPLETED_TASKS = SPRINT_BOARD_TASKS.filter(
  (task) => !INCOMPLETE_BOARD_COLUMNS.includes(task.boardColumn),
);

export const SPRINT_BOARD_BLOCKED_TASKS = SPRINT_BOARD_TASKS.filter(
  (task) => task.boardColumn === "blocked",
);

export const SPRINT_BOARD_TOTAL_STORY_POINTS = SPRINT_BOARD_TASKS.reduce(
  (sum, task) => sum + task.points,
  0,
);

export const SPRINT_BOARD_COMPLETED_STORY_POINTS =
  SPRINT_BOARD_COMPLETED_TASKS.reduce((sum, task) => sum + task.points, 0);

export const SPRINT_BOARD_COMPLETION_RATE =
  SPRINT_BOARD_TASKS.length > 0
    ? Math.round((SPRINT_BOARD_COMPLETED_TASKS.length / SPRINT_BOARD_TASKS.length) * 100)
    : 0;

export const SPRINT_BOARD_ASSIGNEE_CONTRIBUTIONS = TEAM_MEMBERS.map((member) => {
  const storyPoints = SPRINT_BOARD_TASKS.filter(
    (task) => task.assignee === member.initials,
  ).reduce((sum, task) => sum + task.points, 0);
  const contribution =
    SPRINT_BOARD_TOTAL_STORY_POINTS > 0
      ? Math.round((storyPoints / SPRINT_BOARD_TOTAL_STORY_POINTS) * 100)
      : 0;

  return {
    ...member,
    storyPoints,
    contribution,
  };
}).filter((member) => member.storyPoints > 0);

export const SPRINT_BOARD_HISTORY = SPRINT_HISTORY.map((sprint, index) => {
  if (index !== SPRINT_HISTORY.length - 1) return sprint;

  return {
    ...sprint,
    velocity: SPRINT_BOARD_COMPLETED_STORY_POINTS,
    completed: SPRINT_BOARD_COMPLETED_TASKS.length,
    total: SPRINT_BOARD_TASKS.length,
    storyPointsDone: SPRINT_BOARD_COMPLETED_STORY_POINTS,
    performanceMetrics: {
      ...sprint.performanceMetrics,
      velocity: SPRINT_BOARD_COMPLETION_RATE,
    },
  };
});
