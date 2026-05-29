export interface SprintTask {
  id: string;
  title: string;
  assignee: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  priority: "P0" | "P1" | "P2" | "P3";
  status: "Done" | "In Progress" | "Review" | "Blocked" | "Todo";
  points: number;
}

export interface SprintMeta {
  id: string;
  label: string;
  shortLabel: string;
  start: Date;
  end: Date;
  monthIdx: number;
}
