import { useState, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  DashboardPage,
  LoginPage,
  SprintPage,
  StoryPointsPage,
  StatisticsPage,
  TasksListPage,
  TestPage,
  AppFlowPage,
  RequirementsDataPage,
} from "./pages";
import { Title } from "@/components/shared/page";
import { getSupabaseSession, signOutSupabaseUser, supabase } from "@/lib/supabase";
import { Icon, type IconKey } from "@/lib/theme";
import "@/assets/styles/AppShell.css";

type NavEntry = {
  id: string;
  label: string;
  icon?: IconKey;
  badge?: boolean;
  children?: NavEntry[];
};
type SetActivePage = Dispatch<SetStateAction<string>>;

/* ─────────────────────────────────────────────
   NAV STRUCTURE
───────────────────────────────────────────── */
const NAV: NavEntry[] = [
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
  { id: "test", label: "Test", icon: "history" },
  { id: "app-flow", label: "App Flow", icon: "scrum" },
  {
    id: "admin",
    label: "Admin",
    icon: "profile",
    children: [
      {
        id: "admin-data-override",
        label: "Data Override",
        children: [
          { id: "admin-requirements-data", label: "Requirements Data" },
        ],
      },
    ],
  },
];

const ACTIVE_PAGE_STORAGE_KEY = "devtracker.activePage";
function flattenNavItems(items: NavEntry[]): NavEntry[] {
  return items.flatMap((item) => [
    item,
    ...flattenNavItems(item.children ?? []),
  ]);
}

const NAV_ITEMS = flattenNavItems(NAV);
const VALID_NAV_IDS = new Set(NAV_ITEMS.map((item) => item.id));

function getInitialActivePage(): string {
  if (typeof window === "undefined") return "dashboard";
  const saved = window.localStorage.getItem(ACTIVE_PAGE_STORAGE_KEY);
  return saved && VALID_NAV_IDS.has(saved) ? saved : "dashboard";
}

/* ─────────────────────────────────────────────
   SIDEBAR NAV ITEM
───────────────────────────────────────────── */
function NavItem({
  item,
  active,
  setActive,
  depth = 0,
  collapsed = false,
}: {
  item: NavEntry;
  active: string;
  setActive: SetActivePage;
  depth?: number;
  collapsed?: boolean;
}) {
  const children = item.children ?? [];
  const hasChildren = children.length > 0;
  const isActive = active === item.id || children.some((c) => c.id === active);
  const [open, setOpen] = useState(isActive);

  const handleClick = () => {
    if (collapsed && hasChildren) return;
    if (hasChildren) setOpen((o) => !o);
    else setActive(item.id);
  };

  return (
    <div>
      <button
        onClick={handleClick}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: collapsed ? 0 : 10,
          justifyContent: collapsed ? "center" : "flex-start",
          padding: collapsed ? "10px 0" : depth === 0 ? "10px 16px" : "7px 16px 7px 38px",
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
        title={collapsed ? item.label : undefined}
        onMouseEnter={(e) => {
          if (active !== item.id) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={(e) => {
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
        {!collapsed && (
          <>
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
          </>
        )}
      </button>

      {/* Children */}
      {hasChildren && !collapsed && (
        <div style={{
          overflow: "hidden",
          maxHeight: open ? "999px" : "0px",
          transition: "max-height 0.35s cubic-bezier(0.23,1,0.32,1)",
        }}>
          {children.map((child) => (
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
function SidebarContent({
  active,
  setActive,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: {
  active: string;
  setActive: SetActivePage;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
    }}>
      {/* Logo / brand */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: collapsed ? "18px 10px 14px" : "20px 16px 16px",
        borderBottom: "1px solid rgba(100,180,255,0.08)",
        marginBottom: 8,
        position: "relative",
      }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: collapsed ? 0 : 10,
            justifyContent: collapsed ? "center" : "flex-start",
            width: collapsed ? "100%" : "auto",
            minWidth: 0,
          }}
        >
          {Icon.logo}
          {!collapsed && <div>
            <div style={{
              fontSize: 13, fontFamily: "'DM Mono', monospace", fontWeight: 800,
              color: "#e8f4ff", letterSpacing: "0.05em", lineHeight: 1,
            }}>DEVTRACKER</div>
            <div style={{
              fontSize: 9, color: "rgba(0,200,255,0.6)",
              fontFamily: "'DM Mono', monospace", letterSpacing: "0.15em",
              marginTop: 2,
            }}>v2.0 PLATFORM</div>
          </div>}
        </div>
        {onToggleCollapse && (
          <button
            aria-label={collapsed ? "Expand side menu" : "Collapse side menu"}
            onClick={onToggleCollapse}
            title={collapsed ? "Expand menu" : "Collapse menu"}
            type="button"
            style={{
              position: "absolute",
              right: -13,
              top: 22,
              width: 26,
              height: 26,
              borderRadius: 999,
              background: "rgba(8,16,34,0.98)",
              border: "1px solid rgba(0,200,255,0.28)",
              color: "#00c8ff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 16px rgba(0,200,255,0.18)",
              zIndex: 6,
              transition: "transform 0.2s ease, border-color 0.2s ease",
            }}
          >
            <span
              style={{
                display: "inline-block",
                fontFamily: "'DM Mono', monospace",
                fontSize: 16,
                fontWeight: 900,
                lineHeight: 1,
                transform: collapsed ? "rotate(180deg)" : "none",
              }}
            >
              ‹
            </span>
          </button>
        )}
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
        padding: collapsed ? "4px 0 8px" : "4px 16px 8px", textTransform: "uppercase",
        textAlign: collapsed ? "center" : "left",
      }}>{collapsed ? "Nav" : "Navigation"}</div>

      {/* Nav items */}
      <nav style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
        {NAV.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            active={active}
            collapsed={collapsed}
            setActive={(id) => {
              setActive(id);
              onClose?.();
            }}
          />
        ))}
      </nav>

      {/* Bottom user card */}
      {!collapsed && (
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
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   TOP BAR
───────────────────────────────────────────── */
function TopBar({
  onBurger,
  active,
  userEmail,
  onLogout,
}: {
  onBurger: () => void;
  active: string;
  userEmail?: string;
  onLogout: () => void;
}) {
  const label = NAV_ITEMS.find((n) => n.id === active)?.label || "Dashboard";
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
        {userEmail && (
          <span style={{
            color: "rgba(160,210,255,0.75)",
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            fontWeight: 700,
            maxWidth: 220,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {userEmail}
          </span>
        )}
        <button
          onClick={onLogout}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(100,180,255,0.15)",
            borderRadius: 999,
            color: "rgba(160,210,255,0.82)",
            cursor: "pointer",
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            fontWeight: 800,
            padding: "6px 10px",
            textTransform: "uppercase",
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE CONTENT PLACEHOLDER
───────────────────────────────────────────── */
function PageContent({ active }: { active: string }) {
  const activeItem = NAV_ITEMS.find((n) => n.id === active);
  const label = activeItem?.label || "Dashboard";
  const activeIconKey =
    activeItem && "icon" in activeItem && typeof activeItem.icon === "string"
      ? activeItem.icon
      : "dashboard";
  const activeIcon = Icon[activeIconKey];

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

  if (active === "test") {
    return <TestPage />;
  }

  if (active === "app-flow") {
    return <AppFlowPage />;
  }

  if (active === "admin-requirements-data") {
    return <RequirementsDataPage />;
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
const SIDEBAR_COLLAPSED_W = 68;

export default function AppShell() {
  const [active, setActive] = useState(getInitialActivePage);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    getSupabaseSession()
      .then((currentSession) => {
        if (mounted) setSession(currentSession);
      })
      .catch(() => {
        if (mounted) setSession(null);
      })
      .finally(() => {
        if (mounted) setSessionLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, nextSession) => {
      setSession(nextSession);
      setSessionLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, active);
  }, [active]);

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
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const handleLogout = async () => {
    await signOutSupabaseUser();
    setSession(null);
    setDrawerOpen(false);
  };

  if (sessionLoading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#060d1f 0%,#0a1628 40%,#071220 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(160,210,255,0.75)",
        fontFamily: "'DM Mono', monospace",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
      }}>
        Loading session...
      </div>
    );
  }

  if (!session) {
    return <LoginPage onLogin={setSession} />;
  }

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
        width: sidebarCollapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_W,
        flexShrink: 0,
        background: "rgba(6,13,31,0.85)",
        borderRight: "1px solid rgba(100,180,255,0.08)",
        backdropFilter: "blur(16px)",
        position: "sticky", top: 0, height: "100vh",
        overflowY: "visible",
        flexDirection: "column",
        zIndex: 5,
        transition: "width 0.28s cubic-bezier(0.23,1,0.32,1)",
      }}>
        <SidebarContent
          active={active}
          setActive={setActive}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
        />
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
        <TopBar
          onBurger={() => setDrawerOpen(true)}
          active={active}
          userEmail={session.user.email}
          onLogout={() => void handleLogout()}
        />
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
