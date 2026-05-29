import { useState, useEffect, useRef } from "react";
import { 
  DashboardPage, 
  SprintPage, 
  StoryPointsPage, 
  StatisticsPage, TasksListPage 
} from "./pages";
import { Title } from "@/components/shared/page";
import "@/assets/styles/AppShell.css";

/* ─────────────────────────────────────────────
   ICONS  (inline SVG so no extra deps needed)
───────────────────────────────────────────── */
const Icon = {
  burger: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="4.5" width="16" height="1.8" rx="1" fill="currentColor"/>
      <rect x="2" y="9.1" width="16" height="1.8" rx="1" fill="currentColor"/>
      <rect x="2" y="13.7" width="16" height="1.8" rx="1" fill="currentColor"/>
    </svg>
  ),
  close: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M4 4L16 16M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".9"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5"/>
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5"/>
    </svg>
  ),
  profile: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.5" r="3" fill="currentColor" opacity=".9"/>
      <path d="M2 13.5c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".7"/>
    </svg>
  ),
  album: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" opacity=".7"/>
      <circle cx="5.5" cy="5.5" r="1.5" fill="currentColor" opacity=".8"/>
      <path d="M2 11l3.5-3.5 2.5 2.5 2-2 3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity=".8"/>
    </svg>
  ),
  collection: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 5h12M2 8h12M2 11h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".8"/>
    </svg>
  ),
  history: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" opacity=".7"/>
      <path d="M8 5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".9"/>
    </svg>
  ),
  battlefield: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 13L8 3l6 10H2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity=".8"/>
      <path d="M6 13V9h4v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".7"/>
    </svg>
  ),
  stats: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="9" width="3" height="5" rx="1" fill="currentColor" opacity=".6"/>
      <rect x="6.5" y="5" width="3" height="9" rx="1" fill="currentColor" opacity=".8"/>
      <rect x="11" y="2" width="3" height="12" rx="1" fill="currentColor" opacity=".95"/>
    </svg>
  ),
  scrum: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 4.5h10M3 8h10M3 11.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".85"/>
      <circle cx="2.5" cy="4.5" r="1" fill="currentColor" opacity=".65"/>
      <circle cx="2.5" cy="8" r="1" fill="currentColor" opacity=".85"/>
      <circle cx="2.5" cy="11.5" r="1" fill="currentColor" opacity=".65"/>
    </svg>
  ),
  favorite: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 13s-6-3.5-6-7a4 4 0 018 0 4 4 0 018 0c0 3.5-6 7-6 7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity=".8"/>
    </svg>
  ),
  replays: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <polygon points="5,3 13,8 5,13" fill="currentColor" opacity=".85"/>
      <rect x="2" y="3" width="2" height="10" rx="1" fill="currentColor" opacity=".6"/>
    </svg>
  ),
  credit: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="3.5" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" opacity=".7"/>
      <path d="M1.5 7h13" stroke="currentColor" strokeWidth="1.5" opacity=".6"/>
      <rect x="3.5" y="9.5" width="4" height="1.5" rx=".75" fill="currentColor" opacity=".6"/>
    </svg>
  ),
  chevron: (open: boolean) => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s ease" }}>
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  badge: (
    <span style={{
      fontSize: 8, fontFamily: "'DM Mono', monospace", fontWeight: 800,
      color: "#060d1f", background: "#00e5a0",
      padding: "1px 5px", borderRadius: 99, letterSpacing: "0.05em",
    }}>NEW</span>
  ),
  logo: (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <polygon points="14,2 26,9 26,19 14,26 2,19 2,9"
        fill="none" stroke="url(#logoGrad)" strokeWidth="2"/>
      <polygon points="14,7 21,11 21,17 14,21 7,17 7,11"
        fill="url(#logoGrad)" opacity="0.3"/>
      <circle cx="14" cy="14" r="3" fill="url(#logoGrad)"/>
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="28" y2="28">
          <stop stopColor="#00c8ff"/>
          <stop offset="1" stopColor="#00e5a0"/>
        </linearGradient>
      </defs>
    </svg>
  ),
};

/* ─────────────────────────────────────────────
   NAV STRUCTURE
───────────────────────────────────────────── */
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  {
    id: "scrum", label: "Scrum", icon: "scrum",
    children: [
      { id: "scrum-sprint", label: "Sprint" },
      { id: "scrum-tasks-list", label: "Tasks List" },
      { id: "scrum-story-points", label: "Story Points" },
    ],
  },
  { id: "profile",   label: "Profile",   icon: "profile" },
  { id: "album",     label: "Album",     icon: "album" },
  {
    id: "collection", label: "Collection", icon: "collection",
    children: [
      { id: "col-heroes",  label: "Heroes" },
      { id: "col-skins",   label: "Skins" },
      { id: "col-emblems", label: "Emblems" },
    ],
  },
  { id: "history", label: "History", icon: "history" },
  {
    id: "battlefield", label: "Accountabilities", icon: "battlefield", badge: true,
    children: [
      { id: "stats",    label: "Statistics", icon: "stats" },
      { id: "favorite", label: "Favorite",   icon: "favorite" },
      { id: "replays",  label: "Replays",    icon: "replays" },
    ],
  },
  { id: "credit", label: "Credit Score", icon: "credit", badge: true },
];

const ACTIVE_PAGE_STORAGE_KEY = "devtracker.activePage";
const NAV_ITEMS = NAV.flatMap((n) => [n, ...(n.children || [])]);
const VALID_NAV_IDS = new Set(NAV_ITEMS.map((item) => item.id));

function getInitialActivePage() {
  if (typeof window === "undefined") return "dashboard";
  const saved = window.localStorage.getItem(ACTIVE_PAGE_STORAGE_KEY);
  return saved && VALID_NAV_IDS.has(saved) ? saved : "dashboard";
}

/* ─────────────────────────────────────────────
   SIDEBAR NAV ITEM
───────────────────────────────────────────── */
function NavItem({ item, active, setActive, depth = 0 }) {
  const hasChildren = item.children?.length > 0;
  const isActive = active === item.id || item.children?.some(c => c.id === active);
  const [open, setOpen] = useState(isActive);

  const handleClick = () => {
    if (hasChildren) setOpen(o => !o);
    else setActive(item.id);
  };

  return (
    <div>
      <button
        onClick={handleClick}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: depth === 0 ? "10px 16px" : "7px 16px 7px 38px",
          background: active === item.id
            ? "linear-gradient(90deg, rgba(0,200,255,0.18) 0%, rgba(0,200,255,0.04) 100%)"
            : "transparent",
          border: "none",
          borderLeft: active === item.id ? "2px solid #00c8ff" : "2px solid transparent",
          borderRadius: "0 8px 8px 0",
          cursor: "pointer",
          color: active === item.id ? "#e8f4ff" : isActive ? "rgba(200,230,255,0.8)" : "rgba(140,185,230,0.6)",
          transition: "all 0.2s ease",
          textAlign: "left",
          marginBottom: 1,
        }}
        onMouseEnter={e => {
          if (active !== item.id) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={e => {
          if (active !== item.id) e.currentTarget.style.background = "transparent";
        }}
      >
        {item.icon && (
          <span style={{ color: active === item.id ? "#00c8ff" : "inherit", flexShrink: 0 }}>
            {Icon[item.icon]}
          </span>
        )}
        {!item.icon && depth > 0 && (
          <span style={{
            width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
            background: active === item.id ? "#00c8ff" : "rgba(100,160,210,0.4)",
            transition: "background 0.2s",
          }}/>
        )}
        <span style={{
          flex: 1,
          fontSize: depth === 0 ? 13 : 12,
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: active === item.id ? 700 : depth === 0 ? 500 : 400,
          letterSpacing: depth === 0 ? "0.02em" : "0.01em",
        }}>
          {item.label}
        </span>
        {item.badge && Icon.badge}
        {hasChildren && Icon.chevron(open)}
      </button>

      {/* Children */}
      {hasChildren && (
        <div style={{
          overflow: "hidden",
          maxHeight: open ? `${item.children.length * 40}px` : "0px",
          transition: "max-height 0.35s cubic-bezier(0.23,1,0.32,1)",
        }}>
          {item.children.map(child => (
            <NavItem key={child.id} item={child} active={active} setActive={setActive} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   SIDEBAR CONTENT
───────────────────────────────────────────── */
function SidebarContent({ active, setActive, onClose = undefined }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
    }}>
      {/* Logo / brand */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 16px 16px",
        borderBottom: "1px solid rgba(100,180,255,0.08)",
        marginBottom: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {Icon.logo}
          <div>
            <div style={{
              fontSize: 13, fontFamily: "'DM Mono', monospace", fontWeight: 800,
              color: "#e8f4ff", letterSpacing: "0.05em", lineHeight: 1,
            }}>DEVTRACKER</div>
            <div style={{
              fontSize: 9, color: "rgba(0,200,255,0.6)",
              fontFamily: "'DM Mono', monospace", letterSpacing: "0.15em",
              marginTop: 2,
            }}>v2.0 PLATFORM</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(100,180,255,0.15)",
            borderRadius: 8, color: "rgba(140,185,230,0.7)", cursor: "pointer",
            padding: "6px", display: "flex", alignItems: "center",
          }}>
            {Icon.close}
          </button>
        )}
      </div>

      {/* Section label */}
      <div style={{
        fontSize: 9, fontFamily: "'DM Mono', monospace", fontWeight: 700,
        color: "rgba(80,130,180,0.5)", letterSpacing: "0.2em",
        padding: "4px 16px 8px", textTransform: "uppercase",
      }}>Navigation</div>

      {/* Nav items */}
      <nav style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
        {NAV.map(item => (
          <NavItem key={item.id} item={item} active={active} setActive={(id) => { setActive(id); onClose?.(); }} />
        ))}
      </nav>

      {/* Bottom user card */}
      <div style={{
        margin: "12px 12px 16px",
        padding: "12px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(100,180,255,0.1)",
        borderRadius: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: "linear-gradient(135deg, #00c8ff, #00e5a0)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 800, color: "#060d1f",
            fontFamily: "'DM Mono', monospace", flexShrink: 0,
          }}>JD</div>
          <div style={{ overflow: "hidden" }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: "#e8f4ff",
              fontFamily: "'DM Sans', sans-serif",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>John Doe</div>
            <div style={{
              fontSize: 10, color: "rgba(0,200,255,0.6)",
              fontFamily: "'DM Mono', monospace",
            }}>Senior Dev · Grade A</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TOP BAR
───────────────────────────────────────────── */
function TopBar({ onBurger, active }) {
  const label = NAV_ITEMS.find(n => n.id === active)?.label || "Dashboard";
  return (
    <div style={{
      height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 20px",
      background: "rgba(6,13,31,0.8)",
      borderBottom: "1px solid rgba(100,180,255,0.08)",
      backdropFilter: "blur(12px)",
      position: "sticky", top: 0, zIndex: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Burger — only visible on mobile */}
        <button
          onClick={onBurger}
          className="burger-btn"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(100,180,255,0.15)",
            borderRadius: 8, color: "rgba(160,210,255,0.8)",
            cursor: "pointer", padding: "7px",
            display: "flex", alignItems: "center",
          }}
        >
          {Icon.burger}
        </button>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 11, color: "rgba(80,130,180,0.5)",
            fontFamily: "'DM Mono', monospace",
          }}>DEVTRACKER</span>
          <span style={{ color: "rgba(80,130,180,0.3)", fontSize: 11 }}>/</span>
          <span style={{
            fontSize: 12, fontWeight: 700, color: "#e8f4ff",
            fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.02em",
          }}>{label}</span>
        </div>
      </div>

      {/* Right side badges */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(0,229,160,0.08)",
          border: "1px solid rgba(0,229,160,0.2)",
          borderRadius: 99, padding: "4px 12px",
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%", background: "#00e5a0",
            boxShadow: "0 0 6px #00e5a0",
          }}/>
          <span style={{
            fontSize: 10, color: "#00e5a0",
            fontFamily: "'DM Mono', monospace", fontWeight: 700,
          }}>ACTIVE</span>
        </div>
        <div style={{
          width: 30, height: 30, borderRadius: "50%",
          background: "linear-gradient(135deg, #00c8ff, #00e5a0)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800, color: "#060d1f",
          fontFamily: "'DM Mono', monospace",
        }}>JD</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE CONTENT PLACEHOLDER
───────────────────────────────────────────── */
function PageContent({ active }) {
  const activeItem = NAV_ITEMS.find(n => n.id === active);
  const label = activeItem?.label || "Dashboard";
  const activeIconKey =
    activeItem && "icon" in activeItem && typeof activeItem.icon === "string"
      ? activeItem.icon
      : "dashboard";
  const activeIcon =
    activeIconKey === "chevron"
      ? Icon.dashboard
      : Icon[activeIconKey as Exclude<keyof typeof Icon, "chevron">];

  if (active === "dashboard") {
    return <DashboardPage />;
  }

  if (active === "stats") {
    return <StatisticsPage />;
  }

  if (active === "scrum-sprint") {
    return <SprintPage />;
  }

  if (active === "scrum-tasks-list") {
    return <TasksListPage />;
  }

  if (active === "scrum-story-points") {
    return <StoryPointsPage />;
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      minHeight: "60vh", gap: 20, padding: 40,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: "rgba(0,200,255,0.08)",
        border: "1px solid rgba(0,200,255,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#00c8ff",
      }}>
        {activeIcon}
      </div>
      <div style={{ textAlign: "center" }}>
        <Title title={label} align="center" size="large" />
        <p style={{
          fontSize: 13, color: "rgba(120,170,220,0.55)",
          fontFamily: "'DM Sans', sans-serif",
        }}>This section is under construction.</p>
      </div>
      <div style={{
        padding: "8px 20px",
        background: "rgba(0,200,255,0.06)",
        border: "1px dashed rgba(0,200,255,0.2)",
        borderRadius: 99,
        fontSize: 11, color: "rgba(0,200,255,0.5)",
        fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em",
      }}>
        COMING SOON
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ROOT APP SHELL
───────────────────────────────────────────── */
const SIDEBAR_W = 220;

export default function AppShell() {
  const [active, setActive] = useState(getInitialActivePage);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const overlayRef = useRef(null);

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, active);
  }, [active]);

  // Close drawer on ESC
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Prevent body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  return (
    <div style={{
      minHeight: "100vh",
      height: "100vh",
      background: "linear-gradient(135deg,#060d1f 0%,#0a1628 40%,#071220 100%)",
      display: "flex",
      position: "relative",
      overflow: "hidden",
    }}>
      <div className="bg-grid"/>

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="desktop-sidebar" style={{
        width: SIDEBAR_W, flexShrink: 0,
        background: "rgba(6,13,31,0.85)",
        borderRight: "1px solid rgba(100,180,255,0.08)",
        backdropFilter: "blur(16px)",
        position: "sticky", top: 0, height: "100vh",
        overflowY: "auto",
        flexDirection: "column",
        zIndex: 5,
      }}>
        <SidebarContent active={active} setActive={setActive} />
      </aside>

      {/* ── MOBILE OVERLAY ── */}
      {drawerOpen && (
        <div
          ref={overlayRef}
          onClick={() => setDrawerOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 40,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(3px)",
            animation: "fadeIn 0.25s ease both",
          }}
        />
      )}

      {/* ── MOBILE DRAWER ── */}
      <aside style={{
        position: "fixed", top: 0, left: 0, height: "100%",
        width: Math.min(SIDEBAR_W + 20, 280),
        background: "rgba(8,16,34,0.98)",
        borderRight: "1px solid rgba(100,180,255,0.12)",
        backdropFilter: "blur(20px)",
        zIndex: 50,
        overflowY: "auto",
        display: "flex", flexDirection: "column",
        transform: drawerOpen ? "translateX(0)" : "translateX(-105%)",
        transition: "transform 0.35s cubic-bezier(0.23,1,0.32,1)",
        boxShadow: drawerOpen ? "4px 0 40px rgba(0,0,0,0.5)" : "none",
      }}>
        <SidebarContent
          active={active}
          setActive={setActive}
          onClose={() => setDrawerOpen(false)}
        />
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        minWidth: 0, minHeight: 0, position: "relative", zIndex: 1,
      }}>
        <TopBar onBurger={() => setDrawerOpen(true)} active={active} />
        <main className="app-main" style={{
          flex: 1, overflowY: "auto",
          minHeight: 0,
          padding: "0 24px 40px",
        }}>
          <PageContent active={active} />
        </main>
      </div>
    </div>
  );
}
