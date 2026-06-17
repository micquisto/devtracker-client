import { SprintScoreboard } from "@/components/scrum";
import "@/assets/styles/Sprint.page.css";

export default function PublicSprintScoreboardPage() {
  const params = new URLSearchParams(window.location.search);
  const sprintId = params.get("sprintId") ?? "";
  const sprintName = params.get("sprintName") ?? "Sprint";
  const pageTitle = `${sprintName} Story Points`;

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
            padding: "16px 18px",
          }}
        >
          <div
            style={{
              color: "rgba(100,180,255,0.62)",
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Public Sprint Scoreboard
          </div>
          <h1
            style={{
              color: "#e8f4ff",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "clamp(26px, 4vw, 42px)",
              fontWeight: 900,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              marginTop: 6,
            }}
          >
            {pageTitle}
          </h1>
          <p
            style={{
              color: "rgba(160,210,255,0.68)",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 700,
              marginTop: 8,
            }}
          >
            Showing all members, project types, and project data with no filters applied.
          </p>
        </header>

        <SprintScoreboard
          showPublicViewButton={false}
          showScrollLink={false}
          sprintId={sprintId}
          sprintName={sprintName}
          title={pageTitle}
        />
      </div>
    </main>
  );
}
