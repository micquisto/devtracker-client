import StatisticsPage from "./Accountabilities/Statistics.page";

type StatisticsShowMode = "year" | "quarter" | "month" | "sprint";

function parseShowMode(value: string | null): StatisticsShowMode {
  if (value === "year" || value === "quarter" || value === "month" || value === "sprint") {
    return value;
  }

  return "sprint";
}

export default function PublicStatisticsPage() {
  const params = new URLSearchParams(window.location.search);
  const ofValue = params.get("of")?.trim() || "team";

  return (
    <main
      style={{
        margin: "0 auto",
        maxWidth: 1400,
        padding: "20px 24px 40px",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <StatisticsPage
        showEvaluateButton={false}
        showFilters={false}
        showMemberFilter
        showPublicViewButton={false}
        initialShowMode={parseShowMode(params.get("show"))}
        initialYear={params.get("year") ?? ""}
        initialQuarter={params.get("quarter") ?? ""}
        initialMonth={params.get("month") ?? ""}
        initialSprintId={params.get("sprintId") ?? ""}
        initialOfValue={ofValue}
      />
    </main>
  );
}
