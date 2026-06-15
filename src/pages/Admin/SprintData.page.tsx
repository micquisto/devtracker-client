import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Card } from "@/components/shared/Containers";
import { ThemedDatePicker } from "@/components/shared/Elements";
import { Title } from "@/components/shared/page";
import {
  deleteSupabaseRows,
  getSupabaseRows,
  insertSupabaseRows,
  updateSupabaseRows,
} from "@/lib/supabase";
import { Background, Border, Palette, Text } from "@/lib/theme";
import "@/assets/styles/RequirementsData.page.css";

type SprintDataSortKey = "date" | "sprint" | "quarter" | "year";
type SprintDataSortDirection = "asc" | "desc";

type SprintDataFormState = {
  year: string;
  quarter: string;
  sprintNumber: string;
  startDate: string;
  endDate: string;
  month: string;
};

type SprintDataEditFormState = SprintDataFormState & {
  status: string;
};

type SprintContextRow = {
  id: string;
  project_id: string;
  name: string;
  sprint_number: number;
  start_date: string;
  end_date: string;
  month: number | null;
  status?: string | null;
  is_current: number | boolean;
};

type SprintInsertRow = {
  project_id: string;
  name: string;
  sprint_number: number;
  start_date: string;
  end_date: string;
  month: number;
  total_planned_points: number;
  total_completed_points: number;
  status: string;
  is_current: number;
};

type SprintUpdateRow = {
  name: string;
  sprint_number: number;
  start_date: string;
  end_date: string;
  month: number;
  status: string;
};

const MONTH_OPTIONS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
];

const INITIAL_FORM: SprintDataFormState = {
  year: String(new Date().getFullYear()),
  quarter: "1",
  sprintNumber: "1",
  startDate: "",
  endDate: "",
  month: String(new Date().getMonth() + 1),
};

const SPRINTS_PAGE_SIZE = 10;
const SPRINT_STATUS_OPTIONS = ["planning", "active", "completed", "done"];

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

function isCurrentSprint(sprint: SprintContextRow): boolean {
  return sprint.is_current === 1 || sprint.is_current === true;
}

function getQuarterFromDate(date: Date): number {
  return Math.floor(date.getUTCMonth() / 3) + 1;
}

function buildDefaultForm(currentSprint: SprintContextRow | null): SprintDataFormState {
  if (!currentSprint) return INITIAL_FORM;

  const startDate = addDays(parseDateOnly(currentSprint.end_date), 1);
  const endDate = addDays(startDate, 13);
  const isSprintCycleEnd = currentSprint.sprint_number === 7;
  const currentQuarter = getQuarterFromDate(parseDateOnly(currentSprint.start_date));
  const yearFromName = currentSprint.name.match(/^(\d{4})\b/u)?.[1];
  const currentYear = yearFromName
    ? Number(yearFromName)
    : parseDateOnly(currentSprint.start_date).getUTCFullYear();
  const nextQuarter = isSprintCycleEnd
    ? currentQuarter === 4
      ? 1
      : currentQuarter + 1
    : currentQuarter;
  const nextYear = isSprintCycleEnd && currentQuarter === 4
    ? currentYear + 1
    : currentYear;

  return {
    year: String(nextYear),
    quarter: String(nextQuarter),
    sprintNumber: String(isSprintCycleEnd ? 1 : currentSprint.sprint_number + 1),
    startDate: formatDateOnly(startDate),
    endDate: formatDateOnly(endDate),
    month: String(startDate.getUTCMonth() + 1),
  };
}

function buildSprintName(form: SprintDataFormState): string {
  return `${form.year} Q${form.quarter} Sprint ${form.sprintNumber}`;
}

function buildSprintUpdateRow(form: SprintDataEditFormState): SprintUpdateRow {
  return {
    name: buildSprintName(form),
    sprint_number: Number(form.sprintNumber),
    start_date: form.startDate,
    end_date: form.endDate,
    month: Number(form.month),
    status: form.status,
  };
}

function getSprintYear(sprint: SprintContextRow): number {
  const yearFromName = sprint.name.match(/^(\d{4})\b/u)?.[1];
  if (yearFromName) return Number(yearFromName);
  return parseDateOnly(sprint.start_date).getUTCFullYear();
}

function getSprintQuarter(sprint: SprintContextRow): number {
  const quarterFromName = sprint.name.match(/\bQ([1-4])\b/iu)?.[1];
  if (quarterFromName) return Number(quarterFromName);
  return getQuarterFromDate(parseDateOnly(sprint.start_date));
}

function formatSprintDate(value: string | null | undefined): string {
  if (!value) return "-";

  const date = parseDateOnly(value);
  if (!Number.isFinite(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return fallback;
}

function sprintToEditForm(sprint: SprintContextRow): SprintDataEditFormState {
  return {
    year: String(getSprintYear(sprint)),
    quarter: String(getSprintQuarter(sprint)),
    sprintNumber: String(sprint.sprint_number),
    startDate: sprint.start_date,
    endDate: sprint.end_date,
    month: String(sprint.month ?? parseDateOnly(sprint.start_date).getUTCMonth() + 1),
    status: sprint.status ?? "planning",
  };
}

export default function SprintDataPage() {
  const [sprints, setSprints] = useState<SprintContextRow[]>([]);
  const [currentSprint, setCurrentSprint] = useState<SprintContextRow | null>(null);
  const [form, setForm] = useState<SprintDataFormState>(INITIAL_FORM);
  const [yearFilter, setYearFilter] = useState("all");
  const [quarterFilter, setQuarterFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SprintDataSortKey>("date");
  const [sortDirection, setSortDirection] = useState<SprintDataSortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingSprint, setEditingSprint] = useState<SprintContextRow | null>(null);
  const [editForm, setEditForm] = useState<SprintDataEditFormState>({
    ...INITIAL_FORM,
    status: "planning",
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState<SprintContextRow | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSprints(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const sprints = await getSupabaseRows<SprintContextRow>("sprints", {
          select: "id,project_id,name,sprint_number,start_date,end_date,month,status,is_current",
          order: { column: "start_date", ascending: false },
        });
        const current = sprints.find(isCurrentSprint) ?? sprints[0] ?? null;

        if (!cancelled) {
          setSprints(sprints);
          setCurrentSprint(current);
          setForm(buildDefaultForm(current));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Unable to load sprint context."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSprints();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateField<K extends keyof SprintDataFormState>(
    key: K,
    value: SprintDataFormState[K],
  ): void {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setError(null);
    setSuccess(null);
  }

  function updateEditField<K extends keyof SprintDataEditFormState>(
    key: K,
    value: SprintDataEditFormState[K],
  ): void {
    setEditForm((current) => ({
      ...current,
      [key]: value,
    }));
    setError(null);
    setSuccess(null);
  }

  function openEditDialog(sprint: SprintContextRow): void {
    setEditingSprint(sprint);
    setEditForm(sprintToEditForm(sprint));
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (
      !form.year ||
      !form.quarter ||
      !form.sprintNumber ||
      !form.startDate ||
      !form.endDate ||
      !form.month
    ) {
      setError("All fields are required.");
      return;
    }

    if (!currentSprint?.project_id) {
      setError("Unable to create sprint data without a project context.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const sprintName = buildSprintName(form);
      const row: SprintInsertRow = {
        project_id: currentSprint.project_id,
        name: sprintName,
        sprint_number: Number(form.sprintNumber),
        start_date: form.startDate,
        end_date: form.endDate,
        month: Number(form.month),
        total_planned_points: 0,
        total_completed_points: 0,
        status: "planning",
        is_current: 0,
      };

      const [createdSprint] = await insertSupabaseRows<SprintContextRow, SprintInsertRow>(
        "sprints",
        row,
        "id,project_id,name,sprint_number,start_date,end_date,month,status,is_current",
      );

      if (createdSprint) {
        setSprints((current) =>
          [createdSprint, ...current].sort((a, b) =>
            b.start_date.localeCompare(a.start_date),
          ),
        );
      }

      setSuccess(`Sprint data created for ${sprintName}.`);
      setForm(buildDefaultForm(currentSprint));
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Unable to create sprint data."));
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!editingSprint) return;

    if (
      !editForm.year ||
      !editForm.quarter ||
      !editForm.sprintNumber ||
      !editForm.startDate ||
      !editForm.endDate ||
      !editForm.month ||
      !editForm.status
    ) {
      setError("All fields are required.");
      return;
    }

    setEditLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const row = buildSprintUpdateRow(editForm);
      const [updatedSprint] = await updateSupabaseRows<
        SprintContextRow,
        SprintUpdateRow
      >("sprints", row, {
        eq: { id: editingSprint.id },
        select: "id,project_id,name,sprint_number,start_date,end_date,month,status,is_current",
      });

      if (updatedSprint) {
        setSprints((current) =>
          current
            .map((sprint) => (sprint.id === updatedSprint.id ? updatedSprint : sprint))
            .sort((a, b) => b.start_date.localeCompare(a.start_date)),
        );
        if (isCurrentSprint(updatedSprint)) {
          setCurrentSprint(updatedSprint);
        }
      }

      setEditingSprint(null);
      setEditForm({ ...INITIAL_FORM, status: "planning" });
      setSuccess(`Updated sprint data for ${row.name}.`);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Unable to update sprint data."));
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete(sprint: SprintContextRow): Promise<void> {
    setDeletingId(sprint.id);
    setError(null);
    setSuccess(null);

    try {
      await deleteSupabaseRows<SprintContextRow>("sprints", {
        eq: { id: sprint.id },
        select: "id",
      });

      setSprints((current) => {
        const nextSprints = current.filter((currentSprint) => currentSprint.id !== sprint.id);
        const nextCurrentSprint = nextSprints.find(isCurrentSprint) ?? nextSprints[0] ?? null;
        setCurrentSprint(nextCurrentSprint);
        setForm(buildDefaultForm(nextCurrentSprint));
        return nextSprints;
      });
      setDeleteConfirmation(null);
      setSuccess(`Deleted sprint data for ${sprint.name}.`);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Unable to delete sprint data."));
    } finally {
      setDeletingId(null);
    }
  }

  const yearOptions = Array.from(new Set(sprints.map(getSprintYear)))
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => b - a);
  const quarterOptions = [1, 2, 3, 4];
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredSprints = sprints
    .filter((sprint) => {
      if (yearFilter !== "all" && getSprintYear(sprint) !== Number(yearFilter)) {
        return false;
      }

      if (quarterFilter !== "all" && getSprintQuarter(sprint) !== Number(quarterFilter)) {
        return false;
      }

      if (normalizedSearchQuery) {
        const searchableText = [
          sprint.name,
          String(getSprintYear(sprint)),
          `q${getSprintQuarter(sprint)}`,
          `quarter ${getSprintQuarter(sprint)}`,
          `sprint ${sprint.sprint_number}`,
          String(sprint.sprint_number),
          MONTH_OPTIONS.find((month) => month.value === sprint.month)?.label,
          String(sprint.month ?? ""),
          sprint.status ?? "planning",
          isCurrentSprint(sprint) ? "current" : "not current",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(normalizedSearchQuery)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      const valueA =
        sortBy === "date"
          ? parseDateOnly(a.start_date).getTime()
          : sortBy === "year"
            ? getSprintYear(a)
            : sortBy === "quarter"
              ? getSprintQuarter(a)
              : a.sprint_number;
      const valueB =
        sortBy === "date"
          ? parseDateOnly(b.start_date).getTime()
          : sortBy === "year"
            ? getSprintYear(b)
            : sortBy === "quarter"
              ? getSprintQuarter(b)
              : b.sprint_number;

      if (valueA === valueB) return b.start_date.localeCompare(a.start_date);
      return (valueA - valueB) * direction;
    });
  const totalPages = Math.max(1, Math.ceil(filteredSprints.length / SPRINTS_PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const pageStartIndex = (activePage - 1) * SPRINTS_PAGE_SIZE;
  const paginatedSprints = filteredSprints.slice(
    pageStartIndex,
    pageStartIndex + SPRINTS_PAGE_SIZE,
  );
  const pageEndIndex = Math.min(pageStartIndex + SPRINTS_PAGE_SIZE, filteredSprints.length);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="requirements-data-page sprint-data-page">
      <Title
        eyebrow="Admin"
        title="Sprint Data"
        subtitle="Create sprint rows without changing the current sprint or syncing Trello data."
        align="left"
      />

      <Card className="requirements-data-card">
        <form className="requirements-data-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="requirements-data-grid">
            <label className="requirements-data-field">
              <span>Year</span>
              <input
                disabled={loading || saving}
                min="2000"
                onChange={(event) => updateField("year", event.target.value)}
                required
                type="number"
                value={form.year}
              />
            </label>

            <label className="requirements-data-field">
              <span>Quarter</span>
              <div className="requirements-data-select-wrap">
                <select
                  disabled={loading || saving}
                  onChange={(event) => updateField("quarter", event.target.value)}
                  required
                  value={form.quarter}
                >
                  {[1, 2, 3, 4].map((quarter) => (
                    <option key={quarter} value={quarter}>
                      Q{quarter}
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
              <span>Sprint</span>
              <div className="requirements-data-select-wrap">
                <select
                  disabled={loading || saving}
                  onChange={(event) => updateField("sprintNumber", event.target.value)}
                  required
                  value={form.sprintNumber}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((sprintNumber) => (
                    <option key={sprintNumber} value={sprintNumber}>
                      Sprint {sprintNumber}
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
              <span>Month</span>
              <div className="requirements-data-select-wrap">
                <select
                  disabled={loading || saving}
                  onChange={(event) => updateField("month", event.target.value)}
                  required
                  value={form.month}
                >
                  {MONTH_OPTIONS.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
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
              <span>Start Date</span>
              <ThemedDatePicker
                disabled={loading || saving}
                onChange={(value) => updateField("startDate", value)}
                value={form.startDate}
              />
            </label>

            <label className="requirements-data-field">
              <span>End Date</span>
              <ThemedDatePicker
                disabled={loading || saving}
                min={form.startDate}
                onChange={(value) => updateField("endDate", value)}
                value={form.endDate}
              />
            </label>
          </div>

          <div className="requirements-data-actions">
            <button
              className="requirements-data-submit"
              disabled={loading || saving}
              type="submit"
            >
              {saving ? (
                <>
                  <span
                    className="requirements-data-loader"
                    style={{ borderTopColor: Palette.cyan }}
                  />
                  Creating
                </>
              ) : (
                "Create Sprint"
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
            <div className="requirements-data-kicker">Sprint Table</div>
            <h3>All Sprints</h3>
          </div>
          <div className="requirements-data-table-tools">
            <label className="requirements-data-filter-field">
              <span>Search</span>
              <input
                aria-label="Search sprints"
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search sprint data"
                type="text"
                value={searchQuery}
              />
            </label>
            <label className="requirements-data-filter-field">
              <span>Year</span>
              <div className="requirements-data-select-wrap">
                <select
                  onChange={(event) => {
                    setYearFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                  value={yearFilter}
                >
                  <option value="all">All Years</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <svg aria-hidden="true" className="requirements-data-select-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
                </svg>
              </div>
            </label>
            <label className="requirements-data-filter-field">
              <span>Quarter</span>
              <div className="requirements-data-select-wrap">
                <select
                  onChange={(event) => {
                    setQuarterFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                  value={quarterFilter}
                >
                  <option value="all">All Quarters</option>
                  {quarterOptions.map((quarter) => (
                    <option key={quarter} value={quarter}>
                      Q{quarter}
                    </option>
                  ))}
                </select>
                <svg aria-hidden="true" className="requirements-data-select-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
                </svg>
              </div>
            </label>
            <label className="requirements-data-filter-field">
              <span>Sort By</span>
              <div className="requirements-data-select-wrap">
                <select
                  onChange={(event) => {
                    setSortBy(event.target.value as SprintDataSortKey);
                    setCurrentPage(1);
                  }}
                  value={sortBy}
                >
                  <option value="date">Date</option>
                  <option value="sprint">Sprint</option>
                  <option value="quarter">Quarter</option>
                  <option value="year">Year</option>
                </select>
                <svg aria-hidden="true" className="requirements-data-select-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
                </svg>
              </div>
            </label>
            <label className="requirements-data-filter-field">
              <span>Order</span>
              <div className="requirements-data-select-wrap">
                <select
                  onChange={(event) => {
                    setSortDirection(event.target.value as SprintDataSortDirection);
                    setCurrentPage(1);
                  }}
                  value={sortDirection}
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
                <svg aria-hidden="true" className="requirements-data-select-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
                </svg>
              </div>
            </label>
            <span>{filteredSprints.length} records</span>
          </div>
        </div>

        {loading ? (
          <div className="requirements-data-empty">Loading sprints...</div>
        ) : filteredSprints.length === 0 ? (
          <div className="requirements-data-empty">No Data Found</div>
        ) : (
          <>
          <div className="requirements-data-table-wrap">
            <table className="requirements-data-table sprint-data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Year</th>
                  <th>Quarter</th>
                  <th>Sprint</th>
                  <th>Month</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                  <th>Current</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSprints.map((sprint) => (
                  <tr key={sprint.id}>
                    <td data-label="Name">{sprint.name}</td>
                    <td data-label="Year">{getSprintYear(sprint)}</td>
                    <td data-label="Quarter">Q{getSprintQuarter(sprint)}</td>
                    <td data-label="Sprint">Sprint {sprint.sprint_number}</td>
                    <td data-label="Month">
                      {MONTH_OPTIONS.find((month) => month.value === sprint.month)?.label ??
                        sprint.month ??
                        "-"}
                    </td>
                    <td data-label="Start Date">{formatSprintDate(sprint.start_date)}</td>
                    <td data-label="End Date">{formatSprintDate(sprint.end_date)}</td>
                    <td data-label="Status">
                      <span className="requirements-data-level requirements-data-level--middle">
                        {sprint.status ?? "planning"}
                      </span>
                    </td>
                    <td data-label="Current">{isCurrentSprint(sprint) ? "Yes" : "No"}</td>
                    <td data-label="Actions">
                      <div className="requirements-data-row-actions">
                        <button
                          aria-label={`Edit ${sprint.name}`}
                          className="requirements-data-row-button"
                          onClick={() => openEditDialog(sprint)}
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
                          aria-label={`Delete ${sprint.name}`}
                          className="requirements-data-row-button is-danger"
                          disabled={deletingId === sprint.id}
                          onClick={() => {
                            setDeleteConfirmation(sprint);
                            setError(null);
                            setSuccess(null);
                          }}
                          title="Delete"
                          type="button"
                        >
                          {deletingId === sprint.id ? (
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
              Showing {pageStartIndex + 1}-{pageEndIndex} of {filteredSprints.length}
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
                  border: `1px solid ${activePage === 1 ? Border.default : Border.hoverSoft}`,
                  background: activePage === 1 ? "transparent" : Background.sortActive,
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
                      border: `1px solid ${isActive ? Palette.cyan : Border.default}`,
                      background: isActive ? Background.sortActive : "transparent",
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
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={activePage === totalPages}
                style={{
                  padding: "4px 10px",
                  borderRadius: 99,
                  border: `1px solid ${
                    activePage === totalPages ? Border.default : Border.hoverSoft
                  }`,
                  background:
                    activePage === totalPages ? "transparent" : Background.sortActive,
                  color: activePage === totalPages ? Text.faint : Palette.cyan,
                  fontFamily: "'DM Mono',monospace",
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: activePage === totalPages ? "not-allowed" : "pointer",
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

      {editingSprint ? (
        <div className="requirements-data-modal-backdrop" role="presentation">
          <div
            aria-labelledby="sprint-data-edit-title"
            aria-modal="true"
            className="requirements-data-modal"
            role="dialog"
          >
            <div className="requirements-data-modal-header">
              <div>
                <div className="requirements-data-kicker">Edit Sprint</div>
                <h3 id="sprint-data-edit-title">{editingSprint.name}</h3>
              </div>
              <button
                className="requirements-data-modal-close"
                onClick={() => setEditingSprint(null)}
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
                  <span>Year</span>
                  <input
                    min="2000"
                    onChange={(event) => updateEditField("year", event.target.value)}
                    required
                    type="number"
                    value={editForm.year}
                  />
                </label>

                <label className="requirements-data-field">
                  <span>Quarter</span>
                  <div className="requirements-data-select-wrap">
                    <select
                      onChange={(event) => updateEditField("quarter", event.target.value)}
                      required
                      value={editForm.quarter}
                    >
                      {[1, 2, 3, 4].map((quarter) => (
                        <option key={quarter} value={quarter}>
                          Q{quarter}
                        </option>
                      ))}
                    </select>
                    <svg aria-hidden="true" className="requirements-data-select-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
                    </svg>
                  </div>
                </label>

                <label className="requirements-data-field">
                  <span>Sprint</span>
                  <div className="requirements-data-select-wrap">
                    <select
                      onChange={(event) => updateEditField("sprintNumber", event.target.value)}
                      required
                      value={editForm.sprintNumber}
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((sprintNumber) => (
                        <option key={sprintNumber} value={sprintNumber}>
                          Sprint {sprintNumber}
                        </option>
                      ))}
                    </select>
                    <svg aria-hidden="true" className="requirements-data-select-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
                    </svg>
                  </div>
                </label>

                <label className="requirements-data-field">
                  <span>Month</span>
                  <div className="requirements-data-select-wrap">
                    <select
                      onChange={(event) => updateEditField("month", event.target.value)}
                      required
                      value={editForm.month}
                    >
                      {MONTH_OPTIONS.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                    <svg aria-hidden="true" className="requirements-data-select-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
                    </svg>
                  </div>
                </label>

                <label className="requirements-data-field">
                  <span>Start Date</span>
                  <ThemedDatePicker
                    disabled={editLoading}
                    onChange={(value) => updateEditField("startDate", value)}
                    value={editForm.startDate}
                  />
                </label>

                <label className="requirements-data-field">
                  <span>End Date</span>
                  <ThemedDatePicker
                    disabled={editLoading}
                    min={editForm.startDate}
                    onChange={(value) => updateEditField("endDate", value)}
                    value={editForm.endDate}
                  />
                </label>

                <label className="requirements-data-field">
                  <span>Status</span>
                  <div className="requirements-data-select-wrap">
                    <select
                      onChange={(event) => updateEditField("status", event.target.value)}
                      required
                      value={editForm.status}
                    >
                      {SPRINT_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <svg aria-hidden="true" className="requirements-data-select-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
                    </svg>
                  </div>
                </label>
              </div>

              <div className="requirements-data-actions requirements-data-modal-actions">
                <button
                  className="requirements-data-cancel-button"
                  onClick={() => setEditingSprint(null)}
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
            aria-labelledby="sprint-data-delete-title"
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
                  id="sprint-data-delete-title"
                >
                  Delete Sprint
                </h2>
              </div>
            </div>

            <p className="requirements-data-confirmation-message">
              This will permanently delete this sprint data. This action cannot be
              undone.
            </p>

            <div className="requirements-data-confirmation-details">
              <span>Sprint</span>
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
