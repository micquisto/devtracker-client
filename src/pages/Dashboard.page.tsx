import { useState, useEffect } from "react";
import type { FilterState } from "../interfaces";
import { getFilterLabel } from "@/lib/utils";
import { 
  ScoreKPI, 
  TeamLineChart, 
  TeamMetricsLineChart,
  SprintComparison, 
  ContributionDoughnut,
  VelocityChart,
  SprintStackedColumnChart,
  SprintFilterBar,
} from "../components/dashboard";

import { Title } from "@/components/shared/page";
import { Palette, Text } from "@/lib/theme";
import {
  SPRINT_BOARD_BLOCKED_TASKS,
  SPRINT_BOARD_COLUMNS,
  SPRINT_BOARD_COMPLETED_STORY_POINTS,
  SPRINT_BOARD_COMPLETED_TASKS,
  SPRINT_BOARD_COMPLETION_RATE,
  SPRINT_BOARD_TASKS,
  SPRINT_BOARD_TOTAL_STORY_POINTS,
} from "@/data/SprintBoard.data";
import "@/assets/styles/Dashboard.page.css";

/* ─── MAIN DASHBOARD PAGE ───────────────────── */
export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<FilterState>({ mode: "current" });
  useEffect(() => {
    setTimeout(() => setMounted(true), 80);
  }, []);

  const anim = (d: number): React.CSSProperties => ({
    animation: mounted ? `fadeUp 0.55s ease ${d}s both` : "none",
  });

  const doneCount = SPRINT_BOARD_COMPLETED_TASKS.length;
  const blockedCount = SPRINT_BOARD_BLOCKED_TASKS.length;
  const completionRate = `${SPRINT_BOARD_COMPLETION_RATE}%`;
  const totalSP = SPRINT_BOARD_TOTAL_STORY_POINTS;
  const doneSP = SPRINT_BOARD_COMPLETED_STORY_POINTS;
  const sprintTaskCountCards = [
    { id: "all", label: "Tasks Count", color: Palette.cyan, count: SPRINT_BOARD_TASKS.length },
    ...SPRINT_BOARD_COLUMNS.map((column) => ({
      id: column.id,
      label: column.id === "planned" ? "Pending" : column.label,
      color: column.color,
      count: SPRINT_BOARD_TASKS.filter((task) => task.boardColumn === column.id).length,
    })),
  ];

  const activeLabel = getFilterLabel(filter);

  return (
    <div style={{ padding: "20px 0 40px" }}>
      {/* ── Top header row: title + sprint filter ── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap" as const,
          gap: 12,
          marginBottom: 20,
          ...anim(0),
        }}
      >
        <Title title="Team Dashboard" subtitle={activeLabel} />
        <SprintFilterBar filter={filter} setFilter={setFilter} />
      </div>

      {/* KPI row */}
      <div
        style={{
          display: "flex",
          gap: 14,
          flexWrap: "wrap" as const,
          marginBottom: 20,
          ...anim(0.05),
        }}
      >
        <ScoreKPI
          label="Overall Team Score"
          value="8,742"
          color={Palette.cyan}
          sub={activeLabel}
          delta={6.2}
        />
        <ScoreKPI
          label="Tasks Done / Sprint"
          value={`${doneCount}/${SPRINT_BOARD_TASKS.length}`}
          color={Palette.green}
          sub="Current Sprint 22"
          delta={9}
          deltaLabel="vs Sprint 21"
        />
        <ScoreKPI
          label="Story Points Done"
          value={`${doneSP}/${totalSP}`}
          color={Palette.gold}
          sub="SP delivered"
          delta={-4.3}
          deltaLabel="vs Sprint 21"
        />
        <ScoreKPI
          label="Blocked Tasks"
          value={blockedCount}
          color={Palette.redSoft}
          sub="Needs attention"
          delta={-1}
          deltaLabel="vs last sprint"
        />
        <ScoreKPI
            label="Completion Rate"
            value={completionRate}
            color={Palette.indigo}
            sub="Needs attention"
            delta={-1}
            deltaLabel="vs last sprint"
          />
      </div>

      {/* Line chart */}
      <div style={{ marginBottom: 20, ...anim(0.08) }}>
        <TeamLineChart />
      </div>
      <div style={{ marginBottom: 20, ...anim(0.095) }}>
        <TeamMetricsLineChart />
      </div>

      {/* Sprint comparison + Velocity */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 20,
          ...anim(0.11),
        }}
        className="dash-2col"
      >
        <SprintComparison />
        <VelocityChart />
      </div>

      {/* Contribution doughnut + Stacked column */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 20,
          ...anim(0.14),
        }}
        className="dash-2col"
      >
        <ContributionDoughnut />
        <SprintStackedColumnChart />
      </div>

      {filter.mode === "current" && (
        <div style={{ marginBottom: 20, ...anim(0.17) }}>
          <div
            style={{
              color: Text.section,
              fontFamily: "'DM Mono',monospace",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Sprint Task Flow
          </div>
          <div
            className="task-count-row"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(8, minmax(120px, 1fr))",
              gap: 10,
              overflowX: "auto",
              paddingBottom: 4,
            }}
          >
            {sprintTaskCountCards.map((item) => (
              <div
                key={item.id}
                style={{
                  minWidth: 0,
                  padding: "12px 11px",
                  borderRadius: 14,
                  border: `1px solid ${item.color}33`,
                  background: `linear-gradient(135deg, ${item.color}14, rgba(6,13,31,0.48))`,
                  boxShadow: `0 0 18px ${item.color}12`,
                }}
              >
                <div
                  style={{
                    color: Text.faint,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 8,
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginBottom: 7,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    color: item.color,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 28,
                    fontWeight: 900,
                    lineHeight: 1,
                    textShadow: `0 0 12px ${item.color}44`,
                  }}
                >
                  {item.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
