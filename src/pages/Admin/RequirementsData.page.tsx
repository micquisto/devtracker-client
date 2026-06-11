import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Card } from "@/components/shared/Containers";
import { Title } from "@/components/shared/page";
import {
  deleteSupabaseRows,
  getSupabaseRows,
  insertSupabaseRows,
  updateSupabaseRows,
} from "@/lib/supabase";
import { Background, Border, Palette, Text } from "@/lib/theme";
import "@/assets/styles/RequirementsData.page.css";

type RequirementLevel = "all" | "intern" | "junior" | "middle" | "senior" | "lead";

type RequirementFormState = {
  name: string;
  code: string;
  level: RequirementLevel;
  min: string;
  max: string;
  value: string;
};

type RequirementInsertRow = {
  name: string;
  code: string;
  level: RequirementLevel;
  min: number;
  max: number;
  value: number;
};

type RequirementRow = RequirementInsertRow & {
  id: string;
  date_created?: string;
  date_updated?: string;
};

type CodeAvailabilityStatus = "idle" | "checking" | "available" | "duplicate" | "error";

type CodeAvailability = {
  status: CodeAvailabilityStatus;
  message: string | null;
};

const LEVEL_OPTIONS: RequirementLevel[] = [
  "all",
  "intern",
  "junior",
  "middle",
  "senior",
  "lead",
];

const INITIAL_FORM: RequirementFormState = {
  name: "",
  code: "",
  level: "all",
  min: "",
  max: "",
  value: "",
};

const INITIAL_CODE_AVAILABILITY: CodeAvailability = {
  status: "idle",
  message: null,
};

const REQUIREMENTS_PAGE_SIZE = 12;

function parseRequiredNumber(value: string, label: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }

  return parsed;
}

function buildRequirementRow(form: RequirementFormState): RequirementInsertRow {
  const row: RequirementInsertRow = {
    name: form.name.trim(),
    code: form.code.trim(),
    level: form.level,
    min: parseRequiredNumber(form.min, "Min"),
    max: parseRequiredNumber(form.max, "Max"),
    value: parseRequiredNumber(form.value, "Value"),
  };

  if (!row.name || !row.code) {
    throw new Error("Name and Code are required.");
  }

  return row;
}

function rowToForm(row: RequirementRow): RequirementFormState {
  return {
    name: row.name,
    code: row.code,
    level: row.level,
    min: String(row.min),
    max: String(row.max),
    value: String(row.value),
  };
}

function buildRequirementCode(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['"]/gu, "")
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
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

function getDuplicateCodeMessage(code: string): string {
  return `Code "${code}" is already in use. Please choose another code.`;
}

function getRequirementLevelClass(level: RequirementLevel): string {
  return `requirements-data-level-pill is-${level}`;
}

export default function RequirementsDataPage() {
  const [form, setForm] = useState<RequirementFormState>(INITIAL_FORM);
  const [requirements, setRequirements] = useState<RequirementRow[]>([]);
  const [levelFilter, setLevelFilter] = useState<RequirementLevel>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [codeAvailability, setCodeAvailability] = useState<CodeAvailability>(
    INITIAL_CODE_AVAILABILITY,
  );
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(true);
  const [editLoading, setEditLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<RequirementRow | null>(
    null,
  );
  const [editingRequirement, setEditingRequirement] =
    useState<RequirementRow | null>(null);
  const [editForm, setEditForm] = useState<RequirementFormState>(INITIAL_FORM);
  const [editCodeAvailability, setEditCodeAvailability] =
    useState<CodeAvailability>(INITIAL_CODE_AVAILABILITY);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const filteredRequirements = useMemo(() => {
    if (levelFilter === "all") return requirements;

    return requirements.filter(
      (requirement) =>
        requirement.level === levelFilter || requirement.level === "all",
    );
  }, [levelFilter, requirements]);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredRequirements.length / REQUIREMENTS_PAGE_SIZE),
  );
  const activePage = Math.min(currentPage, totalPages);
  const pageStartIndex = (activePage - 1) * REQUIREMENTS_PAGE_SIZE;
  const paginatedRequirements = filteredRequirements.slice(
    pageStartIndex,
    pageStartIndex + REQUIREMENTS_PAGE_SIZE,
  );
  const pageEndIndex = Math.min(
    pageStartIndex + REQUIREMENTS_PAGE_SIZE,
    filteredRequirements.length,
  );

  async function loadRequirements(): Promise<void> {
    setTableLoading(true);

    try {
      const rows = await getSupabaseRows<RequirementRow>("requirements", {
        select: "id,name,code,level,min,max,value,date_created,date_updated",
        order: { column: "code", ascending: true },
      });

      setRequirements(rows);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to load requirements.",
      );
    } finally {
      setTableLoading(false);
    }
  }

  async function findRequirementByCode(code: string): Promise<RequirementRow | null> {
    const [requirement] = await getSupabaseRows<RequirementRow>("requirements", {
      select: "id,name,code,level,min,max,value,date_created,date_updated",
      eq: { code },
      limit: 1,
    });

    return requirement ?? null;
  }

  useEffect(() => {
    void loadRequirements();
  }, []);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    const code = form.code.trim();

    if (!code) {
      setCodeAvailability(INITIAL_CODE_AVAILABILITY);
      return;
    }

    let isActive = true;
    setCodeAvailability({
      status: "checking",
      message: "Checking code availability...",
    });

    const timeoutId = window.setTimeout(() => {
      void findRequirementByCode(code)
        .then((requirement) => {
          if (!isActive) return;

          setCodeAvailability(
            requirement
              ? {
                  status: "duplicate",
                  message: getDuplicateCodeMessage(code),
                }
              : {
                  status: "available",
                  message: "Code is available.",
                },
          );
        })
        .catch(() => {
          if (!isActive) return;

          setCodeAvailability({
            status: "error",
            message: "Unable to check code availability.",
          });
        });
    }, 350);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [form.code]);

  useEffect(() => {
    if (!editingRequirement) {
      setEditCodeAvailability(INITIAL_CODE_AVAILABILITY);
      return;
    }

    const code = editForm.code.trim();

    if (!code) {
      setEditCodeAvailability(INITIAL_CODE_AVAILABILITY);
      return;
    }

    let isActive = true;
    setEditCodeAvailability({
      status: "checking",
      message: "Checking code availability...",
    });

    const timeoutId = window.setTimeout(() => {
      void findRequirementByCode(code)
        .then((requirement) => {
          if (!isActive) return;

          setEditCodeAvailability(
            requirement && requirement.id !== editingRequirement.id
              ? {
                  status: "duplicate",
                  message: getDuplicateCodeMessage(code),
                }
              : {
                  status: "available",
                  message:
                    requirement?.id === editingRequirement.id
                      ? "Current code is valid."
                      : "Code is available.",
                },
          );
        })
        .catch(() => {
          if (!isActive) return;

          setEditCodeAvailability({
            status: "error",
            message: "Unable to check code availability.",
          });
        });
    }, 350);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [editForm.code, editingRequirement]);

  function updateField(field: keyof RequirementFormState, value: string): void {
    if (field === "name") {
      setForm((current) => ({
        ...current,
        name: value,
        code: buildRequirementCode(value),
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateEditField(field: keyof RequirementFormState, value: string): void {
    if (field === "name") {
      setEditForm((current) => ({
        ...current,
        name: value,
        code: buildRequirementCode(value),
      }));
      return;
    }

    setEditForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openEditDialog(requirement: RequirementRow): void {
    setEditingRequirement(requirement);
    setEditForm(rowToForm(requirement));
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const row = buildRequirementRow(form);
      const duplicateRequirement = await findRequirementByCode(row.code);

      if (duplicateRequirement) {
        setCodeAvailability({
          status: "duplicate",
          message: getDuplicateCodeMessage(row.code),
        });
        setError(getDuplicateCodeMessage(row.code));
        return;
      }

      const [savedRequirement] = await insertSupabaseRows<
        RequirementRow,
        RequirementInsertRow
      >("requirements", row, "id,name,code");

      setForm(INITIAL_FORM);
      setCodeAvailability(INITIAL_CODE_AVAILABILITY);
      await loadRequirements();
      setSuccess(
        savedRequirement
          ? `Added requirement ${savedRequirement.name}.`
          : "Added requirement.",
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to add requirement.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!editingRequirement) return;

    setEditLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const row = buildRequirementRow(editForm);
      const duplicateRequirement = await findRequirementByCode(row.code);

      if (duplicateRequirement && duplicateRequirement.id !== editingRequirement.id) {
        setEditCodeAvailability({
          status: "duplicate",
          message: getDuplicateCodeMessage(row.code),
        });
        setError(getDuplicateCodeMessage(row.code));
        return;
      }

      const [updatedRequirement] = await updateSupabaseRows<
        RequirementRow,
        RequirementInsertRow
      >("requirements", row, {
        eq: { id: editingRequirement.id },
        select: "id,name,code,level,min,max,value,date_created,date_updated",
      });

      await loadRequirements();
      setEditingRequirement(null);
      setEditForm(INITIAL_FORM);
      setEditCodeAvailability(INITIAL_CODE_AVAILABILITY);
      setSuccess(
        updatedRequirement
          ? `Updated requirement ${updatedRequirement.name}.`
          : "Updated requirement.",
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to update requirement.");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete(requirement: RequirementRow): Promise<void> {
    setDeletingId(requirement.id);
    setError(null);
    setSuccess(null);

    try {
      await deleteSupabaseRows<RequirementRow>("requirements", {
        eq: { id: requirement.id },
        select: "id",
      });
      await loadRequirements();
      setDeleteConfirmation(null);
      setSuccess(`Deleted requirement ${requirement.name}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to delete requirement.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="requirements-data-page">
      <Title
        eyebrow="Admin / Data Override"
        title="Requirements Data"
        subtitle="Add requirement baseline data used by performance and sprint calculations."
        size="large"
      />

      <Card className="requirements-data-card">
        <form className="requirements-data-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="requirements-data-grid">
            <label className="requirements-data-field">
              <span>Name</span>
              <input
                name="name"
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Requirement name"
                required
                type="text"
                value={form.name}
              />
            </label>

            <label className="requirements-data-field">
              <span>Code</span>
              <input
                name="code"
                onChange={(event) => updateField("code", event.target.value)}
                placeholder="e.g. sprint_velocity"
                required
                type="text"
                value={form.code}
              />
              {codeAvailability.message ? (
                <small
                  className={`requirements-data-code-feedback is-${codeAvailability.status}`}
                >
                  {codeAvailability.message}
                </small>
              ) : null}
            </label>

            <label className="requirements-data-field">
              <span>Level</span>
              <div className="requirements-data-select-wrap">
                <select
                  name="level"
                  onChange={(event) =>
                    updateField("level", event.target.value as RequirementLevel)
                  }
                  required
                  value={form.level}
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
                name="min"
                onChange={(event) => updateField("min", event.target.value)}
                placeholder="0"
                required
                type="text"
                value={form.min}
              />
            </label>

            <label className="requirements-data-field">
              <span>Max</span>
              <input
                name="max"
                onChange={(event) => updateField("max", event.target.value)}
                placeholder="100"
                required
                type="text"
                value={form.max}
              />
            </label>

            <label className="requirements-data-field">
              <span>Value</span>
              <input
                name="value"
                onChange={(event) => updateField("value", event.target.value)}
                placeholder="Required value"
                required
                type="text"
                value={form.value}
              />
            </label>
          </div>

          <div className="requirements-data-actions">
            <button
              className="requirements-data-submit"
              disabled={
                loading ||
                codeAvailability.status === "checking" ||
                codeAvailability.status === "duplicate"
              }
              type="submit"
            >
              {loading ? (
                <>
                  <span
                    className="requirements-data-loader"
                    style={{ borderTopColor: Palette.cyan }}
                  />
                  Adding
                </>
              ) : (
                "Add Data"
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
            <div className="requirements-data-kicker">Requirements Table</div>
            <h3>All Requirements</h3>
          </div>
          <div className="requirements-data-table-tools">
            <label className="requirements-data-filter-field">
              <span>Level</span>
              <div className="requirements-data-select-wrap">
                <select
                  aria-label="Filter requirements by level"
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
            <span>{filteredRequirements.length} records</span>
          </div>
        </div>

        {tableLoading ? (
          <div className="requirements-data-empty">Loading requirements...</div>
        ) : filteredRequirements.length === 0 ? (
          <div className="requirements-data-empty">No Data Found</div>
        ) : (
          <>
            <div className="requirements-data-table-wrap">
              <table className="requirements-data-table">
                <thead>
                  <tr>
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
                  {paginatedRequirements.map((requirement) => (
                    <tr key={requirement.id}>
                      <td data-label="Name">{requirement.name}</td>
                      <td data-label="Code">{requirement.code}</td>
                      <td data-label="Level">
                        <span className={getRequirementLevelClass(requirement.level)}>
                          {requirement.level}
                        </span>
                      </td>
                      <td data-label="Min">{requirement.min}</td>
                      <td data-label="Max">{requirement.max}</td>
                      <td data-label="Value">{requirement.value}</td>
                      <td data-label="Updated">
                        {formatRequirementDate(requirement.date_updated)}
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
                {filteredRequirements.length}
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
            aria-labelledby="requirements-edit-title"
            aria-modal="true"
            className="requirements-data-modal"
            role="dialog"
          >
            <div className="requirements-data-modal-header">
              <div>
                <div className="requirements-data-kicker">Edit Requirement</div>
                <h3 id="requirements-edit-title">{editingRequirement.name}</h3>
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
                  {editCodeAvailability.message ? (
                    <small
                      className={`requirements-data-code-feedback is-${editCodeAvailability.status}`}
                    >
                      {editCodeAvailability.message}
                    </small>
                  ) : null}
                </label>

                <label className="requirements-data-field">
                  <span>Level</span>
                  <div className="requirements-data-select-wrap">
                    <select
                      name="edit-level"
                      onChange={(event) =>
                        updateEditField("level", event.target.value as RequirementLevel)
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
                  disabled={
                    editLoading ||
                    editCodeAvailability.status === "checking" ||
                    editCodeAvailability.status === "duplicate"
                  }
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
            aria-labelledby="requirements-delete-title"
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
                  id="requirements-delete-title"
                >
                  Delete Requirement
                </h2>
              </div>
            </div>

            <p className="requirements-data-confirmation-message">
              This will permanently delete this requirement data. This action cannot
              be undone.
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
