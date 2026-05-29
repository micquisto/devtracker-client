import { TEAM_MEMBERS } from "@/data/Mock.data";
import {
  INCOMPLETE_BOARD_COLUMNS,
  SPRINT_BOARD_COMPLETED_STORY_POINTS,
  SPRINT_BOARD_TASKS,
} from "@/data/SprintBoard.data";
import { Background, Border, Text } from "@/lib/theme";
import { Card } from "@/components/shared/Containers";
import { SectionTitle } from "@/components/shared/Sections";
import { DoughnutChart } from "@/components/shared/Charts";

/* ─── CONTRIBUTION DOUGHNUT ─────────────────── */
const ContributionDoughnut = () => {
    const contributionRows = TEAM_MEMBERS.map((member) => {
      const completedStoryPoints = SPRINT_BOARD_TASKS.filter(
        (task) =>
          task.assignee === member.initials &&
          !INCOMPLETE_BOARD_COLUMNS.includes(task.boardColumn),
      ).reduce((sum, task) => sum + task.points, 0);
      const contribution =
        SPRINT_BOARD_COMPLETED_STORY_POINTS > 0
          ? Math.round(
              (completedStoryPoints / SPRINT_BOARD_COMPLETED_STORY_POINTS) * 100,
            )
          : 0;

      return {
        ...member,
        completedStoryPoints,
        contribution,
        value: completedStoryPoints,
      };
    });
    const segments = contributionRows.filter(
      (member) => member.completedStoryPoints > 0,
    );
  
    return (
      <Card>
        <SectionTitle>Team Contribution</SectionTitle>
        <DoughnutChart
          segments={segments}
          gradientIdPrefix="cg"
          renderCenter={({ hovered, cx, cy }) =>
            hovered ? (
              <>
                <text
                  x={cx}
                  y={cy - 14}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="18"
                  fill={hovered.color}
                  fontFamily="'DM Mono',monospace"
                  fontWeight="800"
                >
                  {hovered.contribution}%
                </text>
                <text
                  x={cx}
                  y={cy + 5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="9"
                  fill={Text.label}
                  fontFamily="'DM Sans',sans-serif"
                >
                  {hovered.initials}
                </text>
                <text
                  x={cx}
                  y={cy + 20}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="8"
                  fill={hovered.color}
                  fontFamily="'DM Mono',monospace"
                >
                  {hovered.completedStoryPoints} SP
                </text>
              </>
            ) : (
              <>
                <text
                  x={cx}
                  y={cy - 8}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="14"
                  fill={Text.primary}
                  fontFamily="'DM Mono',monospace"
                  fontWeight="800"
                >
                  {SPRINT_BOARD_COMPLETED_STORY_POINTS}
                </text>
                <text
                  x={cx}
                  y={cy + 10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="9"
                  fill={Text.faint}
                  fontFamily="'DM Sans',sans-serif"
                >
                  Done SP
                </text>
              </>
            )
          }
          renderLegend={({ segments: segs, hov, setHov }) => (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                minWidth: 130,
              }}
            >
              {contributionRows.map((member) => {
                const segment = segs.find((s) => s.initials === member.initials);
                const isActive = segment ? hov === segment.i : false;

                return (
                  <div
                    key={member.initials}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: isActive ? `${member.color}12` : Background.row,
                      border: `1px solid ${isActive ? member.color + "44" : Border.faint}`,
                      cursor: segment ? "pointer" : "default",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={() => setHov(segment?.i ?? null)}
                    onMouseLeave={() => setHov(null)}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: member.color,
                        flexShrink: 0,
                        opacity: member.completedStoryPoints > 0 ? 1 : 0.45,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontFamily: "'DM Sans',sans-serif",
                          color: Text.body,
                          fontWeight: 600,
                        }}
                      >
                        {member.name}
                      </div>
                      <div
                        style={{
                          height: 3,
                          background: Background.track,
                          borderRadius: 99,
                          overflow: "hidden",
                          marginTop: 3,
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${member.contribution}%`,
                            background: member.color,
                            borderRadius: 99,
                            transition: "width 1s ease",
                          }}
                        />
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "'DM Mono',monospace",
                        fontWeight: 700,
                        color: member.color,
                      }}
                    >
                      {member.completedStoryPoints} SP · {member.contribution}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        />
      </Card>
    );
  }

  export default ContributionDoughnut;