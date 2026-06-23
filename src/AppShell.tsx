import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Session } from "@supabase/supabase-js";
import { BackgroundProcessProvider, SprintSyncProvider } from "@/contexts";
import {
  DashboardPage,
  LoginPage,
  SprintPage,
  StoryPointsPage,
  StatisticsPage,
  TasksListPage,
  PlanningPokerPage,
  TestPage,
  AppFlowPage,
  PublicSprintScoreboardPage,
  RequirementsDataPage,
  SprintRequirementsPage,
  SprintDataPage,
  DevVelocityPage,
  AccessControlListsPage,
  ChangePasswordsPage,
  SprintStoryPointsCheckPage,
  BackgroundProcessPage,
} from "./pages";
import { Title } from "@/components/shared/page";
import {
  getSupabaseRows,
  getSupabaseSession,
  signOutSupabaseUser,
  supabase,
} from "@/lib/supabase";
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

type LoggedInMemberAccessRow = {
  role: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type SidebarMemberProfile = {
  displayName: string;
  roleLabel: string;
  initials: string;
};

type AccessControlRow = {
  page_id: string;
  can_access: boolean;
};

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
      { id: "scrum-planning-poker", label: "Planning Poker" },
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
          { id: "admin-sprint-requirements", label: "Sprint Requirements" },
          { id: "admin-sprint-data", label: "Sprint Data" },
          { id: "admin-dev-velocity", label: "Dev Velocity" },
          { id: "admin-sprint-story-points-check", label: "Sprint Story Points Check" },
        ],
      },
      {
        id: "admin-user",
        label: "Users",
        children: [
          { id: "admin-user-change-passwords", label: "Change Passwords" },
        ],
      },
      {
        id: "admin-settings",
        label: "Settings",
        children: [
          { id: "admin-background-process", label: "Background Process" },
        ],
      },
      { id: "admin-access-control-lists", label: "Access Control Lists" },
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

function getFirstAccessiblePage(items: NavEntry[]): string {
  for (const item of items) {
    if (item.children?.length) {
      const childPage = getFirstAccessiblePage(item.children);
      if (childPage) return childPage;
    } else {
      return item.id;
    }
  }

  return "dashboard";
}

function formatRoleLabel(role: string | null | undefined): string {
  if (!role?.trim()) return "Member";

  return role
    .trim()
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function getMemberDisplayName(member: LoggedInMemberAccessRow | null | undefined, fallbackEmail?: string): string {
  const fullName = member?.full_name?.trim();
  const composedName = [member?.first_name, member?.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return fullName || composedName || fallbackEmail || "Member";
}

function getMemberInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length > 1
    ? `${parts[0]?.charAt(0) ?? ""}${parts[parts.length - 1]?.charAt(0) ?? ""}`
    : displayName.slice(0, 2);

  return initials.toUpperCase() || "MB";
}

function filterNavByAccess(items: NavEntry[], allowedPageIds: Set<string> | null): NavEntry[] {
  if (!allowedPageIds) return items;

  return items.reduce<NavEntry[]>((filteredItems, item) => {
    const filteredChildren = item.children
      ? filterNavByAccess(item.children, allowedPageIds)
      : undefined;
    const itemAllowed = allowedPageIds.has(item.id);

    if (!itemAllowed && (!filteredChildren || filteredChildren.length === 0)) {
      return filteredItems;
    }

    filteredItems.push({
      ...item,
      children: filteredChildren,
    });

    return filteredItems;
  }, []);
}

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
          padding: collapsed
            ? "10px 0"
            : depth === 0
              ? "10px 16px"
              : depth === 1
                ? "7px 16px 7px 38px"
                : "7px 16px 7px 54px",
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
            width: depth >= 2 ? 10 : 6,
            height: depth >= 2 ? 1 : 6,
            borderRadius: depth >= 2 ? 999 : "50%",
            flexShrink: 0,
            background: active === item.id
              ? "#00c8ff"
              : depth >= 2
                ? "rgba(0,229,160,0.48)"
                : "rgba(100,160,210,0.4)",
            boxShadow: depth >= 2 ? "0 0 6px rgba(0,229,160,0.14)" : "none",
            transform: "none",
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
  navItems,
  memberProfile,
  navLoading = false,
  collapsed = false,
  onToggleCollapse,
}: {
  active: string;
  setActive: SetActivePage;
  onClose?: () => void;
  navItems: NavEntry[];
  memberProfile: SidebarMemberProfile;
  navLoading?: boolean;
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
        {navLoading ? (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 10,
            padding: collapsed ? "12px 0" : "12px 16px",
            color: "rgba(160,210,255,0.72)",
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}>
            <span
              aria-hidden="true"
              style={{
                width: 12,
                height: 12,
                border: "2px solid rgba(160,210,255,0.24)",
                borderTopColor: "#00c8ff",
                borderRadius: "50%",
                animation: "spin 0.75s linear infinite",
                flexShrink: 0,
              }}
            />
            {!collapsed ? <span>Loading menu...</span> : null}
          </div>
        ) : (
          navItems.map((item) => (
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
          ))
        )}
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
            }}>{memberProfile.initials}</div>
            <div style={{ overflow: "hidden" }}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: "#e8f4ff",
                fontFamily: "'DM Sans', sans-serif",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{memberProfile.displayName}</div>
              <div style={{
                fontSize: 10, color: "rgba(0,200,255,0.6)",
                fontFamily: "'DM Mono', monospace",
              }}>{memberProfile.roleLabel} · Grade A</div>
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
    <div className="app-topbar" style={{
      height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 20px",
      background: "rgba(6,13,31,0.8)",
      borderBottom: "1px solid rgba(100,180,255,0.08)",
      backdropFilter: "blur(12px)",
      position: "sticky", top: 0, zIndex: 10,
    }}>
      <div className="app-topbar-left" style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
        <div className="app-topbar-breadcrumb" style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
      <div className="app-topbar-right" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="app-topbar-status" style={{
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
          <span className="app-topbar-email" style={{
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
          className="app-topbar-logout"
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

  if (active === "scrum-planning-poker") {
    return <PlanningPokerPage />;
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

  if (active === "admin-sprint-requirements") {
    return <SprintRequirementsPage />;
  }

  if (active === "admin-sprint-data") {
    return <SprintDataPage />;
  }

  if (active === "admin-dev-velocity") {
    return <DevVelocityPage />;
  }

  if (active === "admin-sprint-story-points-check") {
    return <SprintStoryPointsCheckPage />;
  }

  if (active === "admin-access-control-lists") {
    return <AccessControlListsPage />;
  }

  if (active === "admin-user-change-passwords") {
    return <ChangePasswordsPage />;
  }

  if (active === "admin-background-process") {
    return <BackgroundProcessPage />;
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
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const [memberProfile, setMemberProfile] = useState<SidebarMemberProfile>({
    displayName: "Member",
    roleLabel: "Member",
    initials: "MB",
  });
  const [allowedPageIds, setAllowedPageIds] = useState<Set<string> | null>(null);
  const [navAccessLoading, setNavAccessLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const isPublicSprintScoreboardRoute =
    typeof window !== "undefined" &&
    window.location.pathname === "/public/current-sprint-scoreboard";

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

  useLayoutEffect(() => {
    if (!session?.user.id) return;

    setNavAccessLoading(true);
    setAllowedPageIds(null);
  }, [session?.user.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadNavAccess(): Promise<void> {
      if (!session?.user.id) {
        setMemberRole(null);
        setMemberProfile({
          displayName: "Member",
          roleLabel: "Member",
          initials: "MB",
        });
        setAllowedPageIds(null);
        return;
      }

      setNavAccessLoading(true);

      try {
        const [memberByEmail] = session.user.email
          ? await getSupabaseRows<LoggedInMemberAccessRow>("members", {
              select: "role,full_name,first_name,last_name",
              eq: { email: session.user.email },
              limit: 1,
            })
          : [];
        const [memberByAuthUserId] =
          !memberByEmail
            ? await getSupabaseRows<LoggedInMemberAccessRow>("members", {
                select: "role,full_name,first_name,last_name",
                eq: { auth_user_id: session.user.id },
                limit: 1,
              })
            : [];
        const member = memberByEmail ?? memberByAuthUserId ?? null;
        const role = (member?.role ?? null)
          ?.trim()
          .toLowerCase() ?? null;
        const displayName = getMemberDisplayName(member, session.user.email);

        if (cancelled) return;

        setMemberRole(role);
        setMemberProfile({
          displayName,
          roleLabel: formatRoleLabel(role),
          initials: getMemberInitials(displayName),
        });

        if (!role) {
          setAllowedPageIds(null);
          return;
        }

        const rows = await getSupabaseRows<AccessControlRow>(
          "access_control_lists",
          {
            select: "page_id,can_access",
            eq: { role },
          },
        );

        if (cancelled) return;

        setAllowedPageIds(
          rows.length === 0
            ? null
            : new Set(rows.filter((row) => row.can_access).map((row) => row.page_id)),
        );
      } catch {
        if (!cancelled) {
          setMemberRole(null);
          setMemberProfile({
            displayName: session.user.email ?? "Member",
            roleLabel: "Member",
            initials: getMemberInitials(session.user.email ?? "Member"),
          });
          setAllowedPageIds(null);
        }
      } finally {
        if (!cancelled) {
          setNavAccessLoading(false);
        }
      }
    }

    void loadNavAccess();

    return () => {
      cancelled = true;
    };
  }, [session?.user.email, session?.user.id]);

  // Close drawer on ESC
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && logoutConfirmOpen) {
        setLogoutConfirmOpen(false);
        return;
      }

      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [logoutConfirmOpen]);

  // Prevent body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const visibleNav = useMemo(
    () => (navAccessLoading ? [] : filterNavByAccess(NAV, allowedPageIds)),
    [allowedPageIds, navAccessLoading],
  );

  useEffect(() => {
    if (navAccessLoading || !allowedPageIds) return;
    if (allowedPageIds.has(active)) return;

    setActive(getFirstAccessiblePage(visibleNav));
  }, [active, allowedPageIds, navAccessLoading, visibleNav]);

  const handleLogout = async () => {
    try {
      setLogoutLoading(true);
      await signOutSupabaseUser();
      setSession(null);
      setDrawerOpen(false);
      setLogoutConfirmOpen(false);
    } finally {
      setLogoutLoading(false);
    }
  };

  if (isPublicSprintScoreboardRoute) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#060d1f 0%,#0a1628 40%,#071220 100%)",
      }}>
        <PublicSprintScoreboardPage />
      </div>
    );
  }

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
    <BackgroundProcessProvider>
    <SprintSyncProvider>
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
          navItems={visibleNav}
          memberProfile={memberProfile}
          navLoading={navAccessLoading}
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
          navItems={visibleNav}
          memberProfile={memberProfile}
          navLoading={navAccessLoading}
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
          onLogout={() => setLogoutConfirmOpen(true)}
        />
        <main className="app-main" style={{
          flex: 1, overflowY: "auto",
          minHeight: 0,
          padding: "0 24px 40px",
        }}>
          <PageContent active={active} />
        </main>
      </div>
      {logoutConfirmOpen && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(0,0,0,0.58)",
            backdropFilter: "blur(8px)",
          }}
          onClick={() => {
            if (!logoutLoading) setLogoutConfirmOpen(false);
          }}
        >
          <div
            aria-modal="true"
            role="dialog"
            aria-labelledby="logout-confirmation-title"
            style={{
              position: "relative",
              width: "min(420px, 100%)",
              overflow: "hidden",
              borderRadius: 18,
              border: "1px solid rgba(0,200,255,0.3)",
              background: "linear-gradient(145deg, rgba(8,16,34,0.98), rgba(6,13,31,0.96))",
              boxShadow: "0 24px 80px rgba(0,0,0,0.46), 0 0 30px rgba(0,200,255,0.12)",
              padding: 24,
              color: "#e8f4ff",
              fontFamily: "'DM Sans', sans-serif",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              style={{
                position: "absolute",
                inset: "0 0 auto",
                height: 3,
                background: "linear-gradient(90deg, #00c8ff, #00e5a0)",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <div
                aria-hidden="true"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  border: "1px solid rgba(0,200,255,0.36)",
                  background: "rgba(0,200,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#00c8ff",
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 18,
                  fontWeight: 900,
                }}
              >
                ?
              </div>
              <div>
                <div
                  style={{
                    color: "rgba(0,200,255,0.68)",
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  Confirm Action
                </div>
                <h2
                  id="logout-confirmation-title"
                  style={{
                    margin: "4px 0 0",
                    color: "#e8f4ff",
                    fontSize: 20,
                    fontWeight: 900,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Logout from DevTracker?
                </h2>
              </div>
            </div>
            <p
              style={{
                margin: "0 0 20px",
                color: "rgba(190,220,255,0.72)",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              Are you sure you want to end your current session?
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                disabled={logoutLoading}
                onClick={() => setLogoutConfirmOpen(false)}
                style={{
                  border: "1px solid rgba(160,210,255,0.18)",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(190,220,255,0.76)",
                  cursor: logoutLoading ? "not-allowed" : "pointer",
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                  fontWeight: 900,
                  padding: "9px 16px",
                  textTransform: "uppercase",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={logoutLoading}
                onClick={() => void handleLogout()}
                style={{
                  border: "1px solid rgba(0,200,255,0.5)",
                  borderRadius: 999,
                  background: "linear-gradient(135deg, rgba(0,200,255,0.22), rgba(0,229,160,0.12))",
                  color: "#00c8ff",
                  cursor: logoutLoading ? "not-allowed" : "pointer",
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                  fontWeight: 900,
                  padding: "9px 16px",
                  textTransform: "uppercase",
                }}
              >
                {logoutLoading ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </SprintSyncProvider>
    </BackgroundProcessProvider>
  );
}
