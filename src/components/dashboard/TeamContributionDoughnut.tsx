import { useEffect, useState } from "react";
import { chartLabelSvgProps } from "@/lib/theme";
import "@/assets/styles/Statistics.page.css";

export type TeamContributionSegment = {
  memberId: string;
  name: string;
  color: string;
  storyPoints: number;
  contribution: number;
};

const TEAM_CONTRIBUTION_COLORS = [
  "#00c8ff",
  "#00e5a0",
  "#f5c842",
  "#a78bfa",
  "#ff6eb4",
  "#ff9f43",
  "#6b89ff",
  "#ff6b6b",
];

export function getTeamContributionMemberColor(
  memberId: string,
  index: number,
): string {
  const hash = Array.from(memberId).reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );

  return TEAM_CONTRIBUTION_COLORS[
    (hash + index) % TEAM_CONTRIBUTION_COLORS.length
  ];
}

function formatContributionStoryPoints(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}

function formatContributionPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export default function TeamContributionDoughnut({
  segments,
  loading = false,
}: {
  segments: TeamContributionSegment[];
  loading?: boolean;
}) {
  const [anim, setAnim] = useState(false);
  const [hov, setHov] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setAnim(true), 400);
    return () => clearTimeout(t);
  }, [segments]);

  if (loading) {
    return (
      <div className="statistics-team-contribution statistics-team-contribution--loading">
        Loading team contribution…
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="statistics-team-contribution statistics-team-contribution--empty">
        No completed story points for the selected period.
      </div>
    );
  }

  const cx = 130;
  const cy = 130;
  const outerR = 100;
  const innerR = 56;
  const gap = 2;
  const totalStoryPoints = segments.reduce(
    (sum, segment) => sum + segment.storyPoints,
    0,
  );
  let cursor = -Math.PI / 2;
  const chartSegments = segments.map((segment, index) => {
    const frac =
      totalStoryPoints > 0 ? segment.storyPoints / totalStoryPoints : 0;
    const angle = frac * 2 * Math.PI - (gap * Math.PI) / 180;
    const start = cursor;
    const end = cursor + angle;
    cursor += frac * 2 * Math.PI;
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = cx + outerR * Math.cos(start);
    const y1 = cy + outerR * Math.sin(start);
    const x2 = cx + outerR * Math.cos(end);
    const y2 = cy + outerR * Math.sin(end);
    const x3 = cx + innerR * Math.cos(end);
    const y3 = cy + innerR * Math.sin(end);
    const x4 = cx + innerR * Math.cos(start);
    const y4 = cy + innerR * Math.sin(start);
    const mid = (start + end) / 2;
    const lx = cx + (outerR + 20) * Math.cos(mid);
    const ly = cy + (outerR + 20) * Math.sin(mid);

    return {
      ...segment,
      index,
      frac,
      mid,
      lx,
      ly,
      d: `M${x1},${y1} A${outerR},${outerR} 0 ${largeArc} 1 ${x2},${y2} L${x3},${y3} A${innerR},${innerR} 0 ${largeArc} 0 ${x4},${y4} Z`,
    };
  });
  const hoveredSegment = hov !== null ? chartSegments[hov] : null;

  return (
    <div className="statistics-team-contribution">
      <svg
        viewBox="0 0 260 260"
        className="statistics-team-contribution__chart"
        onMouseLeave={() => setHov(null)}
      >
        <defs>
          {chartSegments.map((segment) => (
            <radialGradient
              key={segment.memberId}
              id={`tc-dg-${segment.memberId}`}
              cx="50%"
              cy="50%"
              r="50%"
            >
              <stop offset="0%" stopColor={segment.color} />
              <stop offset="100%" stopColor={segment.color} stopOpacity=".7" />
            </radialGradient>
          ))}
        </defs>
        {chartSegments.map((segment, index) => (
          <g
            key={segment.memberId}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHov(index)}
          >
            <path
              d={segment.d}
              fill={`url(#tc-dg-${segment.memberId})`}
              stroke="rgba(6,13,31,0.8)"
              strokeWidth="2"
              style={{
                transform:
                  hov === index
                    ? `translate(${Math.cos(segment.mid) * 6}px,${Math.sin(segment.mid) * 6}px)`
                    : "none",
                transition: "transform 0.25s ease",
                opacity: anim ? 1 : 0,
                transitionDelay: `${index * 0.07}s`,
                transformOrigin: `${cx}px ${cy}px`,
              }}
            />
            {segment.contribution >= 8 ? (
              <text
                x={segment.lx}
                y={segment.ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={segment.color}
                {...chartLabelSvgProps}
                style={{
                  ...chartLabelSvgProps.style,
                  fontSize: "13px",
                  opacity: anim ? 1 : 0,
                  transition: `opacity 0.5s ease ${index * 0.07 + 0.3}s`,
                }}
              >
                {formatContributionPercent(segment.contribution)}
              </text>
            ) : null}
          </g>
        ))}
        <circle cx={cx} cy={cy} r={innerR - 3} fill="rgba(6,13,31,0.85)" />
        {hoveredSegment ? (
          <>
            <text
              x={cx}
              y={cy - 14}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="22"
              fill={hoveredSegment.color}
              fontFamily="'DM Mono',monospace"
              fontWeight="800"
            >
              {formatContributionPercent(hoveredSegment.contribution)}
            </text>
            <text
              x={cx}
              y={cy + 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(160,210,255,0.85)"
              {...chartLabelSvgProps}
            >
              {hoveredSegment.name}
            </text>
            <text
              x={cx}
              y={cy + 24}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={hoveredSegment.color}
              {...chartLabelSvgProps}
            >
              {formatContributionStoryPoints(hoveredSegment.storyPoints)} SP
            </text>
          </>
        ) : (
          <>
            <text
              x={cx}
              y={cy - 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="24"
              fill="#e8f4ff"
              fontFamily="'DM Mono',monospace"
              fontWeight="800"
            >
              {formatContributionStoryPoints(totalStoryPoints)}
            </text>
            <text
              x={cx}
              y={cy + 14}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(160,210,255,0.75)"
              {...chartLabelSvgProps}
            >
              Team SP
            </text>
          </>
        )}
      </svg>
      <div className="statistics-team-contribution__legend">
        {chartSegments.map((segment, index) => (
          <div
            key={segment.memberId}
            className="statistics-team-contribution__legend-item"
            onMouseEnter={() => setHov(index)}
            onMouseLeave={() => setHov(null)}
          >
            <span
              className="statistics-team-contribution__legend-swatch"
              style={{
                background: segment.color,
                boxShadow: `0 0 8px ${segment.color}88`,
              }}
            />
            <div className="statistics-team-contribution__legend-copy">
              <span className="statistics-team-contribution__legend-name">
                {segment.name}
              </span>
              <span className="statistics-team-contribution__legend-points">
                {formatContributionStoryPoints(segment.storyPoints)} SP
              </span>
            </div>
            <span
              className="statistics-team-contribution__legend-share"
              style={{ color: segment.color }}
            >
              {formatContributionPercent(segment.contribution)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
