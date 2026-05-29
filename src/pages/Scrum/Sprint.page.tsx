import { useState } from "react";
import {
  SprintFilter,
  SPRINT_STATUS_STYLE,
  getSprintFilterOption,
  SprintKanbanBoard,
  SprintScoreboard,
} from "@/components/scrum";
import { Title } from "@/components/shared/page";
import { SPRINT_BOARD_TASKS } from "@/data/SprintBoard.data";
import "@/assets/styles/Sprint.page.css";

const sprintBoardTasks = SPRINT_BOARD_TASKS;

export default function SprintPage() {
  const [selectedSprint, setSelectedSprint] = useState("current");
  const selectedSprintOption = getSprintFilterOption(selectedSprint);
  const selectedSprintStatus = selectedSprintOption.status;
  const selectedSprintStatusStyle = SPRINT_STATUS_STYLE[selectedSprintStatus];
  const sprintTitle =
    selectedSprint === "current" ? "Sprint 22 Kanban" : `${selectedSprintOption.label} Kanban`;

  return (
    <div
      className="sprint-page"
      style={{
        minHeight: "calc(100vh - 96px)",
        display: "flex",
        flexDirection: "column",
        overflow: "visible",
        padding: "16px 0 0",
      }}
    >
      <SprintFilter
        selectedSprint={selectedSprint}
        onSprintChange={setSelectedSprint}
      />
      <div
        className="sprint-header"
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <Title
          eyebrow="Scrum Board"
          title={sprintTitle}
          size="sprint"
          rowClassName="sprint-title-row"
          meta={
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 9px",
                borderRadius: 99,
                border: `1px solid ${selectedSprintStatusStyle.border}`,
                background: selectedSprintStatusStyle.background,
                color: selectedSprintStatusStyle.color,
                fontFamily: "'DM Mono', monospace",
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                boxShadow: `0 0 12px ${selectedSprintStatusStyle.color}22`,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: selectedSprintStatusStyle.color,
                  boxShadow: `0 0 8px ${selectedSprintStatusStyle.color}`,
                }}
              />
              {selectedSprintStatus}
            </span>
          }
        />
        <div
          className="sprint-task-count"
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,200,255,0.18)",
            background: "rgba(0,200,255,0.07)",
            color: "rgba(160,210,255,0.75)",
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          {sprintBoardTasks.length} tasks
        </div>
      </div>

      <SprintKanbanBoard />

      <SprintScoreboard />
    </div>
  );
}
