import { Fragment, useEffect, useState } from "react";
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
import {
  getSprintListingYear,
  getSprintQuarterGroupLabel,
} from "@/lib/utils";
import { Background, Border, Palette, Text } from "@/lib/theme";
import "@/assets/styles/RequirementsData.page.css";
import "@/assets/styles/SprintGroupedSelect.css";

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
  sprint_year?: number | null;
  sprint_quarter?: number | null;
  sprint_month?: number | null;
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

const SPRINTS_PAGE_SIZE_OPTIONS = ["10", "20", "30", "all"] as const;
const DEFAULT_SPRINTS_PAGE_SIZE = "10";
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

function isActiveSprint(sprint: SprintContextRow): boolean {
  return (sprint.status ?? "planning") === "active";
}

function isNonDeletableSprint(sprint: SprintContextRow): boolean {
  return isCurrentSprint(sprint) || isActiveSprint(sprint);
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
  if (sprint.sprint_year !== null && sprint.sprint_year !== undefined) {
    return Number(sprint.sprint_year);
  }

  const yearFromName = sprint.name.match(/^(\d{4})\b/u)?.[1];
  if (yearFromName) return Number(yearFromName);
  return parseDateOnly(sprint.start_date).getUTCFullYear();
}

function getSprintQuarter(sprint: SprintContextRow): number {
  if (sprint.sprint_quarter !== null && sprint.sprint_quarter !== undefined) {
    return Number(sprint.sprint_quarter);
  }

  const quarterFromName = sprint.name.match(/\bQ([1-4])\b/iu)?.[1];
  if (quarterFromName) return Number(quarterFromName);
  return getQuarterFromDate(parseDateOnly(sprint.start_date));
}

function parseSprintPeriodFromName(name: string): {
  year: number | null;
  quarter: number | null;
} {
  const yearFromName = name.match(/^(\d{4})\b/u)?.[1];
  const quarterFromName = name.match(/\bQ([1-4])\b/iu)?.[1];

  return {
    year: yearFromName ? Number(yearFromName) : null,
    quarter: quarterFromName ? Number(quarterFromName) : null,
  };
}

function getSprintPeriodFromRow(sprint: SprintContextRow): {
  year: number | null;
  quarter: number | null;
} {
  const year =
    sprint.sprint_year !== null && sprint.sprint_year !== undefined
      ? Number(sprint.sprint_year)
      : null;
  const quarter =
    sprint.sprint_quarter !== null && sprint.sprint_quarter !== undefined
      ? Number(sprint.sprint_quarter)
      : null;

  if (year !== null && quarter !== null) {
    return { year, quarter };
  }

  return parseSprintPeriodFromName(sprint.name);
}

function getSprintPeriodFromForm(form: SprintDataFormState): {
  year: number;
  quarter: number;
} {
  const fromName = parseSprintPeriodFromName(buildSprintName(form));

  return {
    year: fromName.year ?? Number(form.year),
    quarter: fromName.quarter ?? Number(form.quarter),
  };
}

function findConflictingSprint(
  sprints: SprintContextRow[],
  projectId: string,
  year: number,
  quarter: number,
  sprintNumber: number,
  excludeSprintId?: string,
): SprintContextRow | null {
  return (
    sprints.find((sprint) => {
      if (excludeSprintId && sprint.id === excludeSprintId) {
        return false;
      }

      if (sprint.project_id !== projectId) {
        return false;
      }

      const period = getSprintPeriodFromRow(sprint);
      if (period.year === null || period.quarter === null) {
        return false;
      }

      return (
        period.year === year &&
        period.quarter === quarter &&
        sprint.sprint_number === sprintNumber
      );
    }) ?? null
  );
}

function formatSprintDuplicateError(
  conflictingSprint: SprintContextRow,
  year: number,
  quarter: number,
  sprintNumber: number,
): string {
  return `Sprint ${sprintNumber} already exists for ${year} Q${quarter} (${conflictingSprint.name}, ${formatSprintDate(conflictingSprint.start_date)} - ${formatSprintDate(conflictingSprint.end_date)}).`;
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

  if (error && typeof error === "object") {
    const { message, details, hint } = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
    };

    return (
      [message, details, hint]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .join(" ") || fallback
    );
  }

  return fallback;
}

function getSprintDeleteErrorMessage(error: unknown, fallback: string): string {
  const message = getErrorMessage(error, fallback);

  if (message.includes("foreign key") || message.includes("violates")) {
    return "Unable to delete this sprint because related tasks or records still reference it.";
  }

  return message;
}

function getSprintSaveErrorMessage(
  error: unknown,
  fallback: string,
  sprints: SprintContextRow[],
  projectId: string,
  year: number,
  quarter: number,
  sprintNumber: number,
  excludeSprintId?: string,
): string {
  const message = getErrorMessage(error, fallback);

  if (
    message.includes("uq_sprint_number_per_project_period") ||
    message.includes("uq_sprint_number_per_project_year")
  ) {
    const conflictingSprint = findConflictingSprint(
      sprints,
      projectId,
      year,
      quarter,
      sprintNumber,
      excludeSprintId,
    );

    if (conflictingSprint) {
      return formatSprintDuplicateError(
        conflictingSprint,
        year,
        quarter,
        sprintNumber,
      );
    }

    return `Sprint ${sprintNumber} already exists for ${year} Q${quarter}.`;
  }

  return message;
}

function sprintDateRangesOverlap(
  startDateA: string,
  endDateA: string,
  startDateB: string,
  endDateB: string,
): boolean {
  const rangeAStart = parseDateOnly(startDateA).getTime();
  const rangeAEnd = parseDateOnly(endDateA).getTime();
  const rangeBStart = parseDateOnly(startDateB).getTime();
  const rangeBEnd = parseDateOnly(endDateB).getTime();

  return rangeAStart <= rangeBEnd && rangeAEnd >= rangeBStart;
}

function findOverlappingSprint(
  startDate: string,
  endDate: string,
  existingSprints: SprintContextRow[],
  excludeSprintId?: string,
): SprintContextRow | null {
  return (
    existingSprints.find((sprint) => {
      if (excludeSprintId && sprint.id === excludeSprintId) {
        return false;
      }

      return sprintDateRangesOverlap(
        startDate,
        endDate,
        sprint.start_date,
        sprint.end_date,
      );
    }) ?? null
  );
}

function getSprintDateOverlapError(
  startDate: string,
  endDate: string,
  existingSprints: SprintContextRow[],
  excludeSprintId?: string,
): string | null {
  if (parseDateOnly(startDate).getTime() > parseDateOnly(endDate).getTime()) {
    return "End date must be on or after the start date.";
  }

  const overlappingSprint = findOverlappingSprint(
    startDate,
    endDate,
    existingSprints,
    excludeSprintId,
  );

  if (!overlappingSprint) {
    return null;
  }

  return `Sprint dates overlap with ${overlappingSprint.name} (${formatSprintDate(overlappingSprint.start_date)} - ${formatSprintDate(overlappingSprint.end_date)}).`;
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
  const [pageSize, setPageSize] = useState<string>(DEFAULT_SPRINTS_PAGE_SIZE);
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
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSprints(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const sprints = await getSupabaseRows<SprintContextRow>("sprints", {
          select:
            "id,project_id,name,sprint_number,sprint_year,sprint_quarter,sprint_month,start_date,end_date,month,status,is_current",
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

    const dateOverlapError = getSprintDateOverlapError(
      form.startDate,
      form.endDate,
      sprints,
    );
    if (dateOverlapError) {
      setError(dateOverlapError);
      return;
    }

    const sprintPeriod = getSprintPeriodFromForm(form);
    const sprintNumber = Number(form.sprintNumber);
    const sprintMonth = Number(form.month);
    const conflictingSprint = findConflictingSprint(
      sprints,
      currentSprint.project_id,
      sprintPeriod.year,
      sprintPeriod.quarter,
      sprintNumber,
    );

    if (conflictingSprint) {
      setError(
        formatSprintDuplicateError(
          conflictingSprint,
          sprintPeriod.year,
          sprintPeriod.quarter,
          sprintNumber,
        ),
      );
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
        sprint_number: sprintNumber,
        start_date: form.startDate,
        end_date: form.endDate,
        month: sprintMonth,
        total_planned_points: 0,
        total_completed_points: 0,
        status: "planning",
        is_current: 0,
      };

      const [createdSprint] = await insertSupabaseRows<SprintContextRow, SprintInsertRow>(
        "sprints",
        row,
        "id,project_id,name,sprint_number,sprint_year,sprint_quarter,sprint_month,start_date,end_date,month,status,is_current",
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
      setError(
        getSprintSaveErrorMessage(
          submitError,
          "Unable to create sprint data.",
          sprints,
          currentSprint.project_id,
          sprintPeriod.year,
          sprintPeriod.quarter,
          sprintNumber,
        ),
      );
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

    const dateOverlapError = getSprintDateOverlapError(
      editForm.startDate,
      editForm.endDate,
      sprints,
      editingSprint.id,
    );
    if (dateOverlapError) {
      setError(dateOverlapError);
      return;
    }

    const sprintPeriod = getSprintPeriodFromForm(editForm);
    const sprintNumber = Number(editForm.sprintNumber);
    const conflictingSprint = findConflictingSprint(
      sprints,
      editingSprint.project_id,
      sprintPeriod.year,
      sprintPeriod.quarter,
      sprintNumber,
      editingSprint.id,
    );

    if (conflictingSprint) {
      setError(
        formatSprintDuplicateError(
          conflictingSprint,
          sprintPeriod.year,
          sprintPeriod.quarter,
          sprintNumber,
        ),
      );
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
        select:
          "id,project_id,name,sprint_number,sprint_year,sprint_quarter,sprint_month,start_date,end_date,month,status,is_current",
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
      setError(
        getSprintSaveErrorMessage(
          submitError,
          "Unable to update sprint data.",
          sprints,
          editingSprint.project_id,
          sprintPeriod.year,
          sprintPeriod.quarter,
          sprintNumber,
          editingSprint.id,
        ),
      );
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete(sprint: SprintContextRow): Promise<void> {
    if (isNonDeletableSprint(sprint)) {
      setDeleteError("The current or active sprint cannot be deleted.");
      return;
    }

    setDeletingId(sprint.id);
    setDeleteError(null);
    setError(null);
    setSuccess(null);

    try {
      const deletedRows = await deleteSupabaseRows<SprintContextRow>("sprints", {
        eq: { id: sprint.id },
        select: "id",
      });

      if (deletedRows.length === 0) {
        throw new Error(
          "Sprint was not deleted. You may not have permission, or the sprint is protected.",
        );
      }

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
      setDeleteError(
        getSprintDeleteErrorMessage(deleteError, "Unable to delete sprint data."),
      );
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
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
  const resolvedPageSize =
    pageSize === "all"
      ? Math.max(filteredSprints.length, 1)
      : Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(filteredSprints.length / resolvedPageSize));
  const activePage = Math.min(currentPage, totalPages);
  const pageStartIndex = (activePage - 1) * resolvedPageSize;
  const paginatedSprints = filteredSprints.slice(
    pageStartIndex,
    pageStartIndex + resolvedPageSize,
  );
  const pageEndIndex = Math.min(
    pageStartIndex + resolvedPageSize,
    filteredSprints.length,
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages, pageSize]);

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
              <span>Show</span>
              <div className="requirements-data-select-wrap">
                <select
                  onChange={(event) => {
                    setPageSize(event.target.value);
                    setCurrentPage(1);
                  }}
                  value={pageSize}
                >
                  {SPRINTS_PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === "all" ? "All" : option}
                    </option>
                  ))}
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
                {paginatedSprints.map((sprint, index) => {
                  const canDeleteSprint = !isNonDeletableSprint(sprint);
                  const quarter = getSprintQuarter(sprint);
                  const previousSprint =
                    index > 0 ? paginatedSprints[index - 1] : null;
                  const showQuarterHeader =
                    !previousSprint ||
                    getSprintListingYear(previousSprint) !==
                      getSprintListingYear(sprint) ||
                    getSprintQuarter(previousSprint) !== quarter;

                  return (
                    <Fragment key={sprint.id}>
                      {showQuarterHeader ? (
                        <tr className="sprint-data-quarter-header">
                          <td colSpan={10}>
                            {getSprintQuarterGroupLabel(
                              getSprintListingYear(sprint),
                              quarter,
                            )}
                          </td>
                        </tr>
                      ) : null}
                      <tr className="sprint-data-quarter-row">
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
                          disabled={!canDeleteSprint || deletingId === sprint.id}
                          onClick={() => {
                            if (!canDeleteSprint) return;
                            setDeleteConfirmation(sprint);
                            setDeleteError(null);
                            setError(null);
                            setSuccess(null);
                          }}
                          title={
                            canDeleteSprint
                              ? "Delete"
                              : "Current and active sprints cannot be deleted"
                          }
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
                    </Fragment>
                  );
                })}
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

            {deleteError ? (
              <div className="requirements-data-message is-error">{deleteError}</div>
            ) : null}

            <div className="requirements-data-confirmation-actions">
              <button
                className="requirements-data-confirmation-button requirements-data-confirmation-button--secondary"
                disabled={Boolean(deletingId)}
                onClick={() => {
                  setDeleteConfirmation(null);
                  setDeleteError(null);
                }}
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
