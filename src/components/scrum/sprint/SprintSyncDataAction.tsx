import { useSprintSync } from "@/contexts";
import { Text } from "@/lib/theme";
import { useState, type CSSProperties, type ReactNode } from "react";
import "@/assets/styles/Sprint.page.css";

type SprintSyncTarget = {
  id: string;
  name: string;
  status: string | null;
};

export type { SprintSyncTarget };

type SprintConfirmationDialog = {
  title: string;
  message: string;
  confirmLabel: string;
  accent: string;
  sprintDetail?: string;
  onConfirm: () => void;
};

type SprintSyncDataActionProps = {
  currentSprint: SprintSyncTarget | null;
  selectedSprintId: string;
  memberRole: string | null;
  onSynced: () => void | Promise<void>;
};

function normalizeSprintStatus(value: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function shouldHideSprintActionButtons(role: string | null): boolean {
  const normalizedRole = role?.trim().toLowerCase() ?? "";

  return (
    normalizedRole === "project_manager" ||
    normalizedRole === "developer" ||
    normalizedRole === "mid_level_developer" ||
    normalizedRole === "senior_developer" ||
    normalizedRole === "qa_engineer" ||
    normalizedRole === "designer" ||
    normalizedRole === "intern"
  );
}

function getSyncDataMessage(status: string): string {
  if (status === "planning") {
    return "This will sync eligible Trello cards from For Planning, Current Sprint, and In Development as planned tasks for the current sprint. Existing current-sprint tasks are updated, missing cards are added, and cards no longer on those lists are removed from the current sprint only.";
  }

  return "This will replace the current sprint task data with the latest cards from Trello. For Planning cards are not counted as planned tasks.";
}

export default function SprintSyncDataAction({
  currentSprint,
  selectedSprintId,
  memberRole,
  onSynced,
}: SprintSyncDataActionProps) {
  const { isSyncing, syncProgressPercent, runSync, lastError } = useSprintSync();
  const [confirmationDialog, setConfirmationDialog] =
    useState<SprintConfirmationDialog | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const hideSprintActionButtons = shouldHideSprintActionButtons(memberRole);
  const currentSprintStatus = normalizeSprintStatus(currentSprint?.status ?? null);
  const canShowSyncButton =
    !hideSprintActionButtons &&
    currentSprint &&
    selectedSprintId === currentSprint.id &&
    (currentSprintStatus === "planning" || currentSprintStatus === "active");
  const syncError = localError ?? lastError;

  function requestSyncConfirmation(): void {
    if (!currentSprint || isSyncing) return;

    setConfirmationDialog({
      title: "Sync Data",
      message: getSyncDataMessage(currentSprintStatus),
      confirmLabel: "Sync Data",
      accent: "#00c8ff",
      sprintDetail: currentSprint.name,
      onConfirm: () => void syncSprintData(),
    });
  }

  async function syncSprintData(): Promise<void> {
    if (!currentSprint || selectedSprintId !== currentSprint.id) {
      setLocalError(
        "Please select the current sprint before processing sprint data.",
      );
      return;
    }

    setLocalError(null);

    try {
      await runSync({ sprintId: currentSprint.id, trigger: "manual" });
      await onSynced();
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Unable to sync Trello cards.",
      );
    }
  }

  function confirmSprintDialogAction(): void {
    const action = confirmationDialog?.onConfirm;
    setConfirmationDialog(null);
    action?.();
  }

  const sprintActionButtonStyle = (accent: string): CSSProperties => ({
    border: `1px solid ${accent}aa`,
    background: `linear-gradient(135deg, ${accent}30, ${accent}16), rgba(6,13,31,0.92)`,
    color: accent,
    borderRadius: 9,
    padding: "9px 13px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    fontWeight: 900,
    cursor: isSyncing ? "not-allowed" : "pointer",
    opacity: isSyncing ? 0.65 : 1,
    boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 10px 24px rgba(0,0,0,0.22), 0 0 18px ${accent}33`,
  });

  const sprintActionButtonContent = (
    label: string,
    loadingLabel: string,
    accent: string,
  ): ReactNode => (
    <>
      {isSyncing ? (
        <span
          aria-hidden="true"
          className="sprint-action-loader"
          style={{
            borderTopColor: accent,
          }}
        />
      ) : null}
      {isSyncing
        ? `${loadingLabel}${
            syncProgressPercent !== null ? ` ${syncProgressPercent}%` : ""
          }`
        : label}
    </>
  );

  if (!canShowSyncButton) {
    return syncError ? (
      <div
        className="planning-poker-sync-error"
        style={{
          color: "#ff8d8d",
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
        }}
      >
        {syncError}
      </div>
    ) : null;
  }

  return (
    <>
      <div
        className="sprint-selector-actions"
        style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
      >
        <button
          type="button"
          disabled={isSyncing}
          onClick={requestSyncConfirmation}
          style={sprintActionButtonStyle("#00c8ff")}
        >
          {sprintActionButtonContent("Sync Data", "Syncing...", "#00c8ff")}
        </button>
      </div>
      {syncError ? (
        <div
          style={{
            color: "#ff8d8d",
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            marginTop: 8,
          }}
        >
          {syncError}
        </div>
      ) : null}
      {confirmationDialog ? (
        <div
          className="sprint-confirmation-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSyncing) {
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
              <strong>
                {confirmationDialog.sprintDetail ??
                  currentSprint?.name ??
                  "Current Sprint"}
              </strong>
            </div>
            <div className="sprint-confirmation-actions">
              <button
                className="sprint-confirmation-button sprint-confirmation-button--secondary"
                disabled={isSyncing}
                onClick={() => setConfirmationDialog(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="sprint-confirmation-button sprint-confirmation-button--primary"
                disabled={isSyncing}
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
    </>
  );
}
