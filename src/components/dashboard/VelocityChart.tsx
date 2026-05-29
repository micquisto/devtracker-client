import { SPRINT_BOARD_HISTORY } from "@/data/SprintBoard.data";
import { Background, Border, Chart, Text } from "@/lib/theme";
import { Card } from "@/components/shared/Containers";
import { SectionTitle } from "@/components/shared/Sections";
import { BarChart } from "@/components/shared/Charts";

/* ─── VELOCITY CHART ────────────────────────── */
const VelocityChart = () => {
    const max = 55;
    const avg = Math.round(
      SPRINT_BOARD_HISTORY.reduce((s, h) => s + h.velocity, 0) /
        SPRINT_BOARD_HISTORY.length,
    );
    const segments = SPRINT_BOARD_HISTORY.map((s, i) => ({
      ...s,
      value: s.velocity,
      label: `S${18 + i}`,
    }));
  
    return (
      <Card>
        <SectionTitle>Avg Story Point Velocity</SectionTitle>
        <BarChart
          segments={segments}
          max={max}
          highlightColor={Chart.highlight}
          renderHeader={() => (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  fontFamily: "'DM Mono',monospace",
                  color: Chart.highlight,
                  letterSpacing: "-0.03em",
                }}
              >
                {avg}
              </span>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: Text.subtle,
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  avg SP / sprint
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: Text.greenMuted,
                    fontFamily: "'DM Mono',monospace",
                    fontWeight: 700,
                    marginTop: 2,
                  }}
                >
                  ↑ Trending up
                </div>
              </div>
            </div>
          )}
          renderFooter={() => (
            <div
              style={{
                marginTop: 10,
                padding: "6px 10px",
                borderRadius: 8,
                background: Background.goldPanel,
                border: `1px dashed ${Border.gold}`,
                fontSize: 10,
                color: Text.goldMuted,
                fontFamily: "'DM Mono',monospace",
                textAlign: "center" as const,
              }}
            >
              Target: 48 SP/sprint
            </div>
          )}
        />
      </Card>
    );
  }

  export default VelocityChart;