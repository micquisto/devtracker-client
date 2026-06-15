import { useState, useEffect, type ReactNode, type CSSProperties } from "react";
import { Border, Chart, Text } from "@/lib/theme";

export type StackLayerInput = {
  value: number;
  defaultColor: string;
  highlightColor?: string;
  highlightBoxShadow?: string;
  borderRadius?: string;
};

export type StackedColumnSegmentInput = {
  label: string;
  sublabel?: string;
  topLabel?: string;
  labelColor?: string;
  /** Rendered top-to-bottom: first layer is the top segment of the column */
  stacks: StackLayerInput[];
};

export type StackedColumnLegendItem = {
  color: string;
  label: string;
};

export function getStackPixelHeight(
  value: number,
  max: number,
  barHeight: number,
): number {
  return max > 0 ? (value / max) * barHeight : 0;
}

type StackedColumnChartProps<T extends StackedColumnSegmentInput> = {
  segments: T[];
  max: number;
  barAreaHeight?: number;
  gap?: number;
  gridTicks?: number[];
  chartPaddingLeft?: number;
  barMaxWidth?: number;
  highlightIndex?: number;
  highlightLabelColor?: string;
  defaultLabelColor?: string;
  animDelay?: number;
  legend?: StackedColumnLegendItem[];
  renderTooltip?: (
    segment: T,
    index: number,
  ) => ReactNode;
};

const DEFAULT_HIGHLIGHT_LABEL = Chart.highlightLabel;
const DEFAULT_LABEL = Chart.stackedLabel;

function StackedColumnChart<T extends StackedColumnSegmentInput>({
  segments,
  max,
  barAreaHeight = 150,
  gap = 10,
  gridTicks = [0, 4, 8, 12, 16],
  chartPaddingLeft = 24,
  barMaxWidth,
  highlightIndex,
  highlightLabelColor = DEFAULT_HIGHLIGHT_LABEL,
  defaultLabelColor = DEFAULT_LABEL,
  animDelay = 400,
  legend,
  renderTooltip,
}: StackedColumnChartProps<T>) {
  const [anim, setAnim] = useState(false);
  const [hov, setHov] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setAnim(true), animDelay);
    return () => clearTimeout(t);
  }, [animDelay]);

  const resolvedHighlight =
    highlightIndex ?? (segments.length > 0 ? segments.length - 1 : -1);

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap,
          height: barAreaHeight + 60,
          position: "relative",
        }}
      >
        {gridTicks.map((v) => {
          const y = barAreaHeight - (v / max) * barAreaHeight;
          return (
            <div
              key={v}
              style={{
                position: "absolute",
                left: chartPaddingLeft,
                right: 0,
                top: y,
                borderTop: `1px dashed ${Border.grid}`,
                display: "flex",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 8,
                  color: Text.dimmer,
                  fontFamily: "'DM Mono',monospace",
                  position: "absolute",
                  left: -20,
                  top: -6,
                }}
              >
                {v}
              </span>
            </div>
          );
        })}

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap,
            width: "100%",
            height: barAreaHeight + 52,
            paddingLeft: chartPaddingLeft,
            position: "relative",
            zIndex: 1,
          }}
        >
          {segments.map((s, i) => {
            const isHighlight = i === resolvedHighlight;
            const labelColor = s.labelColor ?? (isHighlight
              ? highlightLabelColor
              : defaultLabelColor);

            return (
              <div
                key={s.label + i}
                style={{
                  flex: 1,
                  maxWidth: barMaxWidth,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  height: "100%",
                  cursor: renderTooltip ? "pointer" : undefined,
                }}
                onMouseEnter={() => setHov(i)}
                onMouseLeave={() => setHov(null)}
              >
                {hov === i && renderTooltip?.(s, i)}

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    height: barAreaHeight,
                    width: "100%",
                  }}
                >
                  {s.topLabel && (
                    <div
                      style={{
                        color: labelColor,
                        fontFamily: "'DM Mono',monospace",
                        fontSize: 9,
                        fontWeight: 900,
                        marginBottom: 6,
                        textShadow: `0 0 10px ${labelColor}44`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.topLabel}
                    </div>
                  )}

                  {s.stacks.map((layer, li) => {
                    const h = getStackPixelHeight(layer.value, max, barAreaHeight);
                    const isTop = li === 0;
                    const layerStyle: CSSProperties = {
                      width: "100%",
                      height: `${anim ? h : 0}px`,
                      transition: `height 0.9s cubic-bezier(0.23,1,0.32,1) ${i * 0.08 + li * 0.05}s`,
                      background: isHighlight
                        ? layer.highlightColor ?? layer.defaultColor
                        : layer.defaultColor,
                      boxShadow:
                        hov === i
                          ? layer.highlightBoxShadow ?? "none"
                          : "none",
                    };
                    if (isTop && layer.borderRadius) {
                      layerStyle.borderRadius = layer.borderRadius;
                    }

                    return <div key={li} style={layerStyle} />;
                  })}
                </div>

                <div
                  style={{
                    marginTop: 8,
                    textAlign: "center" as const,
                  }}
                >
                  <div
                    style={{
                      color: labelColor,
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 8,
                      fontWeight: 700,
                      lineHeight: 1.15,
                      maxWidth: 72,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {s.label}
                  </div>
                  {s.sublabel && (
                    <div
                      style={{
                        fontSize: 7,
                        fontFamily: "'DM Mono',monospace",
                        color: Text.dimmer,
                        marginTop: 1,
                      }}
                    >
                      {s.sublabel}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {legend && legend.length > 0 && (
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          {legend.map(({ color, label }) => (
            <div
              key={label}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: color,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: Text.legend,
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default StackedColumnChart;
