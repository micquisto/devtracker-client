import { useEffect, useState } from "react";
import {
  Background,
  Border,
  Chart,
  Palette,
  Text,
} from "@/lib/theme";

export type PerformanceScoresBySprintPoint = {
  id?: string;
  label: string;
  productivity: number;
  efficiency: number;
  quality: number;
  collaboration: number;
  velocity: number;
  professionalism: number;
};

type SeriesKey = Exclude<keyof PerformanceScoresBySprintPoint, "id" | "label">;

const SERIES: Array<{ key: SeriesKey; label: string; color: string }> = [
  { key: "productivity", label: "Productivity", color: Palette.cyan },
  { key: "efficiency", label: "Efficiency", color: Palette.green },
  { key: "quality", label: "Quality", color: Palette.indigo },
  { key: "collaboration", label: "Collaboration", color: Palette.pink },
  { key: "velocity", label: "Velocity", color: Palette.gold },
  { key: "professionalism", label: "Professionalism", color: "#ff9f43" },
];

const LABEL_FONT_SIZE = 8;
const LABEL_LINE_HEIGHT = 10;
const LABEL_MAX_LINES = 3;

function formatScoreValue(value: number): string {
  return Number((Math.round(value * 100) / 100).toFixed(2)).toString();
}

function getScoreDelta(current: number, previous: number | null): number | null {
  if (previous === null || !Number.isFinite(previous) || !Number.isFinite(current)) {
    return null;
  }

  return Math.round((current - previous) * 100) / 100;
}

function formatScoreDeltaLabel(delta: number | null): string {
  if (delta === null) {
    return "—";
  }

  if (delta === 0) {
    return "0";
  }

  const absolute = formatScoreValue(Math.abs(delta));
  return delta > 0 ? `+${absolute}` : `-${absolute}`;
}

function getScoreDeltaColor(delta: number | null): string {
  if (delta === null || delta === 0) {
    return Text.muted;
  }

  return delta > 0 ? Palette.green : "#ff6b6b";
}

function getScoreDeltaArrow(delta: number | null): string {
  if (delta === null || delta === 0) {
    return "";
  }

  return delta > 0 ? " ▲" : " ▼";
}

function wrapAxisLabel(
  label: string,
  maxWidthPx: number,
  fontSize: number,
  maxLines = LABEL_MAX_LINES,
): string[] {
  const trimmed = label.trim();
  if (!trimmed) {
    return [""];
  }

  const avgCharWidth = fontSize * 0.58;
  const maxChars = Math.max(4, Math.floor(maxWidthPx / avgCharWidth));
  const words = trimmed.split(/\s+/u);
  const lines: string[] = [];
  let current = "";

  const pushHardBroken = (word: string) => {
    let rest = word;
    while (rest.length > maxChars) {
      lines.push(rest.slice(0, maxChars));
      rest = rest.slice(maxChars);
      if (lines.length >= maxLines) {
        return;
      }
    }
    current = rest;
  };

  for (const word of words) {
    if (lines.length >= maxLines) {
      break;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
      if (lines.length >= maxLines) {
        break;
      }
    }

    if (word.length > maxChars) {
      pushHardBroken(word);
    } else {
      current = word;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (lines.length === 0) {
    return [trimmed.slice(0, maxChars)];
  }

  const usedLength = lines.join(" ").length;
  if (usedLength < trimmed.length && lines.length > 0) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] =
      last.length > 1 ? `${last.slice(0, Math.max(1, last.length - 1))}…` : "…";
  }

  return lines;
}

type PerformanceScoresBySprintLineChartProps = {
  entries: PerformanceScoresBySprintPoint[];
  glowFilterId?: string;
};

export function PerformanceScoresBySprintLineChart({
  entries,
  glowFilterId = "performanceScoresBySprintGlow",
}: PerformanceScoresBySprintLineChartProps) {
  const [animated, setAnimated] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    setAnimated(false);
    const t = setTimeout(() => setAnimated(true), 120);
    return () => clearTimeout(t);
  }, [entries]);

  const W = 560;
  const pL = 42;
  const pR = 16;
  const pT = 26;
  const plotH = 148;
  const cW = W - pL - pR;
  const step = entries.length > 1 ? cW / (entries.length - 1) : 0;
  const labelMaxWidth =
    entries.length > 1 ? Math.max(step * 0.9, 64) : Math.min(cW * 0.5, 160);

  const wrappedLabels = entries.map((entry) =>
    wrapAxisLabel(entry.label, labelMaxWidth, LABEL_FONT_SIZE),
  );
  const maxLabelLines = Math.max(
    1,
    ...wrappedLabels.map((lines) => lines.length),
  );
  const pB = 18 + maxLabelLines * LABEL_LINE_HEIGHT;
  const cH = plotH;
  const H = pT + cH + pB;
  const maxScore = 100;
  const gridTicks = [0, 0.25, 0.5, 0.75, 1];

  const points = entries.map((entry, index) => ({
    key: entry.id ?? `${entry.label}-${index}`,
    x: pL + (entries.length === 1 ? cW / 2 : index * step),
    labelLines: wrappedLabels[index] ?? [entry.label],
    values: {
      productivity: entry.productivity,
      efficiency: entry.efficiency,
      quality: entry.quality,
      collaboration: entry.collaboration,
      velocity: entry.velocity,
      professionalism: entry.professionalism,
    },
    ys: SERIES.reduce(
      (acc, series) => {
        acc[series.key] =
          pT + cH - (Math.min(maxScore, Math.max(0, entry[series.key])) / maxScore) * cH;
        return acc;
      },
      {} as Record<SeriesKey, number>,
    ),
  }));

  const pathFor = (key: SeriesKey) =>
    points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.ys[key].toFixed(1)}`,
      )
      .join(" ");

  const tooltipHeight = 18 + SERIES.length * 16;
  const hoveredPoint = hovered !== null ? points[hovered] : null;
  const previousPoint =
    hovered !== null && hovered > 0 ? points[hovered - 1] : null;

  const getTooltipPlacement = (point: (typeof points)[number]) => {
    const tipWidthPct = (210 / W) * 100;
    const tipHeightPct = ((tooltipHeight + 28) / H) * 100;
    let leftPct = (point.x / W) * 100;
    // Prefer shifting tooltip to the side of the point when near edges
    if (leftPct < 28) {
      leftPct = leftPct + tipWidthPct / 2 + 4;
    } else if (leftPct > 72) {
      leftPct = leftPct - tipWidthPct / 2 - 4;
    }
    leftPct = Math.min(
      Math.max(leftPct, tipWidthPct / 2 + 1),
      100 - tipWidthPct / 2 - 1,
    );

    let topPct = ((pT + 10) / H) * 100;
    if (topPct + tipHeightPct > 92) {
      topPct = Math.max(2, 92 - tipHeightPct);
    }

    return { leftPct, topPct };
  };

  const tooltipPlacement = hoveredPoint
    ? getTooltipPlacement(hoveredPoint)
    : null;

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 18,
          marginBottom: 14,
          flexWrap: "wrap",
          rowGap: 10,
        }}
      >
        {SERIES.map((series) => (
          <div
            key={series.key}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <div
              style={{
                width: 22,
                height: 3,
                background: series.color,
                borderRadius: 99,
                boxShadow: `0 0 8px ${series.color}55`,
              }}
            />
            <span
              style={{
                fontSize: 13,
                color: "rgba(210, 230, 255, 0.92)",
                fontFamily: "'DM Sans',sans-serif",
                fontWeight: 700,
                letterSpacing: "0.01em",
              }}
            >
              {series.label}
            </span>
          </div>
        ))}
      </div>

      <div style={{ width: "100%", overflowX: "auto" }}>
        {entries.length === 0 ? (
          <div
            style={{
              padding: "28px 8px",
              textAlign: "center",
              fontSize: 12,
              color: Text.muted,
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            No sprint data for the selected period.
          </div>
        ) : (
          <div
            style={{
              position: "relative",
              width: "100%",
              minWidth: 340,
            }}
            onMouseLeave={() => setHovered(null)}
          >
            <svg
              viewBox={`0 0 ${W} ${H}`}
              style={{ width: "100%", display: "block", overflow: "visible" }}
            >
            <defs>
              <filter id={glowFilterId}>
                <feGaussianBlur stdDeviation="1.4" result="blur" />
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
                    {Math.round(maxScore * tick)}
                  </text>
                </g>
              );
            })}

            <text
              x={pL}
              y={12}
              fontSize="8"
              fill={Text.muted}
              fontFamily="'DM Mono',monospace"
              fontWeight="700"
            >
              SCORE
            </text>

            {SERIES.map((series, seriesIndex) => (
              <path
                key={series.key}
                d={pathFor(series.key)}
                fill="none"
                stroke={series.color}
                strokeWidth="0.75"
                strokeLinejoin="round"
                filter={`url(#${glowFilterId})`}
                style={{
                  opacity: animated ? 1 : 0,
                  transition: `opacity 0.45s ease ${seriesIndex * 0.04}s`,
                }}
              />
            ))}

            {points.map((point, index) => (
              <g key={point.key} onMouseEnter={() => setHovered(index)}>
                <line
                  x1={point.x}
                  y1={pT}
                  x2={point.x}
                  y2={pT + cH}
                  stroke={
                    hovered === index
                      ? Border.tooltipSoft
                      : "rgba(100,180,255,0.04)"
                  }
                  strokeWidth="1"
                />
                {SERIES.map((series) => (
                  <circle
                    key={`${point.key}-${series.key}`}
                    cx={point.x}
                    cy={point.ys[series.key]}
                    r={hovered === index ? 4.5 : 2.75}
                    fill={series.color}
                    stroke={Palette.navy}
                    strokeWidth="1.1"
                    style={{ opacity: animated ? 1 : 0, transition: "all 0.2s" }}
                  />
                ))}
                <text
                  x={point.x}
                  y={pT + cH + 14}
                  textAnchor="middle"
                  fontSize={LABEL_FONT_SIZE}
                  fill={Text.muted}
                  fontFamily="'DM Sans',sans-serif"
                  fontWeight="600"
                >
                  {point.labelLines.map((line, lineIndex) => (
                    <tspan
                      key={`${point.key}-line-${lineIndex}`}
                      x={point.x}
                      dy={lineIndex === 0 ? 0 : LABEL_LINE_HEIGHT}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
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

            {hoveredPoint && tooltipPlacement ? (
              <div
                style={{
                  position: "absolute",
                  left: `${tooltipPlacement.leftPct}%`,
                  top: `${tooltipPlacement.topPct}%`,
                  transform: "translateX(-50%)",
                  zIndex: 6,
                  pointerEvents: "none",
                  minWidth: 196,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: Background.tooltipAlt,
                  border: `1px solid ${Border.tooltipSoft}`,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                }}
              >
                {SERIES.map((series) => {
                  const delta = getScoreDelta(
                    hoveredPoint.values[series.key],
                    previousPoint?.values[series.key] ?? null,
                  );

                  return (
                    <div
                      key={`${hoveredPoint.key}-tip-${series.key}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        fontSize: 11,
                        fontFamily: "'DM Mono',monospace",
                        fontWeight: 800,
                        color: series.color,
                        whiteSpace: "nowrap",
                        lineHeight: 1.45,
                      }}
                    >
                      <span>
                        {series.label}: {formatScoreValue(hoveredPoint.values[series.key])}%
                      </span>
                      <span style={{ color: getScoreDeltaColor(delta) }}>
                        {formatScoreDeltaLabel(delta)}
                        {getScoreDeltaArrow(delta)}
                      </span>
                    </div>
                  );
                })}
                {previousPoint ? null : (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 9,
                      color: Text.faint,
                      fontFamily: "'DM Sans',sans-serif",
                    }}
                  >
                    No previous sprint
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export default PerformanceScoresBySprintLineChart;
