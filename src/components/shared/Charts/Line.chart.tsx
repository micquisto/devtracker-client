import { useState } from "react";
import type { ChartPoint } from "@/interfaces";
import {
  Background,
  Border,
  Chart,
  Palette,
  Semantic,
  Text,
} from "@/lib/theme";
import { detectTrendPoints } from ".";

 /* ─── REUSABLE SVG LINE GRAPH ─────────────── */
 const LineGraph = ({
  data,
  animated,
}: {
  data: ChartPoint[];
  animated: boolean;
}) => {
  const [hov, setHov] = useState<number | null>(null);
  const W = 540,
    H = 170,
    pL = 36,
    pR = 16,
    pT = 26,
    pB = 30;
  const cW = W - pL - pR,
    cH = H - pT - pB;
  const n = data.length;
  const step = n > 1 ? cW / (n - 1) : 0;
  const vals = data.map((d) => d.value);
  const dMin = Math.max(0, Math.min(...vals) - 10);
  const dMax = Math.min(100, Math.max(...vals) + 10);
  const range = dMax - dMin || 1;

  const pts = data.map((d, i) => ({
    x: n === 1 ? pL + cW / 2 : pL + i * step,
    y: pT + cH - ((d.value - dMin) / range) * cH,
    v: d.value,
    label: d.label,
  }));

  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath =
    pts.length > 1
      ? `${linePath} L${pts[pts.length - 1].x},${pT + cH} L${pts[0].x},${pT + cH} Z`
      : "";

  const trendPts = detectTrendPoints(vals, Math.max(1, Math.floor(n / 8)));

  // Grid Y values — pick 4 nice ticks
  const gridStep = Math.round((dMax - dMin) / 4);
  const gridVals = [0, 1, 2, 3, 4]
    .map((i) => Math.round(dMin + i * gridStep))
    .filter((v) => v <= dMax);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", minWidth: 240, display: "block" }}
      onMouseLeave={() => setHov(null)}
    >
      <defs>
        <linearGradient id="tlg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={Chart.line} stopOpacity=".18" />
          <stop offset="100%" stopColor={Chart.line} stopOpacity=".01" />
        </linearGradient>
        <filter id="tglow2">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="aglow2">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Grid */}
      {gridVals.map((v) => {
        const y = pT + cH - ((v - dMin) / range) * cH;
        return (
          <g key={v}>
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
              x={pL - 4}
              y={y + 4}
              textAnchor="end"
              fontSize="8"
              fill={Chart.label}
              fontFamily="'DM Mono',monospace"
            >
              {v}
            </text>
          </g>
        );
      })}

      {/* Area + Line */}
      {areaPath && (
        <path
          d={areaPath}
          fill="url(#tlg2)"
          style={{ opacity: animated ? 1 : 0, transition: "opacity 0.7s ease" }}
        />
      )}
      {pts.length > 1 && (
        <path
          d={linePath}
          fill="none"
          stroke={Chart.line}
          strokeWidth="1.5"
          strokeLinejoin="round"
          filter="url(#tglow2)"
          style={{
            opacity: animated ? 1 : 0,
            transition: "opacity 0.5s ease 0.1s",
          }}
        />
      )}

      {/* Trend arrows */}
      {trendPts.map(({ idx, dir }, ai) => {
        const p = pts[idx];
        if (!p) return null;
        const color = dir === "up" ? Chart.up : Chart.down;
        const isUp = dir === "up";
        const arrowY = isUp ? p.y - 20 : p.y + 8;
        const hw = 5,
          ah = 6,
          stemLen = 5;
        const tipY = isUp ? arrowY : arrowY + ah;
        const baseY = isUp ? arrowY + ah : arrowY;
        const stemT = isUp ? arrowY + ah : arrowY;
        const stemB = isUp ? arrowY + ah + stemLen : arrowY - stemLen;
        const diff = vals[idx] - vals[idx - 1];
        return (
          <g
            key={`a${idx}`}
            filter="url(#aglow2)"
            style={{
              opacity: animated ? 1 : 0,
              transition: `opacity 0.4s ease ${0.25 + ai * 0.05}s`,
            }}
          >
            <circle
              cx={p.x}
              cy={isUp ? arrowY + ah + stemLen / 2 : arrowY - stemLen / 2}
              r={8}
              fill={`${color}14`}
            />
            <polygon
              points={`${p.x},${tipY} ${p.x - hw},${baseY} ${p.x + hw},${baseY}`}
              fill={color}
              opacity="0.92"
            />
            <line
              x1={p.x}
              y1={stemT}
              x2={p.x}
              y2={stemB}
              stroke={color}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <rect
              x={p.x - 12}
              y={isUp ? arrowY - 12 : arrowY + ah + stemLen + 1}
              width={24}
              height={10}
              rx="4"
              fill={`${color}20`}
              stroke={`${color}50`}
              strokeWidth="0.8"
            />
            <text
              x={p.x}
              y={isUp ? arrowY - 7 : arrowY + ah + stemLen + 7}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="7"
              fill={color}
              fontFamily="'DM Mono',monospace"
              fontWeight="800"
            >
              {diff >= 0 ? "+" : ""}
              {diff}
            </text>
          </g>
        );
      })}

      {/* Dots */}
      {pts.map((p, i) => (
        <g key={i} style={{ cursor: "pointer" }} onMouseEnter={() => setHov(i)}>
          <circle
            cx={p.x}
            cy={p.y}
            r={hov === i ? 12 : 5}
            fill={Background.dotHover}
            style={{ transition: "r 0.18s" }}
          />
          <circle
            cx={p.x}
            cy={p.y}
            r={hov === i ? 4.5 : 2.5}
            fill={hov === i ? Palette.cyan : Background.dotFill}
            stroke={hov === i ? Palette.navy : "none"}
            strokeWidth="1.5"
            style={{
              opacity: animated ? 1 : 0,
              transition: "r 0.18s,fill 0.18s,opacity 0.4s",
            }}
          />
          {hov === i && (
            <g>
              <rect
                x={Math.min(p.x - 30, W - pR - 62)}
                y={p.y - 36}
                width={62}
                height={22}
                rx="5"
                fill={Background.tooltipAlt}
                stroke={Border.tooltipSoft}
                strokeWidth="1"
              />
              <text
                x={Math.min(p.x, W - pR - 31) + 1}
                y={p.y - 25}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fill={Palette.cyan}
                fontFamily="'DM Mono',monospace"
                fontWeight="700"
              >
                {p.label}: {p.v}
              </text>
              {i > 0 && (
                <text
                  x={Math.min(p.x, W - pR - 31) + 1}
                  y={p.y - 14}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="8"
                  fill={
                    vals[i] - vals[i - 1] >= 0
                      ? Semantic.positive
                      : Semantic.negative
                  }
                  fontFamily="'DM Mono',monospace"
                >
                  {vals[i] - vals[i - 1] >= 0 ? "+" : ""}
                  {vals[i] - vals[i - 1]}
                </text>
              )}
            </g>
          )}
        </g>
      ))}

      {/* X axis + labels */}
      <line
        x1={pL}
        y1={pT + cH}
        x2={W - pR}
        y2={pT + cH}
        stroke={Chart.axis}
        strokeWidth="1"
      />
      {pts.map((p, i) => (
        <text
          key={i}
          x={p.x}
          y={pT + cH + 14}
          textAnchor="middle"
          fontSize="8"
          fill={Text.faint}
          fontFamily="'DM Mono',monospace"
        >
          {p.label.length > 6 ? p.label.slice(0, 6) : p.label}
        </text>
      ))}
    </svg>
  );
}

export default LineGraph;