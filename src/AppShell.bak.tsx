import { useState, useEffect, useRef, type MouseEvent } from "react";

/* ─────────────────────────────────────────────
   ICONS  (inline SVG so no extra deps needed)
───────────────────────────────────────────── */
const Icon = {
  burger: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="4.5" width="16" height="1.8" rx="1" fill="currentColor" />
      <rect x="2" y="9.1" width="16" height="1.8" rx="1" fill="currentColor" />
      <rect x="2" y="13.7" width="16" height="1.8" rx="1" fill="currentColor" />
    </svg>
  ),
  close: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M4 4L16 16M16 4L4 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect
        x="1"
        y="1"
        width="6"
        height="6"
        rx="1.5"
        fill="currentColor"
        opacity=".9"
      />
      <rect
        x="9"
        y="1"
        width="6"
        height="6"
        rx="1.5"
        fill="currentColor"
        opacity=".5"
      />
      <rect
        x="1"
        y="9"
        width="6"
        height="6"
        rx="1.5"
        fill="currentColor"
        opacity=".5"
      />
      <rect
        x="9"
        y="9"
        width="6"
        height="6"
        rx="1.5"
        fill="currentColor"
        opacity=".5"
      />
    </svg>
  ),
  profile: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.5" r="3" fill="currentColor" opacity=".9" />
      <path
        d="M2 13.5c0-3.314 2.686-5 6-5s6 1.686 6 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity=".7"
      />
    </svg>
  ),
  album: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect
        x="1.5"
        y="1.5"
        width="13"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity=".7"
      />
      <circle cx="5.5" cy="5.5" r="1.5" fill="currentColor" opacity=".8" />
      <path
        d="M2 11l3.5-3.5 2.5 2.5 2-2 3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity=".8"
      />
    </svg>
  ),
  collection: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M2 5h12M2 8h12M2 11h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity=".8"
      />
    </svg>
  ),
  history: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity=".7"
      />
      <path
        d="M8 5v3.5l2.5 1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity=".9"
      />
    </svg>
  ),
  battlefield: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M2 13L8 3l6 10H2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity=".8"
      />
      <path
        d="M6 13V9h4v4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity=".7"
      />
    </svg>
  ),
  stats: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect
        x="2"
        y="9"
        width="3"
        height="5"
        rx="1"
        fill="currentColor"
        opacity=".6"
      />
      <rect
        x="6.5"
        y="5"
        width="3"
        height="9"
        rx="1"
        fill="currentColor"
        opacity=".8"
      />
      <rect
        x="11"
        y="2"
        width="3"
        height="12"
        rx="1"
        fill="currentColor"
        opacity=".95"
      />
    </svg>
  ),
  favorite: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 13s-6-3.5-6-7a4 4 0 018 0 4 4 0 018 0c0 3.5-6 7-6 7z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity=".8"
      />
    </svg>
  ),
  replays: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <polygon points="5,3 13,8 5,13" fill="currentColor" opacity=".85" />
      <rect
        x="2"
        y="3"
        width="2"
        height="10"
        rx="1"
        fill="currentColor"
        opacity=".6"
      />
    </svg>
  ),
  credit: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect
        x="1.5"
        y="3.5"
        width="13"
        height="9"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity=".7"
      />
      <path
        d="M1.5 7h13"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity=".6"
      />
      <rect
        x="3.5"
        y="9.5"
        width="4"
        height="1.5"
        rx=".75"
        fill="currentColor"
        opacity=".6"
      />
    </svg>
  ),
  chevron: (open: boolean) => (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.3s ease",
      }}
    >
      <path
        d="M2 4l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  badge: (
    <span
      style={{
        fontSize: 8,
        fontFamily: "'DM Mono', monospace",
        fontWeight: 800,
        color: "#060d1f",
        background: "#00e5a0",
        padding: "1px 5px",
        borderRadius: 99,
        letterSpacing: "0.05em",
      }}
    >
      NEW
    </span>
  ),
  logo: (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <polygon
        points="14,2 26,9 26,19 14,26 2,19 2,9"
        fill="none"
        stroke="url(#logoGrad)"
        strokeWidth="2"
      />
      <polygon
        points="14,7 21,11 21,17 14,21 7,17 7,11"
        fill="url(#logoGrad)"
        opacity="0.3"
      />
      <circle cx="14" cy="14" r="3" fill="url(#logoGrad)" />
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="28" y2="28">
          <stop stopColor="#00c8ff" />
          <stop offset="1" stopColor="#00e5a0" />
        </linearGradient>
      </defs>
    </svg>
  ),
};

type NavIconKey = Exclude<keyof typeof Icon, "chevron" | "badge" | "logo">;

type NavItemData = {
  id: string;
  label: string;
  icon?: NavIconKey;
  badge?: boolean;
  children?: readonly NavItemData[];
};

/* ─────────────────────────────────────────────
   NAV STRUCTURE
───────────────────────────────────────────── */
const NAV: NavItemData[] = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "profile", label: "Profile", icon: "profile" },
  { id: "album", label: "Album", icon: "album" },
  {
    id: "collection",
    label: "Collection",
    icon: "collection",
    children: [
      { id: "col-heroes", label: "Heroes" },
      { id: "col-skins", label: "Skins" },
      { id: "col-emblems", label: "Emblems" },
    ],
  },
  { id: "history", label: "History", icon: "history" },
  {
    id: "battlefield",
    label: "Battlefield",
    icon: "battlefield",
    badge: true,
    children: [
      { id: "stats", label: "Statistics", icon: "stats" },
      { id: "favorite", label: "Favorite", icon: "favorite" },
      { id: "replays", label: "Replays", icon: "replays" },
    ],
  },
  { id: "credit", label: "Credit Score", icon: "credit", badge: true },
];

/* ─────────────────────────────────────────────
   SIDEBAR NAV ITEM
───────────────────────────────────────────── */
type NavItemProps = {
  item: NavItemData;
  active: string;
  setActive: (id: string) => void;
  depth?: number;
};

function NavItem({ item, active, setActive, depth = 0 }: NavItemProps) {
  const hasChildren = (item.children?.length ?? 0) > 0;
  const isActive =
    active === item.id || item.children?.some((c) => c.id === active) || false;
  const [open, setOpen] = useState(isActive);

  const handleClick = () => {
    if (hasChildren) setOpen((o) => !o);
    else setActive(item.id);
  };

  return (
    <div>
      <button
        onClick={handleClick}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: depth === 0 ? "10px 16px" : "7px 16px 7px 38px",
          background:
            active === item.id
              ? "linear-gradient(90deg, rgba(0,200,255,0.18) 0%, rgba(0,200,255,0.04) 100%)"
              : "transparent",
          border: "none",
          borderLeft:
            active === item.id ? "2px solid #00c8ff" : "2px solid transparent",
          borderRadius: "0 8px 8px 0",
          cursor: "pointer",
          color:
            active === item.id
              ? "#e8f4ff"
              : isActive
                ? "rgba(200,230,255,0.8)"
                : "rgba(140,185,230,0.6)",
          transition: "all 0.2s ease",
          textAlign: "left",
          marginBottom: 1,
        }}
        onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => {
          if (active !== item.id)
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => {
          if (active !== item.id)
            e.currentTarget.style.background = "transparent";
        }}
      >
        {item.icon && (
          <span
            style={{
              color: active === item.id ? "#00c8ff" : "inherit",
              flexShrink: 0,
            }}
          >
            {Icon[item.icon]}
          </span>
        )}
        {!item.icon && depth > 0 && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              flexShrink: 0,
              background:
                active === item.id ? "#00c8ff" : "rgba(100,160,210,0.4)",
              transition: "background 0.2s",
            }}
          />
        )}
        <span
          style={{
            flex: 1,
            fontSize: depth === 0 ? 13 : 12,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: active === item.id ? 700 : depth === 0 ? 500 : 400,
            letterSpacing: depth === 0 ? "0.02em" : "0.01em",
          }}
        >
          {item.label}
        </span>
        {item.badge && Icon.badge}
        {hasChildren && Icon.chevron(open)}
      </button>

      {/* Children */}
      {hasChildren && (
        <div
          style={{
            overflow: "hidden",
            maxHeight: open ? `${(item.children?.length ?? 0) * 40}px` : "0px",
            transition: "max-height 0.35s cubic-bezier(0.23,1,0.32,1)",
          }}
        >
          {item.children?.map((child) => (
            <NavItem
              key={child.id}
              item={child}
              active={active}
              setActive={setActive}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   SIDEBAR CONTENT
───────────────────────────────────────────── */
type SidebarContentProps = {
  active: string;
  setActive: (id: string) => void;
  onClose?: () => void;
};

function SidebarContent({ active, setActive, onClose }: SidebarContentProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Logo / brand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 16px 16px",
          borderBottom: "1px solid rgba(100,180,255,0.08)",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {Icon.logo}
          <div>
            <div
              style={{
                fontSize: 13,
                fontFamily: "'DM Mono', monospace",
                fontWeight: 800,
                color: "#e8f4ff",
                letterSpacing: "0.05em",
                lineHeight: 1,
              }}
            >
              DEVTRACKER
            </div>
            <div
              style={{
                fontSize: 9,
                color: "rgba(0,200,255,0.6)",
                fontFamily: "'DM Mono', monospace",
                letterSpacing: "0.15em",
                marginTop: 2,
              }}
            >
              v2.0 PLATFORM
            </div>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(100,180,255,0.15)",
              borderRadius: 8,
              color: "rgba(140,185,230,0.7)",
              cursor: "pointer",
              padding: "6px",
              display: "flex",
              alignItems: "center",
            }}
          >
            {Icon.close}
          </button>
        )}
      </div>

      {/* Section label */}
      <div
        style={{
          fontSize: 9,
          fontFamily: "'DM Mono', monospace",
          fontWeight: 700,
          color: "rgba(80,130,180,0.5)",
          letterSpacing: "0.2em",
          padding: "4px 16px 8px",
          textTransform: "uppercase",
        }}
      >
        Navigation
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
        {NAV.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            active={active}
            setActive={(id) => {
              setActive(id);
              onClose?.();
            }}
          />
        ))}
      </nav>

      {/* Bottom user card */}
      <div
        style={{
          margin: "12px 12px 16px",
          padding: "12px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(100,180,255,0.1)",
          borderRadius: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #00c8ff, #00e5a0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              color: "#060d1f",
              fontFamily: "'DM Mono', monospace",
              flexShrink: 0,
            }}
          >
            JD
          </div>
          <div style={{ overflow: "hidden" }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#e8f4ff",
                fontFamily: "'DM Sans', sans-serif",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              John Doe
            </div>
            <div
              style={{
                fontSize: 10,
                color: "rgba(0,200,255,0.6)",
                fontFamily: "'DM Mono', monospace",
              }}
            >
              Senior Dev · Grade A
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TOP BAR
───────────────────────────────────────────── */
type TopBarProps = {
  active: string;
  onBurger: () => void;
};

function TopBar({ onBurger, active }: TopBarProps) {
  const label =
    NAV.flatMap((n) => [n, ...(n.children || [])]).find((n) => n.id === active)
      ?.label || "Dashboard";
  return (
    <div
      style={{
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        background: "rgba(6,13,31,0.8)",
        borderBottom: "1px solid rgba(100,180,255,0.08)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Burger — only visible on mobile */}
        <button
          onClick={onBurger}
          className="burger-btn"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(100,180,255,0.15)",
            borderRadius: 8,
            color: "rgba(160,210,255,0.8)",
            cursor: "pointer",
            padding: "7px",
            display: "flex",
            alignItems: "center",
          }}
        >
          {Icon.burger}
        </button>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              color: "rgba(80,130,180,0.5)",
              fontFamily: "'DM Mono', monospace",
            }}
          >
            DEVTRACKER
          </span>
          <span style={{ color: "rgba(80,130,180,0.3)", fontSize: 11 }}>/</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#e8f4ff",
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: "0.02em",
            }}
          >
            {label}
          </span>
        </div>
      </div>

      {/* Right side badges */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(0,229,160,0.08)",
            border: "1px solid rgba(0,229,160,0.2)",
            borderRadius: 99,
            padding: "4px 12px",
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#00e5a0",
              boxShadow: "0 0 6px #00e5a0",
            }}
          />
          <span
            style={{
              fontSize: 10,
              color: "#00e5a0",
              fontFamily: "'DM Mono', monospace",
              fontWeight: 700,
            }}
          >
            ACTIVE
          </span>
        </div>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #00c8ff, #00e5a0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 800,
            color: "#060d1f",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          JD
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE CONTENT PLACEHOLDER
───────────────────────────────────────────── */
type PageContentProps = {
  active: string;
};

function PageContent({ active }: PageContentProps) {
  const label =
    NAV.flatMap((n) => [n, ...(n.children || [])]).find((n) => n.id === active)
      ?.label || "Dashboard";

  if (active === "stats") {
    return <StatisticsPage />;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: 20,
        padding: 40,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: "rgba(0,200,255,0.08)",
          border: "1px solid rgba(0,200,255,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#00c8ff",
        }}
      >
        {(() => {
          const activeIcon =
            NAV.flatMap((n) => [n, ...(n.children || [])]).find(
              (n) => n.id === active,
            )?.icon ?? "dashboard";
          return Icon[activeIcon] || Icon.dashboard;
        })()}
      </div>
      <div style={{ textAlign: "center" }}>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: "#e8f4ff",
            fontFamily: "'DM Sans', sans-serif",
            marginBottom: 8,
          }}
        >
          {label}
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "rgba(120,170,220,0.55)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          This section is under construction.
        </p>
      </div>
      <div
        style={{
          padding: "8px 20px",
          background: "rgba(0,200,255,0.06)",
          border: "1px dashed rgba(0,200,255,0.2)",
          borderRadius: 99,
          fontSize: 11,
          color: "rgba(0,200,255,0.5)",
          fontFamily: "'DM Mono', monospace",
          letterSpacing: "0.1em",
        }}
      >
        COMING SOON
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   STATISTICS PAGE (the tracker we already built)
───────────────────────────────────────────── */

const RADAR_LABELS = [
  "Productivity",
  "Efficiency",
  "Quality",
  "Collaboration",
  "Velocity",
] as const;
const RADAR_KEYS = [
  "productivity",
  "efficiency",
  "quality",
  "collaboration",
  "velocity",
] as const;
const BAR_COLORS = [
  "#00c8ff",
  "#00e5a0",
  "#f5c842",
  "#ff6eb4",
  "#a78bfa",
] as const;

type RadarKey = (typeof RADAR_KEYS)[number];

type RadarValues = Record<RadarKey, number>;

const devData = {
  score: "95.45%",
  storyPoints: 347,
  grade: "B",
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
  radar: {
    productivity: 87,
    efficiency: 92,
    quality: 78,
    collaboration: 95,
    velocity: 83,
  },
};

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function RadarChart({ values }: { values: RadarValues }) {
  const cx = 160,
    cy = 160,
    maxR = 110,
    levels = 5,
    n = RADAR_KEYS.length;
  const polygonPoints = (r: number) =>
    Array.from({ length: n }, (_, i) => {
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
    <svg viewBox="0 0 320 320" style={{ width: "100%", maxWidth: "100%" }}>
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
          style={{
            transition: `all 1s ease ${i * 0.08}s`,
            opacity: anim ? 1 : 0,
          }}
        />
      ))}
      {RADAR_LABELS.map((l, i) => {
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
            {l}
          </text>
        );
      })}
    </svg>
  );
}

function SkillBarChart({ values }: { values: RadarValues }) {
  const [heights, setHeights] = useState<number[]>(RADAR_KEYS.map(() => 0));
  const chartH = 160;
  useEffect(() => {
    const t = setTimeout(
      () => setHeights(RADAR_KEYS.map((k) => values[k])),
      300,
    );
    return () => clearTimeout(t);
  }, [values]);
  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          height: chartH + 32,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            paddingBottom: 32,
          }}
        >
          {[0, 25, 50, 75, 100].map((v) => (
            <div
              key={v}
              style={{
                position: "absolute",
                bottom: `calc(${v}%+32px)`,
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
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            width: "100%",
            height: "100%",
            paddingBottom: 32,
            paddingLeft: 28,
          }}
        >
          {RADAR_KEYS.map((k, i) => {
            const color = BAR_COLORS[i];
            return (
              <div
                key={k}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: "100%",
                  justifyContent: "flex-end",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "'DM Mono',monospace",
                    fontWeight: 700,
                    color,
                    marginBottom: 4,
                    opacity: heights[i] > 0 ? 1 : 0,
                    transition: "opacity 0.5s ease",
                  }}
                >
                  {values[k]}
                </span>
                <div
                  style={{
                    width: "100%",
                    height: `${(heights[i] / 100) * chartH}px`,
                    transition: "height 1s cubic-bezier(0.23,1,0.32,1)",
                    borderRadius: "6px 6px 3px 3px",
                    background: `linear-gradient(180deg,${color} 0%,${color}55 100%)`,
                    boxShadow: `0 0 14px ${color}44`,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "'DM Sans',sans-serif",
                    fontWeight: 600,
                    color: "rgba(150,200,240,0.7)",
                    marginTop: 8,
                    textAlign: "center",
                  }}
                >
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

function SkillLineChart({ values }: { values: RadarValues }) {
  const W = 500,
    H = 180,
    padL = 32,
    padR = 16,
    padT = 20,
    padB = 36;
  const chartW = W - padL - padR,
    chartH = H - padT - padB,
    n = RADAR_KEYS.length,
    step = chartW / (n - 1);
  const [anim, setAnim] = useState(false);
  const [hov, setHov] = useState<number | null>(null);
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
    const pv = pts[i - 1],
      cpx = (pv.x + p.x) / 2;
    return `${a} C${cpx},${pv.y} ${cpx},${p.y} ${p.x},${p.y}`;
  }, "");
  const area = `${smooth} L${pts[pts.length - 1].x},${padT + chartH} L${pts[0].x},${padT + chartH} Z`;
  return (
    <div
      style={{ width: "100%", overflowX: "auto" }}
      onMouseLeave={() => setHov(null)}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", minWidth: 280, display: "block" }}
      >
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
              <line
                x1={padL}
                y1={y}
                x2={W - padR}
                y2={y}
                stroke="rgba(100,180,255,0.08)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={padL - 4}
                y={y + 4}
                textAnchor="end"
                fontSize="9"
                fill="rgba(100,160,210,0.45)"
                fontFamily="'DM Mono',monospace"
              >
                {v}
              </text>
            </g>
          );
        })}
        <path
          d={area}
          fill="url(#la2)"
          style={{ opacity: anim ? 1 : 0, transition: "opacity 1s ease 0.4s" }}
        />
        <path
          d={smooth}
          fill="none"
          stroke="rgba(0,200,255,0.9)"
          strokeWidth="2.5"
          strokeLinecap="round"
          filter="url(#gl2)"
          style={{
            opacity: anim ? 1 : 0,
            transition: "opacity 0.8s ease 0.2s",
          }}
        />
        {pts.map((p, i) => (
          <g
            key={i}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHov(i)}
          >
            <circle
              cx={p.x}
              cy={p.y}
              r={hov === i ? 14 : 0}
              fill={`${p.color}18`}
              stroke={`${p.color}44`}
              strokeWidth="1"
              style={{ transition: "r 0.25s ease" }}
            />
            <circle
              cx={p.x}
              cy={p.y}
              r={hov === i ? 7 : 5}
              fill={hov === i ? p.color : "#0a1628"}
              stroke={p.color}
              strokeWidth="2.5"
              style={{
                transition: "all 0.25s ease",
                filter: `drop-shadow(0 0 5px ${p.color}99)`,
                opacity: anim ? 1 : 0,
              }}
            />
            {hov === i && (
              <g>
                <rect
                  x={p.x - 44}
                  y={p.y - 38}
                  width={88}
                  height={24}
                  rx="5"
                  fill="rgba(10,22,44,0.95)"
                  stroke={`${p.color}66`}
                  strokeWidth="1"
                />
                <text
                  x={p.x}
                  y={p.y - 22}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="10"
                  fill={p.color}
                  fontFamily="'DM Mono',monospace"
                  fontWeight="700"
                >
                  {p.label}:{p.val}
                </text>
              </g>
            )}
          </g>
        ))}
        {pts.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={padT + chartH + 16}
            textAnchor="middle"
            fontSize="9"
            fill={BAR_COLORS[i]}
            fontFamily="'DM Sans',sans-serif"
            fontWeight="600"
          >
            {RADAR_LABELS[i].slice(0, 5)}
          </text>
        ))}
        <line
          x1={padL}
          y1={padT + chartH}
          x2={W - padR}
          y2={padT + chartH}
          stroke="rgba(100,180,255,0.15)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

type DoughnutSegment = {
  k: RadarKey;
  i: number;
  d: string;
  color: string;
  frac: number;
  lx: number;
  ly: number;
  mid: number;
  val: number;
};

function buildDoughnutSegments(values: RadarValues): DoughnutSegment[] {
  const cx = 130,
    cy = 130,
    outerR = 100,
    innerR = 56,
    gap = 2;
  const total = RADAR_KEYS.reduce((s, k) => s + values[k], 0);
  let cursor = -Math.PI / 2;
  return RADAR_KEYS.map((k, i) => {
    const frac = values[k] / total;
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
    const lx = cx + (outerR + 20) * Math.cos(mid);
    const ly = cy + (outerR + 20) * Math.sin(mid);

    return {
      k,
      i,
      d: `M${x1},${y1} A${outerR},${outerR} 0 ${la} 1 ${x2},${y2} L${x3},${y3} A${innerR},${innerR} 0 ${la} 0 ${x4},${y4} Z`,
      color: BAR_COLORS[i],
      frac,
      lx,
      ly,
      mid,
      val: values[k],
    };
  });
}

function SkillDoughnutChart({ values }: { values: RadarValues }) {
  const [anim, setAnim] = useState(false);
  const [hov, setHov] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setAnim(true), 400);
    return () => clearTimeout(t);
  }, []);
  const cx = 130,
    cy = 130,
    innerR = 56;
  const total = RADAR_KEYS.reduce((s, k) => s + values[k], 0);
  const segs = buildDoughnutSegments(values);
  const hs = hov !== null ? segs[hov] : null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: 24,
      }}
    >
      <svg
        viewBox="0 0 260 260"
        style={{ width: "100%", maxWidth: 240, flexShrink: 0 }}
        onMouseLeave={() => setHov(null)}
      >
        <defs>
          {segs.map(({ k, color, i }) => (
            <radialGradient key={k} id={`dg${i}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={color} stopOpacity=".7" />
            </radialGradient>
          ))}
        </defs>
        {segs.map(({ k, i, d, color, val, lx, ly }) => (
          <g
            key={k}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHov(i)}
          >
            <path
              d={d}
              fill={`url(#dg${i})`}
              stroke="rgba(6,13,31,0.8)"
              strokeWidth="2"
              style={{
                transform:
                  hov === i
                    ? `translate(${Math.cos(segs[i].mid) * 6}px,${Math.sin(segs[i].mid) * 6}px)`
                    : "none",
                transition: "transform 0.25s ease",
                opacity: anim ? 1 : 0,
                transitionDelay: `${i * 0.07}s`,
                transformOrigin: `${cx}px ${cy}px`,
              }}
            />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="9"
              fill={color}
              fontFamily="'DM Mono',monospace"
              fontWeight="700"
              style={{
                opacity: anim ? 1 : 0,
                transition: `opacity 0.5s ease ${i * 0.07 + 0.3}s`,
              }}
            >
              {Math.round((val / total) * 100)}%
            </text>
          </g>
        ))}
        <circle cx={cx} cy={cy} r={innerR - 3} fill="rgba(6,13,31,0.85)" />
        {hs ? (
          <>
            <text
              x={cx}
              y={cy - 12}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="20"
              fill={hs.color}
              fontFamily="'DM Mono',monospace"
              fontWeight="800"
            >
              {hs.val}
            </text>
            <text
              x={cx}
              y={cy + 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="9"
              fill="rgba(160,210,255,0.7)"
              fontFamily="'DM Sans',sans-serif"
              fontWeight="600"
            >
              {RADAR_LABELS[hs.i]}
            </text>
            <text
              x={cx}
              y={cy + 22}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8"
              fill={hs.color}
              fontFamily="'DM Mono',monospace"
            >
              {Math.round(hs.frac * 100)}%
            </text>
          </>
        ) : (
          <>
            <text
              x={cx}
              y={cy - 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="22"
              fill="#e8f4ff"
              fontFamily="'DM Mono',monospace"
              fontWeight="800"
            >
              {total}
            </text>
            <text
              x={cx}
              y={cy + 12}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="9"
              fill="rgba(120,180,240,0.55)"
              fontFamily="'DM Sans',sans-serif"
            >
              Total
            </text>
          </>
        )}
      </svg>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minWidth: 150,
        }}
      >
        {segs.map(({ k, i, color, val }) => (
          <div
            key={k}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 8,
              background: hov === i ? `${color}14` : "rgba(255,255,255,0.025)",
              border: `1px solid ${hov === i ? color + "44" : "rgba(100,180,255,0.08)"}`,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={() => setHov(i)}
            onMouseLeave={() => setHov(null)}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: color,
                boxShadow: `0 0 6px ${color}88`,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(180,215,255,0.85)",
                  fontFamily: "'DM Sans',sans-serif",
                  fontWeight: 600,
                }}
              >
                {RADAR_LABELS[i]}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "'DM Mono',monospace",
                  color,
                  fontWeight: 700,
                }}
              >
                {val} · {Math.round((val / total) * 100)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBar2({
  label,
  value,
  max,
  unit,
  index,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  index: number;
}) {
  const [w, setW] = useState(0);
  const pct = Math.round((value / max) * 100);
  useEffect(() => {
    const t = setTimeout(() => setW(pct), 200 + index * 60);
    return () => clearTimeout(t);
  }, [pct, index]);
  const color =
    pct >= 85
      ? "#00e5a0"
      : pct >= 65
        ? "#00c8ff"
        : pct >= 45
          ? "#f5c842"
          : "#ff6b6b";
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: "rgba(180,210,240,0.8)",
            fontFamily: "'DM Sans',sans-serif",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 12,
            color,
            fontFamily: "'DM Mono',monospace",
            fontWeight: 700,
          }}
        >
          {value}
          {unit}
          <span style={{ color: "rgba(120,160,200,0.5)", fontWeight: 400 }}>
            /{max}
            {unit}
          </span>
        </span>
      </div>
      <div
        style={{
          height: 5,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 99,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${w}%`,
            background: `linear-gradient(90deg,${color}88,${color})`,
            borderRadius: 99,
            transition: "width 0.9s cubic-bezier(0.23,1,0.32,1)",
          }}
        />
      </div>
    </div>
  );
}

function ScoreCircle2({
  value,
  label,
  color,
  delay = 0,
}: {
  value: string | number;
  label: string;
  color: string;
  delay?: number;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          width: 110,
          height: 110,
          borderRadius: "50%",
          border: `3px solid ${color}`,
          boxShadow: `0 0 24px ${color}44,inset 0 0 20px ${color}11`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(10,20,40,0.6)",
          transition: `all 0.7s cubic-bezier(0.23,1,0.32,1) ${delay}ms`,
          transform: show ? "scale(1)" : "scale(0.6)",
          opacity: show ? 1 : 0,
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            fontFamily: "'DM Mono',monospace",
            color,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          {value}
        </span>
      </div>
      <span
        style={{
          fontSize: 10,
          fontFamily: "'DM Sans',sans-serif",
          color: "rgba(160,200,240,0.7)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function StatisticsPage() {
  const gColor =
    { A: "#00e5a0", B: "#00c8ff", C: "#f5c842", D: "#ff9f43", F: "#ff4757" }[
      devData.grade
    ] || "#fff";
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setTimeout(() => setMounted(true), 100);
  }, []);
  return (
    <div style={{ padding: "24px 0" }}>
      <style>{`.scard{background:rgba(255,255,255,0.035);border:1px solid rgba(100,180,255,0.1);border-radius:16px;padding:24px;transition:border-color 0.3s;margin-bottom:20px}.scard:hover{border-color:rgba(0,200,255,0.2)}.stitle{font-size:10px;font-family:'DM Mono',monospace;color:rgba(100,180,255,0.55);text-transform:uppercase;letter-spacing:0.15em;margin-bottom:16px;font-weight:700}@media(max-width:700px){.two-col{grid-template-columns:1fr!important}}`}</style>

      {/* Circles */}
      <div
        className="scard"
        style={{ animation: mounted ? "fadeUp 0.5s ease both" : "none" }}
      >
        <div className="stitle">Summary — John Doe</div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-around",
            flexWrap: "wrap",
            gap: 20,
          }}
        >
          <ScoreCircle2
            value={devData.score.toLocaleString()}
            label="Score Points"
            color="#ff6eb4"
            delay={200}
          />
          <ScoreCircle2
            value={devData.storyPoints}
            label="Story Points"
            color="#f5c842"
            delay={350}
          />
          <ScoreCircle2
            value={devData.grade}
            label="Grade"
            color={gColor}
            delay={500}
          />
        </div>
      </div>

      {/* Metrics + Radar */}
      <div
        className="two-col"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}
      >
        <div className="scard">
          <div className="stitle">Performance Metrics</div>
          {devData.stats.map((s, i) => (
            <StatBar2 key={s.label} {...s} index={i} />
          ))}
        </div>
        <div className="scard">
          <div className="stitle">Skill Radar</div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <RadarChart values={devData.radar} />
          </div>
        </div>
      </div>

      {/* Bar */}
      <div className="scard">
        <div className="stitle">Skill Breakdown — Bar Chart</div>
        <SkillBarChart values={devData.radar} />
      </div>

      {/* Line */}
      <div className="scard">
        <div className="stitle">Skill Trend — Line Chart</div>
        <SkillLineChart values={devData.radar} />
      </div>

      {/* Doughnut */}
      <div className="scard">
        <div className="stitle">Skill Distribution — Doughnut Chart</div>
        <SkillDoughnutChart values={devData.radar} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ROOT APP SHELL
───────────────────────────────────────────── */
const SIDEBAR_W = 220;

export default function AppShell() {
  const [active, setActive] = useState("stats");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Close drawer on ESC
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Prevent body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg,#060d1f 0%,#0a1628 40%,#071220 100%)",
        display: "flex",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:#0a1628;}
        ::-webkit-scrollbar-thumb{background:#00c8ff33;border-radius:99px;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}

        /* Desktop: always show sidebar, hide burger */
        .burger-btn { display: none !important; }
        .desktop-sidebar { display: flex !important; }

        /* ≤ 900px: hide desktop sidebar, show burger */
        @media (max-width: 900px) {
          .burger-btn { display: flex !important; }
          .desktop-sidebar { display: none !important; }
        }

        /* Background grid */
        .bg-grid {
          position:fixed;inset:0;pointer-events:none;z-index:0;
          background-image:
            linear-gradient(rgba(0,200,255,0.025) 1px,transparent 1px),
            linear-gradient(90deg,rgba(0,200,255,0.025) 1px,transparent 1px);
          background-size:48px 48px;
        }
      `}</style>

      <div className="bg-grid" />

      {/* ── DESKTOP SIDEBAR ── */}
      <aside
        className="desktop-sidebar"
        style={{
          width: SIDEBAR_W,
          flexShrink: 0,
          background: "rgba(6,13,31,0.85)",
          borderRight: "1px solid rgba(100,180,255,0.08)",
          backdropFilter: "blur(16px)",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
          flexDirection: "column",
          zIndex: 5,
        }}
      >
        <SidebarContent active={active} setActive={setActive} />
      </aside>

      {/* ── MOBILE OVERLAY ── */}
      {drawerOpen && (
        <div
          ref={overlayRef}
          onClick={() => setDrawerOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(3px)",
            animation: "fadeIn 0.25s ease both",
          }}
        />
      )}

      {/* ── MOBILE DRAWER ── */}
      <aside
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100%",
          width: Math.min(SIDEBAR_W + 20, 280),
          background: "rgba(8,16,34,0.98)",
          borderRight: "1px solid rgba(100,180,255,0.12)",
          backdropFilter: "blur(20px)",
          zIndex: 50,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          transform: drawerOpen ? "translateX(0)" : "translateX(-105%)",
          transition: "transform 0.35s cubic-bezier(0.23,1,0.32,1)",
          boxShadow: drawerOpen ? "4px 0 40px rgba(0,0,0,0.5)" : "none",
        }}
      >
        <SidebarContent
          active={active}
          setActive={setActive}
          onClose={() => setDrawerOpen(false)}
        />
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          position: "relative",
          zIndex: 1,
        }}
      >
        <TopBar onBurger={() => setDrawerOpen(true)} active={active} />
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 24px 40px",
          }}
        >
          <PageContent active={active} />
        </main>
      </div>
    </div>
  );
}
