import { SPRINT_BOARD_HISTORY } from "@/data/SprintBoard.data";
import {
  Background,
  Border,
  Chart,
  Palette,
  Semantic,
  Text,
} from "@/lib/theme";
import { Card } from "@/components/shared/Containers";
import { SectionTitle } from "@/components/shared/Sections";
import { ProgressBar } from "@/components/shared/Elements";

/* ─── SPRINT COMPARISON ─────────────────────── */
const SprintComparison = () => {
    const cur = SPRINT_BOARD_HISTORY[SPRINT_BOARD_HISTORY.length - 1];
    const prev = SPRINT_BOARD_HISTORY[SPRINT_BOARD_HISTORY.length - 2];
    const deltaVel = cur.velocity - prev.velocity;
    const deltaPct = Math.round(
      (cur.completed / cur.total - prev.completed / prev.total) * 100,
    );
  
    return (
      <Card>
        <SectionTitle>Sprint vs Sprint Comparison</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[prev, cur].map((s, i) => (
            <div
              key={s.sprint}
              style={{
                padding: "14px",
                borderRadius: 12,
                background:
                  i === 1 ? Background.currentPanel : Background.cardSubtle,
                border: `1px solid ${i === 1 ? Border.hover : Border.subtle}`,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontFamily: "'DM Mono',monospace",
                  color: i === 1 ? Palette.cyan : Text.faint,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  marginBottom: 8,
                }}
              >
                {i === 1 ? "● CURRENT" : "○ PREVIOUS"}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: Text.label,
                  fontFamily: "'DM Sans',sans-serif",
                  marginBottom: 10,
                }}
              >
                {s.sprint}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span
                    style={{
                      fontSize: 11,
                      color: Text.subtle,
                      fontFamily: "'DM Sans',sans-serif",
                    }}
                  >
                    Velocity
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      fontFamily: "'DM Mono',monospace",
                      color: i === 1 ? Semantic.positive : Text.label,
                    }}
                  >
                    {s.velocity} SP
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span
                    style={{
                      fontSize: 11,
                      color: Text.subtle,
                      fontFamily: "'DM Sans',sans-serif",
                    }}
                  >
                    Completion
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      fontFamily: "'DM Mono',monospace",
                      color: i === 1 ? Palette.cyan : Text.label,
                    }}
                  >
                    {s.completed}/{s.total}
                  </span>
                </div>
                <ProgressBar
                  value={s.completed}
                  max={s.total}
                  fillColor={i === 1 ? Palette.cyan : Chart.barValueMuted}
                />
              </div>
            </div>
          ))}
        </div>
        <div
          style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}
        >
          <div
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 10,
              background: Background.successPanel,
              border: `1px solid ${Border.success}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: Text.label,
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              Velocity Δ
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 800,
                fontFamily: "'DM Mono',monospace",
                color: deltaVel >= 0 ? Semantic.positive : Semantic.negativeSoft,
              }}
            >
              {deltaVel >= 0 ? "+" : ""}
              {deltaVel} SP
            </span>
          </div>
          <div
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 10,
              background: Background.cyanPanel,
              border: `1px solid ${Border.hoverSoft}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: Text.label,
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              Completion Δ
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 800,
                fontFamily: "'DM Mono',monospace",
                color: deltaPct >= 0 ? Palette.cyan : Semantic.negativeSoft,
              }}
            >
              {deltaPct >= 0 ? "+" : ""}
              {deltaPct}%
            </span>
          </div>
        </div>
      </Card>
    );
  }

  export default SprintComparison;