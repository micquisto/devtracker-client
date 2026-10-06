import { useEffect, useRef, useState } from "react";
import {
  Background,
  Border,
  Chart,
  Palette,
  Text,
  CHART_LABEL_FONT_SIZE,
  CHART_LABEL_FONT_FAMILY,
  CHART_LABEL_FONT_WEIGHT,
  CHART_LABEL_LETTER_SPACING,
  CHART_LABEL_TEXT_TRANSFORM,
  CHART_LABEL_MAX_LINES,
  chartLegendStyle,
  chartLabelSvgProps,
  wrapChartLabel,
} from "@/lib/theme";

export type PerformanceScoresBySprintPoint = {
  id?: string;
  label: string;
  labelLines?: string[];
  sublabel?: string | null;
  productivity: number;
  efficiency: number;
  quality: number;
  collaboration: number;
  velocity: number;
  professionalism: number;
  overallScore?: number | null;
  hoursAccumulated?: number | null;
};

type SeriesKey =
  | "productivity"
  | "efficiency"
  | "quality"
  | "collaboration"
  | "velocity"
  | "professionalism"
  | "overallScore"
  | "hoursAccumulated";

const BASE_SERIES: Array<{
  key: Exclude<SeriesKey, "overallScore" | "hoursAccumulated">;
  label: string;
  color: string;
}> = [
  { key: "productivity", label: "Productivity", color: Palette.cyan },
  { key: "efficiency", label: "Efficiency", color: Palette.green },
  { key: "quality", label: "Quality", color: Palette.indigo },
  { key: "collaboration", label: "Collaboration", color: Palette.pink },
  { key: "velocity", label: "Velocity", color: Palette.gold },
  { key: "professionalism", label: "Professionalism", color: "#ff9f43" },
];

const OVERALL_SERIES: { key: "overallScore"; label: string; color: string } = {
  key: "overallScore",
  label: "Overall Score",
  color: Palette.purple,
};

const HOURS_SERIES: { key: "hoursAccumulated"; label: string; color: string } = {
  key: "hoursAccumulated",
  label: "Hours Accumulated",
  color: "#67e8f9",
};

const LABEL_MAX_LINES = Math.max(CHART_LABEL_MAX_LINES, 5);
const MIN_LABEL_FONT_SIZE = 5.5;
const MAX_LABEL_FONT_SIZE = CHART_LABEL_FONT_SIZE;

function getResponsiveLabelFontSize(
  containerWidthPx: number,
  entryCount: number,
): number {
  if (entryCount <= 1) {
    return MAX_LABEL_FONT_SIZE;
  }

  const usableWidth = Math.max(containerWidthPx - 96, 160);
  const columnWidth = usableWidth / entryCount;
  // Fit roughly 4-5 compact characters per column.
  const sizeFromDensity = columnWidth / 4.6;
  const sizeFromViewport = Math.min(
    MAX_LABEL_FONT_SIZE,
    Math.max(MIN_LABEL_FONT_SIZE, containerWidthPx / 120),
  );

  return Math.min(
    MAX_LABEL_FONT_SIZE,
    Math.max(MIN_LABEL_FONT_SIZE, Math.min(sizeFromDensity, sizeFromViewport)),
  );
}

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

type PerformanceScoresBySprintLineChartProps = {
  entries: PerformanceScoresBySprintPoint[];
  glowFilterId?: string;
  includeOverallScore?: boolean;
  includeHoursAccumulated?: boolean;
  emptyPreviousLabel?: string;
  emptyEntriesLabel?: string;
};

export function PerformanceScoresBySprintLineChart({
  entries,
  glowFilterId = "performanceScoresBySprintGlow",
  includeOverallScore = false,
  includeHoursAccumulated = false,
  emptyPreviousLabel = "No previous sprint",
  emptyEntriesLabel = "No sprint data for the selected period.",
}: PerformanceScoresBySprintLineChartProps) {
  const SERIES: Array<{ key: SeriesKey; label: string; color: string }> = [
    ...(includeOverallScore ? [OVERALL_SERIES] : []),
    ...BASE_SERIES,
    ...(includeHoursAccumulated ? [HOURS_SERIES] : []),
  ];

  const [animated, setAnimated] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(720);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [visibleSeries, setVisibleSeries] = useState<Record<SeriesKey, boolean>>(
    () =>
      Object.fromEntries(
        SERIES.map((series) => [series.key, true]),
      ) as Record<SeriesKey, boolean>,
  );

  useEffect(() => {
    setVisibleSeries((current) => {
      const next = { ...current } as Record<SeriesKey, boolean>;
      for (const series of SERIES) {
        if (next[series.key] === undefined) {
          next[series.key] = true;
        }
      }
      return next;
    });
  }, [includeOverallScore, includeHoursAccumulated]);

  useEffect(() => {
    setAnimated(false);
    const t = setTimeout(() => setAnimated(true), 120);
    return () => clearTimeout(t);
  }, [entries, includeOverallScore, includeHoursAccumulated, visibleSeries]);

  useEffect(() => {
    const element = chartContainerRef.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((observations) => {
      const width = observations[0]?.contentRect.width;
      if (Number.isFinite(width) && width > 0) {
        setContainerWidth(width);
      }
    });

    observer.observe(element);
    setContainerWidth(element.getBoundingClientRect().width || 720);

    return () => observer.disconnect();
  }, []);

  const visibleSeriesList = SERIES.filter(
    (series) => visibleSeries[series.key] !== false,
  );
  const showHoursAxis =
    includeHoursAccumulated &&
    visibleSeries.hoursAccumulated !== false;

  const toggleSeries = (key: SeriesKey) => {
    setVisibleSeries((current) => {
      const isCurrentlyVisible = current[key] !== false;
      const visibleCount = SERIES.filter(
        (series) => current[series.key] !== false,
      ).length;

      // Keep at least one series visible.
      if (isCurrentlyVisible && visibleCount <= 1) {
        return current;
      }

      return {
        ...current,
        [key]: !isCurrentlyVisible,
      };
    });
  };

  const labelFontSize = getResponsiveLabelFontSize(
    containerWidth,
    entries.length,
  );
  const labelLineHeight = Math.ceil(labelFontSize * 1.15);
  const labelLetterSpacing =
    entries.length >= 12
      ? "0.02em"
      : entries.length >= 8
        ? "0.04em"
        : CHART_LABEL_LETTER_SPACING;

  const W = 560;
  const pL = 48;
  const pR = showHoursAxis ? 52 : 48;
  const pT = 26;
  const plotH = 148;
  const cW = W - pL - pR;
  const step = entries.length > 1 ? cW / (entries.length - 1) : 0;
  const minSvgCssWidth = Math.max(
    340,
    entries.length > 1 ? entries.length * Math.max(28, labelFontSize * 4.2) : 340,
  );
  const displayWidthCss = Math.max(containerWidth, minSvgCssWidth, 280);
  const viewBoxToCss = displayWidthCss / W;

  const getLabelLayout = (index: number) => {
    const pointX = pL + (entries.length === 1 ? cW / 2 : index * step);

    if (entries.length <= 1) {
      return {
        textAnchor: "middle" as const,
        labelX: pointX,
        maxWidthCss: Math.min(cW * 0.45, 96) * viewBoxToCss,
      };
    }

    const maxWidthCss = Math.max(
      step * 0.9 * viewBoxToCss,
      labelFontSize * 3.2,
    );

    return {
      textAnchor: "middle" as const,
      labelX: pointX,
      maxWidthCss,
    };
  };

  const wrappedLabels = entries.map((entry, index) => {
    if (entry.labelLines && entry.labelLines.length > 0) {
      return entry.labelLines
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, LABEL_MAX_LINES);
    }

    const { maxWidthCss } = getLabelLayout(index);
    return wrapChartLabel(
      entry.label,
      maxWidthCss,
      labelFontSize,
      entry.sublabel ? Math.max(LABEL_MAX_LINES - 1, 1) : LABEL_MAX_LINES,
    );
  });
  const maxLabelLines = Math.max(
    1,
    ...wrappedLabels.map(
      (lines, index) => lines.length + (entries[index]?.sublabel ? 1 : 0),
    ),
  );
  const pB = 14 + maxLabelLines * labelLineHeight;
  const cH = plotH;
  const H = pT + cH + pB;
  const maxScore = 100;
  const maxHours = Math.max(
    1,
    ...entries.map((entry) =>
      Number.isFinite(entry.hoursAccumulated) ? Number(entry.hoursAccumulated) : 0,
    ),
  );
  const gridTicks = [0, 0.25, 0.5, 0.75, 1];

  const getSeriesValue = (
    entry: PerformanceScoresBySprintPoint,
    key: SeriesKey,
  ): number => {
    if (key === "overallScore") {
      return Number.isFinite(entry.overallScore) ? Number(entry.overallScore) : 0;
    }

    if (key === "hoursAccumulated") {
      return Number.isFinite(entry.hoursAccumulated)
        ? Number(entry.hoursAccumulated)
        : 0;
    }

    return entry[key];
  };

  const getSeriesY = (value: number, key: SeriesKey): number => {
    if (key === "hoursAccumulated") {
      return pT + cH - (Math.max(0, value) / maxHours) * cH;
    }

    return (
      pT + cH - (Math.min(maxScore, Math.max(0, value)) / maxScore) * cH
    );
  };

  const points = entries.map((entry, index) => {
    const layout = getLabelLayout(index);
    const values = SERIES.reduce(
      (acc, series) => {
        acc[series.key] = getSeriesValue(entry, series.key);
        return acc;
      },
      {} as Record<SeriesKey, number>,
    );

    return {
      key: entry.id ?? `${entry.label}-${index}`,
      x: pL + (entries.length === 1 ? cW / 2 : index * step),
      labelX: layout.labelX,
      textAnchor: layout.textAnchor,
      labelLines: wrappedLabels[index] ?? [entry.label],
      sublabel: entry.sublabel?.trim() || null,
      values,
      ys: SERIES.reduce(
        (acc, series) => {
          acc[series.key] = getSeriesY(values[series.key], series.key);
          return acc;
        },
        {} as Record<SeriesKey, number>,
      ),
    };
  });

  const pathFor = (key: SeriesKey) =>
    points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.ys[key].toFixed(1)}`,
      )
      .join(" ");

  const tooltipHeight = 18 + Math.max(visibleSeriesList.length, 1) * 16;
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

  const formatSeriesTooltipValue = (key: SeriesKey, value: number): string => {
    if (key === "hoursAccumulated") {
      return `${formatScoreValue(value)} hrs`;
    }

    return `${formatScoreValue(value)}%`;
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 14,
          marginBottom: 14,
          flexWrap: "wrap",
          rowGap: 10,
        }}
      >
        {SERIES.map((series) => {
          const isVisible = visibleSeries[series.key] !== false;
          const checkboxId = `${glowFilterId}-${series.key}`;

          return (
            <label
              key={series.key}
              htmlFor={checkboxId}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                userSelect: "none",
                opacity: isVisible ? 1 : 0.45,
              }}
            >
              <input
                id={checkboxId}
                type="checkbox"
                checked={isVisible}
                onChange={() => toggleSeries(series.key)}
                style={{
                  width: 14,
                  height: 14,
                  accentColor: series.color,
                  cursor: "pointer",
                }}
              />
              <div
                style={{
                  width: 22,
                  height: 3,
                  background: series.color,
                  borderRadius: 99,
                  boxShadow: isVisible ? `0 0 8px ${series.color}55` : "none",
                }}
              />
              <span
                style={{
                  ...chartLegendStyle,
                  color: "rgba(210, 230, 255, 0.92)",
                }}
              >
                {series.label}
              </span>
            </label>
          );
        })}
      </div>

      <div
        ref={chartContainerRef}
        style={{ width: "100%", overflowX: "auto", overflowY: "visible" }}
      >
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
            {emptyEntriesLabel}
          </div>
        ) : (
          <div
            style={{
              position: "relative",
              width: "100%",
              minWidth: minSvgCssWidth,
              overflow: "visible",
              paddingBottom: 8,
              boxSizing: "border-box",
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
                    fill={Text.faint}
                    {...chartLabelSvgProps}
                  >
                    {Math.round(maxScore * tick)}
                  </text>
                  {showHoursAxis ? (
                    <text
                      x={W - pR + 6}
                      y={y + 3}
                      textAnchor="start"
                      fill={HOURS_SERIES.color}
                      {...chartLabelSvgProps}
                    >
                      {formatScoreValue(maxHours * tick)}
                    </text>
                  ) : null}
                </g>
              );
            })}

            <text
              x={pL}
              y={12}
              fill={Text.muted}
              {...chartLabelSvgProps}
            >
              SCORE
            </text>
            {showHoursAxis ? (
              <text
                x={W - pR}
                y={12}
                textAnchor="end"
                fill={HOURS_SERIES.color}
                {...chartLabelSvgProps}
              >
                HRS
              </text>
            ) : null}

            {visibleSeriesList.map((series, seriesIndex) => (
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
                {visibleSeriesList.map((series) => (
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
                  x={point.labelX}
                  y={pT + cH + Math.max(10, labelFontSize + 2)}
                  textAnchor={point.textAnchor}
                  fill={Text.muted}
                  className="chart-label"
                  style={{
                    fontSize: `${labelFontSize}px`,
                    fontFamily: CHART_LABEL_FONT_FAMILY,
                    fontWeight: CHART_LABEL_FONT_WEIGHT,
                    letterSpacing: labelLetterSpacing,
                    textTransform: CHART_LABEL_TEXT_TRANSFORM,
                  }}
                >
                  {point.labelLines.map((line, lineIndex) => (
                    <tspan
                      key={`${point.key}-line-${lineIndex}`}
                      x={point.labelX}
                      dy={lineIndex === 0 ? 0 : labelLineHeight}
                    >
                      {line}
                    </tspan>
                  ))}
                  {point.sublabel ? (
                    <tspan
                      x={point.labelX}
                      dy={labelLineHeight}
                      fill={Text.faint}
                    >
                      {point.sublabel}
                    </tspan>
                  ) : null}
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
                {visibleSeriesList.map((series) => {
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
                        {series.label}:{" "}
                        {formatSeriesTooltipValue(
                          series.key,
                          hoveredPoint.values[series.key],
                        )}
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
                    {emptyPreviousLabel}
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
