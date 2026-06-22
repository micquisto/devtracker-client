import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Card } from "@/components/shared/Containers";
import { Title } from "@/components/shared/page";
import { useBackgroundProcesses, useSprintSync } from "@/contexts";
import {
  BACKGROUND_PROCESS_FREQUENCY_PRESETS,
  getFrequencyPreset,
  getFrequencyPresetValue,
} from "@/lib/backgroundProcesses/backgroundProcess.config";
import {
  BACKGROUND_PROCESS_KEYS,
  canManageBackgroundProcesses,
  type BackgroundProcessKey,
  type BackgroundProcessRow,
  type BackgroundProcessRunState,
} from "@/lib/backgroundProcesses/backgroundProcess.registry";
import { getSupabaseRows, getSupabaseSession } from "@/lib/supabase";
import { Palette, Text } from "@/lib/theme";
import "@/assets/styles/RequirementsData.page.css";

type MemberRoleRow = {
  role: string | null;
};

type EditFormState = {
  frequencyIntervalMs: string;
  isEnabled: boolean;
};

function formatTimestamp(value: string | null, unavailable = false): string {
  if (unavailable) return "Not tracked";
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRunState(state: string): string {
  return state
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function processToEditForm(process: BackgroundProcessRow): EditFormState {
  return {
    frequencyIntervalMs: getFrequencyPresetValue(process),
    isEnabled: process.is_enabled,
  };
}

function getFrequencyLabelFromIntervalMs(intervalMs: number): string {
  return getFrequencyPreset(intervalMs)?.label ?? `Every ${intervalMs / 1000} seconds`;
}

function getProcessRunFields(
  process: BackgroundProcessRow,
  isSyncing: boolean,
  usingDefaults: boolean,
): {
  state: BackgroundProcessRunState;
  lastRunAt: string | null;
  lastCompletedAt: string | null;
  updatedAt: string | null;
  runDataUnavailable: boolean;
} {
  const runDataUnavailable = usingDefaults;
  const isActiveSync =
    isSyncing && process.process_key === BACKGROUND_PROCESS_KEYS.SPRINT_TRELLO_SYNC;

  return {
    state: isActiveSync ? "processing" : process.state,
    lastRunAt: process.last_run_at,
    lastCompletedAt: process.last_completed_at,
    updatedAt: process.updated_at,
    runDataUnavailable,
  };
}

export default function BackgroundProcessPage() {
  const {
    processes,
    loading,
    error,
    usingDefaults,
    version,
    setProcessesEnabled,
    updateBackgroundProcess,
    refreshProcesses,
  } = useBackgroundProcesses();
  const { isSyncing, syncVersion } = useSprintSync();
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [selectedProcessKeys, setSelectedProcessKeys] = useState<Set<string>>(
    new Set(),
  );
  const [editingProcess, setEditingProcess] = useState<BackgroundProcessRow | null>(
    null,
  );
  const [editForm, setEditForm] = useState<EditFormState>({
    frequencyIntervalMs: String(BACKGROUND_PROCESS_FREQUENCY_PRESETS[1].intervalMs),
    isEnabled: true,
  });
  const [saving, setSaving] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = canManageBackgroundProcesses(memberRole);
  const allSelected =
    processes.length > 0 &&
    processes.every((process) => selectedProcessKeys.has(process.process_key));
  const someSelected = processes.some((process) =>
    selectedProcessKeys.has(process.process_key),
  );

  const selectedCount = useMemo(
    () =>
      processes.filter((process) => selectedProcessKeys.has(process.process_key))
        .length,
    [processes, selectedProcessKeys],
  );

  useEffect(() => {
    void refreshProcesses();
  }, [refreshProcesses, version, syncVersion]);

  useEffect(() => {
    let cancelled = false;

    async function loadMemberRole(): Promise<void> {
      setRoleLoading(true);

      try {
        const session = await getSupabaseSession();
        if (!session?.user) {
          if (!cancelled) setMemberRole(null);
          return;
        }

        const [memberByEmail] = session.user.email
          ? await getSupabaseRows<MemberRoleRow>("members", {
              select: "role",
              eq: { email: session.user.email },
              limit: 1,
            })
          : [];

        const [memberByAuthUserId] =
          !memberByEmail && session.user.id
            ? await getSupabaseRows<MemberRoleRow>("members", {
                select: "role",
                eq: { auth_user_id: session.user.id },
                limit: 1,
              })
            : [];

        if (!cancelled) {
          setMemberRole(memberByEmail?.role ?? memberByAuthUserId?.role ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setActionError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load your member role.",
          );
        }
      } finally {
        if (!cancelled) setRoleLoading(false);
      }
    }

    void loadMemberRole();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelectedProcessKeys((current) => {
      const next = new Set<string>();
      for (const process of processes) {
        if (current.has(process.process_key)) {
          next.add(process.process_key);
        }
      }
      return next;
    });
  }, [processes]);

  function toggleProcess(processKey: string): void {
    setSelectedProcessKeys((current) => {
      const next = new Set(current);
      if (next.has(processKey)) next.delete(processKey);
      else next.add(processKey);
      return next;
    });
  }

  function toggleAllProcesses(): void {
    setSelectedProcessKeys((current) => {
      if (processes.every((process) => current.has(process.process_key))) {
        return new Set();
      }

      return new Set(processes.map((process) => process.process_key));
    });
  }

  function openEditDialog(process: BackgroundProcessRow): void {
    setEditingProcess(process);
    setEditForm(processToEditForm(process));
    setActionError(null);
  }

  function closeEditDialog(): void {
    setEditingProcess(null);
  }

  async function applyBulkAction(enabled: boolean): Promise<void> {
    if (!canManage || selectedProcessKeys.size === 0) return;

    setSaving(true);
    setMessage(null);
    setActionError(null);

    try {
      await setProcessesEnabled(
        Array.from(selectedProcessKeys) as BackgroundProcessKey[],
        enabled,
      );
      setMessage(
        `${enabled ? "Enabled" : "Disabled"} ${selectedProcessKeys.size} background process${selectedProcessKeys.size === 1 ? "" : "es"}.`,
      );
    } catch (saveError) {
      setActionError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update background processes.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!editingProcess || !canManage) return;

    const frequencyIntervalMs = Number(editForm.frequencyIntervalMs);
    if (!Number.isFinite(frequencyIntervalMs) || frequencyIntervalMs < 0) {
      setActionError("Please choose a valid frequency.");
      return;
    }

    setEditLoading(true);
    setMessage(null);
    setActionError(null);

    try {
      await updateBackgroundProcess({
        processKey: editingProcess.process_key,
        frequency: getFrequencyLabelFromIntervalMs(frequencyIntervalMs),
        frequency_interval_ms: frequencyIntervalMs,
        is_enabled: editForm.isEnabled,
      });
      setMessage(`Updated ${editingProcess.name}.`);
      closeEditDialog();
    } catch (saveError) {
      setActionError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update background process.",
      );
    } finally {
      setEditLoading(false);
    }
  }

  const pageLoading = loading || roleLoading;

  useEffect(() => {
    if (pageLoading) return undefined;

    const intervalId = window.setInterval(() => {
      void refreshProcesses();
    }, 10_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [pageLoading, refreshProcesses]);

  return (
    <div className="requirements-data-page">
      <Title
        eyebrow="Admin / Settings"
        title="Background Process"
        subtitle="Manage scheduled background jobs that run while the app is open."
        size="large"
      />

      <Card className="requirements-data-card">
        <div className="requirements-data-table-header">
          <div>
            <div className="requirements-data-kicker">Process Control</div>
            <h3>Available Background Processes</h3>
          </div>
          <div className="requirements-data-table-tools background-process-actions">
            <button
              className="requirements-data-submit background-process-action-button background-process-action-button--on"
              disabled={!canManage || saving || selectedCount === 0 || usingDefaults}
              onClick={() => void applyBulkAction(true)}
              type="button"
            >
              Turn On Selected
            </button>
            <button
              className="requirements-data-submit background-process-action-button background-process-action-button--off"
              disabled={!canManage || saving || selectedCount === 0 || usingDefaults}
              onClick={() => void applyBulkAction(false)}
              type="button"
            >
              Turn Off Selected
            </button>
          </div>
        </div>

        {usingDefaults ? (
          <div className="requirements-data-message is-warning">
            Background process settings are using app defaults because the database
            table is missing. Apply the latest Supabase migrations to enable saving
            changes from this page.
          </div>
        ) : null}

        {!canManage && !roleLoading ? (
          <div className="requirements-data-message is-warning">
            Only Tech Lead and Super Admin members can enable or disable background
            processes.
          </div>
        ) : null}

        {message ? (
          <div className="requirements-data-message is-success">{message}</div>
        ) : null}

        {error && !usingDefaults ? (
          <div className="requirements-data-message is-error">{error}</div>
        ) : null}

        {actionError ? (
          <div className="requirements-data-message is-error">{actionError}</div>
        ) : null}

        {pageLoading ? (
          <div className="requirements-data-empty">Loading background processes...</div>
        ) : processes.length === 0 ? (
          <div className="requirements-data-empty">
            No background processes are configured yet.
          </div>
        ) : (
          <div className="background-process-table-wrap">
            <div className="background-process-table-toolbar">
              <span>{selectedCount} selected</span>
              <span>{processes.filter((process) => process.is_enabled).length} enabled</span>
            </div>
            <table className="background-process-table">
              <thead>
                <tr>
                  <th scope="col">
                    <label className="background-process-select-all">
                      <input
                        checked={allSelected}
                        disabled={!canManage || saving || usingDefaults}
                        onChange={toggleAllProcesses}
                        ref={(element) => {
                          if (element) {
                            element.indeterminate = someSelected && !allSelected;
                          }
                        }}
                        type="checkbox"
                      />
                      <span>Select all</span>
                    </label>
                  </th>
                  <th scope="col">Process</th>
                  <th scope="col">Frequency</th>
                  <th scope="col">Status</th>
                  <th scope="col">State</th>
                  <th scope="col">Last Run</th>
                  <th scope="col">Last Completed</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {processes.map((process) => {
                  const isSelected = selectedProcessKeys.has(process.process_key);
                  const runFields = getProcessRunFields(
                    process,
                    isSyncing,
                    usingDefaults,
                  );

                  return (
                    <tr key={process.id}>
                      <td>
                        <input
                          aria-label={`Select ${process.name}`}
                          checked={isSelected}
                          disabled={!canManage || saving || usingDefaults}
                          onChange={() => toggleProcess(process.process_key)}
                          type="checkbox"
                        />
                      </td>
                      <td>
                        <div className="background-process-name">{process.name}</div>
                        <div className="background-process-description">
                          {process.description}
                        </div>
                        <div className="background-process-key">{process.process_key}</div>
                        {process.last_error ? (
                          <div className="background-process-last-error">
                            {process.last_error}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <span className="background-process-schedule">
                          {process.frequency ?? "Manual only"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`background-process-status ${
                            process.is_enabled
                              ? "background-process-status--on"
                              : "background-process-status--off"
                          }`}
                        >
                          {process.is_enabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`background-process-state background-process-state--${runFields.state}`}
                        >
                          {formatRunState(runFields.state)}
                        </span>
                      </td>
                      <td>
                        <span
                          className="background-process-updated"
                          style={{ color: Text.faint }}
                        >
                          {formatTimestamp(
                            runFields.lastRunAt,
                            runFields.runDataUnavailable,
                          )}
                        </span>
                      </td>
                      <td>
                        <span
                          className="background-process-updated"
                          style={{ color: Text.faint }}
                        >
                          {formatTimestamp(
                            runFields.lastCompletedAt,
                            runFields.runDataUnavailable,
                          )}
                        </span>
                      </td>
                      <td>
                        <span
                          className="background-process-updated"
                          style={{ color: Text.faint }}
                        >
                          {formatTimestamp(
                            runFields.updatedAt,
                            runFields.runDataUnavailable,
                          )}
                        </span>
                      </td>
                      <td>
                        <div className="requirements-data-row-actions">
                          <button
                            aria-label={`Edit ${process.name}`}
                            className="requirements-data-row-button"
                            disabled={!canManage || saving || editLoading || usingDefaults}
                            onClick={() => openEditDialog(process)}
                            title="Edit"
                            type="button"
                          >
                            <svg
                              aria-hidden="true"
                              className="requirements-data-row-icon"
                              fill="none"
                              viewBox="0 0 16 16"
                            >
                              <path
                                d="M9.5 3.2 12.8 6.5M2.8 13.2l3.2-.7 6.9-6.9a1.6 1.6 0 0 0-2.3-2.3L3.6 10.3l-.8 2.9Z"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.4"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {canManage ? (
          <p
            className="background-process-footnote"
            style={{ color: Text.faint }}
          >
            Changes apply immediately for all signed-in users. Manual sync buttons
            remain available even when auto-sync is turned off.
          </p>
        ) : null}

        {!canManage && !roleLoading ? (
          <p
            className="background-process-footnote"
            style={{ color: Palette.cyan }}
          >
            Your role: {memberRole?.replaceAll("_", " ") ?? "Unknown"}
          </p>
        ) : null}
      </Card>

      {editingProcess ? (
        <div
          className="requirements-data-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !editLoading) {
              closeEditDialog();
            }
          }}
        >
          <div
            aria-labelledby="background-process-edit-title"
            aria-modal="true"
            className="requirements-data-modal background-process-edit-modal"
            role="dialog"
          >
            <div className="requirements-data-modal-header">
              <div>
                <div className="requirements-data-kicker">Edit Background Process</div>
                <h3 id="background-process-edit-title">{editingProcess.name}</h3>
              </div>
              <button
                className="requirements-data-modal-close"
                disabled={editLoading}
                onClick={closeEditDialog}
                type="button"
              >
                Close
              </button>
            </div>

            <form
              className="requirements-data-form"
              onSubmit={(event) => void handleEditSubmit(event)}
            >
              <div className="requirements-data-grid">
                <label className="requirements-data-field">
                  <span>Frequency</span>
                  <div className="requirements-data-select-wrap">
                    <select
                      disabled={editLoading}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          frequencyIntervalMs: event.target.value,
                        }))
                      }
                      required
                      value={editForm.frequencyIntervalMs}
                    >
                      {!getFrequencyPreset(Number(editForm.frequencyIntervalMs)) &&
                      Number(editForm.frequencyIntervalMs) > 0 ? (
                        <option value={editForm.frequencyIntervalMs}>
                          {editingProcess.frequency ??
                            `Every ${Number(editForm.frequencyIntervalMs) / 60_000} minutes`}
                        </option>
                      ) : null}
                      {BACKGROUND_PROCESS_FREQUENCY_PRESETS.map((preset) => (
                        <option key={preset.intervalMs} value={preset.intervalMs}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                    <svg
                      aria-hidden="true"
                      className="requirements-data-select-arrow"
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M2.5 4.5 6 8l3.5-3.5"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.7"
                      />
                    </svg>
                  </div>
                </label>

                <label className="requirements-data-field">
                  <span>Status</span>
                  <div className="requirements-data-select-wrap">
                    <select
                      disabled={editLoading}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          isEnabled: event.target.value === "enabled",
                        }))
                      }
                      required
                      value={editForm.isEnabled ? "enabled" : "disabled"}
                    >
                      <option value="enabled">Enabled</option>
                      <option value="disabled">Disabled</option>
                    </select>
                    <svg
                      aria-hidden="true"
                      className="requirements-data-select-arrow"
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M2.5 4.5 6 8l3.5-3.5"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.7"
                      />
                    </svg>
                  </div>
                </label>
              </div>

              <p className="background-process-edit-help" style={{ color: Text.faint }}>
                Frequency controls how often the process runs automatically while the app
                is open. Status controls whether scheduled runs are active.
              </p>

              <div className="requirements-data-actions requirements-data-modal-actions">
                <button
                  className="requirements-data-cancel-button"
                  disabled={editLoading}
                  onClick={closeEditDialog}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="requirements-data-submit"
                  disabled={editLoading}
                  type="submit"
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
