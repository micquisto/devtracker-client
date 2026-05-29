import { TEAM_MEMBERS } from "@/data/Mock.data";
import {
  PROJECT_LABELS,
  SPRINT_BOARD_COLUMNS,
  SPRINT_BOARD_TASKS,
  type BoardTask,
} from "@/data/SprintBoard.data";
import {
  PriorityColor,
  SeverityColor,
  StatusBg,
  StatusColor,
} from "@/lib/theme";
import "@/assets/styles/SprintKanbanBoard.css";

const TEAM_BY_INITIALS = Object.fromEntries(
  TEAM_MEMBERS.map((member) => [member.initials, member]),
);

const sprintBoardTasks = SPRINT_BOARD_TASKS;

function SprintTaskCard({
  task,
  columnColor,
  animationDelay,
}: {
  task: BoardTask;
  columnColor: string;
  animationDelay: string;
}) {
  const assignee = TEAM_BY_INITIALS[task.assignee];
  const assigneeColor = assignee?.color ?? columnColor;
  const assigneeName = assignee?.name ?? task.assignee;
  const severityColor = SeverityColor[task.severity];
  const priorityColor = PriorityColor[task.priority];
  const statusColor = StatusColor[task.status];
  const statusBg = StatusBg[task.status];
  const project =
    PROJECT_LABELS.find((item) => item.label === task.project) ?? PROJECT_LABELS[0];

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
        {task.title}
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
          {task.assignee}
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
            {assigneeName}
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
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          alignSelf: "flex-start",
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
        <span>{project.label}</span>
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
            background: task.isAdhoc
              ? "rgba(255,159,67,0.16)"
              : "rgba(0,200,255,0.12)",
            border: task.isAdhoc
              ? "1px solid rgba(255,159,67,0.55)"
              : "1px solid rgba(0,200,255,0.46)",
            color: task.isAdhoc ? "#ff9f43" : "#00c8ff",
            fontSize: 9,
            fontFamily: "'DM Mono', monospace",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            boxShadow: task.isAdhoc
              ? "0 0 10px rgba(255,159,67,0.18)"
              : "0 0 10px rgba(0,200,255,0.14)",
          }}
        >
          {task.isAdhoc ? "Adhoc" : "Planned"}
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
          {task.assignee}
        </span>
      </div>
    </article>
  );
}

export default function SprintKanbanBoard() {
  return (
    <div
      className="sprint-board-grid"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${SPRINT_BOARD_COLUMNS.length}, minmax(220px, 1fr))`,
        gap: 12,
        height: "calc(100vh - 170px)",
        minHeight: 420,
        overflowX: "auto",
        paddingBottom: 8,
      }}
    >
      {SPRINT_BOARD_COLUMNS.map((column, columnIndex) => {
        const tasks = sprintBoardTasks.filter(
          (task) => task.boardColumn === column.id,
        );

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
                {tasks.length}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                paddingRight: 2,
              }}
            >
              {tasks.map((task, taskIndex) => (
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
