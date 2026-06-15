import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Card } from "@/components/shared/Containers";
import { Title } from "@/components/shared/page";
import {
  deleteSupabaseRows,
  getSupabaseRows,
  updateSupabaseRows,
} from "@/lib/supabase";
import { Background, Border, Palette, Text } from "@/lib/theme";
import {
  buildSprintRequirementsFromCurrentRequirements,
  type RequirementLevel,
} from "@/lib/utils";
import "@/assets/styles/RequirementsData.page.css";

type SprintRow = {
  id: string;
  name: string;
  sprint_number: number | null;
  sprint_year: number | null;
  sprint_month: number | null;
  status: string | null;
  is_current: number | null;
};

type SprintRequirementRow = {
  id: string;
  sprint_id: string;
  name: string;
  code: string;
  level: RequirementLevel;
  min: number | null;
  max: number | null;
  value: number | null;
  created_at?: string;
  updated_at?: string;
};

type SprintRequirementFormState = {
  sprint_id: string;
  name: string;
  code: string;
  level: RequirementLevel;
  min: string;
  max: string;
  value: string;
};

type SprintRequirementUpdateRow = {
  sprint_id: string;
  name: string;
  code: string;
  level: RequirementLevel;
  min: number;
  max: number;
  value: number;
};

const LEVEL_OPTIONS: RequirementLevel[] = [
  "all",
  "intern",
  "junior",
  "middle",
  "senior",
  "lead",
];
const SPRINT_REQUIREMENTS_PAGE_SIZE = 12;
const INITIAL_EDIT_FORM: SprintRequirementFormState = {
  sprint_id: "",
  name: "",
  code: "",
  level: "all",
  min: "",
  max: "",
  value: "",
};

function parseRequiredNumber(value: string, label: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }

  return parsed;
}

function rowToForm(row: SprintRequirementRow): SprintRequirementFormState {
  return {
    sprint_id: row.sprint_id,
    name: row.name,
    code: row.code,
    level: row.level,
    min: String(row.min ?? ""),
    max: String(row.max ?? ""),
    value: String(row.value ?? ""),
  };
}

function buildSprintRequirementUpdateRow(
  form: SprintRequirementFormState,
): SprintRequirementUpdateRow {
  const row = {
    sprint_id: form.sprint_id,
    name: form.name.trim(),
    code: form.code.trim(),
    level: form.level,
    min: parseRequiredNumber(form.min, "Min"),
    max: parseRequiredNumber(form.max, "Max"),
    value: parseRequiredNumber(form.value, "Value"),
  };

  if (!row.sprint_id || !row.name || !row.code) {
    throw new Error("Sprint, Name, and Code are required.");
  }

  return row;
}

function formatRequirementDate(value?: string): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

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

  return `${parts.month} ${parts.day}, ${parts.year} at ${parts.hour}:${parts.minute}${parts.dayPeriod.toLowerCase()}`;
}

function getRequirementLevelClass(level: RequirementLevel): string {
  return `requirements-data-level-pill is-${level}`;
}

function getSprintLabel(sprint: SprintRow): string {
  const status = sprint.status ? ` · ${sprint.status}` : "";
  const current = sprint.is_current === 1 ? " · Current" : "";

  return `${sprint.name}${status}${current}`;
}

export default function SprintRequirementsPage() {
  const [sprints, setSprints] = useState<SprintRow[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState("");
  const [sprintFilter, setSprintFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState<RequirementLevel>("all");
  const [sprintRequirements, setSprintRequirements] = useState<
    SprintRequirementRow[]
  >([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [building, setBuilding] = useState(false);
  const [tableLoading, setTableLoading] = useState(true);
  const [editLoading, setEditLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingRequirement, setEditingRequirement] =
    useState<SprintRequirementRow | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] =
    useState<SprintRequirementRow | null>(null);
  const [editForm, setEditForm] =
    useState<SprintRequirementFormState>(INITIAL_EDIT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const sprintById = useMemo(
    () => new Map(sprints.map((sprint) => [sprint.id, sprint])),
    [sprints],
  );
  const filteredSprintRequirements = useMemo(() => {
    return sprintRequirements.filter((row) => {
      const matchesSprint = sprintFilter === "all" || row.sprint_id === sprintFilter;
      const matchesLevel =
        levelFilter === "all" ||
        row.level === levelFilter ||
        row.level === "all";

      return matchesSprint && matchesLevel;
    });
  }, [levelFilter, sprintFilter, sprintRequirements]);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredSprintRequirements.length / SPRINT_REQUIREMENTS_PAGE_SIZE),
  );
  const activePage = Math.min(currentPage, totalPages);
  const pageStartIndex = (activePage - 1) * SPRINT_REQUIREMENTS_PAGE_SIZE;
  const paginatedSprintRequirements = filteredSprintRequirements.slice(
    pageStartIndex,
    pageStartIndex + SPRINT_REQUIREMENTS_PAGE_SIZE,
  );
  const pageEndIndex = Math.min(
    pageStartIndex + SPRINT_REQUIREMENTS_PAGE_SIZE,
    filteredSprintRequirements.length,
  );

  async function loadSprints(): Promise<void> {
    const rows = await getSupabaseRows<SprintRow>("sprints", {
      select: "id,name,sprint_number,sprint_year,sprint_month,status,is_current",
      order: { column: "start_date", ascending: false },
    });

    setSprints(rows);
    setSelectedSprintId((current) => {
      if (current) return current;
      return rows.find((sprint) => sprint.is_current === 1)?.id ?? rows[0]?.id ?? "";
    });
  }

  async function loadSprintRequirements(): Promise<void> {
    setTableLoading(true);

    try {
      const rows = await getSupabaseRows<SprintRequirementRow>(
        "sprint_requirements",
        {
          select:
            "id,sprint_id,name,code,level,min,max,value,created_at,updated_at",
          order: { column: "code", ascending: true },
        },
      );

      setSprintRequirements(rows);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load sprint requirements.",
      );
    } finally {
      setTableLoading(false);
    }
  }

  useEffect(() => {
    void Promise.all([loadSprints(), loadSprintRequirements()]).catch((error) => {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load sprint requirement data.",
      );
      setTableLoading(false);
    });
  }, []);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function openEditDialog(requirement: SprintRequirementRow): void {
    setEditingRequirement(requirement);
    setEditForm(rowToForm(requirement));
    setError(null);
    setSuccess(null);
  }

  function updateEditField(
    field: keyof SprintRequirementFormState,
    value: string,
  ): void {
    setEditForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleBuildData(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedSprintId) {
      setError("Please select a sprint.");
      return;
    }

    setBuilding(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await buildSprintRequirementsFromCurrentRequirements(
        selectedSprintId,
      );

      setSprintFilter(selectedSprintId);
      setCurrentPage(1);
      await loadSprintRequirements();
      setSuccess(
        result.replacedCount > 0
          ? `Replaced ${result.replacedCount} existing rows with ${result.insertedCount} current requirement records.`
          : `Built ${result.insertedCount} sprint requirement records.`,
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to build sprint requirement data.",
      );
    } finally {
      setBuilding(false);
    }
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!editingRequirement) return;

    setEditLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const row = buildSprintRequirementUpdateRow(editForm);
      const [updatedRequirement] = await updateSupabaseRows<
        SprintRequirementRow,
        SprintRequirementUpdateRow
      >("sprint_requirements", row, {
        eq: { id: editingRequirement.id },
        select: "id,sprint_id,name,code,level,min,max,value,created_at,updated_at",
      });

      await loadSprintRequirements();
      setEditingRequirement(null);
      setEditForm(INITIAL_EDIT_FORM);
      setSuccess(
        updatedRequirement
          ? `Updated sprint requirement ${updatedRequirement.name}.`
          : "Updated sprint requirement.",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to update sprint requirement.",
      );
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete(requirement: SprintRequirementRow): Promise<void> {
    setDeletingId(requirement.id);
    setError(null);
    setSuccess(null);

    try {
      await deleteSupabaseRows<SprintRequirementRow>("sprint_requirements", {
        eq: { id: requirement.id },
        select: "id",
      });

      await loadSprintRequirements();
      setDeleteConfirmation(null);
      setSuccess(`Deleted sprint requirement ${requirement.name}.`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to delete sprint requirement.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="requirements-data-page">
      <Title
        eyebrow="Admin / Data Override"
        title="Sprint Requirements"
        subtitle="Build and review requirement data assigned to each sprint."
        size="large"
      />

      <Card className="requirements-data-card">
        <form
          className="requirements-data-form"
          onSubmit={(event) => void handleBuildData(event)}
        >
          <div className="requirements-data-grid">
            <label className="requirements-data-field">
              <span>Sprint</span>
              <div className="requirements-data-select-wrap">
                <select
                  disabled={building || sprints.length === 0}
                  name="sprint"
                  onChange={(event) => setSelectedSprintId(event.target.value)}
                  required
                  value={selectedSprintId}
                >
                  {sprints.length === 0 ? (
                    <option value="">No sprints found</option>
                  ) : (
                    sprints.map((sprint) => (
                      <option key={sprint.id} value={sprint.id}>
                        {getSprintLabel(sprint)}
                      </option>
                    ))
                  )}
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

          <div className="requirements-data-actions">
            <button
              className="requirements-data-submit"
              disabled={building || !selectedSprintId}
              type="submit"
            >
              {building ? (
                <>
                  <span className="requirements-data-loader" />
                  Building...
                </>
              ) : (
                "Build Data"
              )}
            </button>
          </div>

          {error ? <div className="requirements-data-message is-error">{error}</div> : null}
          {success ? (
            <div className="requirements-data-message is-success">{success}</div>
          ) : null}
        </form>
      </Card>

      <Card className="requirements-data-card requirements-data-table-card">
        <div className="requirements-data-table-header">
          <div>
            <div className="requirements-data-kicker">Sprint Requirements Table</div>
            <h3>All Sprint Requirements</h3>
          </div>
          <div className="requirements-data-table-tools">
            <label className="requirements-data-filter-field">
              <span>Sprint</span>
              <div className="requirements-data-select-wrap">
                <select
                  aria-label="Filter sprint requirements by sprint"
                  onChange={(event) => {
                    setSprintFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                  value={sprintFilter}
                >
                  <option value="all">All Sprints</option>
                  {sprints.map((sprint) => (
                    <option key={sprint.id} value={sprint.id}>
                      {getSprintLabel(sprint)}
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
            <label className="requirements-data-filter-field">
              <span>Level</span>
              <div className="requirements-data-select-wrap">
                <select
                  aria-label="Filter sprint requirements by level"
                  onChange={(event) => {
                    setLevelFilter(event.target.value as RequirementLevel);
                    setCurrentPage(1);
                  }}
                  value={levelFilter}
                >
                  {LEVEL_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      {level}
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
            <span>{filteredSprintRequirements.length} records</span>
          </div>
        </div>

        {tableLoading ? (
          <div className="requirements-data-empty">Loading sprint requirements...</div>
        ) : filteredSprintRequirements.length === 0 ? (
          <div className="requirements-data-empty">No Data Found</div>
        ) : (
          <>
            <div className="requirements-data-table-wrap">
              <table className="requirements-data-table sprint-requirements-table">
                <thead>
                  <tr>
                    <th>Sprint</th>
                    <th>Name</th>
                    <th>Code</th>
                    <th>Level</th>
                    <th>Min</th>
                    <th>Max</th>
                    <th>Value</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSprintRequirements.map((requirement) => (
                    <tr key={requirement.id}>
                      <td data-label="Sprint">
                        {sprintById.get(requirement.sprint_id)?.name ?? "Unknown sprint"}
                      </td>
                      <td data-label="Name">{requirement.name}</td>
                      <td data-label="Code">{requirement.code}</td>
                      <td data-label="Level">
                        <span className={getRequirementLevelClass(requirement.level)}>
                          {requirement.level}
                        </span>
                      </td>
                      <td data-label="Min">{requirement.min ?? "-"}</td>
                      <td data-label="Max">{requirement.max ?? "-"}</td>
                      <td data-label="Value">{requirement.value ?? "-"}</td>
                      <td data-label="Updated">
                        {formatRequirementDate(requirement.updated_at)}
                      </td>
                      <td data-label="Actions">
                        <div className="requirements-data-row-actions">
                          <button
                            aria-label={`Edit ${requirement.name}`}
                            className="requirements-data-row-button"
                            onClick={() => openEditDialog(requirement)}
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
                          <button
                            aria-label={`Delete ${requirement.name}`}
                            className="requirements-data-row-button is-danger"
                            disabled={deletingId === requirement.id}
                            onClick={() => {
                              setDeleteConfirmation(requirement);
                              setError(null);
                              setSuccess(null);
                            }}
                            title="Delete"
                            type="button"
                          >
                            {deletingId === requirement.id ? (
                              <span
                                className="requirements-data-loader"
                                style={{ borderTopColor: "#ff8d8d" }}
                              />
                            ) : (
                              <svg
                                aria-hidden="true"
                                className="requirements-data-row-icon"
                                fill="none"
                                viewBox="0 0 16 16"
                              >
                                <path
                                  d="M3.2 4.5h9.6M6.2 4.5V3.4c0-.5.4-.9.9-.9h1.8c.5 0 .9.4.9.9v1.1M5.1 6.5l.4 6.1c0 .5.5.9 1 .9h3c.5 0 1-.4 1-.9l.4-6.1M7 7.3v4M9 7.3v4"
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="1.4"
                                />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="requirements-data-pagination">
              <div
                style={{
                  color: Text.faint,
                  fontFamily: "'DM Mono',monospace",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                Showing {pageStartIndex + 1}-{pageEndIndex} of{" "}
                {filteredSprintRequirements.length}
              </div>
              <div
                className="requirements-data-pagination-actions"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={activePage === 1}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 99,
                    border: `1px solid ${
                      activePage === 1 ? Border.default : Border.hoverSoft
                    }`,
                    background:
                      activePage === 1 ? "transparent" : Background.sortActive,
                    color: activePage === 1 ? Text.faint : Palette.cyan,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 10,
                    fontWeight: 800,
                    cursor: activePage === 1 ? "not-allowed" : "pointer",
                    opacity: activePage === 1 ? 0.55 : 1,
                  }}
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }, (_, index) => {
                  const page = index + 1;
                  const isActive = page === activePage;

                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 9,
                        border: `1px solid ${
                          isActive ? Palette.cyan : Border.default
                        }`,
                        background: isActive
                          ? Background.sortActive
                          : "transparent",
                        color: isActive ? Palette.cyan : Text.faint,
                        fontFamily: "'DM Mono',monospace",
                        fontSize: 10,
                        fontWeight: isActive ? 900 : 700,
                        cursor: "pointer",
                      }}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  disabled={activePage === totalPages}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 99,
                    border: `1px solid ${
                      activePage === totalPages
                        ? Border.default
                        : Border.hoverSoft
                    }`,
                    background:
                      activePage === totalPages
                        ? "transparent"
                        : Background.sortActive,
                    color:
                      activePage === totalPages ? Text.faint : Palette.cyan,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 10,
                    fontWeight: 800,
                    cursor:
                      activePage === totalPages ? "not-allowed" : "pointer",
                    opacity: activePage === totalPages ? 0.55 : 1,
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      {editingRequirement ? (
        <div className="requirements-data-modal-backdrop" role="presentation">
          <div
            aria-labelledby="sprint-requirements-edit-title"
            aria-modal="true"
            className="requirements-data-modal"
            role="dialog"
          >
            <div className="requirements-data-modal-header">
              <div>
                <div className="requirements-data-kicker">
                  Edit Sprint Requirement
                </div>
                <h3 id="sprint-requirements-edit-title">
                  {editingRequirement.name}
                </h3>
              </div>
              <button
                className="requirements-data-modal-close"
                onClick={() => setEditingRequirement(null)}
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
                  <span>Sprint</span>
                  <div className="requirements-data-select-wrap">
                    <select
                      name="edit-sprint"
                      onChange={(event) =>
                        updateEditField("sprint_id", event.target.value)
                      }
                      required
                      value={editForm.sprint_id}
                    >
                      {sprints.map((sprint) => (
                        <option key={sprint.id} value={sprint.id}>
                          {getSprintLabel(sprint)}
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
                  <span>Name</span>
                  <input
                    name="edit-name"
                    onChange={(event) => updateEditField("name", event.target.value)}
                    required
                    type="text"
                    value={editForm.name}
                  />
                </label>

                <label className="requirements-data-field">
                  <span>Code</span>
                  <input
                    name="edit-code"
                    onChange={(event) => updateEditField("code", event.target.value)}
                    required
                    type="text"
                    value={editForm.code}
                  />
                </label>

                <label className="requirements-data-field">
                  <span>Level</span>
                  <div className="requirements-data-select-wrap">
                    <select
                      name="edit-level"
                      onChange={(event) =>
                        updateEditField(
                          "level",
                          event.target.value as RequirementLevel,
                        )
                      }
                      required
                      value={editForm.level}
                    >
                      {LEVEL_OPTIONS.map((level) => (
                        <option key={level} value={level}>
                          {level}
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
                  <span>Min</span>
                  <input
                    name="edit-min"
                    onChange={(event) => updateEditField("min", event.target.value)}
                    required
                    type="text"
                    value={editForm.min}
                  />
                </label>

                <label className="requirements-data-field">
                  <span>Max</span>
                  <input
                    name="edit-max"
                    onChange={(event) => updateEditField("max", event.target.value)}
                    required
                    type="text"
                    value={editForm.max}
                  />
                </label>

                <label className="requirements-data-field">
                  <span>Value</span>
                  <input
                    name="edit-value"
                    onChange={(event) => updateEditField("value", event.target.value)}
                    required
                    type="text"
                    value={editForm.value}
                  />
                </label>
              </div>

              <div className="requirements-data-actions requirements-data-modal-actions">
                <button
                  className="requirements-data-cancel-button"
                  onClick={() => setEditingRequirement(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="requirements-data-submit"
                  disabled={editLoading}
                  type="submit"
                >
                  {editLoading ? "Updating" : "Update Data"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteConfirmation ? (
        <div
          className="requirements-data-confirmation-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingId) {
              setDeleteConfirmation(null);
            }
          }}
          role="presentation"
        >
          <section
            aria-labelledby="sprint-requirements-delete-title"
            aria-modal="true"
            className="requirements-data-confirmation-dialog"
            role="dialog"
          >
            <div className="requirements-data-confirmation-glow" />
            <div className="requirements-data-confirmation-header">
              <span className="requirements-data-confirmation-icon">!</span>
              <div>
                <div className="requirements-data-confirmation-eyebrow">
                  Confirm Action
                </div>
                <h2
                  className="requirements-data-confirmation-title"
                  id="sprint-requirements-delete-title"
                >
                  Delete Sprint Requirement
                </h2>
              </div>
            </div>

            <p className="requirements-data-confirmation-message">
              This will permanently delete this sprint requirement data. This action
              cannot be undone.
            </p>

            <div className="requirements-data-confirmation-details">
              <span>Requirement</span>
              <strong>{deleteConfirmation.name}</strong>
            </div>

            <div className="requirements-data-confirmation-actions">
              <button
                className="requirements-data-confirmation-button requirements-data-confirmation-button--secondary"
                disabled={Boolean(deletingId)}
                onClick={() => setDeleteConfirmation(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="requirements-data-confirmation-button requirements-data-confirmation-button--primary"
                disabled={Boolean(deletingId)}
                onClick={() => void handleDelete(deleteConfirmation)}
                type="button"
              >
                {deletingId === deleteConfirmation.id ? "Deleting" : "Delete"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
