import { useEffect, useState } from "react";
import { SprintScoreboard } from "@/components/scrum";
import { getSupabaseRows } from "@/lib/supabase";
import "@/assets/styles/Sprint.page.css";

type PublicSprintRow = {
  id: string;
  name: string | null;
  status: string | null;
};

type PublicSprintTaskSyncRow = {
  trello_last_synced_at: string | null;
};

function getLatestTaskSyncDate(tasks: PublicSprintTaskSyncRow[]): string | null {
  const latestTimestamp = tasks.reduce<number | null>((latest, task) => {
    if (!task.trello_last_synced_at) return latest;

    const timestamp = new Date(task.trello_last_synced_at).getTime();
    if (!Number.isFinite(timestamp)) return latest;

    return latest === null ? timestamp : Math.max(latest, timestamp);
  }, null);

  return latestTimestamp === null ? null : new Date(latestTimestamp).toISOString();
}

function formatLastSyncDate(value: string | null): string {
  if (!value) return "Not synced yet";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not synced yet";

  const parts = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((accumulator, part) => {
      accumulator[part.type] = part.value;
      return accumulator;
    }, {});

  return `${parts.month} ${parts.day}, ${parts.year} at ${parts.hour}:${parts.minute} ${parts.dayPeriod.toUpperCase()}`;
}

function formatSprintStatus(status: string | null | undefined): string {
  if (!status?.trim()) return "Status Unknown";

  return status
    .trim()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function getSprintStatusColor(status: string | null | undefined): string {
  const normalizedStatus = status?.trim().toLowerCase() ?? "";

  if (normalizedStatus === "active") return "#00e5a0";
  if (normalizedStatus === "planning" || normalizedStatus === "open") return "#00c8ff";
  if (normalizedStatus === "completed" || normalizedStatus === "done") return "#f5c842";
  if (normalizedStatus === "closed") return "#ff9f43";

  return "rgba(160,210,255,0.72)";
}

export default function PublicSprintScoreboardPage() {
  const params = new URLSearchParams(window.location.search);
  const sprintId = params.get("sprintId") ?? "";
  const sprintName = params.get("sprintName") ?? "Sprint";
  const [sprint, setSprint] = useState<PublicSprintRow | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const resolvedSprintName = sprint?.name?.trim() || sprintName;
  const sprintStatus = sprint?.status ?? null;
  const sprintStatusColor = getSprintStatusColor(sprintStatus);
  const pageTitle = `${resolvedSprintName} Story Points`;

  useEffect(() => {
    let cancelled = false;

    async function loadSprint() {
      try {
        const [row] = sprintId
          ? await getSupabaseRows<PublicSprintRow>("sprints", {
              select: "id,name,status",
              eq: { id: sprintId },
              limit: 1,
            })
          : await getSupabaseRows<PublicSprintRow>("sprints", {
              select: "id,name,status",
              eq: { is_current: 1 },
              limit: 1,
            });

        if (!row) {
          if (!cancelled) {
            setSprint(null);
            setLastSyncAt(null);
          }
          return;
        }

        const tasks = await getSupabaseRows<PublicSprintTaskSyncRow>("tasks", {
          select: "trello_last_synced_at",
          eq: { sprint_id: row.id },
        });

        if (!cancelled) {
          setSprint(row);
          setLastSyncAt(getLatestTaskSyncDate(tasks));
        }
      } catch {
        if (!cancelled) {
          setSprint(null);
          setLastSyncAt(null);
        }
      }
    }

    void loadSprint();

    return () => {
      cancelled = true;
    };
  }, [sprintId]);

  return (
    <main
      style={{
        minHeight: "100vh",
        overflowX: "hidden",
        padding: "22px clamp(12px, 3vw, 34px) 34px",
        position: "relative",
      }}
    >
      <div className="bg-grid" />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          margin: "0 auto",
          maxWidth: 1440,
          position: "relative",
          zIndex: 1,
        }}
      >
        <header
          style={{
            border: "1px solid rgba(100,180,255,0.12)",
            borderRadius: 18,
            background:
              "linear-gradient(135deg, rgba(0,200,255,0.08), rgba(0,229,160,0.04), rgba(6,13,31,0.78))",
            boxShadow: "0 18px 48px rgba(0,0,0,0.24)",
            padding: "18px 132px 18px",
            position: "relative",
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: "rgba(100,180,255,0.62)",
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.14em",
              textAlign: "center",
              textTransform: "uppercase",
            }}
          >
            Public Sprint Scoreboard
          </div>
          <div
            style={{
              color: "rgba(160,210,255,0.64)",
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.06em",
              marginTop: 6,
              textAlign: "center",
              textTransform: "uppercase",
            }}
          >
            Last Sync: {formatLastSyncDate(lastSyncAt)}
          </div>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              justifyContent: "center",
              marginTop: 6,
            }}
          >
            <h1
              style={{
                color: "#e8f4ff",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "clamp(26px, 4vw, 42px)",
                fontWeight: 900,
                letterSpacing: "-0.04em",
                lineHeight: 1,
                margin: 0,
                textAlign: "center",
              }}
            >
              {pageTitle}
            </h1>
          </div>
          <span
            style={{
              background: `linear-gradient(135deg, ${sprintStatusColor}1f, rgba(255,255,255,0.025))`,
              border: `1px solid ${sprintStatusColor}66`,
              borderRadius: 999,
              boxShadow: `0 0 18px ${sprintStatusColor}22`,
              color: sprintStatusColor,
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.08em",
              padding: "7px 10px",
              position: "absolute",
              right: 18,
              textTransform: "uppercase",
              top: 16,
              whiteSpace: "nowrap",
            }}
          >
            {formatSprintStatus(sprintStatus)}
          </span>
        </header>

        <SprintScoreboard
          showPublicViewButton={false}
          showScrollLink={false}
          sprintId={sprintId}
          sprintName={resolvedSprintName}
          title={pageTitle}
        />
      </div>
    </main>
  );
}
