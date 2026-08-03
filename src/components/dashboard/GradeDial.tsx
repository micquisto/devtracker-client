import { useEffect, useState } from "react";
import {
  resolvePerformanceScoreGrade,
  type PerformanceScoreGrade,
} from "@/lib/utils/scrum/evaluateMemberPerformance.utils";

const GRADE_DIAL_FILL_PERCENT: Record<PerformanceScoreGrade, number> = {
  S: 100,
  A: 95,
  B: 85,
  C: 75,
  D: 65,
  E: 57,
  F: 50,
};

export const PERFORMANCE_GRADE_COLORS: Record<PerformanceScoreGrade, string> = {
  S: "#ffcc00",
  A: "#00e5a0",
  B: "#00c8ff",
  C: "#f97316",
  D: "#a78bfa",
  E: "#b87333",
  F: "#ef4444",
};

function colorWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red},${green},${blue},${alpha})`;
}

export function getPerformanceGradeColor(
  value: number,
  passingThreshold: number,
): string {
  return PERFORMANCE_GRADE_COLORS[
    resolvePerformanceScoreGrade(value, passingThreshold)
  ];
}

export default function GradeDial({
  grade,
  color,
  delay = 0,
  size = "default",
  glowFilterId = "grade-dial-glow",
}: {
  grade: string;
  color: string;
  delay?: number;
  size?: "default" | "compact" | "large";
  glowFilterId?: string;
}) {
  const [show, setShow] = useState(false);
  const isCompact = size === "compact";
  const isLarge = size === "large";
  const isTopGrade = grade === "S";
  const fillPercent =
    GRADE_DIAL_FILL_PERCENT[grade as PerformanceScoreGrade] ?? 50;
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (fillPercent / 100) * circumference;
  const topGlowFilterId = `${glowFilterId}-s`;
  const dialWidth = isCompact
    ? isTopGrade
      ? 96
      : 90
    : isLarge
      ? isTopGrade
        ? 220
        : 208
      : isTopGrade
        ? 158
        : 148;
  const gradeFontSize = isCompact
    ? isTopGrade
      ? 52
      : 48
    : isLarge
      ? isTopGrade
        ? 58
        : 54
      : isTopGrade
        ? 46
        : 42;

  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className={`grade-dial grade-dial--${size}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: isCompact ? 3 : isLarge ? 10 : 8,
      }}
    >
      <svg
        aria-label={`Grade ${grade}`}
        role="img"
        viewBox="0 0 190 190"
        style={{
          width: dialWidth,
          height: dialWidth,
          opacity: show ? 1 : 0,
          transform: show ? "scale(1)" : "scale(0.6)",
          transition: `all 0.7s cubic-bezier(0.23,1,0.32,1) ${delay}ms`,
          filter: isTopGrade
            ? `drop-shadow(0 0 18px ${color}aa)`
            : isLarge
              ? `drop-shadow(0 0 16px ${color}66)`
              : undefined,
        }}
      >
        <defs>
          <filter id={glowFilterId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {isTopGrade ? (
            <filter
              id={topGlowFilterId}
              x="-60%"
              y="-60%"
              width="220%"
              height="220%"
            >
              <feGaussianBlur stdDeviation="7" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ) : null}
        </defs>
        {isTopGrade ? (
          <circle
            cx="95"
            cy="95"
            fill="none"
            r="84"
            stroke={colorWithAlpha(color, 0.28)}
            strokeWidth="4"
          />
        ) : null}
        <circle
          cx="95"
          cy="95"
          fill="rgba(255,255,255,0.025)"
          r="78"
          stroke="rgba(160,210,255,0.12)"
          strokeWidth="10"
        />
        <circle
          cx="95"
          cy="95"
          fill="none"
          r={radius}
          stroke="rgba(160,210,255,0.14)"
          strokeLinecap="round"
          strokeWidth="13"
        />
        <circle
          cx="95"
          cy="95"
          fill="none"
          filter={
            isTopGrade ? `url(#${topGlowFilterId})` : `url(#${glowFilterId})`
          }
          r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={show ? dashOffset : circumference}
          strokeLinecap="round"
          strokeWidth={isTopGrade ? 15 : 13}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "95px 95px",
            transition: `stroke-dashoffset 0.9s cubic-bezier(0.23,1,0.32,1) ${
              delay + 100
            }ms`,
          }}
        />
        <text
          dominantBaseline="middle"
          fill={color}
          fontFamily="'DM Mono', monospace"
          fontSize={gradeFontSize}
          fontWeight="900"
          textAnchor="middle"
          x="95"
          y="95"
        >
          {grade}
        </text>
      </svg>
      <span
        style={{
          fontSize: isCompact ? 12 : isLarge ? 15 : 13,
          fontFamily: "'DM Sans',sans-serif",
          color: "rgba(180,215,255,0.88)",
          textTransform: "uppercase",
          letterSpacing: isLarge ? "0.1em" : "0.06em",
          fontWeight: 700,
        }}
      >
        Grade
      </span>
    </div>
  );
}
