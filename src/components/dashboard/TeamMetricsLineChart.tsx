import { useEffect, useState } from "react";
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

type MetricKey = keyof (typeof SPRINT_BOARD_HISTORY)[number]["performanceMetrics"];

const METRICS: { key: MetricKey; label: string; color: string }[] = [
  { key: "productivity", label: "Productivity", color: Palette.cyan },
  { key: "efficiency", label: "Efficiency", color: Palette.green },
  { key: "quality", label: "Quality", color: Palette.gold },
  { key: "collaboration", label: "Collaboration", color: Palette.purple },
  { key: "velocity", label: "Velocity", color: Palette.pink },
];

const TeamMetricsLineChart = () => {
  const [animated, setAnimated] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 160);
    return () => clearTimeout(t);
  }, []);

  const W = 560;
  const H = 230;
  const pL = 38;
  const pR = 18;
  const pT = 26;
  const pB = 38;
  const cW = W - pL - pR;
  const cH = H - pT - pB;
  const step =
    SPRINT_BOARD_HISTORY.length > 1 ? cW / (SPRINT_BOARD_HISTORY.length - 1) : 0;
  const gridTicks = [0, 25, 50, 75, 100];

  const points = SPRINT_BOARD_HISTORY.map((s, i) => ({
    x: pL + i * step,
    label: s.sprint.replace("Sprint ", "S").replace(" (Current)", ""),
    metrics: s.performanceMetrics,
  }));

  const yFor = (value: number) => pT + cH - (value / 100) * cH;

  const pathFor = (metric: MetricKey) =>
    points
      .map((p, i) => {
        const y = yFor(p.metrics[metric]);
        return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  const metricAverages = METRICS.map(({ key }) =>
    Math.round(
      SPRINT_BOARD_HISTORY.reduce((sum, s) => sum + s.performanceMetrics[key], 0) /
        SPRINT_BOARD_HISTORY.length,
    ),
  );
  const overallAvg = Math.round(
    metricAverages.reduce((sum, v) => sum + v, 0) / metricAverages.length,
  );

  return (
    <Card>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div>
          <SectionTitle>Sprint Metrics Comparison</SectionTitle>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
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
              {overallAvg}/100
            </span>
            <span
              style={{
                fontSize: 11,
                fontFamily: "'DM Mono',monospace",
                color: Text.subtle,
                fontWeight: 700,
              }}
            >
              avg across productivity, efficiency, quality, collaboration, velocity
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        {METRICS.map((m) => (
          <div
            key={m.key}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <div
              style={{
                width: 18,
                height: 2,
                background: m.color,
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
              {m.label}
            </span>
          </div>
        ))}
      </div>

      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", minWidth: 360, display: "block" }}
          onMouseLeave={() => setHovered(null)}
        >
          <defs>
            <filter id="teamMetricsGlow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {gridTicks.map((tick) => {
            const y = yFor(tick);
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
                  {tick}
                </text>
              </g>
            );
          })}

          {METRICS.map((metric, mi) => (
            <path
              key={metric.key}
              d={pathFor(metric.key)}
              fill="none"
              stroke={metric.color}
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeDasharray={mi % 2 === 0 ? "none" : "5 4"}
              filter="url(#teamMetricsGlow)"
              style={{
                opacity: animated ? 1 : 0,
                transition: `opacity 0.45s ease ${mi * 0.05}s`,
              }}
            />
          ))}

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
              {METRICS.map((metric) => (
                <circle
                  key={metric.key}
                  cx={p.x}
                  cy={yFor(p.metrics[metric.key])}
                  r={hovered === i ? 4.5 : 2.5}
                  fill={metric.color}
                  stroke={Palette.navy}
                  strokeWidth="1"
                  style={{
                    opacity: animated ? 1 : 0,
                    transition: "all 0.2s",
                  }}
                />
              ))}
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
                    x={Math.min(Math.max(p.x - 62, pL), W - pR - 124)}
                    y={pT + 8}
                    width={124}
                    height={80}
                    rx="6"
                    fill={Background.tooltipAlt}
                    stroke={Border.tooltipSoft}
                    strokeWidth="1"
                  />
                  {METRICS.map((metric, mi) => (
                    <text
                      key={metric.key}
                      x={Math.min(Math.max(p.x - 52, pL + 10), W - pR - 114)}
                      y={pT + 25 + mi * 12}
                      fontSize="8"
                      fill={metric.color}
                      fontFamily="'DM Mono',monospace"
                      fontWeight="800"
                    >
                      {metric.label}: {p.metrics[metric.key]}
                    </text>
                  ))}
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
};

export default TeamMetricsLineChart;
