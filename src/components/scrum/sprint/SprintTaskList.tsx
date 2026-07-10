import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/shared/Containers";
import { StyledSelect } from "@/components/shared/Elements";
import SprintGroupedSelect from "@/components/scrum/sprint/SprintGroupedSelect";
import {
  Background,
  Border,
  Palette,
  Text,
} from "@/lib/theme";
import { SectionTitle } from "@/components/shared/Sections";
import { STATUS_COLOR, STATUS_BG, SEV_COLOR, PRI_COLOR } from "@/lib/helper";
import { getSupabaseRows } from "@/lib/supabase";
import "@/assets/styles/SprintTaskList.css";

/* ─── TASK LIST ─────────────────────────────── */
export type SortKey = "severity" | "priority" | "list" | "points";
export const SEV_ORDER: Record<string, number> = {
  P1: 0,
  P2: 1,
  P3: 2,
  P4: 3,
};
export const PRI_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

type SprintRow = {
  id: string;
  name: string | null;
  sprint_number: number | null;
  sprint_year: number | null;
  sprint_quarter: number | null;
  start_date: string | null;
  end_date: string | null;
  is_current: number | null;
};

type TaskRow = {
  id?: string;
  assigned_to: string | null;
  trello_card_id: string;
  trello_short_id: number | null;
  trello_card_url: string | null;
  trello_list_name: string | null;
  title: string;
  priority: string;
  status: string;
  story_points: number;
  severity: number;
  sp_type: "planned" | "adhoc" | "done" | "blocked";
  project_type: string | null;
  project: string | null;
};

type MemberRow = {
  id: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type ProjectTypeRow = {
  id: string;
  name: string;
};

type TaskListItem = {
  id: string;
  title: string;
  trelloCardUrl: string | null;
  assigneeId: string | null;
  assigneeInitials: string;
  assigneeName: string;
  assigneeColor: string;
  severity: string;
  priority: string;
  status: string;
  points: number;
  spType: "planned" | "adhoc" | "done" | "blocked";
  listName: string;
  projectTypeId: string | null;
  projectTypeName: string;
  projectName: string;
};

const TASKS_PER_PAGE = 12;
const INCLUDED_SP_TYPES = new Set<TaskRow["sp_type"]>([
  "planned",
  "adhoc",
  "blocked",
]);
const SP_TYPE_FILTER_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "adhoc", label: "Adhoc" },
  { value: "blocked", label: "Blocked" },
] as const;
const SEVERITY_FILTER_OPTIONS = ["P1", "P2", "P3", "P4"] as const;
const PRIORITY_FILTER_OPTIONS = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;
const UNASSIGNED_COLOR = "#8a96a8";
const ASSIGNEE_COLORS = [
  Palette.cyan,
  Palette.green,
  Palette.gold,
  Palette.purple,
  Palette.pink,
  Palette.orange,
  Palette.indigo,
  Palette.redSoft,
];

function getMemberName(member: MemberRow): string {
  return (
    member.full_name ||
    [member.first_name, member.last_name].filter(Boolean).join(" ") ||
    "Unnamed member"
  );
}

function getSprintName(sprint: SprintRow): string {
  const fallbackName = sprint.sprint_number
    ? `Sprint ${sprint.sprint_number}`
    : "Unnamed sprint";

  return `${sprint.name || fallbackName}${sprint.is_current ? " (Current)" : ""}`;
}

function getInitials(name: string): string {
  if (name === "Unassigned") return "UA";

  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function getAssigneeColor(memberId: string | null, fallbackName: string): string {
  if (!memberId || fallbackName === "Unassigned") return UNASSIGNED_COLOR;

  const hash = Array.from(memberId).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );

  return ASSIGNEE_COLORS[hash % ASSIGNEE_COLORS.length];
}

function getSeverityLabel(value: number): string {
  if (value === 1.3) return "P1";
  if (value === 1.2) return "P2";
  if (value === 1.1) return "P3";
  return "P4";
}

function mapTask(
  task: TaskRow,
  membersById: Map<string, MemberRow>,
  projectTypesById: Map<string, ProjectTypeRow>,
): TaskListItem {
  const member = task.assigned_to ? membersById.get(task.assigned_to) : undefined;
  const assigneeName = member ? getMemberName(member) : "Unassigned";
  const projectTypeName = task.project_type
    ? projectTypesById.get(task.project_type)?.name ?? "General"
    : "General";

  return {
    id: String(task.trello_short_id ?? task.trello_card_id),
    title: task.title,
    trelloCardUrl: task.trello_card_url,
    assigneeId: task.assigned_to,
    assigneeInitials: getInitials(assigneeName),
    assigneeName,
    assigneeColor: getAssigneeColor(task.assigned_to, assigneeName),
    severity: getSeverityLabel(task.severity),
    priority: task.priority,
    status: task.status,
    points: task.story_points,
    spType: task.sp_type,
    listName: task.trello_list_name ?? "Unknown",
    projectTypeId: task.project_type,
    projectTypeName,
    projectName: task.project?.trim() || "General",
  };
}

const SprintTaskList = () => {
    const [sortBy, setSortBy] = useState<SortKey>("priority");
    const [selectedSprintId, setSelectedSprintId] = useState("");
    const [selectedMemberId, setSelectedMemberId] = useState("");
    const [selectedListName, setSelectedListName] = useState("");
    const [selectedSpType, setSelectedSpType] = useState("");
    const [selectedProjectTypeId, setSelectedProjectTypeId] = useState("");
    const [selectedProjectName, setSelectedProjectName] = useState("");
    const [selectedSeverity, setSelectedSeverity] = useState("");
    const [selectedPriority, setSelectedPriority] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [tasks, setTasks] = useState<TaskListItem[]>([]);
    const [sprints, setSprints] = useState<SprintRow[]>([]);
    const [members, setMembers] = useState<MemberRow[]>([]);
    const [projectTypes, setProjectTypes] = useState<ProjectTypeRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtersLoaded, setFiltersLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      let cancelled = false;

      async function loadFilters() {
        setError(null);

        try {
          const [sprintRows, memberRows, projectTypeRows] = await Promise.all([
            getSupabaseRows<SprintRow>("sprints", {
              select:
                "id,name,sprint_number,sprint_year,sprint_quarter,start_date,end_date,is_current",
              order: { column: "start_date", ascending: false },
            }),
            getSupabaseRows<MemberRow>("members", {
              select: "id,full_name,first_name,last_name",
            }),
            getSupabaseRows<ProjectTypeRow>("project_type", {
              select: "id,name",
              order: { column: "name", ascending: true },
            }),
          ]);

          if (!cancelled) {
            const selectedSprint =
              sprintRows.find((sprint) => sprint.is_current) ?? sprintRows[0];

            setSprints(sprintRows);
            setMembers(memberRows.filter((member) => Boolean(member.id)));
            setProjectTypes(projectTypeRows);
            setSelectedSprintId((currentValue) =>
              currentValue || selectedSprint?.id || "",
            );
            setFiltersLoaded(true);
          }
        } catch (error) {
          if (!cancelled) {
            setError(error instanceof Error ? error.message : "Unable to load filters.");
            setSprints([]);
            setMembers([]);
            setProjectTypes([]);
            setTasks([]);
            setFiltersLoaded(true);
            setLoading(false);
          }
        }
      }

      void loadFilters();

      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      let cancelled = false;

      async function loadTasks() {
        if (!filtersLoaded) return;

        if (!selectedSprintId) {
          setTasks([]);
          setLoading(false);
          return;
        }

        setLoading(true);
        setError(null);

        try {
          const taskRows = await getSupabaseRows<TaskRow>("tasks", {
            select:
              "id,assigned_to,trello_card_id,trello_short_id,trello_card_url,trello_list_name,title,priority,status,story_points,severity,sp_type,project_type,project",
            eq: { sprint_id: selectedSprintId },
          });

          const membersById = new Map(
            members
              .filter((member) => member.id)
              .map((member) => [member.id as string, member]),
          );
          const projectTypesById = new Map(
            projectTypes.map((projectType) => [projectType.id, projectType]),
          );

          if (!cancelled) {
            setTasks(
              taskRows
                .filter((task) => INCLUDED_SP_TYPES.has(task.sp_type))
                .map((task) => mapTask(task, membersById, projectTypesById)),
            );
          }
        } catch (error) {
          if (!cancelled) {
            setError(error instanceof Error ? error.message : "Unable to load tasks.");
            setTasks([]);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      void loadTasks();

      return () => {
        cancelled = true;
      };
    }, [filtersLoaded, members, projectTypes, selectedSprintId]);

    const listNames = useMemo(
      () =>
        Array.from(new Set(tasks.map((task) => task.listName)))
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b)),
      [tasks],
    );

    const projectNames = useMemo(
      () =>
        Array.from(new Set(tasks.map((task) => task.projectName)))
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b)),
      [tasks],
    );

    const resetTaskFilters = () => {
      setSelectedMemberId("");
      setSelectedListName("");
      setSelectedSpType("");
      setSelectedProjectTypeId("");
      setSelectedProjectName("");
      setSelectedSeverity("");
      setSelectedPriority("");
      setCurrentPage(1);
    };

    const sorted = tasks
      .filter((task) => {
        if (selectedMemberId && task.assigneeId !== selectedMemberId) return false;
        if (selectedListName && task.listName !== selectedListName) return false;
        if (selectedSpType && task.spType !== selectedSpType) return false;
        if (selectedProjectTypeId && task.projectTypeId !== selectedProjectTypeId) {
          return false;
        }
        if (selectedProjectName && task.projectName !== selectedProjectName) {
          return false;
        }
        if (selectedSeverity && task.severity !== selectedSeverity) return false;
        if (selectedPriority && task.priority !== selectedPriority) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "severity")
          return SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
        if (sortBy === "priority")
          return PRI_ORDER[a.priority] - PRI_ORDER[b.priority];
        if (sortBy === "points") return b.points - a.points;
        return a.listName.localeCompare(b.listName);
      });

    const totalPages = Math.max(1, Math.ceil(sorted.length / TASKS_PER_PAGE));
    const activePage = Math.min(currentPage, totalPages);
    const pageStart = (activePage - 1) * TASKS_PER_PAGE;
    const paginatedTasks = sorted.slice(pageStart, pageStart + TASKS_PER_PAGE);
  
    return (
      <Card>
        <div
          className="sprint-task-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <SectionTitle>Sprint Tasks</SectionTitle>
          <div>
            <div
              className="sprint-task-control-label"
              style={{
                color: Text.faint,
                fontFamily: "'DM Mono',monospace",
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.12em",
                marginBottom: 5,
                textTransform: "uppercase",
              }}
            >
              Sort
            </div>
            <div
              className="sprint-task-toolbar"
              style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
            >
              {(["severity", "priority", "list", "points"] as SortKey[]).map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSortBy(s);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: "3px 10px",
                      borderRadius: 99,
                      border: "1px solid",
                      borderColor:
                        sortBy === s ? Palette.cyan : Border.dim,
                      background:
                        sortBy === s ? Background.sortActive : "transparent",
                      color: sortBy === s ? Palette.cyan : Text.faint,
                      fontSize: 9,
                      fontFamily: "'DM Mono',monospace",
                      fontWeight: 700,
                      cursor: "pointer",
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.08em",
                    }}
                  >
                    ↕ {s}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
        {/* Member and list filters */}
        <div
          className="sprint-task-control-label"
          style={{
            color: Text.faint,
            fontFamily: "'DM Mono',monospace",
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: "0.12em",
            marginBottom: 6,
            textTransform: "uppercase",
          }}
        >
          Filter
        </div>
        <div
          className="sprint-task-filters"
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 14,
            alignItems: "center",
          }}
        >
          <SprintGroupedSelect
            sprints={sprints}
            value={selectedSprintId}
            onChange={(value) => {
              setSelectedSprintId(value);
              resetTaskFilters();
            }}
            getLabel={getSprintName}
            placeholder="Select sprint"
          />
          <StyledSelect
            value={selectedSpType}
            onChange={(value) => {
              setSelectedSpType(value);
              setCurrentPage(1);
            }}
            placeholder="All task types"
          >
            {SP_TYPE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </StyledSelect>
          <StyledSelect
            value={selectedProjectTypeId}
            onChange={(value) => {
              setSelectedProjectTypeId(value);
              setCurrentPage(1);
            }}
            placeholder="All project types"
          >
            {projectTypes.map((projectType) => (
              <option key={projectType.id} value={projectType.id}>
                {projectType.name}
              </option>
            ))}
          </StyledSelect>
          <StyledSelect
            value={selectedProjectName}
            onChange={(value) => {
              setSelectedProjectName(value);
              setCurrentPage(1);
            }}
            placeholder="All projects"
          >
            {projectNames.map((projectName) => (
              <option key={projectName} value={projectName}>
                {projectName}
              </option>
            ))}
          </StyledSelect>
          <StyledSelect
            value={selectedSeverity}
            onChange={(value) => {
              setSelectedSeverity(value);
              setCurrentPage(1);
            }}
            placeholder="All severities"
          >
            {SEVERITY_FILTER_OPTIONS.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </StyledSelect>
          <StyledSelect
            value={selectedPriority}
            onChange={(value) => {
              setSelectedPriority(value);
              setCurrentPage(1);
            }}
            placeholder="All priorities"
          >
            {PRIORITY_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </StyledSelect>
          <StyledSelect
            value={selectedMemberId}
            onChange={(value) => {
              setSelectedMemberId(value);
              setCurrentPage(1);
            }}
            placeholder="All members"
          >
            <option value="">All members</option>
            {members.map((member) => (
              <option key={member.id} value={member.id ?? ""}>
                {getMemberName(member)}
              </option>
            ))}
          </StyledSelect>
          <StyledSelect
            value={selectedListName}
            onChange={(value) => {
              setSelectedListName(value);
              setCurrentPage(1);
            }}
            placeholder="All lists"
          >
            {listNames.map((listName) => (
              <option key={listName} value={listName}>
                {listName}
              </option>
            ))}
          </StyledSelect>
        </div>
        {loading ? (
          <div
            className="sprint-task-loading"
            style={{ color: Text.faint }}
          >
            <span
              className="sprint-task-loading-spinner"
              style={{ borderTopColor: Palette.cyan }}
            />
            <span>Fetching tasks...</span>
          </div>
        ) : error ? (
          <div style={{ color: Palette.redSoft, padding: "18px 0", textAlign: "center" }}>
            {error}
          </div>
        ) : (
        <>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {paginatedTasks.length === 0 ? (
            <div
              className="sprint-task-empty"
              style={{ color: Text.faint }}
            >
              No records found.
            </div>
          ) : null}
          {paginatedTasks.map((t, taskIndex) => {
            const assigneeColor = t.assigneeColor;
            const assigneeName = t.assigneeName;
            const isSeveritySorted = sortBy === "severity";
            const isPrioritySorted = sortBy === "priority";
            const isStatusSorted = sortBy === "list";
            const isPointsSorted = sortBy === "points";
            const severityColor = SEV_COLOR[t.severity] ?? Palette.green;
            const priorityColor = PRI_COLOR[t.priority] ?? {
              critical: Palette.red,
              high: Palette.orange,
              medium: Palette.gold,
              low: Palette.green,
            }[t.priority] ?? Palette.cyan;
            const statusColor = STATUS_COLOR[t.status] ?? Palette.cyan;
            const statusBackground = STATUS_BG[t.status] ?? Background.tabActiveInset;
            const typeColor =
              t.spType === "adhoc"
                ? "#ff9f43"
                : t.spType === "done"
                  ? Palette.green
                  : t.spType === "blocked"
                    ? Palette.red
                    : Palette.cyan;

            return (
            <div
              className="sprint-task-row"
              key={`${t.id}-${taskIndex}`}
              style={{
                display: "grid",
                gridTemplateColumns: "72px 60px 44px 1fr auto auto auto",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                background: Background.row,
                border: `1px solid ${Border.faint}`,
                transition: "border-color 0.2s, background 0.2s",
                animationDelay: `${0.06 + taskIndex * 0.055}s`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = Background.rowHover;
                e.currentTarget.style.borderColor = Border.hoverSoft;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = Background.row;
                e.currentTarget.style.borderColor = Border.faint;
              }}
            >
              <span
                className="sprint-task-kind"
                style={{
                  fontSize: 10,
                  color: typeColor,
                  fontFamily: "'DM Mono',monospace",
                  fontWeight: 800,
                  textTransform: "uppercase" as const,
                  whiteSpace: "nowrap" as const,
                }}
              >
                {t.spType === "adhoc"
                  ? "Adhoc"
                  : t.spType === "done"
                    ? "Done"
                    : t.spType === "blocked"
                      ? "Blocked"
                      : "Planned"}
              </span>
              <span
                className="sprint-task-id"
                style={{
                  fontSize: 10,
                  fontFamily: "'DM Mono',monospace",
                  color: Text.dimmer,
                  fontWeight: 700,
                }}
              >
                {t.id}
              </span>
              <span
                className="sprint-task-assignee"
                style={{
                  fontSize: 10,
                  fontFamily: "'DM Mono',monospace",
                  color: assigneeColor,
                  fontWeight: 800,
                  whiteSpace: "nowrap" as const,
                }}
              >
                <span className="sprint-task-assignee-initials">{t.assigneeInitials}</span>
                <span className="sprint-task-assignee-name">
                  {assigneeName}
                </span>
              </span>
              <span
                className="sprint-task-title"
                style={{
                  fontSize: 12,
                  color: Text.bright,
                  fontFamily: "'DM Sans',sans-serif",
                  fontWeight: 500,
                  lineHeight: 1.35,
                  minWidth: 0,
                  overflowWrap: "anywhere" as const,
                  whiteSpace: "normal" as const,
                }}
              >
                {t.trelloCardUrl ? (
                  <a
                    className="sprint-task-title-link"
                    href={t.trelloCardUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "inherit" }}
                  >
                    {t.title}
                  </a>
                ) : (
                  t.title
                )}
              </span>
              <div
                className="sprint-task-badges"
                style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}
              >
                <span
                  style={{
                    fontSize: 9,
                    padding: "2px 7px",
                    borderRadius: 99,
                    background: `${severityColor}18`,
                    color: severityColor,
                    fontFamily: "'DM Mono',monospace",
                    fontWeight: isSeveritySorted ? 1000 : 700,
                    letterSpacing: isSeveritySorted ? "0.04em" : undefined,
                    transform: isSeveritySorted ? "scale(1.05)" : "none",
                    WebkitTextStroke: isSeveritySorted
                      ? `0.35px ${severityColor}`
                      : undefined,
                    textShadow: isSeveritySorted
                      ? `0 0 10px ${severityColor}, 0 0 18px ${severityColor}88`
                      : "none",
                    whiteSpace: "nowrap" as const,
                  }}
                >
                  {t.severity}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    padding: "2px 7px",
                    borderRadius: 99,
                    background: `${priorityColor}18`,
                    color: priorityColor,
                    fontFamily: "'DM Mono',monospace",
                    fontWeight: isPrioritySorted ? 1000 : 700,
                    letterSpacing: isPrioritySorted ? "0.04em" : undefined,
                    transform: isPrioritySorted ? "scale(1.05)" : "none",
                    WebkitTextStroke: isPrioritySorted
                      ? `0.35px ${priorityColor}`
                      : undefined,
                    textShadow: isPrioritySorted
                      ? `0 0 10px ${priorityColor}, 0 0 18px ${priorityColor}88`
                      : "none",
                  }}
                >
                  {t.priority}
                </span>
              </div>
              <span
                className="sprint-task-status"
                style={{
                  fontSize: 9,
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: statusBackground,
                  color: statusColor,
                  fontFamily: "'DM Mono',monospace",
                  fontWeight: isStatusSorted ? 1000 : 700,
                  letterSpacing: isStatusSorted ? "0.04em" : undefined,
                  transform: isStatusSorted ? "scale(1.05)" : "none",
                  WebkitTextStroke: isStatusSorted
                    ? `0.35px ${statusColor}`
                    : undefined,
                  textShadow: isStatusSorted
                    ? `0 0 10px ${statusColor}, 0 0 18px ${statusColor}88`
                    : "none",
                  whiteSpace: "nowrap" as const,
                }}
              >
                {t.listName}
              </span>
              <span
                className="sprint-task-points"
                style={{
                  fontSize: 11,
                  fontFamily: "'DM Mono',monospace",
                  fontWeight: isPointsSorted ? 1000 : 700,
                  color: isPointsSorted ? Palette.gold : Text.label,
                  textAlign: "right" as const,
                  letterSpacing: isPointsSorted ? "0.03em" : undefined,
                  transform: isPointsSorted ? "scale(1.05)" : "none",
                  WebkitTextStroke: isPointsSorted ? `0.35px ${Palette.gold}` : undefined,
                  textShadow: isPointsSorted
                    ? "0 0 10px rgba(245,200,66,0.95), 0 0 18px rgba(245,200,66,0.55)"
                    : "none",
                }}
              >
                {t.points}sp
              </span>
            </div>
            );
          })}
        </div>
        <div
          className="sprint-task-pagination"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 14,
          }}
        >
          <div
            style={{
              color: Text.faint,
              fontFamily: "'DM Mono',monospace",
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            Showing {sorted.length === 0 ? 0 : pageStart + 1}-
            {Math.min(pageStart + TASKS_PER_PAGE, sorted.length)} of {sorted.length}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
                border: `1px solid ${activePage === totalPages ? Border.default : Border.hoverSoft}`,
                background: activePage === totalPages ? "transparent" : Background.sortActive,
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
    );
  }

  export default SprintTaskList;
