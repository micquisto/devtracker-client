import { useRef } from "react";
import { DoughnutChart } from "@/components/shared/Charts";
import { TEAM_MEMBERS } from "@/data/Mock.data";
import {
  PROJECT_LABELS,
  SPRINT_BOARD_TASKS,
  INCOMPLETE_BOARD_COLUMNS,
} from "@/data/SprintBoard.data";

const sprintBoardTasks = SPRINT_BOARD_TASKS;

const assigneeStoryPointTotals = TEAM_MEMBERS.map((member) => ({
  ...member,
  plannedStoryPoints: sprintBoardTasks
    .filter((task) => task.assignee === member.initials && !task.isAdhoc)
    .reduce((sum, task) => sum + task.points, 0),
  adhocStoryPoints: sprintBoardTasks
    .filter((task) => task.assignee === member.initials && task.isAdhoc)
    .reduce((sum, task) => sum + task.points, 0),
  completedStoryPoints: sprintBoardTasks
    .filter(
      (task) =>
        task.assignee === member.initials &&
        !INCOMPLETE_BOARD_COLUMNS.includes(task.boardColumn),
    )
    .reduce((sum, task) => sum + task.points, 0),
  taskCount: sprintBoardTasks.filter((task) => task.assignee === member.initials)
    .length,
}))
  .map((member) => ({
    ...member,
    storyPoints: member.plannedStoryPoints + member.adhocStoryPoints,
    completedRate:
      member.plannedStoryPoints > 0
        ? Math.round((member.completedStoryPoints / member.plannedStoryPoints) * 100)
        : 0,
  }))
  .filter((member) => member.storyPoints > 0);

const totalBoardStoryPoints = assigneeStoryPointTotals.reduce(
  (sum, member) => sum + member.storyPoints,
  0,
);

const plannedStoryPoints = sprintBoardTasks
  .filter((task) => !task.isAdhoc)
  .reduce((sum, task) => sum + task.points, 0);

const adhocStoryPoints = sprintBoardTasks
  .filter((task) => task.isAdhoc)
  .reduce((sum, task) => sum + task.points, 0);

const projectStoryPointTotals = PROJECT_LABELS.map((project) => ({
  ...project,
  storyPoints: sprintBoardTasks
    .filter((task) => task.project === project.label)
    .reduce((sum, task) => sum + task.points, 0),
})).filter((project) => project.storyPoints > 0);

const projectStoryPointSegments = projectStoryPointTotals.map((project) => ({
  ...project,
  value: project.storyPoints,
}));

export default function SprintScoreboard() {
  const scoreboardRef = useRef<HTMLElement | null>(null);

  const scrollToScoreboard = () => {
    const target = scoreboardRef.current;
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <a
        href="#sprint-scoreboard"
        onClick={(event) => {
          event.preventDefault();
          scrollToScoreboard();
        }}
        aria-label="Scroll to scoreboard section"
        style={{
          flexShrink: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
          alignSelf: "center",
          marginTop: 4,
          padding: "7px 4px",
          color: "#00c8ff",
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: "pointer",
          textDecoration: "none",
          textShadow: "0 0 16px rgba(0,200,255,0.35)",
          transition: "transform 0.2s ease, color 0.2s ease, text-shadow 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(1px)";
          e.currentTarget.style.color = "#00e5a0";
          e.currentTarget.style.textShadow = "0 0 18px rgba(0,229,160,0.45)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.color = "#00c8ff";
          e.currentTarget.style.textShadow = "0 0 16px rgba(0,200,255,0.35)";
        }}
      >
        <span>Scoreboard below</span>
        <span
          style={{
            color: "#00e5a0",
            display: "inline-block",
          }}
        >
          ↓
        </span>
      </a>

      <section
        className="sprint-scoreboard"
        id="sprint-scoreboard"
        ref={scoreboardRef}
        style={{
          flexShrink: 0,
          scrollMarginTop: 12,
          marginTop: 10,
          marginBottom: 0,
          borderRadius: 16,
          border: "1px solid rgba(100,180,255,0.1)",
          background: "rgba(255,255,255,0.025)",
          padding: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
        <div>
          <div
            style={{
              fontSize: 10,
              fontFamily: "'DM Mono', monospace",
              color: "rgba(100,180,255,0.55)",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              fontWeight: 800,
              marginBottom: 2,
            }}
          >
            Current Sprint Story Points
          </div>
          <h3
            style={{
              margin: 0,
              color: "#e8f4ff",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 16,
              fontWeight: 800,
            }}
          >
            Scoreboard
          </h3>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          className="sprint-scoreboard-top"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(280px, 0.9fr) minmax(360px, 1.1fr)",
            gap: 10,
          }}
        >
          <div
            className="sprint-total-card"
            style={{
              padding: 11,
              borderRadius: 13,
              border: "1px solid rgba(0,200,255,0.28)",
              background:
                "linear-gradient(135deg, rgba(0,200,255,0.12), rgba(0,229,160,0.06), rgba(6,13,31,0.46))",
              boxShadow: "0 0 24px rgba(0,200,255,0.12)",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              minHeight: 0,
            }}
          >
            <div
              className="sprint-total-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(86px, 1fr))",
                gridTemplateRows: "auto minmax(0, 1fr)",
                gap: 8,
                flex: 1,
                minHeight: 0,
              }}
            >
              {[
                ["Planned", plannedStoryPoints, "#00c8ff"],
                ["Adhoc", adhocStoryPoints, "#ff9f43"],
                ["Total", totalBoardStoryPoints, "#00e5a0"],
              ].map(([label, value, color]) => {
                const labelText = label as string;
                const storyPoints = value as number;
                const accentColor = color as string;
                const isTotal = labelText === "Total";
                const percentOfTotal =
                  totalBoardStoryPoints > 0
                    ? Math.round((storyPoints / totalBoardStoryPoints) * 100)
                    : 0;

                return (
                  <div
                    className={isTotal ? "sprint-total-block" : undefined}
                    key={labelText}
                    style={{
                      padding: isTotal ? "12px 13px" : "8px 9px",
                      borderRadius: isTotal ? 14 : 11,
                      background: isTotal
                        ? "linear-gradient(135deg, rgba(0,229,160,0.22), rgba(0,200,255,0.12))"
                        : `${accentColor}12`,
                      border: `1px solid ${accentColor}${isTotal ? "88" : "44"}`,
                      boxShadow: isTotal
                        ? "0 0 28px rgba(0,229,160,0.2), inset 0 0 0 1px rgba(255,255,255,0.04)"
                        : "none",
                      transform: "none",
                      gridColumn: isTotal ? "1 / -1" : undefined,
                      alignSelf: "stretch",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: isTotal ? "center" : "flex-start",
                      minHeight: 0,
                    }}
                  >
                    <div
                      style={{
                        color: isTotal
                          ? "rgba(232,244,255,0.82)"
                          : "rgba(160,210,255,0.65)",
                        fontFamily: "'DM Mono', monospace",
                        fontSize: isTotal ? 9 : 8,
                        fontWeight: 900,
                        textTransform: "uppercase",
                        marginBottom: 4,
                      }}
                    >
                      {labelText}
                    </div>
                    <div
                      style={{
                        color: accentColor,
                        fontFamily: "'DM Mono', monospace",
                        fontSize: isTotal ? 40 : 22,
                        fontWeight: 900,
                        letterSpacing: isTotal ? "-0.1em" : "-0.07em",
                        lineHeight: 0.9,
                        textShadow: isTotal ? `0 0 14px ${accentColor}55` : "none",
                      }}
                    >
                      {storyPoints}
                      <span
                        style={{
                          color: "rgba(160,210,255,0.6)",
                          fontSize: isTotal ? 11 : 9,
                          marginLeft: 4,
                          letterSpacing: 0,
                        }}
                      >
                        SP
                      </span>
                    </div>
                    {!isTotal && (
                      <div
                        style={{
                          marginTop: 4,
                          color: "rgba(160,210,255,0.55)",
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 9,
                          fontWeight: 800,
                        }}
                      >
                        {percentOfTotal}% of total
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="sprint-project-chart-card"
            style={{
              padding: 11,
              borderRadius: 13,
              border: "1px solid rgba(167,139,250,0.24)",
              background:
                "linear-gradient(135deg, rgba(167,139,250,0.12), rgba(0,200,255,0.06), rgba(6,13,31,0.46))",
              boxShadow: "0 0 24px rgba(167,139,250,0.1)",
              minWidth: 0,
            }}
          >
            <div
              style={{
                color: "rgba(100,180,255,0.55)",
                fontFamily: "'DM Mono', monospace",
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Project Story Points
            </div>
            <DoughnutChart
              segments={projectStoryPointSegments}
              gradientIdPrefix="project-sp"
              maxWidth={170}
              renderCenter={({ hovered, cx, cy }) => {
                const active = hovered ?? null;
                const activeValue = active?.storyPoints ?? totalBoardStoryPoints;
                const activePercent =
                  totalBoardStoryPoints > 0
                    ? Math.round((activeValue / totalBoardStoryPoints) * 100)
                    : 0;

                return (
                  <>
                    <text
                      x={cx}
                      y={cy - 8}
                      textAnchor="middle"
                      fill={active?.color ?? "#00e5a0"}
                      fontFamily="'DM Mono', monospace"
                      fontSize="24"
                      fontWeight="900"
                    >
                      {activeValue}
                    </text>
                    <text
                      x={cx}
                      y={cy + 10}
                      textAnchor="middle"
                      fill="rgba(160,210,255,0.66)"
                      fontFamily="'DM Mono', monospace"
                      fontSize="9"
                      fontWeight="900"
                    >
                      {active ? `${activePercent}%` : "TOTAL SP"}
                    </text>
                  </>
                );
              }}
              renderLegend={({ segments, hov, setHov }) => (
                <div
                  style={{
                    flex: "1 1 260px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  {segments.map((project) => {
                    const percent =
                      totalBoardStoryPoints > 0
                        ? Math.round((project.storyPoints / totalBoardStoryPoints) * 100)
                        : 0;
                    const isActive = hov === project.i;

                    return (
                      <button
                        className="project-score-legend-item"
                        key={project.label}
                        type="button"
                        onMouseEnter={() => setHov(project.i)}
                        onMouseLeave={() => setHov(null)}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "auto minmax(0, 1fr) auto",
                          alignItems: "center",
                          gap: 7,
                          padding: "5px 7px",
                          borderRadius: 10,
                          border: `1px solid ${
                            isActive ? project.color : "rgba(100,180,255,0.08)"
                          }`,
                          background: isActive
                            ? `${project.color}16`
                            : "rgba(255,255,255,0.025)",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: project.color,
                            boxShadow: `0 0 8px ${project.color}88`,
                          }}
                        />
                        <span
                          style={{
                            color: "rgba(220,238,255,0.82)",
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: 10,
                            fontWeight: 800,
                            lineHeight: 1.15,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {project.label}
                        </span>
                        <span
                          className="project-score-legend-value"
                          style={{
                            color: project.color,
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 11,
                            fontWeight: 900,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {project.storyPoints} SP · {percent}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </div>
        </div>

        <div
          className="sprint-assignee-grid"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${assigneeStoryPointTotals.length}, minmax(0, 1fr))`,
            gap: 8,
            overflowX: "auto",
            paddingBottom: 2,
          }}
        >
          {assigneeStoryPointTotals.map((member) => (
            <div
              className="sprint-assignee-card"
              key={member.initials}
              style={{
                flex: "1 1 150px",
                minWidth: 0,
                padding: 9,
                borderRadius: 13,
                border: `1px solid ${member.color}33`,
                background: `linear-gradient(135deg, ${member.color}14, rgba(6,13,31,0.48))`,
                boxShadow: `0 0 18px ${member.color}12`,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 7,
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: member.color,
                    color: "#060d1f",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 10,
                    fontWeight: 900,
                    boxShadow: `0 0 12px ${member.color}66`,
                    flexShrink: 0,
                  }}
                >
                  {member.initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: "rgba(230,245,255,0.92)",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 11,
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {member.name}
                  </div>
                  <div
                    style={{
                      color: "rgba(140,185,230,0.65)",
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 8,
                      fontWeight: 800,
                    }}
                  >
                    {member.taskCount} cards assigned
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 8,
                    width: "100%",
                    flex: 1,
                  }}
                >
                  {[
                    ["Planned", member.plannedStoryPoints, "#00c8ff", "SP"],
                    ["Adhoc", member.adhocStoryPoints, "#ff9f43", "SP"],
                    ["Completed", member.completedStoryPoints, "#00e5a0", "SP"],
                    ["Rate", member.completedRate, "#00e5a0", "%"],
                  ].map(([label, value, color, unit]) => {
                    const labelText = label as string;
                    const metricValue = value as number;
                    const accentColor = color as string;
                    const metricUnit = unit as string;

                    return (
                      <div
                        key={labelText}
                        style={{
                          padding: "6px 7px",
                          borderRadius: 10,
                          background: `${accentColor}10`,
                          border: `1px solid ${accentColor}33`,
                          minHeight: 58,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                        }}
                      >
                        <div
                          style={{
                            color: "rgba(160,210,255,0.62)",
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 8,
                            fontWeight: 900,
                            textTransform: "uppercase",
                            marginBottom: 3,
                          }}
                        >
                          {labelText}
                        </div>
                        <div
                          style={{
                            color: accentColor,
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 18,
                            fontWeight: 900,
                            letterSpacing: "-0.05em",
                            lineHeight: 1,
                          }}
                        >
                          {metricValue}
                          <span
                            style={{
                              color: "rgba(160,210,255,0.55)",
                              fontSize: 9,
                              marginLeft: 3,
                              letterSpacing: 0,
                            }}
                          >
                            {metricUnit}
                          </span>
                        </div>
                        {labelText === "Rate" && (
                          <div
                            style={{
                              height: 3,
                              background: "rgba(255,255,255,0.07)",
                              borderRadius: 99,
                              overflow: "hidden",
                              marginTop: 5,
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.min(metricValue, 100)}%`,
                                background: accentColor,
                                borderRadius: 99,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
        </div>
      </section>
    </>
  );
}
