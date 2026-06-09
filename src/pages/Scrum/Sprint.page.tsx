import { useEffect, useState } from "react";
import {
  SprintFilter,
  SPRINT_STATUS_STYLE,
  getSprintFilterOption,
  SprintScoreboard,
  type SprintStatus,
} from "@/components/scrum";
import SprintKanbanBoard from "@/components/scrum/sprint/SprintKanbanBoard";
import { StyledSelect } from "@/components/shared/Elements";
import { Title } from "@/components/shared/page";
import {
  getSupabaseRows,
  insertSupabaseRows,
  updateSupabaseRows,
} from "@/lib/supabase";
import { syncCurrentSprintTasks } from "@/lib/utils";
import { Text } from "@/lib/theme";
import "@/assets/styles/Sprint.page.css";

const TASK_COUNT_LIST_NAMES = [
  "Current Sprint",
  "Adhoc",
  "In Development",
  "For Dev Deployment",
  "On Dev Environment",
];

type SprintTaskCountRow = {
  trello_list_name: string | null;
};

type CurrentSprintRow = {
  id: string;
  project_id: string;
  name: string;
  sprint_number: number;
  start_date: string;
  end_date: string;
  sprint_quarter: number | null;
  total_planned_points: number;
  total_completed_points: number;
  status: string | null;
  is_current: number;
};

type SprintMemberFilterRow = {
  id: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type SprintMutationRow = Record<string, string | number | boolean | null>;

type SprintConfirmationDialog = {
  title: string;
  message: string;
  confirmLabel: string;
  accent: string;
  onConfirm: () => void;
};

function normalizeListName(value: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeSprintStatus(value: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function getMemberFilterName(member: SprintMemberFilterRow): string {
  return (
    member.full_name ||
    [member.first_name, member.last_name].filter(Boolean).join(" ") ||
    "Unnamed member"
  );
}

function getSprintStatusStyleKey(status: string | null): SprintStatus {
  const normalizedStatus = normalizeSprintStatus(status);

  if (normalizedStatus === "planning") return "open";
  if (normalizedStatus === "completed") return "closed";
  if (
    normalizedStatus === "open" ||
    normalizedStatus === "active" ||
    normalizedStatus === "closed"
  ) {
    return normalizedStatus;
  }

  return "open";
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);

  return nextDate;
}

function getQuarterFromDate(date: Date): number {
  return Math.floor(date.getUTCMonth() / 3) + 1;
}

function buildNextSprintPayload(currentSprint: CurrentSprintRow): SprintMutationRow {
  const startDate = addDays(parseDateOnly(currentSprint.end_date), 1);
  const endDate = addDays(startDate, 13);
  const nextSprintNumber =
    currentSprint.sprint_number === 7 ? 1 : currentSprint.sprint_number + 1;
  const currentQuarter =
    currentSprint.sprint_quarter ?? getQuarterFromDate(parseDateOnly(currentSprint.start_date));
  const nextQuarter =
    currentSprint.sprint_number === 7 ? currentQuarter + 1 : currentQuarter;

  return {
    project_id: currentSprint.project_id,
    name: `${startDate.getUTCFullYear()} Q${nextQuarter} Sprint ${nextSprintNumber}`,
    sprint_number: nextSprintNumber,
    start_date: formatDateOnly(startDate),
    end_date: formatDateOnly(endDate),
    sprint_quarter: nextQuarter,
    total_planned_points: 0,
    total_completed_points: 0,
    status: "planning",
    is_current: 1,
  };
}

export default function SprintPage() {
  const [selectedSprint, setSelectedSprint] = useState("current");
  const [taskCount, setTaskCount] = useState(0);
  const [currentSprint, setCurrentSprint] = useState<CurrentSprintRow | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [memberFilterOptions, setMemberFilterOptions] = useState<SprintMemberFilterRow[]>(
    [],
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [sprintActionLoading, setSprintActionLoading] = useState<string | null>(null);
  const [sprintActionError, setSprintActionError] = useState<string | null>(null);
  const [confirmationDialog, setConfirmationDialog] =
    useState<SprintConfirmationDialog | null>(null);
  const selectedSprintOption = getSprintFilterOption(selectedSprint);
  const selectedSprintStatus =
    selectedSprint === "current"
      ? currentSprint?.status ?? selectedSprintOption.status
      : selectedSprintOption.status;
  const currentSprintStatus = normalizeSprintStatus(currentSprint?.status ?? null);
  const selectedSprintStatusStyle =
    SPRINT_STATUS_STYLE[getSprintStatusStyleKey(selectedSprintStatus)];
  const sprintTitle =
    selectedSprint === "current"
      ? `${currentSprint?.name ?? "Current Sprint"} Kanban`
      : `${selectedSprintOption.label} Kanban`;

  useEffect(() => {
    let cancelled = false;
    const countedListNames = new Set(TASK_COUNT_LIST_NAMES.map(normalizeListName));

    async function loadCurrentSprintData() {
      try {
        const [currentSprints, members] = await Promise.all([
          getSupabaseRows<CurrentSprintRow>("sprints", {
            select:
              "id,project_id,name,sprint_number,start_date,end_date,sprint_quarter,total_planned_points,total_completed_points,status,is_current",
            eq: { is_current: 1 },
            limit: 1,
          }),
          getSupabaseRows<SprintMemberFilterRow>("members", {
            select: "id,full_name,first_name,last_name",
            order: { column: "full_name", ascending: true },
          }),
        ]);
        const sprint = currentSprints[0] ?? null;
        const tasks = sprint
          ? await getSupabaseRows<SprintTaskCountRow>("tasks", {
              select: "trello_list_name",
              eq: selectedMemberId
                ? { sprint_id: sprint.id, assigned_to: selectedMemberId }
                : { sprint_id: sprint.id },
            })
          : [];
        const count = tasks.filter((task) =>
          countedListNames.has(normalizeListName(task.trello_list_name)),
        ).length;

        if (!cancelled) {
          setTaskCount(count);
          setCurrentSprint(sprint);
          setMemberFilterOptions(
            members.filter((member) => Boolean(member.id)),
          );
        }
      } catch {
        if (!cancelled) {
          setTaskCount(0);
          setCurrentSprint(null);
          setMemberFilterOptions([]);
        }
      }
    }

    void loadCurrentSprintData();

    return () => {
      cancelled = true;
    };
  }, [refreshKey, selectedMemberId]);

  function refreshSprintPageElements(): void {
    setRefreshKey((value) => value + 1);
  }

  async function startSprint(): Promise<void> {
    if (!currentSprint) return;

    setSprintActionLoading("start-sync");
    setSprintActionError(null);

    try {
      await updateSupabaseRows<CurrentSprintRow, SprintMutationRow>(
        "sprints",
        { status: "active" },
        {
          select:
            "id,project_id,name,sprint_number,start_date,end_date,sprint_quarter,total_planned_points,total_completed_points,status,is_current",
          eq: { id: currentSprint.id },
        },
      );
      await syncCurrentSprintTasks();
      refreshSprintPageElements();
    } catch (error) {
      setSprintActionError(
        error instanceof Error
          ? error.message
          : "Unable to start sprint and sync Trello cards.",
      );
    } finally {
      setSprintActionLoading(null);
    }
  }

  async function reopenSprint(): Promise<void> {
    if (!currentSprint) return;

    setSprintActionLoading("reopen-sync");
    setSprintActionError(null);

    try {
      await updateSupabaseRows<CurrentSprintRow, SprintMutationRow>(
        "sprints",
        { status: "active" },
        {
          select:
            "id,project_id,name,sprint_number,start_date,end_date,sprint_quarter,total_planned_points,total_completed_points,status,is_current",
          eq: { id: currentSprint.id },
        },
      );
      await syncCurrentSprintTasks();
      refreshSprintPageElements();
    } catch (error) {
      setSprintActionError(
        error instanceof Error
          ? error.message
          : "Unable to reopen sprint and sync Trello cards.",
      );
    } finally {
      setSprintActionLoading(null);
    }
  }

  async function endSprint(): Promise<void> {
    if (!currentSprint) return;

    setSprintActionLoading("end-sync");
    setSprintActionError(null);

    try {
      await updateSupabaseRows<CurrentSprintRow, SprintMutationRow>(
        "sprints",
        { status: "completed" },
        {
          select:
            "id,project_id,name,sprint_number,start_date,end_date,sprint_quarter,total_planned_points,total_completed_points,status,is_current",
          eq: { id: currentSprint.id },
        },
      );
      await syncCurrentSprintTasks();
      refreshSprintPageElements();
    } catch (error) {
      setSprintActionError(
        error instanceof Error
          ? error.message
          : "Unable to sync Trello cards and end sprint.",
      );
    } finally {
      setSprintActionLoading(null);
    }
  }

  async function syncSprintData(): Promise<void> {
    setSprintActionLoading("sync-data");
    setSprintActionError(null);

    try {
      await syncCurrentSprintTasks();
      refreshSprintPageElements();
    } catch (error) {
      setSprintActionError(
        error instanceof Error ? error.message : "Unable to sync Trello cards.",
      );
    } finally {
      setSprintActionLoading(null);
    }
  }

  async function openNewSprint(): Promise<void> {
    if (!currentSprint) return;

    setSprintActionLoading("open-new");
    setSprintActionError(null);

    try {
      await updateSupabaseRows<CurrentSprintRow, SprintMutationRow>(
        "sprints",
        { status: "done" },
        {
          select:
            "id,project_id,name,sprint_number,start_date,end_date,sprint_quarter,total_planned_points,total_completed_points,status,is_current",
          eq: { id: currentSprint.id },
        },
      );
      await syncCurrentSprintTasks();
      await updateSupabaseRows<CurrentSprintRow, SprintMutationRow>(
        "sprints",
        { is_current: 0 },
        {
          select:
            "id,project_id,name,sprint_number,start_date,end_date,sprint_quarter,total_planned_points,total_completed_points,status,is_current",
          eq: { id: currentSprint.id },
        },
      );
      await insertSupabaseRows<CurrentSprintRow, SprintMutationRow>(
        "sprints",
        buildNextSprintPayload(currentSprint),
        "id,project_id,name,sprint_number,start_date,end_date,sprint_quarter,total_planned_points,total_completed_points,status,is_current",
      );
      refreshSprintPageElements();
    } catch (error) {
      setSprintActionError(
        error instanceof Error ? error.message : "Unable to open a new sprint.",
      );
    } finally {
      setSprintActionLoading(null);
    }
  }

  function requestSprintConfirmation(dialog: SprintConfirmationDialog): void {
    setConfirmationDialog(dialog);
  }

  function confirmSprintDialogAction(): void {
    const action = confirmationDialog?.onConfirm;
    setConfirmationDialog(null);
    action?.();
  }

  function scrollToScoreboard(): void {
    document
      .getElementById("sprint-scoreboard")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const sprintActionButtonStyle = (accent: string): React.CSSProperties => ({
    border: `1px solid ${accent}88`,
    background: `${accent}18`,
    color: accent,
    borderRadius: 9,
    padding: "7px 11px",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    fontWeight: 900,
    cursor: sprintActionLoading ? "not-allowed" : "pointer",
    opacity: sprintActionLoading ? 0.65 : 1,
    boxShadow: `0 0 12px ${accent}18`,
  });

  const sprintActionButtonContent = (
    loadingKey: string,
    label: string,
    loadingLabel: string,
    accent: string,
  ) => (
    <>
      {sprintActionLoading === loadingKey ? (
        <span
          aria-hidden="true"
          className="sprint-action-loader"
          style={{
            borderTopColor: accent,
          }}
        />
      ) : null}
      {sprintActionLoading === loadingKey ? loadingLabel : label}
    </>
  );

  const sprintActions =
    selectedSprint === "current" && currentSprint ? (
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {currentSprintStatus === "planning" ? (
          <>
            <button
              type="button"
              disabled={Boolean(sprintActionLoading)}
              onClick={() => {
                requestSprintConfirmation({
                  title: "Start Sprint",
                  message:
                    "This will set the current sprint to active and sync Trello cards, including Ad hoc cards.",
                  confirmLabel: "Start Sprint",
                  accent: "#00e5a0",
                  onConfirm: () => void startSprint(),
                });
              }}
              style={sprintActionButtonStyle("#00e5a0")}
            >
              {sprintActionButtonContent(
                "start-sync",
                "Start Sprint",
                "Starting & syncing...",
                "#00e5a0",
              )}
            </button>
            <button
              type="button"
              disabled={Boolean(sprintActionLoading)}
              onClick={() => {
                requestSprintConfirmation({
                  title: "Sync Data",
                  message:
                    "This will replace the current sprint task data with the latest planning cards from Trello.",
                  confirmLabel: "Sync Data",
                  accent: "#00c8ff",
                  onConfirm: () => void syncSprintData(),
                });
              }}
              style={sprintActionButtonStyle("#00c8ff")}
            >
              {sprintActionButtonContent(
                "sync-data",
                "Sync Data",
                "Syncing...",
                "#00c8ff",
              )}
            </button>
          </>
        ) : null}
        {currentSprintStatus === "active" ? (
          <>
            <button
              type="button"
              disabled={Boolean(sprintActionLoading)}
              onClick={() => {
                requestSprintConfirmation({
                  title: "End Sprint",
                  message:
                    "This will sync Trello data first, then mark the current sprint as completed.",
                  confirmLabel: "End Sprint",
                  accent: "#f5c842",
                  onConfirm: () => void endSprint(),
                });
              }}
              style={sprintActionButtonStyle("#f5c842")}
            >
              {sprintActionButtonContent(
                "end-sync",
                "End Sprint",
                "Syncing & ending...",
                "#f5c842",
              )}
            </button>
            <button
              type="button"
              disabled={Boolean(sprintActionLoading)}
              onClick={() => {
                requestSprintConfirmation({
                  title: "Sync Data",
                  message:
                    "This will replace the current sprint task data with the latest cards from Trello.",
                  confirmLabel: "Sync Data",
                  accent: "#00c8ff",
                  onConfirm: () => void syncSprintData(),
                });
              }}
              style={sprintActionButtonStyle("#00c8ff")}
            >
              {sprintActionButtonContent(
                "sync-data",
                "Sync Data",
                "Syncing...",
                "#00c8ff",
              )}
            </button>
          </>
        ) : null}
        {currentSprintStatus === "completed" ? (
          <>
            <button
              type="button"
              disabled={Boolean(sprintActionLoading)}
              onClick={() => {
                requestSprintConfirmation({
                  title: "Reopen Sprint",
                  message:
                    "This will set the sprint back to active and sync Trello cards, including Ad hoc cards.",
                  confirmLabel: "Reopen",
                  accent: "#00e5a0",
                  onConfirm: () => void reopenSprint(),
                });
              }}
              style={sprintActionButtonStyle("#00e5a0")}
            >
              {sprintActionButtonContent(
                "reopen-sync",
                "Reopen",
                "Reopening & syncing...",
                "#00e5a0",
              )}
            </button>
            <button
              type="button"
              disabled={Boolean(sprintActionLoading)}
              onClick={() => {
                requestSprintConfirmation({
                  title: "Open New Sprint",
                  message:
                    "This will mark the current sprint as done and create a new current sprint in planning status.",
                  confirmLabel: "Open New Sprint",
                  accent: "#00c8ff",
                  onConfirm: () => void openNewSprint(),
                });
              }}
              style={sprintActionButtonStyle("#00c8ff")}
            >
              {sprintActionButtonContent(
                "open-new",
                "Open New Sprint",
                "Opening...",
                "#00c8ff",
              )}
            </button>
          </>
        ) : null}
      </div>
    ) : null;

  return (
    <div
      className="sprint-page"
      style={{
        minHeight: "calc(100vh - 96px)",
        display: "flex",
        flexDirection: "column",
        overflow: "visible",
        padding: "16px 0 0",
      }}
    >
      <SprintFilter
        selectedSprint={selectedSprint}
        onSprintChange={setSelectedSprint}
        actions={sprintActions}
      />
      {sprintActionError ? (
        <div
          style={{
            color: "#ff8d8d",
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            margin: "-4px 0 10px auto",
          }}
        >
          {sprintActionError}
        </div>
      ) : null}
      {confirmationDialog ? (
        <div
          className="sprint-confirmation-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !sprintActionLoading) {
              setConfirmationDialog(null);
            }
          }}
        >
          <section
            aria-modal="true"
            className="sprint-confirmation-dialog"
            role="dialog"
            style={{
              borderColor: `${confirmationDialog.accent}66`,
              boxShadow: `0 24px 80px rgba(0,0,0,0.42), 0 0 34px ${confirmationDialog.accent}20`,
            }}
          >
            <div
              className="sprint-confirmation-glow"
              style={{ background: confirmationDialog.accent }}
            />
            <div className="sprint-confirmation-header">
              <span
                className="sprint-confirmation-icon"
                style={{
                  borderColor: `${confirmationDialog.accent}66`,
                  background: `${confirmationDialog.accent}18`,
                  color: confirmationDialog.accent,
                  boxShadow: `0 0 18px ${confirmationDialog.accent}28`,
                }}
              >
                !
              </span>
              <div>
                <div className="sprint-confirmation-eyebrow">Confirm Action</div>
                <h2 className="sprint-confirmation-title">
                  {confirmationDialog.title}
                </h2>
              </div>
            </div>
            <p className="sprint-confirmation-message">
              {confirmationDialog.message}
            </p>
            <div className="sprint-confirmation-details">
              <span style={{ color: Text.faint }}>Sprint</span>
              <strong>{currentSprint?.name ?? "Current Sprint"}</strong>
            </div>
            <div className="sprint-confirmation-actions">
              <button
                className="sprint-confirmation-button sprint-confirmation-button--secondary"
                disabled={Boolean(sprintActionLoading)}
                onClick={() => setConfirmationDialog(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="sprint-confirmation-button sprint-confirmation-button--primary"
                disabled={Boolean(sprintActionLoading)}
                onClick={confirmSprintDialogAction}
                style={{
                  borderColor: `${confirmationDialog.accent}88`,
                  background: `linear-gradient(135deg, ${confirmationDialog.accent}24, ${confirmationDialog.accent}10)`,
                  color: confirmationDialog.accent,
                }}
                type="button"
              >
                {confirmationDialog.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <div className="sprint-board-separator" aria-hidden="true" />

      <div
        className="sprint-header"
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <Title
          eyebrow="Scrum Board"
          title={sprintTitle}
          align="left"
          size="sprint"
          rowClassName="sprint-title-row"
          meta={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 9px",
                  borderRadius: 99,
                  border: `1px solid ${selectedSprintStatusStyle.border}`,
                  background: selectedSprintStatusStyle.background,
                  color: selectedSprintStatusStyle.color,
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  boxShadow: `0 0 12px ${selectedSprintStatusStyle.color}22`,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: selectedSprintStatusStyle.color,
                    boxShadow: `0 0 8px ${selectedSprintStatusStyle.color}`,
                  }}
                />
                {selectedSprintStatus}
              </span>
              <a
                href="#sprint-scoreboard"
                onClick={(event) => {
                  event.preventDefault();
                  scrollToScoreboard();
                }}
                style={{
                  alignItems: "center",
                  color: "#00c8ff",
                  display: "inline-flex",
                  gap: 4,
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                  textDecoration: "none",
                  textTransform: "uppercase",
                  textShadow: "0 0 12px rgba(0,200,255,0.28)",
                }}
              >
                <span>Scoreboard</span>
                <span
                  aria-hidden="true"
                  style={{
                    color: "#00e5a0",
                    display: "inline-block",
                    fontSize: 11,
                    lineHeight: 1,
                    transform: "translateY(-1px)",
                  }}
                >
                  ↓
                </span>
              </a>
            </span>
          }
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <StyledSelect
            value={selectedMemberId}
            onChange={setSelectedMemberId}
            placeholder="All members"
            accent={selectedSprintStatusStyle.color}
          >
            {memberFilterOptions.map((member) => (
              <option key={member.id} value={member.id ?? ""}>
                {getMemberFilterName(member)}
              </option>
            ))}
          </StyledSelect>
          <div
            className="sprint-task-count"
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,200,255,0.18)",
              background: "rgba(0,200,255,0.07)",
              color: "rgba(160,210,255,0.75)",
              fontFamily: "'DM Mono', monospace",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {taskCount} tasks
          </div>
        </div>
      </div>

      <SprintKanbanBoard
        key={`${currentSprint?.id ?? "no-current-sprint"}-${refreshKey}`}
        selectedMemberId={selectedMemberId}
      />

      <SprintScoreboard key={`scoreboard-${currentSprint?.id ?? "no-current-sprint"}-${refreshKey}`} />
    </div>
  );
}
