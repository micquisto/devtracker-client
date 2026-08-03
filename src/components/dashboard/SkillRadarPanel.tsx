import { useEffect, useState } from "react";
import { chartLabelSvgProps } from "@/lib/theme";
import {
  resolvePerformanceScoreGrade,
  type PerformanceScoreGrade,
} from "@/lib/utils/scrum/evaluateMemberPerformance.utils";
import {
  DEFAULT_SKILL_CHART_SCALE,
  getSkillChartTicks,
  isSkillValuePassing,
  normalizeSkillValueForChart,
  SKILL_RADAR_KEYS,
  type SkillChartScale,
  type SkillRadarValues,
} from "@/lib/utils/scrum/statisticsRadar.utils";
import "@/assets/styles/Statistics.page.css";

const RADAR_LABELS = [
  "Productivity",
  "Efficiency",
  "Quality",
  "Collaboration",
  "Velocity",
  "Professionalism",
] as const;

const PERFORMANCE_GRADE_COLORS: Record<PerformanceScoreGrade, string> = {
  S: "#ffcc00",
  A: "#00e5a0",
  B: "#00c8ff",
  C: "#f97316",
  D: "#a78bfa",
  E: "#b87333",
  F: "#ef4444",
};

function getSkillValueGradeColor(
  value: number,
  passingThreshold: number,
): string {
  return PERFORMANCE_GRADE_COLORS[
    resolvePerformanceScoreGrade(value, passingThreshold)
  ];
}

function colorWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red},${green},${blue},${alpha})`;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function RadarChart({
  values,
  scale,
  hideValueLabels = false,
}: {
  values: SkillRadarValues;
  scale: SkillChartScale;
  hideValueLabels?: boolean;
}) {
  const cx = 200;
  const cy = 200;
  const maxR = 150;
  const levels = 5;
  const n = SKILL_RADAR_KEYS.length;
  const chartTicks = getSkillChartTicks(scale);
  const polygonPoints = (r: number) =>
    Array.from({ length: n }, (_, i) => {
      const p = polarToCartesian(cx, cy, r, (360 / n) * i);
      return `${p.x},${p.y}`;
    }).join(" ");
  const passingThreshold = scale.minValue;
  const dataPoints = SKILL_RADAR_KEYS.map((k, i) => {
    const actualValue = values[k];
    const chartValue = normalizeSkillValueForChart(actualValue, scale);
    const r = (chartValue / 100) * maxR;
    const color = getSkillValueGradeColor(actualValue, passingThreshold);
    return {
      ...polarToCartesian(cx, cy, r, (360 / n) * i),
      value: actualValue,
      passed: isSkillValuePassing(actualValue, scale),
      color,
      label: RADAR_LABELS[i],
    };
  });
  const [anim, setAnim] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnim(true), 400);
    return () => clearTimeout(t);
  }, [scale, values]);

  return (
    <svg viewBox="0 0 400 440" className="statistics-skill-radar__svg">
      {Array.from({ length: levels }, (_, i) => (
        <polygon
          key={i}
          points={polygonPoints((maxR / levels) * (i + 1))}
          fill="none"
          stroke="rgba(100,220,255,0.12)"
          strokeWidth="1"
        />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const p = polarToCartesian(cx, cy, maxR, (360 / n) * i);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="rgba(100,220,255,0.15)"
            strokeWidth="1"
          />
        );
      })}
      {dataPoints.map((p, i) => {
        const next = dataPoints[(i + 1) % n];
        return (
          <polygon
            key={`wedge-${i}`}
            points={`${cx},${cy} ${p.x},${p.y} ${next.x},${next.y}`}
            fill={colorWithAlpha(p.color, 0.24)}
            stroke="none"
            style={{
              transition: "all 1s cubic-bezier(0.23,1,0.32,1)",
              opacity: anim ? 1 : 0,
              transform: anim ? "scale(1)" : "scale(0.3)",
              transformOrigin: `${cx}px ${cy}px`,
            }}
          />
        );
      })}
      {dataPoints.map((p, i) => {
        const next = dataPoints[(i + 1) % n];
        return (
          <line
            key={`edge-${i}`}
            x1={p.x}
            y1={p.y}
            x2={next.x}
            y2={next.y}
            stroke={colorWithAlpha(p.color, 0.9)}
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{
              transition: "all 1s cubic-bezier(0.23,1,0.32,1)",
              opacity: anim ? 1 : 0,
            }}
          />
        );
      })}
      {dataPoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={5}
          fill={p.color}
          style={{ transition: `all 1s ease ${i * 0.08}s`, opacity: anim ? 1 : 0 }}
        />
      ))}
      {dataPoints.map((p, i) => {
        const labelPoint = polarToCartesian(cx, cy, maxR + 24, (360 / n) * i);
        const valuePoint = polarToCartesian(cx, cy, maxR + 42, (360 / n) * i);
        return (
          <g key={`label-${i}`}>
            <text
              x={labelPoint.x}
              y={labelPoint.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(200,235,255,0.95)"
              {...chartLabelSvgProps}
            >
              {p.label}
            </text>
            {!hideValueLabels ? (
              <text
                x={valuePoint.x}
                y={valuePoint.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={p.color}
                {...chartLabelSvgProps}
                style={{
                  ...chartLabelSvgProps.style,
                  opacity: anim ? 1 : 0,
                  transition: `opacity 0.6s ease ${i * 0.08 + 0.2}s`,
                }}
              >
                {Number(p.value).toFixed(2)}%
              </text>
            ) : null}
          </g>
        );
      })}
      <text
        x={cx}
        y={410}
        textAnchor="middle"
        fill="rgba(170,210,245,0.8)"
        {...chartLabelSvgProps}
      >
        Passing min {Math.round(scale.minValue)}% · scale {chartTicks.join(" / ")}%
      </text>
    </svg>
  );
}

export default function SkillRadarPanel({
  values,
  scale = DEFAULT_SKILL_CHART_SCALE,
}: {
  values: SkillRadarValues;
  scale?: SkillChartScale;
}) {
  const passingThreshold = scale.minValue;
  const criteriaItems = SKILL_RADAR_KEYS.map((key, index) => {
    const value = values[key];
    const grade = resolvePerformanceScoreGrade(value, passingThreshold);

    return {
      key,
      label: RADAR_LABELS[index],
      value,
      grade,
      color: getSkillValueGradeColor(value, passingThreshold),
      passed: isSkillValuePassing(value, scale),
    };
  });

  return (
    <div className="statistics-skill-radar">
      <div className="statistics-skill-radar__chart">
        <RadarChart values={values} scale={scale} hideValueLabels />
      </div>
      <aside className="statistics-skill-radar__legend" aria-label="Criteria values">
        <div className="statistics-skill-radar__legend-title">Criteria Values</div>
        <ul className="statistics-skill-radar__legend-list">
          {criteriaItems.map((item) => (
            <li
              key={item.key}
              className={`statistics-skill-radar__legend-item${item.passed ? "" : " statistics-skill-radar__legend-item--failed"}`}
            >
              <span
                className="statistics-skill-radar__legend-swatch"
                style={{ background: item.color, boxShadow: `0 0 10px ${item.color}66` }}
                aria-hidden="true"
              />
              <div className="statistics-skill-radar__legend-copy">
                <span className="statistics-skill-radar__legend-label">{item.label}</span>
                <span className="statistics-skill-radar__legend-meta">
                  {item.passed ? "Passing" : "Below passing"}
                </span>
              </div>
              <div className="statistics-skill-radar__legend-stats">
                <span
                  className="statistics-skill-radar__legend-value"
                  style={{ color: item.color }}
                >
                  {Number(item.value).toFixed(2)}%
                </span>
                <span
                  className="statistics-skill-radar__legend-grade"
                  style={{
                    color: item.color,
                    borderColor: `${item.color}55`,
                    background: `${item.color}14`,
                  }}
                >
                  {item.grade}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="statistics-skill-radar__legend-footnote">
          Passing min {Math.round(scale.minValue)}%
        </p>
      </aside>
    </div>
  );
}
