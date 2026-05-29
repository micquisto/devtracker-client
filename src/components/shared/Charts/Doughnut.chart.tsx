import { useState, useEffect, type ReactNode } from "react";
import { Background, Border } from "@/lib/theme";

export type DoughnutSegmentInput = {
  value: number;
  color: string;
};

export type DoughnutGeometry = {
  cx: number;
  cy: number;
  outerR: number;
  innerR: number;
  gap?: number;
};

export type BuiltDoughnutSegment<T extends DoughnutSegmentInput> = T & {
  i: number;
  d: string;
  frac: number;
  mid: number;
};

export function buildDoughnutSegments<T extends DoughnutSegmentInput>(
  items: T[],
  { cx, cy, outerR, innerR, gap = 2.5 }: DoughnutGeometry,
): BuiltDoughnutSegment<T>[] {
  const total = items.reduce((s, m) => s + m.value, 0);
  if (total === 0) return [];

  let cursor = -Math.PI / 2;
  return items.map((item, i) => {
    const frac = item.value / total;
    const angle = frac * 2 * Math.PI - (gap * Math.PI) / 180;
    const start = cursor;
    const end = cursor + angle;
    cursor += frac * 2 * Math.PI;

    const la = angle > Math.PI ? 1 : 0;
    const x1 = cx + outerR * Math.cos(start);
    const y1 = cy + outerR * Math.sin(start);
    const x2 = cx + outerR * Math.cos(end);
    const y2 = cy + outerR * Math.sin(end);
    const x3 = cx + innerR * Math.cos(end);
    const y3 = cy + innerR * Math.sin(end);
    const x4 = cx + innerR * Math.cos(start);
    const y4 = cy + innerR * Math.sin(start);
    const mid = (start + end) / 2;

    return {
      ...item,
      i,
      d: `M${x1},${y1} A${outerR},${outerR} 0 ${la} 1 ${x2},${y2} L${x3},${y3} A${innerR},${innerR} 0 ${la} 0 ${x4},${y4} Z`,
      frac,
      mid,
    };
  });
}

type DoughnutChartProps<T extends DoughnutSegmentInput> = {
  segments: T[];
  geometry?: DoughnutGeometry;
  viewBox?: string;
  maxWidth?: number;
  gradientIdPrefix?: string;
  popOffset?: number;
  animDelay?: number;
  renderCenter: (ctx: {
    hovered: BuiltDoughnutSegment<T> | null;
    cx: number;
    cy: number;
    innerR: number;
  }) => ReactNode;
  renderLegend?: (ctx: {
    segments: BuiltDoughnutSegment<T>[];
    hov: number | null;
    setHov: (i: number | null) => void;
  }) => ReactNode;
};

const DEFAULT_GEOMETRY: DoughnutGeometry = {
  cx: 120,
  cy: 120,
  outerR: 95,
  innerR: 54,
  gap: 2.5,
};

function DoughnutChart<T extends DoughnutSegmentInput>({
  segments,
  geometry = DEFAULT_GEOMETRY,
  viewBox = "0 0 240 240",
  maxWidth = 200,
  gradientIdPrefix = "dg",
  popOffset = 5,
  animDelay = 400,
  renderCenter,
  renderLegend,
}: DoughnutChartProps<T>) {
  const [anim, setAnim] = useState(false);
  const [hov, setHov] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setAnim(true), animDelay);
    return () => clearTimeout(t);
  }, [animDelay]);

  const { cx, cy, innerR } = geometry;
  const built = buildDoughnutSegments(segments, geometry);
  const hovered = hov !== null ? built[hov] : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        flexWrap: "wrap",
      }}
    >
      <svg
        viewBox={viewBox}
        style={{ width: "100%", maxWidth, flexShrink: 0 }}
        onMouseLeave={() => setHov(null)}
      >
        <defs>
          {built.map((s) => (
            <radialGradient
              key={s.i}
              id={`${gradientIdPrefix}${s.i}`}
              cx="50%"
              cy="50%"
              r="50%"
            >
              <stop offset="0%" stopColor={s.color} />
              <stop offset="100%" stopColor={s.color} stopOpacity=".65" />
            </radialGradient>
          ))}
        </defs>
        {built.map((s) => (
          <g
            key={s.i}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHov(s.i)}
          >
            <path
              d={s.d}
              fill={`url(#${gradientIdPrefix}${s.i})`}
              stroke={Border.chartStroke}
              strokeWidth="2"
              style={{
                transform:
                  hov === s.i
                    ? `translate(${Math.cos(s.mid) * popOffset}px,${Math.sin(s.mid) * popOffset}px)`
                    : "none",
                transition: "transform 0.25s ease",
                opacity: anim ? 1 : 0,
                transformOrigin: `${cx}px ${cy}px`,
                transitionDelay: `${s.i * 0.07}s`,
              }}
            />
          </g>
        ))}
        <circle cx={cx} cy={cy} r={innerR - 3} fill={Background.chartInner} />
        {renderCenter({ hovered, cx, cy, innerR })}
      </svg>
      {renderLegend?.({ segments: built, hov, setHov })}
    </div>
  );
}

export default DoughnutChart;
