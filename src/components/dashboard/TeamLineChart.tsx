import { useState, useEffect } from "react";
import { SPRINT_BOARD_HISTORY } from "@/data/SprintBoard.data";
import {
  Background,
  Border,
  Chart,
  Palette,
  Text,
} from "@/lib/theme";
import { Card } from "@/components/shared/Containers";
import { SectionTitle } from "@/components/shared/Sections";

/* ─── TEAM LINE CHART WRAPPER ─────────────── */
const TeamLineChart = () => {
  const [animated, setAnimated] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 120);
    return () => clearTimeout(t);
  }, []);

  const totalStoryPoints = SPRINT_BOARD_HISTORY.reduce(
    (sum, sprint) => sum + sprint.storyPointsDone,
    0,
  );
  const totalHours = SPRINT_BOARD_HISTORY.reduce(
    (sum, sprint) => sum + sprint.hoursSpent,
    0,
  );
  const pointsPerHour = totalHours
    ? (totalStoryPoints / totalHours).toFixed(2)
    : "0.00";

  const W = 560;
  const H = 210;
  const pL = 42;
  const pR = 46;
  const pT = 26;
  const pB = 36;
  const cW = W - pL - pR;
  const cH = H - pT - pB;
  const maxStoryPoints =
    Math.max(...SPRINT_BOARD_HISTORY.map((s) => s.storyPointsDone)) + 5;
  const maxHours = Math.max(...SPRINT_BOARD_HISTORY.map((s) => s.hoursSpent)) + 20;
  const step =
    SPRINT_BOARD_HISTORY.length > 1 ? cW / (SPRINT_BOARD_HISTORY.length - 1) : 0;

  const points = SPRINT_BOARD_HISTORY.map((s, i) => ({
    x: pL + i * step,
    storyY: pT + cH - (s.storyPointsDone / maxStoryPoints) * cH,
    hoursY: pT + cH - (s.hoursSpent / maxHours) * cH,
    label: s.sprint.replace("Sprint ", "S").replace(" (Current)", ""),
    storyPointsDone: s.storyPointsDone,
    hoursSpent: s.hoursSpent,
  }));

  const pathFor = (key: "storyY" | "hoursY") =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p[key].toFixed(1)}`)
      .join(" ");

  const storyPath = pathFor("storyY");
  const hoursPath = pathFor("hoursY");
  const gridTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <Card>
      {/* ── Header row ── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap" as const,
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <SectionTitle>Completed Story Points vs Hours Spent</SectionTitle>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginTop: -8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 20,
                fontWeight: 800,
                fontFamily: "'DM Mono',monospace",
                color: Palette.cyan,
                letterSpacing: "-0.03em",
              }}
            >
              {totalStoryPoints} SP
            </span>
            <span
              style={{
                fontSize: 20,
                fontWeight: 800,
                fontFamily: "'DM Mono',monospace",
                color: Palette.gold,
                letterSpacing: "-0.03em",
              }}
            >
              {totalHours} hrs
            </span>
            <span
              style={{
                fontSize: 11,
                fontFamily: "'DM Mono',monospace",
                color: Text.subtle,
                fontWeight: 700,
              }}
            >
              {pointsPerHour} SP/hr
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 8,
          flexWrap: "wrap" as const,
        }}
      >
        {[
          [Palette.cyan, "Completed story points"],
          [Palette.gold, "Hours spent"],
        ].map(([c, l]) => (
          <div
            key={l}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <div
              style={{
                width: 18,
                height: 2,
                background: c,
                borderRadius: 99,
              }}
            />
            <span
              style={{
                fontSize: 10,
                color: Text.muted,
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              {l}
            </span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", minWidth: 340, display: "block" }}
          onMouseLeave={() => setHovered(null)}
        >
          <defs>
            <filter id="teamComparisonGlow">
              <feGaussianBlur stdDeviation="1.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {gridTicks.map((tick) => {
            const y = pT + cH - tick * cH;
            return (
              <g key={tick}>
                <line
                  x1={pL}
                  y1={y}
                  x2={W - pR}
                  y2={y}
                  stroke={Chart.grid}
                  strokeWidth="1"
                  strokeDasharray="4 3"
                />
                <text
                  x={pL - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="8"
                  fill={Text.faint}
                  fontFamily="'DM Mono',monospace"
                >
                  {Math.round(maxStoryPoints * tick)}
                </text>
                <text
                  x={W - pR + 6}
                  y={y + 3}
                  textAnchor="start"
                  fontSize="8"
                  fill={Text.faint}
                  fontFamily="'DM Mono',monospace"
                >
                  {Math.round(maxHours * tick)}
                </text>
              </g>
            );
          })}

          <text
            x={pL}
            y={12}
            fontSize="8"
            fill={Palette.cyan}
            fontFamily="'DM Mono',monospace"
            fontWeight="700"
          >
            SP
          </text>
          <text
            x={W - pR}
            y={12}
            textAnchor="end"
            fontSize="8"
            fill={Palette.gold}
            fontFamily="'DM Mono',monospace"
            fontWeight="700"
          >
            HRS
          </text>

          <path
            d={storyPath}
            fill="none"
            stroke={Palette.cyan}
            strokeWidth="1.75"
            strokeLinejoin="round"
            filter="url(#teamComparisonGlow)"
            style={{
              opacity: animated ? 1 : 0,
              transition: "opacity 0.45s ease",
            }}
          />
          <path
            d={hoursPath}
            fill="none"
            stroke={Palette.gold}
            strokeWidth="1.75"
            strokeLinejoin="round"
            strokeDasharray="5 4"
            filter="url(#teamComparisonGlow)"
            style={{
              opacity: animated ? 1 : 0,
              transition: "opacity 0.45s ease 0.08s",
            }}
          />

          {points.map((p, i) => (
            <g key={p.label} onMouseEnter={() => setHovered(i)}>
              <line
                x1={p.x}
                y1={pT}
                x2={p.x}
                y2={pT + cH}
                stroke={
                  hovered === i ? Border.tooltipSoft : "rgba(100,180,255,0.04)"
                }
                strokeWidth="1"
              />
              <circle
                cx={p.x}
                cy={p.storyY}
                r={hovered === i ? 5 : 3}
                fill={Palette.cyan}
                stroke={Palette.navy}
                strokeWidth="1.2"
                style={{ opacity: animated ? 1 : 0, transition: "all 0.2s" }}
              />
              <circle
                cx={p.x}
                cy={p.hoursY}
                r={hovered === i ? 5 : 3}
                fill={Palette.gold}
                stroke={Palette.navy}
                strokeWidth="1.2"
                style={{ opacity: animated ? 1 : 0, transition: "all 0.2s" }}
              />
              <text
                x={p.x}
                y={pT + cH + 17}
                textAnchor="middle"
                fontSize="8"
                fill={Text.faint}
                fontFamily="'DM Mono',monospace"
              >
                {p.label}
              </text>
              {hovered === i && (
                <g>
                  <rect
                    x={Math.min(Math.max(p.x - 48, pL), W - pR - 96)}
                    y={Math.min(p.storyY, p.hoursY) - 44}
                    width={96}
                    height={36}
                    rx="6"
                    fill={Background.tooltipAlt}
                    stroke={Border.tooltipSoft}
                    strokeWidth="1"
                  />
                  <text
                    x={Math.min(Math.max(p.x, pL + 48), W - pR - 48)}
                    y={Math.min(p.storyY, p.hoursY) - 30}
                    textAnchor="middle"
                    fontSize="9"
                    fill={Palette.cyan}
                    fontFamily="'DM Mono',monospace"
                    fontWeight="800"
                  >
                    {p.storyPointsDone} SP done
                  </text>
                  <text
                    x={Math.min(Math.max(p.x, pL + 48), W - pR - 48)}
                    y={Math.min(p.storyY, p.hoursY) - 16}
                    textAnchor="middle"
                    fontSize="9"
                    fill={Palette.gold}
                    fontFamily="'DM Mono',monospace"
                    fontWeight="800"
                  >
                    {p.hoursSpent} hrs spent
                  </text>
                </g>
              )}
            </g>
          ))}

          <line
            x1={pL}
            y1={pT + cH}
            x2={W - pR}
            y2={pT + cH}
            stroke={Chart.axis}
            strokeWidth="1"
          />
        </svg>
      </div>
    </Card>
  );
}

export default TeamLineChart;