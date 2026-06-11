import { useEffect, useState } from "react";
import { TEAM_MEMBERS } from "@/data/Mock.data";
import { PROJECT_LABELS, SPRINT_BOARD_COLUMNS } from "@/data/SprintBoard.data";
import {
  Palette,
  PriorityColor,
  SeverityColor,
  StatusBg,
  StatusColor,
} from "@/lib/theme";
import { getSupabaseRows } from "@/lib/supabase";
import "@/assets/styles/SprintKanbanBoard.css";

const SPRINT_KANBAN_COLUMNS = [
  SPRINT_BOARD_COLUMNS[0],
  { id: "adhoc", label: "Adhoc", color: "#ff9f43" },
  ...SPRINT_BOARD_COLUMNS.slice(1),
] as const;

const KANBAN_HIDDEN_TRELLO_LIST_NAMES = new Set([
  "project refinement",
  "on-deck sprint backlog",
  "done qa",
]);

type BoardColumnId = (typeof SPRINT_BOARD_COLUMNS)[number]["id"];

type SprintRow = {
  id: string;
};

type SprintPointType = "planned" | "adhoc" | "done" | "blocked";

type TaskRow = {
  id?: string;
  sprint_id: string;
  project_type: string | null;
  assigned_to: string | null;
  trello_card_id: string;
  trello_short_id: number | null;
  trello_board_id: string;
  trello_card_url: string | null;
  trello_list_name: string | null;
  title: string;
  priority: string;
  status: string;
  story_points: number;
  completion_percentage: number | null;
  severity: number;
  sp_type: SprintPointType;
};

type MemberRow = {
  id: string | null;
  auth_user_id: string | null;
  trello_username: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type ProjectTypeRow = {
  id: string;
  name: string;
};

type KanbanTask = {
  id: string;
  title: string;
  trelloCardUrl: string | null;
  trelloListName: string | null;
  assigneeInitials: string;
  assigneeName: string;
  assigneeColor: string;
  severity: string;
  priority: string;
  status: string;
  points: number;
  completionPercentage: number;
  boardColumn: BoardColumnId;
  spType: SprintPointType;
  project: {
    label: string;
    color: string;
  };
};

type SprintKanbanBoardProps = {
  selectedMemberId?: string;
};

const ASSIGNEE_COLORS = [
  Palette.cyan,
  Palette.green,
  Palette.gold,
  Palette.purple,
  Palette.pink,
  Palette.orange,
  Palette.indigo,
  Palette.redSoft,
];

const MOCK_MEMBER_COLOR_BY_NAME = new Map(
  TEAM_MEMBERS.map((member) => [member.name, member.color]),
);

const MOCK_MEMBER_NAME_BY_TRELLO_USERNAME: Record<string, string> = {
  joshuabalansa: "John Doe",
  doerrosales1: "Sarah Kim",
  louiefranzgualingco: "Alex Rivera",
  jpangs: "Mia Chen",
  thomasandrewzaragoza1: "Leo Santos",
};

const UNASSIGNED_COLOR = "#8a96a8";

const PROJECT_TYPE_FALLBACK_COLORS = [
  Palette.cyan,
  Palette.purple,
  Palette.gold,
  Palette.pink,
  Palette.green,
  Palette.orange,
  Palette.indigo,
  Palette.redSoft,
];

const SPRINT_BOARD_CONTAINER_STYLE: React.CSSProperties = {
  height: "calc(100vh - 170px)",
  minHeight: 420,
};

function getAssigneeColor(member: MemberRow | undefined, fallbackName: string): string {
  if (!member || fallbackName === "Unassigned") return UNASSIGNED_COLOR;

  const mockMemberName = member.trello_username
    ? MOCK_MEMBER_NAME_BY_TRELLO_USERNAME[member.trello_username]
    : undefined;
  const mockColor = mockMemberName
    ? MOCK_MEMBER_COLOR_BY_NAME.get(mockMemberName)
    : undefined;

  if (mockColor) return mockColor;

  const seed = member.id ?? fallbackName;
  const hash = Array.from(seed).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );

  return ASSIGNEE_COLORS[hash % ASSIGNEE_COLORS.length];
}

function getInitials(name: string): string {
  if (name === "Unassigned") return "UA";

  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function getSeverityLabel(value: number): string {
  if (value === 1.3) return "P1";
  if (value === 1.2) return "P2";
  if (value === 1.1) return "P3";
  return "P4";
}

function getBoardColumn(listName: string | null): BoardColumnId {
  const normalized = listName?.trim().toLowerCase();

  if (normalized === "in development" || normalized === "in dev") return "in-dev";
  if (normalized === "for dev deployment") return "for-dev-deployment";
  if (normalized === "on dev environment") return "on-dev-environment";
  if (normalized === "for live deployment") return "for-live-deployment";
  if (normalized === "on live🎉" || normalized === "live") return "live";
  if (normalized === "blocked") return "blocked";

  return "planned";
}

function shouldShowOnKanban(listName: string | null): boolean {
  const normalized = listName?.trim().toLowerCase();

  return !normalized || !KANBAN_HIDDEN_TRELLO_LIST_NAMES.has(normalized);
}

function getProjectTypeColor(projectTypeName: string): string {
  const existingProjectLabel = PROJECT_LABELS.find(
    (item) => item.label === projectTypeName,
  );

  if (existingProjectLabel) return existingProjectLabel.color;
  if (projectTypeName === "General") return UNASSIGNED_COLOR;

  const hash = Array.from(projectTypeName).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );

  return PROJECT_TYPE_FALLBACK_COLORS[hash % PROJECT_TYPE_FALLBACK_COLORS.length];
}

function getSprintPointTypeLabel(spType: SprintPointType): string {
  if (spType === "adhoc") return "Adhoc";
  if (spType === "done") return "Done";
  if (spType === "blocked") return "Blocked";
  return "Planned";
}

function getSprintPointTypeColor(spType: SprintPointType): string {
  if (spType === "adhoc") return "#ff9f43";
  if (spType === "done") return "#00e5a0";
  if (spType === "blocked") return "#ff4757";
  return "#00c8ff";
}

function getCompletionPercentageColor(percentage: number): string {
  if (percentage >= 100) return Palette.green;
  if (percentage >= 50) return Palette.orange;
  return Palette.cyan;
}

function mapTask(
  task: TaskRow,
  membersById: Map<string, MemberRow>,
  projectTypesById: Map<string, ProjectTypeRow>,
): KanbanTask {
  const member = task.assigned_to ? membersById.get(task.assigned_to) : undefined;
  const assigneeName = member?.full_name ?? "Unassigned";
  const projectTypeName = task.project_type
    ? projectTypesById.get(task.project_type)?.name ?? "General"
    : "General";

  return {
    id: String(task.trello_short_id ?? task.trello_card_id),
    title: task.title,
    trelloCardUrl: task.trello_card_url,
    trelloListName: task.trello_list_name,
    assigneeInitials: getInitials(assigneeName),
    assigneeName,
    assigneeColor: getAssigneeColor(member, assigneeName),
    severity: getSeverityLabel(task.severity),
    priority: task.priority,
    status: task.status,
    points: task.story_points,
    completionPercentage: task.completion_percentage ?? 0,
    boardColumn: getBoardColumn(task.trello_list_name),
    spType: task.sp_type,
    project: {
      label: projectTypeName,
      color: getProjectTypeColor(projectTypeName),
    },
  };
}

function SprintTaskCard({
  task,
  columnColor,
  animationDelay,
}: {
  task: KanbanTask;
  columnColor: string;
  animationDelay: string;
}) {
  const assigneeColor = task.assigneeColor;
  const severityColor = SeverityColor[task.severity] ?? Palette.green;
  const priorityColor =
    PriorityColor[task.priority] ??
    {
      critical: Palette.red,
      high: Palette.orange,
      medium: Palette.gold,
      low: Palette.green,
    }[task.priority] ??
    Palette.cyan;
  const statusColor = StatusColor[task.status] ?? Palette.cyan;
  const statusBg = StatusBg[task.status] ?? "rgba(0,200,255,0.1)";
  const spTypeColor = getSprintPointTypeColor(task.spType);
  const completionPercentageColor = getCompletionPercentageColor(
    task.completionPercentage,
  );
  const isWorkInProgressList = ["current sprint", "in development"].includes(
    task.trelloListName?.trim().toLowerCase() ?? "",
  );
  const project = task.project;

  return (
    <article
      className="sprint-kanban-card"
      style={{
        padding: "10px 11px 10px 13px",
        borderRadius: 12,
        border: `1px solid ${severityColor}38`,
        borderLeft: `4px solid ${assigneeColor}`,
        background: `linear-gradient(135deg, ${assigneeColor}12, ${severityColor}0f 42%, rgba(6,13,31,0.58))`,
        boxShadow: `0 8px 24px rgba(0,0,0,0.16), 0 0 18px ${severityColor}16`,
        animationDelay,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            color: columnColor,
            fontFamily: "'DM Mono', monospace",
            fontWeight: 900,
            fontSize: 10,
          }}
        >
          {task.id}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span
            style={{
              color: "#00e5a0",
              background:
                "linear-gradient(135deg, rgba(0,229,160,0.18), rgba(0,200,255,0.08))",
              border: "1px solid rgba(0,229,160,0.45)",
              borderRadius: 10,
              padding: "4px 8px",
              fontFamily: "'DM Mono', monospace",
              fontWeight: 900,
              fontSize: 15,
              lineHeight: 1,
              letterSpacing: "-0.05em",
              boxShadow: "0 0 14px rgba(0,229,160,0.16)",
            }}
          >
            {task.points > 0 ? (
              <>
                {task.points}
                <span
                  style={{
                    color: "rgba(160,210,255,0.7)",
                    fontSize: 9,
                    letterSpacing: "0",
                    marginLeft: 3,
                  }}
                >
                  SP
                </span>
              </>
            ) : null}
          </span>
          <span
            title="Completion percentage"
            style={{
              color: isWorkInProgressList ? Palette.cyan : completionPercentageColor,
              background: isWorkInProgressList
                ? "rgba(0,200,255,0.12)"
                : `${completionPercentageColor}1f`,
              border: isWorkInProgressList
                ? "1px solid rgba(0,200,255,0.48)"
                : `1px solid ${completionPercentageColor}66`,
              borderRadius: 10,
              padding: "4px 7px",
              fontFamily: "'DM Mono', monospace",
              fontWeight: 900,
              fontSize: 11,
              lineHeight: 1,
              boxShadow: isWorkInProgressList
                ? "0 0 12px rgba(0,200,255,0.18)"
                : `0 0 12px ${completionPercentageColor}24`,
            }}
          >
            {isWorkInProgressList ? (
              <svg
                aria-label="Work in progress"
                role="img"
                width="13"
                height="13"
                viewBox="0 0 13 13"
                fill="none"
              >
                <circle
                  cx="6.5"
                  cy="6.5"
                  r="5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeDasharray="2 1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M6.5 3.7v3l2.2 1.3"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              `${task.completionPercentage}%`
            )}
          </span>
        </span>
      </div>

      <div
        style={{
          color: "#e8f4ff",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 14,
          fontWeight: 900,
          lineHeight: 1.25,
          letterSpacing: "-0.01em",
          marginBottom: 8,
          padding: "6px 7px",
          borderRadius: 9,
          background: `linear-gradient(135deg, ${assigneeColor}1f, rgba(255,255,255,0.035))`,
          border: `1px solid ${assigneeColor}2f`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.025), 0 0 12px ${assigneeColor}10`,
        }}
      >
        {task.trelloCardUrl ? (
          <a
            href={task.trelloCardUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              color: "inherit",
              textDecoration: "none",
            }}
          >
            {task.title}
          </a>
        ) : (
          task.title
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "6px 7px",
          borderRadius: 9,
          background: `${assigneeColor}14`,
          border: `1px solid ${assigneeColor}26`,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: assigneeColor,
            color: "#060d1f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'DM Mono', monospace",
            fontWeight: 900,
            fontSize: 9,
            flexShrink: 0,
            boxShadow: `0 0 10px ${assigneeColor}66`,
          }}
        >
          {task.assigneeInitials}
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: "rgba(230,245,255,0.9)",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              fontWeight: 800,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {task.assigneeName}
          </div>
          <div
            style={{
              color: assigneeColor,
              fontFamily: "'DM Mono', monospace",
              fontSize: 8,
              fontWeight: 900,
              marginTop: 1,
            }}
          >
            Assignee
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 6,
          alignSelf: "stretch",
          width: "100%",
          boxSizing: "border-box",
          padding: "4px 8px",
          borderRadius: 9,
          background: `${project.color}14`,
          border: `1px solid ${project.color}44`,
          color: project.color,
          fontSize: 9,
          fontFamily: "'DM Mono', monospace",
          fontWeight: 900,
          lineHeight: 1.25,
          marginBottom: 8,
          textAlign: "left",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: project.color,
            boxShadow: `0 0 8px ${project.color}88`,
            flexShrink: 0,
          }}
        />
        <span style={{ minWidth: 0, textAlign: "left" }}>{project.label}</span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            padding: "3px 8px",
            borderRadius: 99,
            background: `${severityColor}1f`,
            border: `1px solid ${severityColor}66`,
            color: severityColor,
            fontSize: 9,
            fontFamily: "'DM Mono', monospace",
            fontWeight: 900,
            boxShadow:
              task.severity === "Critical" ? `0 0 12px ${severityColor}35` : "none",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {task.severity}
        </span>
        <span
          style={{
            padding: "3px 8px",
            borderRadius: 99,
            background: statusBg,
            border: `1px solid ${statusColor}44`,
            color: statusColor,
            fontSize: 9,
            fontFamily: "'DM Mono', monospace",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {task.status}
        </span>
        <span
          style={{
            padding: "3px 8px",
            borderRadius: 99,
            background: `${spTypeColor}1f`,
            border: `1px solid ${spTypeColor}66`,
            color: spTypeColor,
            fontSize: 9,
            fontFamily: "'DM Mono', monospace",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            boxShadow: `0 0 10px ${spTypeColor}24`,
          }}
        >
          {getSprintPointTypeLabel(task.spType)}
        </span>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span
          style={{
            padding: "2px 7px",
            borderRadius: 99,
            background: `${priorityColor}16`,
            border: `1px solid ${priorityColor}44`,
            color: priorityColor,
            fontSize: 9,
            fontFamily: "'DM Mono', monospace",
            fontWeight: 800,
          }}
        >
          {task.priority}
        </span>
        <span
          style={{
            padding: "2px 7px",
            borderRadius: 99,
            background: "rgba(255,255,255,0.045)",
            color: "rgba(140,185,230,0.72)",
            fontSize: 9,
            fontFamily: "'DM Mono', monospace",
            fontWeight: 800,
          }}
        >
          {task.assigneeInitials}
        </span>
      </div>
    </article>
  );
}

export default function SprintKanbanBoard({
  selectedMemberId = "",
}: SprintKanbanBoardProps) {
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTasks() {
      setLoading(true);
      setError(null);

      try {
        const [currentSprint] = await getSupabaseRows<SprintRow>("sprints", {
          select: "id",
          eq: { is_current: 1 },
          limit: 1,
        });

        if (!currentSprint) {
          if (!cancelled) setTasks([]);
          return;
        }

        const [taskRows, memberRows, projectTypeRows] = await Promise.all([
          getSupabaseRows<TaskRow>("tasks", {
            select:
              "id,sprint_id,project_type,assigned_to,trello_card_id,trello_short_id,trello_board_id,trello_card_url,trello_list_name,title,priority,status,story_points,completion_percentage,severity,sp_type",
            eq: selectedMemberId
              ? { sprint_id: currentSprint.id, assigned_to: selectedMemberId }
              : { sprint_id: currentSprint.id },
          }),
          getSupabaseRows<MemberRow>("members", {
            select: "id,auth_user_id,trello_username,full_name,first_name,last_name",
          }),
          getSupabaseRows<ProjectTypeRow>("project_type", {
            select: "id,name",
          }),
        ]);

        const membersById = new Map(
          memberRows
            .filter((member) => member.id)
            .map((member) => [member.id as string, member]),
        );
        const projectTypesById = new Map(
          projectTypeRows.map((projectType) => [projectType.id, projectType]),
        );

        if (!cancelled) {
          setTasks(
            taskRows
              .filter((task) => shouldShowOnKanban(task.trello_list_name))
              .map((task) => mapTask(task, membersById, projectTypesById)),
          );
        }
      } catch (error) {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : "Unable to load tasks.");
          setTasks([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTasks();

    return () => {
      cancelled = true;
    };
  }, [selectedMemberId]);

  if (loading) {
    return (
      <div
        style={{
          ...SPRINT_BOARD_CONTAINER_STYLE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          color: "rgba(160,210,255,0.7)",
          fontFamily: "'DM Mono', monospace",
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        <span className="sprint-kanban-loader" aria-hidden="true" />
        Fetching Data
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          ...SPRINT_BOARD_CONTAINER_STYLE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ff8d8d",
          padding: 16,
          textAlign: "center",
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div
      className="sprint-board-grid"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${SPRINT_KANBAN_COLUMNS.length}, minmax(300px, 1fr))`,
        gap: 12,
        ...SPRINT_BOARD_CONTAINER_STYLE,
        overflowX: "auto",
        paddingBottom: 8,
      }}
    >
      {SPRINT_KANBAN_COLUMNS.map((column, columnIndex) => {
        const columnTasks = tasks.filter((task) => {
          if (column.id === "adhoc") {
            return task.boardColumn === "planned" && task.spType === "adhoc";
          }

          if (column.id === "planned") {
            return task.boardColumn === "planned" && task.spType === "planned";
          }

          return task.boardColumn === column.id;
        });

        return (
          <section
            className="sprint-board-column"
            key={column.id}
            style={{
              minHeight: "100%",
              borderRadius: 16,
              border: "1px solid rgba(100,180,255,0.1)",
              background: "rgba(255,255,255,0.025)",
              padding: 12,
              display: "flex",
              flexDirection: "column",
              minWidth: 300,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: column.color,
                    boxShadow: `0 0 10px ${column.color}66`,
                  }}
                />
                <span
                  style={{
                    color: "#e8f4ff",
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  {column.label}
                </span>
              </div>
              <span
                style={{
                  color: column.color,
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  fontWeight: 900,
                }}
              >
                {columnTasks.length}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                flex: 1,
                minHeight: 0,
                minWidth: 0,
                overflowX: "hidden",
                overflowY: "auto",
                paddingRight: 2,
              }}
            >
              {columnTasks.map((task, taskIndex) => (
                <SprintTaskCard
                  key={task.id}
                  task={task}
                  columnColor={column.color}
                  animationDelay={`${0.06 + columnIndex * 0.035 + taskIndex * 0.055}s`}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
