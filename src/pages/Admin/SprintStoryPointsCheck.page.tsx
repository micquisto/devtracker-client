import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { Card } from "@/components/shared/Containers";
import { ThemedDatePicker } from "@/components/shared/Elements";
import { Title } from "@/components/shared/page";
import { getSupabaseRows, insertSupabaseRows } from "@/lib/supabase";
import { compareMembersByLastName } from "@/lib/utils";
import { SprintGroupedSelectOptions } from "@/components/scrum/sprint/SprintGroupedSelect";
import { getMemberColor, getMemberInitials } from "@/lib/utils/memberColors.utils";
import "@/assets/styles/SprintGroupedSelect.css";
import "@/assets/styles/RequirementsData.page.css";

type SprintOptionRow = {
  id: string;
  project_id: string | null;
  name: string | null;
  sprint_number: number | null;
  start_date: string | null;
  sprint_year: number | null;
  sprint_quarter: number | null;
  sprint_month: number | null;
  month: number | null;
  is_current: number | boolean | null;
};

type NewSprintFormState = {
  year: string;
  quarter: string;
  month: string;
  sprintNumber: string;
  startDate: string;
  endDate: string;
  name: string;
  projectId: string;
};

type NewSprintInsertRow = {
  project_id: string;
  name: string;
  sprint_number: number;
  month: number;
  start_date: string;
  end_date: string;
  status: "completed";
  is_current: 0;
  total_planned_points: number;
  total_completed_points: number;
};

type SprintStoryPointRow = {
  model: "sprint" | "member" | "project_type";
  model_id: string;
  project: string | null;
  points: number | null;
  real_points: number | null;
};

type SprintStoryPointInsertRow = {
  sprint_id: string;
  model: "sprint" | "member" | "project_type";
  model_id: string;
  project: string;
  points: number;
  real_points: number;
};

type MemberRow = {
  id: string;
  trello_username: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type ProjectRow = {
  id: string;
  name: string;
};

type ProjectTypeRow = {
  id: string;
  name: string;
};

type StoryPointLine = {
  label: string;
  points: number;
  realPoints: number;
};

type StoryPointGroup = {
  id: string;
  label: string;
  lines: StoryPointLine[];
  totalPoints: number;
  totalRealPoints: number;
};

type SprintModelAddFormState = {
  project: string;
  points: string;
  realPoints: string;
};

type MemberModelAddFormState = {
  memberId: string;
  project: string;
  points: string;
  realPoints: string;
};

type ProjectTypeModelAddFormState = {
  project: string;
  projectTypeId: string;
  points: string;
  realPoints: string;
};

const EMPTY_SPRINT_ADD_FORM: SprintModelAddFormState = {
  project: "",
  points: "",
  realPoints: "",
};

const EMPTY_MEMBER_ADD_FORM: MemberModelAddFormState = {
  memberId: "",
  project: "",
  points: "",
  realPoints: "",
};

const EMPTY_PROJECT_TYPE_ADD_FORM: ProjectTypeModelAddFormState = {
  project: "",
  projectTypeId: "",
  points: "",
  realPoints: "",
};

const DEFAULT_PROJECT_NAME = "All DevDenPH";
const CURRENT_CALENDAR_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: 11 },
  (_, index) => CURRENT_CALENDAR_YEAR - index,
);
const QUARTER_OPTIONS = [1, 2, 3, 4] as const;
const ALL_SPRINT_NUMBERS = [1, 2, 3, 4, 5, 6, 7] as const;
const MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
] as const;

function getMonthOptionsForQuarter(quarter: string | number) {
  const parsedQuarter = Number(quarter);
  if (!Number.isFinite(parsedQuarter) || parsedQuarter < 1 || parsedQuarter > 4) {
    return [...MONTH_OPTIONS];
  }

  const startMonth = (parsedQuarter - 1) * 3 + 1;
  return MONTH_OPTIONS.filter(
    (month) => month.value >= startMonth && month.value < startMonth + 3,
  );
}

function normalizeMonthForQuarter(month: string, quarter: string): string {
  const monthOptions = getMonthOptionsForQuarter(quarter);
  if (monthOptions.some((option) => String(option.value) === month)) {
    return month;
  }

  return String(monthOptions[0]?.value ?? 1);
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

function getSprintSaveErrorMessage(error: unknown): string {
  const message = getErrorMessage(error, "Unable to add sprint.");
  if (message.includes("uq_sprint_number_per_project_period")) {
    return "A sprint with this number already exists for the selected year and quarter.";
  }

  if (message.includes("uq_sprint_number_per_project_year")) {
    return "Sprint number already exists for this project and year. Run the latest database migration to allow the same sprint number in different quarters and months.";
  }

  return message;
}

function buildSprintName(year: string, quarter: string, sprintNumber: string): string {
  return `${year} Q${quarter} Sprint ${sprintNumber}`;
}

function getSprintNumberValue(sprint: SprintOptionRow): number | null {
  if (sprint.sprint_number === null || sprint.sprint_number === undefined) {
    return null;
  }

  const sprintNumber = Number(sprint.sprint_number);
  return Number.isFinite(sprintNumber) ? sprintNumber : null;
}

function isCurrentSprint(sprint: SprintOptionRow): boolean {
  return sprint.is_current === 1 || sprint.is_current === true;
}

function getSprintRowMonthValue(sprint: SprintOptionRow): number | null {
  if (sprint.sprint_month !== null && sprint.sprint_month !== undefined) {
    return Number(sprint.sprint_month);
  }

  if (sprint.month !== null && sprint.month !== undefined) {
    return Number(sprint.month);
  }

  return null;
}

function parseDateOnly(dateValue: string): Date {
  return new Date(`${dateValue}T00:00:00Z`);
}

function getSprintYearQuarterFromRow(sprint: SprintOptionRow): {
  year: number | null;
  quarter: number | null;
} {
  let year =
    sprint.sprint_year !== null && sprint.sprint_year !== undefined
      ? Number(sprint.sprint_year)
      : null;
  let quarter =
    sprint.sprint_quarter !== null && sprint.sprint_quarter !== undefined
      ? Number(sprint.sprint_quarter)
      : null;
  const month = getSprintRowMonthValue(sprint);

  if (sprint.start_date) {
    const startDate = parseDateOnly(sprint.start_date);
    year ??= startDate.getUTCFullYear();
    quarter ??= Math.floor(startDate.getUTCMonth() / 3) + 1;
  }

  if (quarter === null && month !== null) {
    quarter = Math.floor((month - 1) / 3) + 1;
  }

  if (year === null) {
    const yearFromName = sprint.name?.match(/^(\d{4})\b/u)?.[1];
    if (yearFromName) year = Number(yearFromName);
  }

  if (quarter === null) {
    const quarterFromName = sprint.name?.match(/\bQ([1-4])\b/iu)?.[1];
    if (quarterFromName) quarter = Number(quarterFromName);
  }

  return { year, quarter };
}

function sprintRowMatchesFormYearQuarter(
  sprint: SprintOptionRow,
  projectId: string,
  year: number,
  quarter: number,
  sprintNumber: number,
): boolean {
  if (!projectId || sprint.project_id !== projectId) {
    return false;
  }

  const period = getSprintYearQuarterFromRow(sprint);
  const rowNumber = getSprintNumberValue(sprint);

  if (period.year === null || period.quarter === null || rowNumber === null) {
    return false;
  }

  return (
    period.year === year &&
    period.quarter === quarter &&
    rowNumber === sprintNumber
  );
}

function sprintExistsForFormYearQuarterAndNumber(
  sprints: SprintOptionRow[],
  projectId: string,
  year: number,
  quarter: number,
  sprintNumber: number,
): boolean {
  return sprints.some((sprint) =>
    sprintRowMatchesFormYearQuarter(
      sprint,
      projectId,
      year,
      quarter,
      sprintNumber,
    ),
  );
}

function getAvailableSprintNumbers(
  sprints: SprintOptionRow[],
  projectId: string,
  year: string,
  quarter: string,
): number[] {
  const parsedFormYear = Number(year);
  const parsedQuarter = Number(quarter);

  if (
    !projectId ||
    !Number.isFinite(parsedFormYear) ||
    !Number.isFinite(parsedQuarter)
  ) {
    return [...ALL_SPRINT_NUMBERS];
  }

  return ALL_SPRINT_NUMBERS.filter(
    (sprintNumber) =>
      !sprintExistsForFormYearQuarterAndNumber(
        sprints,
        projectId,
        parsedFormYear,
        parsedQuarter,
        sprintNumber,
      ),
  );
}

function normalizeNewSprintForm(
  form: NewSprintFormState,
  sprints: SprintOptionRow[],
): NewSprintFormState {
  const month = normalizeMonthForQuarter(form.month, form.quarter);
  return applyAvailableSprintNumber({ ...form, month }, sprints);
}

function applyAvailableSprintNumber(
  form: NewSprintFormState,
  sprints: SprintOptionRow[],
): NewSprintFormState {
  const availableNumbers = getAvailableSprintNumbers(
    sprints,
    form.projectId,
    form.year,
    form.quarter,
  );

  if (availableNumbers.length === 0) {
    return { ...form, sprintNumber: "" };
  }

  if (availableNumbers.includes(Number(form.sprintNumber))) {
    return form;
  }

  return {
    ...form,
    sprintNumber: String(availableNumbers[0]),
  };
}

function getDefaultProjectId(projects: ProjectRow[]): string {
  const defaultProject = projects.find(
    (project) =>
      project.name.trim().toLowerCase() === DEFAULT_PROJECT_NAME.toLowerCase(),
  );

  return defaultProject?.id ?? projects[0]?.id ?? "";
}

function buildDefaultNewSprintForm(
  sprints: SprintOptionRow[],
  projects: ProjectRow[],
): NewSprintFormState {
  const year = String(CURRENT_CALENDAR_YEAR);
  const quarter = String(Math.floor(new Date().getMonth() / 3) + 1);
  const month = String(new Date().getMonth() + 1);
  const projectId = getDefaultProjectId(projects);
  const { start_date, end_date } = buildSprintDates(Number(year), Number(month));
  const availableSprintNumbers = getAvailableSprintNumbers(
    sprints,
    projectId,
    year,
    quarter,
  );
  const sprintNumber = String(availableSprintNumbers[0] ?? 1);

  return {
    year,
    quarter,
    month,
    sprintNumber,
    startDate: start_date,
    endDate: end_date,
    name: buildSprintName(year, quarter, sprintNumber),
    projectId,
  };
}

function buildSprintDates(year: number, month: number): {
  start_date: string;
  end_date: string;
} {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 13);

  return {
    start_date: startDate.toISOString().slice(0, 10),
    end_date: endDate.toISOString().slice(0, 10),
  };
}

function formatStoryPoints(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Number.isInteger(value)) return String(value);

  return value.toFixed(2).replace(/\.?0+$/, "");
}

function parseStoryPointInput(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;

  return Math.max(0, parsed);
}

function sumPoints(rows: StoryPointLine[], key: "points" | "realPoints"): number {
  return rows.reduce((sum, row) => sum + row[key], 0);
}

function getSprintOptionLabel(sprint: SprintOptionRow): string {
  return sprint.name?.trim() || `Sprint ${sprint.sprint_number ?? "?"}`;
}

function getMemberName(member: MemberRow): string {
  return (
    member.full_name ||
    [member.first_name, member.last_name].filter(Boolean).join(" ") ||
    "Unnamed member"
  );
}

function buildSprintModelSection(rows: SprintStoryPointRow[]): {
  lines: StoryPointLine[];
  totalPoints: number;
  totalRealPoints: number;
} {
  const lines = rows
    .map((row) => ({
      label: row.project?.trim() || "General",
      points: row.points ?? 0,
      realPoints: row.real_points ?? 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    lines,
    totalPoints: sumPoints(lines, "points"),
    totalRealPoints: sumPoints(lines, "realPoints"),
  };
}

function buildMemberModelSection(
  rows: SprintStoryPointRow[],
  memberLookup: Map<string, string>,
): {
  groups: StoryPointGroup[];
  totalPoints: number;
  totalRealPoints: number;
} {
  const rowsByMemberId = rows.reduce<Map<string, SprintStoryPointRow[]>>(
    (groups, row) => {
      const memberRows = groups.get(row.model_id) ?? [];
      memberRows.push(row);
      groups.set(row.model_id, memberRows);
      return groups;
    },
    new Map(),
  );

  const groups = Array.from(rowsByMemberId.entries())
    .map(([memberId, memberRows]) => {
      const lines = memberRows
        .map((row) => ({
          label: row.project?.trim() || "General",
          points: row.points ?? 0,
          realPoints: row.real_points ?? 0,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      return {
        id: memberId,
        label: memberLookup.get(memberId) ?? "Unknown member",
        lines,
        totalPoints: sumPoints(lines, "points"),
        totalRealPoints: sumPoints(lines, "realPoints"),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    groups,
    totalPoints: groups.reduce((sum, group) => sum + group.totalPoints, 0),
    totalRealPoints: groups.reduce((sum, group) => sum + group.totalRealPoints, 0),
  };
}

function buildProjectTypeModelSection(
  rows: SprintStoryPointRow[],
  projectTypeLookup: Map<string, string>,
): {
  groups: StoryPointGroup[];
  totalPoints: number;
  totalRealPoints: number;
} {
  const rowsByProject = rows.reduce<Map<string, SprintStoryPointRow[]>>(
    (groups, row) => {
      const projectName = row.project?.trim() || "General";
      const projectRows = groups.get(projectName) ?? [];
      projectRows.push(row);
      groups.set(projectName, projectRows);
      return groups;
    },
    new Map(),
  );

  const groups = Array.from(rowsByProject.entries())
    .map(([projectName, projectRows]) => {
      const lines = projectRows
        .map((row) => ({
          label: projectTypeLookup.get(row.model_id) ?? "Unknown project type",
          points: row.points ?? 0,
          realPoints: row.real_points ?? 0,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      return {
        id: projectName,
        label: projectName,
        lines,
        totalPoints: sumPoints(lines, "points"),
        totalRealPoints: sumPoints(lines, "realPoints"),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    groups,
    totalPoints: groups.reduce((sum, group) => sum + group.totalPoints, 0),
    totalRealPoints: groups.reduce((sum, group) => sum + group.totalRealPoints, 0),
  };
}

function StoryPointTable({
  lines,
  emptyMessage,
  total,
}: {
  lines: StoryPointLine[];
  emptyMessage: string;
  total?: {
    label: string;
    points: number;
    realPoints: number;
  };
}) {
  if (lines.length === 0 && !total) {
    return <p className="sprint-story-points-check-status">{emptyMessage}</p>;
  }

  return (
    <div className="sprint-story-points-check-table-wrap">
      <table className="sprint-story-points-check-table">
        <colgroup>
          <col className="col-name" />
          <col className="col-points" />
          <col className="col-real-points" />
        </colgroup>
        <thead>
          <tr>
            <th>Name</th>
            <th>Points</th>
            <th>Real Points</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={`${line.label}-${index}`}>
              <td>{line.label}</td>
              <td>{formatStoryPoints(line.points)}</td>
              <td>{formatStoryPoints(line.realPoints)}</td>
            </tr>
          ))}
        </tbody>
        {total ? (
          <tfoot>
            <tr>
              <td>{total.label}</td>
              <td>{formatStoryPoints(total.points)}</td>
              <td>{formatStoryPoints(total.realPoints)}</td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

function AddFormSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <label className="requirements-data-field sprint-story-points-check-add-field">
      <span>{label}</span>
      <div className="requirements-data-select-wrap">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="requirements-data-select-arrow">▾</span>
      </div>
    </label>
  );
}

function AddFormNumberInput({
  label,
  value,
  onChange,
  max,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <label className="requirements-data-field sprint-story-points-check-add-field">
      <span>
        {label}
        {max !== undefined ? ` (max ${formatStoryPoints(max)})` : ""}
      </span>
      <input
        type="number"
        min={0}
        max={max}
        step="any"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder="0"
      />
    </label>
  );
}

function MemberStoryPointGroup({
  group,
  member,
}: {
  group: StoryPointGroup;
  member: MemberRow | undefined;
}) {
  const memberColor = getMemberColor(member, group.label);
  const memberInitials = getMemberInitials(group.label);

  return (
    <div
      className="sprint-story-points-check-group is-member-group"
      style={{ "--member-color": memberColor } as CSSProperties}
    >
      <div className="sprint-story-points-check-member-header">
        <div
          className="sprint-story-points-check-member-avatar"
          style={{ background: memberColor }}
        >
          {memberInitials}
        </div>
        <h3 style={{ color: memberColor }}>{group.label}</h3>
      </div>
      <StoryPointTable
        lines={group.lines}
        emptyMessage="No project rows for this member."
        total={{
          label: `${group.label} Total`,
          points: group.totalPoints,
          realPoints: group.totalRealPoints,
        }}
      />
    </div>
  );
}

export default function SprintStoryPointsCheckPage() {
  const [sprints, setSprints] = useState<SprintOptionRow[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState("");
  const [storyPointRows, setStoryPointRows] = useState<SprintStoryPointRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSprintAddForm, setShowSprintAddForm] = useState(false);
  const [showMemberAddForm, setShowMemberAddForm] = useState(false);
  const [showProjectTypeAddForm, setShowProjectTypeAddForm] = useState(false);
  const [sprintAddForm, setSprintAddForm] = useState(EMPTY_SPRINT_ADD_FORM);
  const [memberAddForm, setMemberAddForm] = useState(EMPTY_MEMBER_ADD_FORM);
  const [projectTypeAddForm, setProjectTypeAddForm] = useState(
    EMPTY_PROJECT_TYPE_ADD_FORM,
  );
  const [savingSection, setSavingSection] = useState<
    "sprint" | "member" | "project_type" | null
  >(null);
  const [showNewSprintModal, setShowNewSprintModal] = useState(false);
  const [newSprintForm, setNewSprintForm] = useState<NewSprintFormState>(() =>
    buildDefaultNewSprintForm([], []),
  );
  const [newSprintNameEdited, setNewSprintNameEdited] = useState(false);
  const [newSprintDatesEdited, setNewSprintDatesEdited] = useState(false);
  const [savingNewSprint, setSavingNewSprint] = useState(false);

  const memberLookup = useMemo(
    () => new Map(members.map((member) => [member.id, getMemberName(member)])),
    [members],
  );

  const projectTypeLookup = useMemo(
    () => new Map(projectTypes.map((projectType) => [projectType.id, projectType.name])),
    [projectTypes],
  );

  const projectSelectOptions = useMemo(
    () =>
      projects
        .filter((project) => project.id && project.name.trim())
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((project) => ({
          value: project.id,
          label: project.name.trim(),
        })),
    [projects],
  );

  const availableNewSprintNumbers = useMemo(
    () =>
      getAvailableSprintNumbers(
        sprints,
        newSprintForm.projectId,
        newSprintForm.year,
        newSprintForm.quarter,
      ),
    [
      newSprintForm.projectId,
      newSprintForm.quarter,
      newSprintForm.year,
      sprints,
    ],
  );

  const newSprintMonthOptions = useMemo(
    () => getMonthOptionsForQuarter(newSprintForm.quarter),
    [newSprintForm.quarter],
  );

  const projectOptions = useMemo(
    () =>
      projects
        .map((project) => project.name.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ value: name, label: name })),
    [projects],
  );

  const memberOptions = useMemo(
    () =>
      [...members]
        .sort(compareMembersByLastName)
        .map((member) => ({
          value: member.id,
          label: getMemberName(member),
        })),
    [members],
  );

  const projectTypeOptions = useMemo(
    () =>
      [...projectTypes]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((projectType) => ({
          value: projectType.id,
          label: projectType.name,
        })),
    [projectTypes],
  );

  const reloadStoryPointRows = useCallback(async (sprintId: string) => {
    setLoadingRows(true);
    setError(null);

    try {
      const rows = await getSupabaseRows<SprintStoryPointRow>("sprint_story_points", {
        select: "model,model_id,project,points,real_points",
        eq: { sprint_id: sprintId },
        order: { column: "project", ascending: true },
      });

      setStoryPointRows(rows);
    } catch (loadError) {
      setStoryPointRows([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load sprint story points.",
      );
    } finally {
      setLoadingRows(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setLoading(true);
      setError(null);

      try {
        const [sprintRows, memberRows, projectRows, projectTypeRows] = await Promise.all([
          getSupabaseRows<SprintOptionRow>("sprints", {
            select:
              "id,project_id,name,sprint_number,start_date,sprint_year,sprint_quarter,sprint_month,month,is_current",
            order: { column: "start_date", ascending: false },
          }),
          getSupabaseRows<MemberRow>("members", {
            select: "id,trello_username,full_name,first_name,last_name",
          }),
          getSupabaseRows<ProjectRow>("projects", {
            select: "id,name",
            order: { column: "name", ascending: true },
          }),
          getSupabaseRows<ProjectTypeRow>("project_type", {
            select: "id,name",
          }),
        ]);

        if (cancelled) return;

        const currentSprint =
          sprintRows.find((sprint) => isCurrentSprint(sprint)) ?? sprintRows[0] ?? null;

        setSprints(sprintRows);
        setMembers(memberRows);
        setProjects(projectRows);
        setProjectTypes(projectTypeRows);
        setSelectedSprintId((current) => current || currentSprint?.id || "");
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load sprint story points check data.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedSprintId) {
      setStoryPointRows([]);
      return;
    }

    void reloadStoryPointRows(selectedSprintId);
  }, [reloadStoryPointRows, selectedSprintId]);

  const sprintModelSection = useMemo(
    () =>
      buildSprintModelSection(
        storyPointRows.filter((row) => row.model === "sprint"),
      ),
    [storyPointRows],
  );

  const memberModelSection = useMemo(
    () =>
      buildMemberModelSection(
        storyPointRows.filter((row) => row.model === "member"),
        memberLookup,
      ),
    [memberLookup, storyPointRows],
  );

  const projectTypeModelSection = useMemo(
    () =>
      buildProjectTypeModelSection(
        storyPointRows.filter((row) => row.model === "project_type"),
        projectTypeLookup,
      ),
    [projectTypeLookup, storyPointRows],
  );

  const sprintPointsMax = Math.max(
    0,
    sprintModelSection.totalPoints - memberModelSection.totalPoints,
  );
  const sprintRealPointsMax = Math.max(
    0,
    sprintModelSection.totalRealPoints - memberModelSection.totalRealPoints,
  );

  const selectedSprint = sprints.find((sprint) => sprint.id === selectedSprintId);
  const selectedSprintLabel = selectedSprint
    ? getSprintOptionLabel(selectedSprint)
    : "Select sprint";

  function openNewSprintModal(): void {
    setNewSprintForm(
      normalizeNewSprintForm(buildDefaultNewSprintForm(sprints, projects), sprints),
    );
    setNewSprintNameEdited(false);
    setNewSprintDatesEdited(false);
    setShowNewSprintModal(true);
    setError(null);
    setSuccess(null);
  }

  function closeNewSprintModal(): void {
    if (savingNewSprint) return;

    setShowNewSprintModal(false);
    setNewSprintNameEdited(false);
    setNewSprintDatesEdited(false);
  }

  function updateNewSprintForm(updates: Partial<NewSprintFormState>): void {
    setNewSprintForm((current) =>
      normalizeNewSprintForm({ ...current, ...updates }, sprints),
    );
  }

  useEffect(() => {
    if (!showNewSprintModal || newSprintNameEdited) return;

    setNewSprintForm((current) => ({
      ...current,
      name: buildSprintName(current.year, current.quarter, current.sprintNumber),
    }));
  }, [
    showNewSprintModal,
    newSprintForm.quarter,
    newSprintForm.sprintNumber,
    newSprintForm.year,
    newSprintNameEdited,
  ]);

  useEffect(() => {
    if (!showNewSprintModal || newSprintNameEdited) return;

    setNewSprintForm((current) => {
      const next = normalizeNewSprintForm(current, sprints);
      if (next.sprintNumber === current.sprintNumber) return current;

      return {
        ...next,
        name: buildSprintName(next.year, next.quarter, next.sprintNumber),
      };
    });
  }, [
    showNewSprintModal,
    newSprintForm.month,
    newSprintForm.quarter,
    newSprintForm.year,
    newSprintForm.projectId,
    newSprintNameEdited,
    sprints,
  ]);

  useEffect(() => {
    if (!showNewSprintModal || newSprintDatesEdited) return;

    setNewSprintForm((current) => {
      const parsedYear = Number(current.year);
      const parsedMonth = Number(current.month);

      if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth)) {
        return current;
      }

      const { start_date, end_date } = buildSprintDates(parsedYear, parsedMonth);

      if (current.startDate === start_date && current.endDate === end_date) {
        return current;
      }

      return {
        ...current,
        startDate: start_date,
        endDate: end_date,
      };
    });
  }, [
    newSprintDatesEdited,
    newSprintForm.month,
    newSprintForm.year,
    showNewSprintModal,
  ]);

  async function handleAddNewSprint(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!newSprintForm.projectId) {
      setError("Project is required.");
      return;
    }

    const sprintYear = Number(newSprintForm.year);
    const sprintQuarter = Number(newSprintForm.quarter);
    const sprintMonth = Number(newSprintForm.month);
    const sprintNumber = Number(newSprintForm.sprintNumber);
    const sprintName = newSprintForm.name.trim();
    const startDate = newSprintForm.startDate.trim();
    const endDate = newSprintForm.endDate.trim();

    if (
      !Number.isFinite(sprintYear) ||
      !Number.isFinite(sprintQuarter) ||
      !Number.isFinite(sprintMonth) ||
      !Number.isFinite(sprintNumber) ||
      !sprintName ||
      !startDate ||
      !endDate
    ) {
      setError("All sprint fields are required.");
      return;
    }

    if (endDate < startDate) {
      setError("End date must be on or after the start date.");
      return;
    }

    if (
      sprintExistsForFormYearQuarterAndNumber(
        sprints,
        newSprintForm.projectId,
        sprintYear,
        sprintQuarter,
        sprintNumber,
      )
    ) {
      setError(
        `Sprint ${sprintNumber} already exists for ${sprintYear} Q${sprintQuarter}.`,
      );
      return;
    }

    const insertRow: NewSprintInsertRow = {
      project_id: newSprintForm.projectId,
      name: sprintName,
      sprint_number: sprintNumber,
      month: sprintMonth,
      start_date: startDate,
      end_date: endDate,
      status: "completed",
      is_current: 0,
      total_planned_points: 0,
      total_completed_points: 0,
    };

    setSavingNewSprint(true);
    setError(null);
    setSuccess(null);

    try {
      const [createdSprint] = await insertSupabaseRows<
        SprintOptionRow,
        NewSprintInsertRow
      >(
        "sprints",
        insertRow,
        "id,project_id,name,sprint_number,start_date,sprint_year,sprint_quarter,sprint_month,month,is_current",
      );

      if (createdSprint) {
        setSprints((current) =>
          [createdSprint, ...current].sort((a, b) =>
            (b.start_date ?? "").localeCompare(a.start_date ?? ""),
          ),
        );
        setSelectedSprintId(createdSprint.id);
      }

      setShowNewSprintModal(false);
      setNewSprintNameEdited(false);
      setSuccess(`Sprint "${sprintName}" added.`);
    } catch (saveError) {
      setError(getSprintSaveErrorMessage(saveError));
    } finally {
      setSavingNewSprint(false);
    }
  }

  async function insertStoryPointRow(
    row: SprintStoryPointInsertRow,
    section: "sprint" | "member" | "project_type",
    successMessage: string,
    resetForm: () => void,
    hideForm: () => void,
  ): Promise<void> {
    if (!selectedSprintId) return;

    setSavingSection(section);
    setError(null);
    setSuccess(null);

    try {
      await insertSupabaseRows<SprintStoryPointRow, SprintStoryPointInsertRow>(
        "sprint_story_points",
        row,
      );
      await reloadStoryPointRows(selectedSprintId);
      resetForm();
      hideForm();
      setSuccess(successMessage);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save sprint story points row.",
      );
    } finally {
      setSavingSection(null);
    }
  }

  async function handleSaveSprintModelRow(): Promise<void> {
    if (!selectedSprintId) return;

    const project = sprintAddForm.project.trim();
    const points = parseStoryPointInput(sprintAddForm.points);
    const realPoints = parseStoryPointInput(sprintAddForm.realPoints);

    if (!project) {
      setError("Project is required for sprint model rows.");
      return;
    }

    if (points > sprintPointsMax) {
      setError(`Points cannot exceed ${formatStoryPoints(sprintPointsMax)}.`);
      return;
    }

    if (realPoints > sprintRealPointsMax) {
      setError(`Real points cannot exceed ${formatStoryPoints(sprintRealPointsMax)}.`);
      return;
    }

    await insertStoryPointRow(
      {
        sprint_id: selectedSprintId,
        model: "sprint",
        model_id: selectedSprintId,
        project,
        points,
        real_points: realPoints,
      },
      "sprint",
      "Sprint model story points row added.",
      () => setSprintAddForm(EMPTY_SPRINT_ADD_FORM),
      () => setShowSprintAddForm(false),
    );
  }

  async function handleSaveMemberModelRow(): Promise<void> {
    if (!selectedSprintId) return;

    const project = memberAddForm.project.trim();
    const points = parseStoryPointInput(memberAddForm.points);
    const realPoints = parseStoryPointInput(memberAddForm.realPoints);

    if (!memberAddForm.memberId) {
      setError("Member is required for member model rows.");
      return;
    }

    if (!project) {
      setError("Project is required for member model rows.");
      return;
    }

    await insertStoryPointRow(
      {
        sprint_id: selectedSprintId,
        model: "member",
        model_id: memberAddForm.memberId,
        project,
        points,
        real_points: realPoints,
      },
      "member",
      "Member model story points row added.",
      () => setMemberAddForm(EMPTY_MEMBER_ADD_FORM),
      () => setShowMemberAddForm(false),
    );
  }

  async function handleSaveProjectTypeModelRow(): Promise<void> {
    if (!selectedSprintId) return;

    const project = projectTypeAddForm.project.trim();
    const points = parseStoryPointInput(projectTypeAddForm.points);
    const realPoints = parseStoryPointInput(projectTypeAddForm.realPoints);

    if (!project) {
      setError("Project is required for project type model rows.");
      return;
    }

    if (!projectTypeAddForm.projectTypeId) {
      setError("Project type is required for project type model rows.");
      return;
    }

    if (points > sprintPointsMax) {
      setError(`Points cannot exceed ${formatStoryPoints(sprintPointsMax)}.`);
      return;
    }

    if (realPoints > sprintRealPointsMax) {
      setError(`Real points cannot exceed ${formatStoryPoints(sprintRealPointsMax)}.`);
      return;
    }

    await insertStoryPointRow(
      {
        sprint_id: selectedSprintId,
        model: "project_type",
        model_id: projectTypeAddForm.projectTypeId,
        project,
        points,
        real_points: realPoints,
      },
      "project_type",
      "Project type model story points row added.",
      () => setProjectTypeAddForm(EMPTY_PROJECT_TYPE_ADD_FORM),
      () => setShowProjectTypeAddForm(false),
    );
  }

  return (
    <div className="requirements-data-page sprint-story-points-check-page">
      <Title title="Sprint Story Points Check" />

      <Card className="requirements-data-card">
        <div className="sprint-story-points-check-sprint-toolbar">
          <label className="requirements-data-field">
            <span>Sprint</span>
            <div className="requirements-data-select-wrap">
              <select
                value={selectedSprintId}
                onChange={(event) => {
                  setSelectedSprintId(event.target.value);
                  setSuccess(null);
                  setShowSprintAddForm(false);
                  setShowMemberAddForm(false);
                  setShowProjectTypeAddForm(false);
                }}
                disabled={loading || sprints.length === 0}
              >
                {sprints.length === 0 ? (
                  <option value="">No sprints available</option>
                ) : (
                  <SprintGroupedSelectOptions
                    sprints={sprints}
                    getLabel={(sprint) =>
                      `${getSprintOptionLabel(sprint)}${
                        isCurrentSprint(sprint) ? " (Current)" : ""
                      }`
                    }
                  />
                )}
              </select>
              <span className="requirements-data-select-arrow">▾</span>
            </div>
          </label>
          <button
            type="button"
            className="requirements-data-submit sprint-story-points-check-add-button"
            onClick={openNewSprintModal}
            disabled={loading}
          >
            Add New Sprint
          </button>
        </div>

        {error ? <div className="requirements-data-message is-error">{error}</div> : null}
        {success ? (
          <div className="requirements-data-message is-success">{success}</div>
        ) : null}
        {loading || loadingRows ? (
          <p className="sprint-story-points-check-status">Loading sprint story points...</p>
        ) : null}
      </Card>

      {showNewSprintModal ? (
        <div className="requirements-data-modal-backdrop" role="presentation">
          <div
            aria-labelledby="add-new-sprint-title"
            aria-modal="true"
            className="requirements-data-modal"
            role="dialog"
          >
            <div className="requirements-data-modal-header">
              <div>
                <div className="requirements-data-kicker">New Sprint</div>
                <h3 id="add-new-sprint-title">Add New Sprint</h3>
              </div>
              <button
                className="requirements-data-modal-close"
                onClick={closeNewSprintModal}
                type="button"
                disabled={savingNewSprint}
              >
                Close
              </button>
            </div>

            <form
              className="requirements-data-form"
              onSubmit={(event) => void handleAddNewSprint(event)}
            >
              <div className="requirements-data-grid">
                <label className="requirements-data-field">
                  <span>Year</span>
                  <div className="requirements-data-select-wrap">
                    <select
                      value={newSprintForm.year}
                      onChange={(event) =>
                        updateNewSprintForm({ year: event.target.value })
                      }
                      required
                      disabled={savingNewSprint}
                    >
                      {YEAR_OPTIONS.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                    <span className="requirements-data-select-arrow">▾</span>
                  </div>
                </label>

                <label className="requirements-data-field">
                  <span>Quarter</span>
                  <div className="requirements-data-select-wrap">
                    <select
                      value={newSprintForm.quarter}
                      onChange={(event) =>
                        updateNewSprintForm({ quarter: event.target.value })
                      }
                      required
                      disabled={savingNewSprint}
                    >
                      {QUARTER_OPTIONS.map((quarter) => (
                        <option key={quarter} value={quarter}>
                          {quarter}
                        </option>
                      ))}
                    </select>
                    <span className="requirements-data-select-arrow">▾</span>
                  </div>
                </label>

                <label className="requirements-data-field">
                  <span>Month</span>
                  <div className="requirements-data-select-wrap">
                    <select
                      value={newSprintForm.month}
                      onChange={(event) =>
                        updateNewSprintForm({ month: event.target.value })
                      }
                      required
                      disabled={savingNewSprint}
                    >
                      {newSprintMonthOptions.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                    <span className="requirements-data-select-arrow">▾</span>
                  </div>
                </label>

                <label className="requirements-data-field">
                  <span>Sprint</span>
                  <div className="requirements-data-select-wrap">
                    <select
                      value={
                        availableNewSprintNumbers.includes(
                          Number(newSprintForm.sprintNumber),
                        )
                          ? newSprintForm.sprintNumber
                          : availableNewSprintNumbers[0] !== undefined
                            ? String(availableNewSprintNumbers[0])
                            : ""
                      }
                      onChange={(event) =>
                        updateNewSprintForm({ sprintNumber: event.target.value })
                      }
                      required
                      disabled={
                        savingNewSprint || availableNewSprintNumbers.length === 0
                      }
                    >
                      {availableNewSprintNumbers.length === 0 ? (
                        <option value="">No sprint numbers available</option>
                      ) : (
                        availableNewSprintNumbers.map((sprintNumber) => (
                          <option key={sprintNumber} value={sprintNumber}>
                            {sprintNumber}
                          </option>
                        ))
                      )}
                    </select>
                    <span className="requirements-data-select-arrow">▾</span>
                  </div>
                </label>

                <label className="requirements-data-field">
                  <span>Start Date</span>
                  <ThemedDatePicker
                    disabled={savingNewSprint}
                    onChange={(value) => {
                      setNewSprintDatesEdited(true);
                      updateNewSprintForm({ startDate: value });
                    }}
                    value={newSprintForm.startDate}
                  />
                </label>

                <label className="requirements-data-field">
                  <span>End Date</span>
                  <ThemedDatePicker
                    disabled={savingNewSprint}
                    min={newSprintForm.startDate}
                    onChange={(value) => {
                      setNewSprintDatesEdited(true);
                      updateNewSprintForm({ endDate: value });
                    }}
                    value={newSprintForm.endDate}
                  />
                </label>

                <label className="requirements-data-field">
                  <span>Name</span>
                  <input
                    type="text"
                    value={newSprintForm.name}
                    onChange={(event) => {
                      setNewSprintNameEdited(true);
                      updateNewSprintForm({ name: event.target.value });
                    }}
                    required
                    disabled={savingNewSprint}
                  />
                </label>

                <label className="requirements-data-field">
                  <span>Project</span>
                  <div className="requirements-data-select-wrap">
                    <select
                      value={newSprintForm.projectId}
                      onChange={(event) =>
                        updateNewSprintForm({ projectId: event.target.value })
                      }
                      required
                      disabled={savingNewSprint || projectSelectOptions.length === 0}
                    >
                      <option value="">Select project</option>
                      {projectSelectOptions.map((project) => (
                        <option key={project.value} value={project.value}>
                          {project.label}
                        </option>
                      ))}
                    </select>
                    <span className="requirements-data-select-arrow">▾</span>
                  </div>
                </label>
              </div>

              <div className="requirements-data-actions requirements-data-modal-actions">
                <button
                  type="button"
                  className="requirements-data-cancel-button"
                  onClick={closeNewSprintModal}
                  disabled={savingNewSprint}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="requirements-data-submit"
                  disabled={
                    savingNewSprint ||
                    availableNewSprintNumbers.length === 0 ||
                    !newSprintForm.projectId ||
                    !newSprintForm.startDate ||
                    !newSprintForm.endDate
                  }
                >
                  {savingNewSprint ? "Adding..." : "Add Sprint"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {!loading && !loadingRows && selectedSprintId ? (
        <>
          <Card className="requirements-data-card sprint-story-points-check-section">
            <div className="sprint-story-points-check-section-header">
              <div>
                <h2>Sprint Model</h2>
                <p>{selectedSprintLabel}</p>
              </div>
              {!showSprintAddForm ? (
                <button
                  type="button"
                  className="requirements-data-submit sprint-story-points-check-add-button"
                  onClick={() => {
                    setShowSprintAddForm(true);
                    setError(null);
                    setSuccess(null);
                  }}
                >
                  Add
                </button>
              ) : null}
            </div>

            {showSprintAddForm ? (
              <div className="sprint-story-points-check-add-form">
                <div className="sprint-story-points-check-add-form-grid is-sprint-model">
                  <AddFormSelect
                    label="Project"
                    value={sprintAddForm.project}
                    onChange={(project) =>
                      setSprintAddForm((current) => ({ ...current, project }))
                    }
                    options={projectOptions}
                    placeholder="Select project"
                    disabled={savingSection === "sprint"}
                  />
                  <AddFormNumberInput
                    label="Points"
                    value={sprintAddForm.points}
                    onChange={(points) =>
                      setSprintAddForm((current) => ({ ...current, points }))
                    }
                    max={sprintPointsMax}
                    disabled={savingSection === "sprint"}
                  />
                  <AddFormNumberInput
                    label="Real Points"
                    value={sprintAddForm.realPoints}
                    onChange={(realPoints) =>
                      setSprintAddForm((current) => ({ ...current, realPoints }))
                    }
                    max={sprintRealPointsMax}
                    disabled={savingSection === "sprint"}
                  />
                </div>
                <div className="sprint-story-points-check-add-actions">
                  <button
                    type="button"
                    className="requirements-data-cancel-button"
                    onClick={() => {
                      setShowSprintAddForm(false);
                      setSprintAddForm(EMPTY_SPRINT_ADD_FORM);
                    }}
                    disabled={savingSection === "sprint"}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="requirements-data-submit"
                    onClick={() => void handleSaveSprintModelRow()}
                    disabled={savingSection === "sprint"}
                  >
                    {savingSection === "sprint" ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : null}

            <StoryPointTable
              lines={sprintModelSection.lines}
              emptyMessage="No sprint model story points found for this sprint."
              total={{
                label: "Total",
                points: sprintModelSection.totalPoints,
                realPoints: sprintModelSection.totalRealPoints,
              }}
            />
          </Card>

          <Card className="requirements-data-card sprint-story-points-check-section">
            <div className="sprint-story-points-check-section-header">
              <div>
                <h2>Member Model</h2>
                <p>Grouped by member, itemized by project</p>
              </div>
              {!showMemberAddForm ? (
                <button
                  type="button"
                  className="requirements-data-submit sprint-story-points-check-add-button"
                  onClick={() => {
                    setShowMemberAddForm(true);
                    setError(null);
                    setSuccess(null);
                  }}
                >
                  Add
                </button>
              ) : null}
            </div>

            {showMemberAddForm ? (
              <div className="sprint-story-points-check-add-form">
                <div className="sprint-story-points-check-add-form-grid is-member-model">
                  <AddFormSelect
                    label="Member"
                    value={memberAddForm.memberId}
                    onChange={(memberId) =>
                      setMemberAddForm((current) => ({ ...current, memberId }))
                    }
                    options={memberOptions}
                    placeholder="Select member"
                    disabled={savingSection === "member"}
                  />
                  <AddFormSelect
                    label="Project"
                    value={memberAddForm.project}
                    onChange={(project) =>
                      setMemberAddForm((current) => ({ ...current, project }))
                    }
                    options={projectOptions}
                    placeholder="Select project"
                    disabled={savingSection === "member"}
                  />
                  <AddFormNumberInput
                    label="Points"
                    value={memberAddForm.points}
                    onChange={(points) =>
                      setMemberAddForm((current) => ({ ...current, points }))
                    }
                    disabled={savingSection === "member"}
                  />
                  <AddFormNumberInput
                    label="Real Points"
                    value={memberAddForm.realPoints}
                    onChange={(realPoints) =>
                      setMemberAddForm((current) => ({ ...current, realPoints }))
                    }
                    disabled={savingSection === "member"}
                  />
                </div>
                <div className="sprint-story-points-check-add-actions">
                  <button
                    type="button"
                    className="requirements-data-cancel-button"
                    onClick={() => {
                      setShowMemberAddForm(false);
                      setMemberAddForm(EMPTY_MEMBER_ADD_FORM);
                    }}
                    disabled={savingSection === "member"}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="requirements-data-submit"
                    onClick={() => void handleSaveMemberModelRow()}
                    disabled={savingSection === "member"}
                  >
                    {savingSection === "member" ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : null}

            {memberModelSection.groups.length === 0 ? (
              <p className="sprint-story-points-check-status">
                No member model story points found for this sprint.
              </p>
            ) : (
              <>
                {memberModelSection.groups.map((group) => (
                  <MemberStoryPointGroup
                    key={group.id}
                    group={group}
                    member={members.find((member) => member.id === group.id)}
                  />
                ))}

                <StoryPointTable
                  lines={[]}
                  emptyMessage=""
                  total={{
                    label: "All Members Total",
                    points: memberModelSection.totalPoints,
                    realPoints: memberModelSection.totalRealPoints,
                  }}
                />
              </>
            )}
          </Card>

          <Card className="requirements-data-card sprint-story-points-check-section">
            <div className="sprint-story-points-check-section-header">
              <div>
                <h2>Project Type Model</h2>
                <p>Grouped by project, itemized by project type</p>
              </div>
              {!showProjectTypeAddForm ? (
                <button
                  type="button"
                  className="requirements-data-submit sprint-story-points-check-add-button"
                  onClick={() => {
                    setShowProjectTypeAddForm(true);
                    setError(null);
                    setSuccess(null);
                  }}
                >
                  Add
                </button>
              ) : null}
            </div>

            {showProjectTypeAddForm ? (
              <div className="sprint-story-points-check-add-form">
                <div className="sprint-story-points-check-add-form-grid is-project-type-model">
                  <AddFormSelect
                    label="Project"
                    value={projectTypeAddForm.project}
                    onChange={(project) =>
                      setProjectTypeAddForm((current) => ({ ...current, project }))
                    }
                    options={projectOptions}
                    placeholder="Select project"
                    disabled={savingSection === "project_type"}
                  />
                  <AddFormSelect
                    label="Project Type"
                    value={projectTypeAddForm.projectTypeId}
                    onChange={(projectTypeId) =>
                      setProjectTypeAddForm((current) => ({ ...current, projectTypeId }))
                    }
                    options={projectTypeOptions}
                    placeholder="Select project type"
                    disabled={savingSection === "project_type"}
                  />
                  <AddFormNumberInput
                    label="Points"
                    value={projectTypeAddForm.points}
                    onChange={(points) =>
                      setProjectTypeAddForm((current) => ({ ...current, points }))
                    }
                    max={sprintPointsMax}
                    disabled={savingSection === "project_type"}
                  />
                  <AddFormNumberInput
                    label="Real Points"
                    value={projectTypeAddForm.realPoints}
                    onChange={(realPoints) =>
                      setProjectTypeAddForm((current) => ({ ...current, realPoints }))
                    }
                    max={sprintRealPointsMax}
                    disabled={savingSection === "project_type"}
                  />
                </div>
                <div className="sprint-story-points-check-add-actions">
                  <button
                    type="button"
                    className="requirements-data-cancel-button"
                    onClick={() => {
                      setShowProjectTypeAddForm(false);
                      setProjectTypeAddForm(EMPTY_PROJECT_TYPE_ADD_FORM);
                    }}
                    disabled={savingSection === "project_type"}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="requirements-data-submit"
                    onClick={() => void handleSaveProjectTypeModelRow()}
                    disabled={savingSection === "project_type"}
                  >
                    {savingSection === "project_type" ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : null}

            {projectTypeModelSection.groups.length === 0 ? (
              <p className="sprint-story-points-check-status">
                No project type model story points found for this sprint.
              </p>
            ) : (
              <>
                {projectTypeModelSection.groups.map((group) => (
                  <div key={group.id} className="sprint-story-points-check-group">
                    <h3>{group.label}</h3>
                    <StoryPointTable
                      lines={group.lines}
                      emptyMessage="No project type rows for this project."
                      total={{
                        label: `${group.label} Total`,
                        points: group.totalPoints,
                        realPoints: group.totalRealPoints,
                      }}
                    />
                  </div>
                ))}

                <StoryPointTable
                  lines={[]}
                  emptyMessage=""
                  total={{
                    label: "All Project Types Total",
                    points: projectTypeModelSection.totalPoints,
                    realPoints: projectTypeModelSection.totalRealPoints,
                  }}
                />
              </>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
