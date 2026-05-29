import { useEffect, useState } from "react";
import "@/assets/styles/Statistics.page.css";

const RADAR_LABELS = ["Productivity", "Efficiency", "Quality", "Collaboration", "Velocity"];
const RADAR_KEYS = ["productivity", "efficiency", "quality", "collaboration", "velocity"];
const BAR_COLORS = ["#00c8ff", "#00e5a0", "#f5c842", "#ff6eb4", "#a78bfa"];

const devData = {
  score: 8420,
  storyPoints: 347,
  grade: "A",
  stats: [
    { label: "Tasks Completed", value: 142, max: 200, unit: "" },
    { label: "Bugs Resolved", value: 89, max: 100, unit: "" },
    { label: "PR Merged", value: 76, max: 90, unit: "" },
    { label: "Code Reviews", value: 54, max: 70, unit: "" },
    { label: "On-time Delivery", value: 91, max: 100, unit: "%" },
    { label: "Documentation", value: 38, max: 50, unit: "" },
    { label: "Sprint Participation", value: 12, max: 14, unit: "" },
    { label: "Mentoring Sessions", value: 7, max: 10, unit: "" },
  ],
  radar: { productivity: 87, efficiency: 92, quality: 78, collaboration: 95, velocity: 83 },
};

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function RadarChart({ values }) {
  const cx = 160, cy = 160, maxR = 110, levels = 5, n = RADAR_KEYS.length;
  const polygonPoints = (r) => Array.from({ length: n }, (_, i) => {
    const p = polarToCartesian(cx, cy, r, (360 / n) * i);
    return `${p.x},${p.y}`;
  }).join(" ");
  const dataPoints = RADAR_KEYS.map((k, i) => {
    const r = (values[k] / 100) * maxR;
    return polarToCartesian(cx, cy, r, (360 / n) * i);
  });
  const [anim, setAnim] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnim(true), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <svg viewBox="0 0 320 320" style={{ width: "100%", maxWidth: 300 }}>
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
      <polygon
        points={dataPoints.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="rgba(0,200,255,0.18)"
        stroke="rgba(0,200,255,0.85)"
        strokeWidth="2"
        style={{
          transition: "all 1s cubic-bezier(0.23,1,0.32,1)",
          opacity: anim ? 1 : 0,
          transform: anim ? "scale(1)" : "scale(0.3)",
          transformOrigin: `${cx}px ${cy}px`,
        }}
      />
      {dataPoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={4}
          fill="#00c8ff"
          style={{ transition: `all 1s ease ${i * 0.08}s`, opacity: anim ? 1 : 0 }}
        />
      ))}
      {RADAR_LABELS.map((label, i) => {
        const p = polarToCartesian(cx, cy, maxR + 22, (360 / n) * i);
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(180,230,255,0.9)"
            fontSize="11"
            fontFamily="'DM Sans',sans-serif"
            fontWeight="500"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

function SkillBarChart({ values }) {
  const [heights, setHeights] = useState(RADAR_KEYS.map(() => 0));
  const chartH = 160;

  useEffect(() => {
    const t = setTimeout(() => setHeights(RADAR_KEYS.map((k) => values[k])), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-end", height: chartH + 32, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", paddingBottom: 32 }}>
          {[0, 25, 50, 75, 100].map((v) => (
            <div
              key={v}
              style={{
                position: "absolute",
                bottom: `calc(${v}% + 32px)`,
                left: 0,
                right: 0,
                borderTop: "1px dashed rgba(100,180,255,0.1)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  color: "rgba(100,160,210,0.45)",
                  fontFamily: "'DM Mono',monospace",
                  marginTop: -8,
                  paddingRight: 4,
                  minWidth: 24,
                  textAlign: "right",
                }}
              >
                {v}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, width: "100%", height: "100%", paddingBottom: 32, paddingLeft: 28 }}>
          {RADAR_KEYS.map((k, i) => {
            const color = BAR_COLORS[i];
            return (
              <div key={k} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", fontWeight: 700, color, marginBottom: 4, opacity: heights[i] > 0 ? 1 : 0, transition: "opacity 0.5s ease" }}>
                  {values[k]}
                </span>
                <div style={{ width: "100%", height: `${(heights[i] / 100) * chartH}px`, transition: "height 1s cubic-bezier(0.23,1,0.32,1)", borderRadius: "6px 6px 3px 3px", background: `linear-gradient(180deg,${color} 0%,${color}55 100%)`, boxShadow: `0 0 14px ${color}44` }} />
                <span style={{ fontSize: 10, fontFamily: "'DM Sans',sans-serif", fontWeight: 600, color: "rgba(150,200,240,0.7)", marginTop: 8, textAlign: "center" }}>
                  {RADAR_LABELS[i].slice(0, 5)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SkillLineChart({ values }) {
  const W = 500, H = 180, padL = 32, padR = 16, padT = 20, padB = 36;
  const chartW = W - padL - padR, chartH = H - padT - padB, n = RADAR_KEYS.length, step = chartW / (n - 1);
  const [anim, setAnim] = useState(false);
  const [hov, setHov] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setAnim(true), 500);
    return () => clearTimeout(t);
  }, []);

  const pts = RADAR_KEYS.map((k, i) => ({
    x: padL + i * step,
    y: padT + chartH - (values[k] / 100) * chartH,
    val: values[k],
    label: RADAR_LABELS[i],
    color: BAR_COLORS[i],
  }));
  const smooth = pts.reduce((a, p, i) => {
    if (i === 0) return `M${p.x},${p.y}`;
    const pv = pts[i - 1], cpx = (pv.x + p.x) / 2;
    return `${a} C${cpx},${pv.y} ${cpx},${p.y} ${p.x},${p.y}`;
  }, "");
  const area = `${smooth} L${pts[pts.length - 1].x},${padT + chartH} L${pts[0].x},${padT + chartH} Z`;

  return (
    <div style={{ width: "100%", overflowX: "auto" }} onMouseLeave={() => setHov(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 280, display: "block" }}>
        <defs>
          <linearGradient id="la2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00c8ff" stopOpacity=".22" />
            <stop offset="100%" stopColor="#00c8ff" stopOpacity=".01" />
          </linearGradient>
          <filter id="gl2">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[0, 25, 50, 75, 100].map((v) => {
          const y = padT + chartH - (v / 100) * chartH;
          return (
            <g key={v}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(100,180,255,0.08)" strokeWidth="1" strokeDasharray="4 4" />
              <text x={padL - 4} y={y + 4} textAnchor="end" fontSize="9" fill="rgba(100,160,210,0.45)" fontFamily="'DM Mono',monospace">
                {v}
              </text>
            </g>
          );
        })}
        <path d={area} fill="url(#la2)" style={{ opacity: anim ? 1 : 0, transition: "opacity 1s ease 0.4s" }} />
        <path d={smooth} fill="none" stroke="rgba(0,200,255,0.9)" strokeWidth="2.5" strokeLinecap="round" filter="url(#gl2)" style={{ opacity: anim ? 1 : 0, transition: "opacity 0.8s ease 0.2s" }} />
        {pts.map((p, i) => (
          <g key={i} style={{ cursor: "pointer" }} onMouseEnter={() => setHov(i)}>
            <circle cx={p.x} cy={p.y} r={hov === i ? 14 : 0} fill={`${p.color}18`} stroke={`${p.color}44`} strokeWidth="1" style={{ transition: "r 0.25s ease" }} />
            <circle cx={p.x} cy={p.y} r={hov === i ? 7 : 5} fill={hov === i ? p.color : "#0a1628"} stroke={p.color} strokeWidth="2.5" style={{ transition: "all 0.25s ease", filter: `drop-shadow(0 0 5px ${p.color}99)`, opacity: anim ? 1 : 0 }} />
            {hov === i && (
              <g>
                <rect x={p.x - 44} y={p.y - 38} width={88} height={24} rx="5" fill="rgba(10,22,44,0.95)" stroke={`${p.color}66`} strokeWidth="1" />
                <text x={p.x} y={p.y - 22} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill={p.color} fontFamily="'DM Mono',monospace" fontWeight="700">
                  {p.label}:{p.val}
                </text>
              </g>
            )}
          </g>
        ))}
        {pts.map((p, i) => (
          <text key={i} x={p.x} y={padT + chartH + 16} textAnchor="middle" fontSize="9" fill={BAR_COLORS[i]} fontFamily="'DM Sans',sans-serif" fontWeight="600">
            {RADAR_LABELS[i].slice(0, 5)}
          </text>
        ))}
        <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="rgba(100,180,255,0.15)" strokeWidth="1" />
      </svg>
    </div>
  );
}

function SkillDoughnutChart({ values }) {
  const [anim, setAnim] = useState(false);
  const [hov, setHov] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setAnim(true), 400);
    return () => clearTimeout(t);
  }, []);

  const cx = 130, cy = 130, outerR = 100, innerR = 56, gap = 2;
  const total = RADAR_KEYS.reduce((s, k) => s + values[k], 0);
  let cursor = -Math.PI / 2;
  const segs = RADAR_KEYS.map((k, i) => {
    const frac = values[k] / total, angle = frac * 2 * Math.PI - (gap * Math.PI) / 180, start = cursor, end = cursor + angle;
    cursor += frac * 2 * Math.PI;
    const la = angle > Math.PI ? 1 : 0;
    const x1 = cx + outerR * Math.cos(start), y1 = cy + outerR * Math.sin(start), x2 = cx + outerR * Math.cos(end), y2 = cy + outerR * Math.sin(end);
    const x3 = cx + innerR * Math.cos(end), y3 = cy + innerR * Math.sin(end), x4 = cx + innerR * Math.cos(start), y4 = cy + innerR * Math.sin(start);
    const mid = (start + end) / 2;
    const lx = cx + (outerR + 20) * Math.cos(mid), ly = cy + (outerR + 20) * Math.sin(mid);
    return { k, i, d: `M${x1},${y1} A${outerR},${outerR} 0 ${la} 1 ${x2},${y2} L${x3},${y3} A${innerR},${innerR} 0 ${la} 0 ${x4},${y4} Z`, color: BAR_COLORS[i], frac, lx, ly, mid, val: values[k] };
  });
  const hs = hov !== null ? segs[hov] : null;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 24 }}>
      <svg viewBox="0 0 260 260" style={{ width: "100%", maxWidth: 240, flexShrink: 0 }} onMouseLeave={() => setHov(null)}>
        <defs>
          {segs.map(({ k, color, i }) => (
            <radialGradient key={k} id={`dg${i}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={color} stopOpacity=".7" />
            </radialGradient>
          ))}
        </defs>
        {segs.map(({ k, i, d, color, val, lx, ly }) => (
          <g key={k} style={{ cursor: "pointer" }} onMouseEnter={() => setHov(i)}>
            <path
              d={d}
              fill={`url(#dg${i})`}
              stroke="rgba(6,13,31,0.8)"
              strokeWidth="2"
              style={{
                transform: hov === i ? `translate(${Math.cos(segs[i].mid) * 6}px,${Math.sin(segs[i].mid) * 6}px)` : "none",
                transition: "transform 0.25s ease",
                opacity: anim ? 1 : 0,
                transitionDelay: `${i * 0.07}s`,
                transformOrigin: `${cx}px ${cy}px`,
              }}
            />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill={color} fontFamily="'DM Mono',monospace" fontWeight="700" style={{ opacity: anim ? 1 : 0, transition: `opacity 0.5s ease ${i * 0.07 + 0.3}s` }}>
              {Math.round((val / total) * 100)}%
            </text>
          </g>
        ))}
        <circle cx={cx} cy={cy} r={innerR - 3} fill="rgba(6,13,31,0.85)" />
        {hs ? (
          <>
            <text x={cx} y={cy - 12} textAnchor="middle" dominantBaseline="middle" fontSize="20" fill={hs.color} fontFamily="'DM Mono',monospace" fontWeight="800">
              {hs.val}
            </text>
            <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="rgba(160,210,255,0.7)" fontFamily="'DM Sans',sans-serif" fontWeight="600">
              {RADAR_LABELS[hs.i]}
            </text>
            <text x={cx} y={cy + 22} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill={hs.color} fontFamily="'DM Mono',monospace">
              {Math.round(hs.frac * 100)}%
            </text>
          </>
        ) : (
          <>
            <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle" fontSize="22" fill="#e8f4ff" fontFamily="'DM Mono',monospace" fontWeight="800">
              {total}
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="rgba(120,180,240,0.55)" fontFamily="'DM Sans',sans-serif">
              Total
            </text>
          </>
        )}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 150 }}>
        {segs.map(({ k, i, color, val }) => (
          <div
            key={k}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: hov === i ? `${color}14` : "rgba(255,255,255,0.025)", border: `1px solid ${hov === i ? color + "44" : "rgba(100,180,255,0.08)"}`, cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={() => setHov(i)}
            onMouseLeave={() => setHov(null)}
          >
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color, boxShadow: `0 0 6px ${color}88`, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "rgba(180,215,255,0.85)", fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>{RADAR_LABELS[i]}</div>
              <div style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color, fontWeight: 700 }}>
                {val} · {Math.round((val / total) * 100)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBar2({ label, value, max, unit, index }) {
  const [w, setW] = useState(0);
  const pct = Math.round((value / max) * 100);

  useEffect(() => {
    const t = setTimeout(() => setW(pct), 200 + index * 60);
    return () => clearTimeout(t);
  }, [pct, index]);

  const color = pct >= 85 ? "#00e5a0" : pct >= 65 ? "#00c8ff" : pct >= 45 ? "#f5c842" : "#ff6b6b";

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "rgba(180,210,240,0.8)", fontFamily: "'DM Sans',sans-serif" }}>{label}</span>
        <span style={{ fontSize: 12, color, fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>
          {value}{unit}<span style={{ color: "rgba(120,160,200,0.5)", fontWeight: 400 }}>/{max}{unit}</span>
        </span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${w}%`, background: `linear-gradient(90deg,${color}88,${color})`, borderRadius: 99, transition: "width 0.9s cubic-bezier(0.23,1,0.32,1)" }} />
      </div>
    </div>
  );
}

function ScoreCircle2({ value, label, color, delay = 0 }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ width: 110, height: 110, borderRadius: "50%", border: `3px solid ${color}`, boxShadow: `0 0 24px ${color}44,inset 0 0 20px ${color}11`, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,20,40,0.6)", transition: `all 0.7s cubic-bezier(0.23,1,0.32,1) ${delay}ms`, transform: show ? "scale(1)" : "scale(0.6)", opacity: show ? 1 : 0 }}>
        <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "'DM Mono',monospace", color, letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</span>
      </div>
      <span style={{ fontSize: 10, fontFamily: "'DM Sans',sans-serif", color: "rgba(160,200,240,0.7)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>{label}</span>
    </div>
  );
}

export default function StatisticsPage() {
  const gColor = { A: "#00e5a0", B: "#00c8ff", C: "#f5c842", D: "#ff9f43", F: "#ff4757" }[devData.grade] || "#fff";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 100);
  }, []);

  return (
    <div style={{ padding: "24px 0" }}>
      <div className="scard" style={{ animation: mounted ? "fadeUp 0.5s ease both" : "none" }}>
        <div className="stitle">Summary — John Doe</div>
        <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 20 }}>
          <ScoreCircle2 value={devData.score.toLocaleString()} label="Score Points" color="#ff6eb4" delay={200} />
          <ScoreCircle2 value={devData.storyPoints} label="Story Points" color="#f5c842" delay={350} />
          <ScoreCircle2 value={devData.grade} label="Grade" color={gColor} delay={500} />
        </div>
      </div>

      <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="scard">
          <div className="stitle">Performance Metrics</div>
          {devData.stats.map((s, i) => <StatBar2 key={s.label} {...s} index={i} />)}
        </div>
        <div className="scard">
          <div className="stitle">Skill Radar</div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <RadarChart values={devData.radar} />
          </div>
        </div>
      </div>

      <div className="scard">
        <div className="stitle">Skill Breakdown — Bar Chart</div>
        <SkillBarChart values={devData.radar} />
      </div>

      <div className="scard">
        <div className="stitle">Skill Trend — Line Chart</div>
        <SkillLineChart values={devData.radar} />
      </div>

      <div className="scard">
        <div className="stitle">Skill Distribution — Doughnut Chart</div>
        <SkillDoughnutChart values={devData.radar} />
      </div>
    </div>
  );
}
