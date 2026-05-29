import { useState, useEffect, type ReactNode } from "react";
import { Chart } from "@/lib/theme";

export type BarSegmentInput = {
  value: number;
  label: string;
};

export function getBarPixelHeight(
  value: number,
  max: number,
  barHeight: number,
): number {
  return max > 0 ? (value / max) * barHeight : 0;
}

type BarChartProps<T extends BarSegmentInput> = {
  segments: T[];
  max: number;
  barHeight?: number;
  gap?: number;
  highlightIndex?: number;
  highlightColor?: string;
  defaultBarColor?: string;
  defaultLabelColor?: string;
  animDelay?: number;
  renderHeader?: () => ReactNode;
  renderFooter?: () => ReactNode;
};

const DEFAULT_HIGHLIGHT = Chart.highlight;
const DEFAULT_BAR = Chart.barDefault;
const DEFAULT_LABEL = Chart.barLabel;

function BarChart<T extends BarSegmentInput>({
  segments,
  max,
  barHeight = 120,
  gap = 8,
  highlightIndex,
  highlightColor = DEFAULT_HIGHLIGHT,
  defaultBarColor = DEFAULT_BAR,
  defaultLabelColor = DEFAULT_LABEL,
  animDelay = 300,
  renderHeader,
  renderFooter,
}: BarChartProps<T>) {
  const [anim, setAnim] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnim(true), animDelay);
    return () => clearTimeout(t);
  }, [animDelay]);

  const resolvedHighlight =
    highlightIndex ?? (segments.length > 0 ? segments.length - 1 : -1);

  return (
    <>
      {renderHeader?.()}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap,
          height: barHeight + 28,
        }}
      >
        {segments.map((s, i) => {
          const isHighlight = i === resolvedHighlight;
          const pct = getBarPixelHeight(s.value, max, barHeight);
          const color = isHighlight ? highlightColor : Chart.barValueMuted;

          return (
            <div
              key={s.label + i}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                height: "100%",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "'DM Mono',monospace",
                  fontWeight: 700,
                  color,
                  marginBottom: 4,
                  opacity: anim ? 1 : 0,
                  transition: `opacity 0.5s ease ${i * 0.1}s`,
                }}
              >
                {s.value}
              </span>
              <div
                style={{
                  width: "100%",
                  height: `${anim ? pct : 0}px`,
                  transition: `height 0.9s cubic-bezier(0.23,1,0.32,1) ${i * 0.08}s`,
                  borderRadius: "5px 5px 2px 2px",
                  background: isHighlight
                    ? `linear-gradient(180deg,${highlightColor},${highlightColor}66)`
                    : defaultBarColor,
                  boxShadow: isHighlight ? `0 0 14px ${highlightColor}44` : "none",
                }}
              />
              <span
                style={{
                  fontSize: 8,
                  fontFamily: "'DM Mono',monospace",
                  color: isHighlight ? highlightColor : defaultLabelColor,
                  marginTop: 6,
                  textAlign: "center" as const,
                  lineHeight: 1.2,
                }}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
      {renderFooter?.()}
    </>
  );
}

export default BarChart;
