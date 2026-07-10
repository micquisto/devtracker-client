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

export type StoryPointsHoursPoint = {
  id?: string;
  label: string;
  storyPointsDone: number;
  hoursSpent: number;
};

type StoryPointsHoursLineChartProps = {
  entries: StoryPointsHoursPoint[];
  glowFilterId?: string;
  showHeaderTotals?: boolean;
};

const LABEL_FONT_SIZE = 8;
const LABEL_LINE_HEIGHT = 10;
const LABEL_MAX_LINES = 3;

function formatChartValue(value: number): string {
  return Number((Math.round(value * 100) / 100).toFixed(2)).toString();
}

function getValueDelta(current: number, previous: number | null): number | null {
  if (previous === null || !Number.isFinite(previous) || !Number.isFinite(current)) {
    return null;
  }

  return Math.round((current - previous) * 100) / 100;
}

function formatDeltaLabel(delta: number | null): string {
  if (delta === null) {
    return "—";
  }

  if (delta === 0) {
    return "0";
  }

  const absolute = formatChartValue(Math.abs(delta));
  return delta > 0 ? `+${absolute}` : `-${absolute}`;
}

function getDeltaColor(delta: number | null): string {
  if (delta === null || delta === 0) {
    return Text.muted;
  }

  return delta > 0 ? Palette.green : "#ff6b6b";
}

function getDeltaArrow(delta: number | null): string {
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

export function StoryPointsHoursLineChart({
  entries,
  glowFilterId = "teamComparisonGlow",
  showHeaderTotals = true,
}: StoryPointsHoursLineChartProps) {
  const [animated, setAnimated] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    setAnimated(false);
    const t = setTimeout(() => setAnimated(true), 120);
    return () => clearTimeout(t);
  }, [entries]);

  const totalStoryPoints = entries.reduce(
    (sum, sprint) => sum + sprint.storyPointsDone,
    0,
  );
  const totalHours = entries.reduce(
    (sum, sprint) => sum + sprint.hoursSpent,
    0,
  );
  const pointsPerHour = totalHours
    ? (totalStoryPoints / totalHours).toFixed(2)
    : "0.00";

  const W = 560;
  const pL = 42;
  const pR = 46;
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
  const maxStoryPoints =
    Math.max(0, ...entries.map((s) => s.storyPointsDone), 0) + 5;
  const maxHours = Math.max(0, ...entries.map((s) => s.hoursSpent), 0) + 20;

  const points = entries.map((s, i) => ({
    key: s.id ?? `${s.label}-${i}`,
    x: pL + (entries.length === 1 ? cW / 2 : i * step),
    storyY: pT + cH - (s.storyPointsDone / maxStoryPoints) * cH,
    hoursY: pT + cH - (s.hoursSpent / maxHours) * cH,
    labelLines: wrappedLabels[i] ?? [s.label],
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
  const hoveredPoint = hovered !== null ? points[hovered] : null;
  const previousPoint =
    hovered !== null && hovered > 0 ? points[hovered - 1] : null;
  const storyDelta = hoveredPoint
    ? getValueDelta(
        hoveredPoint.storyPointsDone,
        previousPoint?.storyPointsDone ?? null,
      )
    : null;
  const hoursDelta = hoveredPoint
    ? getValueDelta(hoveredPoint.hoursSpent, previousPoint?.hoursSpent ?? null)
    : null;

  const getTooltipPlacement = (point: (typeof points)[number]) => {
    const tipWidthPct = (148 / W) * 100;
    const tipHeightPct = (64 / H) * 100;
    let leftPct = (point.x / W) * 100;
    leftPct = Math.min(
      Math.max(leftPct, tipWidthPct / 2 + 2),
      100 - tipWidthPct / 2 - 2,
    );

    const aboveY = Math.min(point.storyY, point.hoursY);
    const belowY = Math.max(point.storyY, point.hoursY);
    let topPct = ((aboveY - 10) / H) * 100 - tipHeightPct;
    if (topPct < 2) {
      topPct = ((belowY + 12) / H) * 100;
    }
    topPct = Math.min(Math.max(topPct, 2), 100 - tipHeightPct - 8);

    return { leftPct, topPct };
  };

  const tooltipPlacement = hoveredPoint
    ? getTooltipPlacement(hoveredPoint)
    : null;

  return (
    <div>
      {showHeaderTotals ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 12,
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
            {formatChartValue(totalStoryPoints)} SP
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
            {formatChartValue(totalHours)} hrs
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
      ) : null}

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
              filter={`url(#${glowFilterId})`}
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
              filter={`url(#${glowFilterId})`}
              style={{
                opacity: animated ? 1 : 0,
                transition: "opacity 0.45s ease 0.08s",
              }}
            />

            {points.map((p, i) => (
              <g key={p.key} onMouseEnter={() => setHovered(i)}>
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
                  y={pT + cH + 14}
                  textAnchor="middle"
                  fontSize={LABEL_FONT_SIZE}
                  fill={Text.muted}
                  fontFamily="'DM Sans',sans-serif"
                  fontWeight="600"
                >
                  {p.labelLines.map((line, lineIndex) => (
                    <tspan
                      key={`${p.key}-line-${lineIndex}`}
                      x={p.x}
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
                  minWidth: 148,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: Background.tooltipAlt,
                  border: `1px solid ${Border.tooltipSoft}`,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: "'DM Mono',monospace",
                    fontWeight: 800,
                    color: Palette.cyan,
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatChartValue(hoveredPoint.storyPointsDone)} SP done
                  <span style={{ color: getDeltaColor(storyDelta), marginLeft: 6 }}>
                    {formatDeltaLabel(storyDelta)}
                    {getDeltaArrow(storyDelta)}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    fontFamily: "'DM Mono',monospace",
                    fontWeight: 800,
                    color: Palette.gold,
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatChartValue(hoveredPoint.hoursSpent)} hrs spent
                  <span style={{ color: getDeltaColor(hoursDelta), marginLeft: 6 }}>
                    {formatDeltaLabel(hoursDelta)}
                    {getDeltaArrow(hoursDelta)}
                  </span>
                </div>
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

const TeamLineChart = () => {
  const entries: StoryPointsHoursPoint[] = SPRINT_BOARD_HISTORY.map((sprint) => ({
    label: sprint.sprint.replace("Sprint ", "S").replace(" (Current)", ""),
    storyPointsDone: sprint.storyPointsDone,
    hoursSpent: sprint.hoursSpent,
  }));

  return (
    <Card>
      <SectionTitle>Completed Story Points vs Hours Spent</SectionTitle>
      <div style={{ marginTop: -8 }}>
        <StoryPointsHoursLineChart
          entries={entries}
          glowFilterId="teamComparisonGlow"
        />
      </div>
    </Card>
  );
};

export default TeamLineChart;
