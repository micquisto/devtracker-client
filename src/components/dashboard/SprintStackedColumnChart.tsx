import { TEAM_MEMBERS } from "@/data/Mock.data";
import {
  INCOMPLETE_BOARD_COLUMNS,
  SPRINT_BOARD_TASKS,
} from "@/data/SprintBoard.data";
import { Background, Border, Chart } from "@/lib/theme";
import { Card } from "@/components/shared/Containers";
import { SectionTitle } from "@/components/shared/Sections";
import { StackedColumnChart } from "@/components/shared/Charts";

/* ─── STACKED COLUMN CHART ──────────────────── */
const SprintStackedColumnChart = () => {
    const assigneeSegments = TEAM_MEMBERS.map((member) => {
      const tasks = SPRINT_BOARD_TASKS.filter(
        (task) => task.assignee === member.initials,
      );
      const completed = tasks
        .filter((task) => !INCOMPLETE_BOARD_COLUMNS.includes(task.boardColumn))
        .reduce((sum, task) => sum + task.points, 0);
      const total = tasks.reduce((sum, task) => sum + task.points, 0);

      return {
        ...member,
        completed,
        total,
      };
    }).filter((member) => member.total > 0);

    const maxTotal = Math.max(...assigneeSegments.map((member) => member.total), 4);
    const barAreaH = 150;
    const gridStep = Math.max(1, Math.ceil(maxTotal / 4));
    const gridTicks = Array.from({ length: 5 }, (_, index) =>
      Math.min(index * gridStep, maxTotal),
    ).filter((value, index, values) => values.indexOf(value) === index);
  
    const segments = assigneeSegments.map((s) => {
      const notDone = s.total - s.completed;
      return {
        ...s,
        label: s.name,
        labelColor: s.color,
        sublabel: `${s.completed}/${s.total}`,
        stacks: [
          {
            value: notDone,
            defaultColor: `${s.color}24`,
            highlightColor: `${s.color}38`,
            highlightBoxShadow: `0 0 16px ${s.color}22`,
            borderRadius: "5px 5px 0 0",
          },
          {
            value: s.completed,
            defaultColor: `${s.color}cc`,
            highlightColor: `linear-gradient(180deg,${s.color},${s.color}99)`,
            highlightBoxShadow: `0 0 18px ${s.color}55`,
          },
        ],
      };
    });
  
    return (
      <Card>
        <SectionTitle>Assignee Completed vs Not Completed</SectionTitle>
        <StackedColumnChart
          segments={segments}
          max={maxTotal}
          barAreaHeight={barAreaH}
          gridTicks={gridTicks}
          legend={[
            { color: Chart.completed, label: "Completed portion uses assignee color" },
            { color: Chart.remaining, label: "Remaining uses muted assignee color" },
          ]}
          renderTooltip={(s) => {
            const notDone = s.total - s.completed;
            return (
              <div
                style={{
                  position: "absolute",
                  bottom: barAreaH + 10,
                  background: Background.tooltip,
                  border: `1px solid ${Border.tooltip}`,
                  borderRadius: 8,
                  padding: "8px 12px",
                  zIndex: 10,
                  whiteSpace: "nowrap" as const,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: s.color,
                    fontFamily: "'DM Sans',sans-serif",
                    marginBottom: 4,
                    fontWeight: 800,
                  }}
                >
                  {s.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: s.color,
                    fontFamily: "'DM Mono',monospace",
                    fontWeight: 700,
                  }}
                >
                  ✓ Done: {s.completed} SP
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: `${s.color}99`,
                    fontFamily: "'DM Mono',monospace",
                    fontWeight: 700,
                  }}
                >
                  ✗ Remaining: {notDone} SP
                </div>
              </div>
            );
          }}
        />
      </Card>
    );
  };

export default SprintStackedColumnChart;

