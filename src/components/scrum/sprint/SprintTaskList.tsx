import { useState } from "react";
import { Card } from "@/components/shared/Containers";
import {
  Background,
  Border,
  Palette,
  Text,
} from "@/lib/theme";
import { SectionTitle } from "@/components/shared/Sections";
import { STATUS_COLOR, STATUS_BG, SEV_COLOR, PRI_COLOR } from "@/lib/helper";
import { SPRINT_BOARD_TASKS } from "@/data/SprintBoard.data";
import { TEAM_MEMBERS } from "@/data/Mock.data";
import "@/assets/styles/SprintTaskList.css";

/* ─── TASK LIST ─────────────────────────────── */
export type SortKey = "severity" | "priority" | "status" | "points";
type TaskFilter = "All" | "Done" | "In Progress" | "Review" | "Blocked" | "Todo" | "Planned" | "Adhoc";
export const SEV_ORDER: Record<string, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};
export const PRI_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

const TEAM_BY_INITIALS = Object.fromEntries(
  TEAM_MEMBERS.map((member) => [member.initials, member]),
);

const TASKS_PER_PAGE = 12;

const SprintTaskList = () => {
    const [sortBy, setSortBy] = useState<SortKey>("priority");
    const [filter, setFilter] = useState<TaskFilter>("All");
    const [currentPage, setCurrentPage] = useState(1);
  
    const filters: TaskFilter[] = [
      "All",
      "Done",
      "In Progress",
      "Review",
      "Blocked",
      "Todo",
      "Planned",
      "Adhoc",
    ];
  
    const sorted = [...SPRINT_BOARD_TASKS]
      .filter((t) => {
        if (filter === "All") return true;
        if (filter === "Planned") return !t.isAdhoc;
        if (filter === "Adhoc") return Boolean(t.isAdhoc);
        return t.status === filter;
      })
      .sort((a, b) => {
        if (sortBy === "severity")
          return SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
        if (sortBy === "priority")
          return PRI_ORDER[a.priority] - PRI_ORDER[b.priority];
        if (sortBy === "points") return b.points - a.points;
        return a.status.localeCompare(b.status);
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
              {(["severity", "priority", "status", "points"] as SortKey[]).map(
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
        {/* Status filter tabs */}
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
          style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}
        >
          {filters.map((s) => {
            const filterColor =
              s === "Planned"
                ? Palette.cyan
                : s === "Adhoc"
                  ? "#ff9f43"
                  : STATUS_COLOR[s] || Palette.cyan;
            const filterBackground =
              s === "Planned"
                ? "rgba(0,200,255,0.12)"
                : s === "Adhoc"
                  ? "rgba(255,159,67,0.16)"
                  : STATUS_BG[s] || Background.tabActiveInset;

            return (
            <button
              key={s}
              onClick={() => {
                setFilter(s);
                setCurrentPage(1);
              }}
              style={{
                padding: "3px 10px",
                borderRadius: 99,
                border: "1px solid",
                borderColor:
                  filter === s
                    ? filterColor
                    : Border.default,
                  background:
                    filter === s
                    ? filterBackground
                    : "transparent",
                  color:
                    filter === s
                    ? filterColor
                    : Text.faint,
                fontSize: 9,
                fontFamily: "'DM Mono',monospace",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {s}
            </button>
            );
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {paginatedTasks.map((t, taskIndex) => {
            const assigneeColor = TEAM_BY_INITIALS[t.assignee]?.color ?? Text.label;
            const assigneeName = TEAM_BY_INITIALS[t.assignee]?.name ?? t.assignee;
            const isSeveritySorted = sortBy === "severity";
            const isPrioritySorted = sortBy === "priority";
            const isStatusSorted = sortBy === "status";
            const isPointsSorted = sortBy === "points";

            return (
            <div
              className="sprint-task-row"
              key={t.id}
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
                  color: t.isAdhoc ? "#ff9f43" : Palette.cyan,
                  fontFamily: "'DM Mono',monospace",
                  fontWeight: 800,
                  textTransform: "uppercase" as const,
                  whiteSpace: "nowrap" as const,
                }}
              >
                {t.isAdhoc ? "Adhoc" : "Planned"}
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
                <span className="sprint-task-assignee-initials">{t.assignee}</span>
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
                {t.title}
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
                    background: `${SEV_COLOR[t.severity]}18`,
                    color: SEV_COLOR[t.severity],
                    fontFamily: "'DM Mono',monospace",
                    fontWeight: isSeveritySorted ? 1000 : 700,
                    letterSpacing: isSeveritySorted ? "0.04em" : undefined,
                    transform: isSeveritySorted ? "scale(1.05)" : "none",
                    WebkitTextStroke: isSeveritySorted
                      ? `0.35px ${SEV_COLOR[t.severity]}`
                      : undefined,
                    textShadow: isSeveritySorted
                      ? `0 0 10px ${SEV_COLOR[t.severity]}, 0 0 18px ${SEV_COLOR[t.severity]}88`
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
                    background: `${PRI_COLOR[t.priority]}18`,
                    color: PRI_COLOR[t.priority],
                    fontFamily: "'DM Mono',monospace",
                    fontWeight: isPrioritySorted ? 1000 : 700,
                    letterSpacing: isPrioritySorted ? "0.04em" : undefined,
                    transform: isPrioritySorted ? "scale(1.05)" : "none",
                    WebkitTextStroke: isPrioritySorted
                      ? `0.35px ${PRI_COLOR[t.priority]}`
                      : undefined,
                    textShadow: isPrioritySorted
                      ? `0 0 10px ${PRI_COLOR[t.priority]}, 0 0 18px ${PRI_COLOR[t.priority]}88`
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
                  background: STATUS_BG[t.status],
                  color: STATUS_COLOR[t.status],
                  fontFamily: "'DM Mono',monospace",
                  fontWeight: isStatusSorted ? 1000 : 700,
                  letterSpacing: isStatusSorted ? "0.04em" : undefined,
                  transform: isStatusSorted ? "scale(1.05)" : "none",
                  WebkitTextStroke: isStatusSorted
                    ? `0.35px ${STATUS_COLOR[t.status]}`
                    : undefined,
                  textShadow: isStatusSorted
                    ? `0 0 10px ${STATUS_COLOR[t.status]}, 0 0 18px ${STATUS_COLOR[t.status]}88`
                    : "none",
                  whiteSpace: "nowrap" as const,
                }}
              >
                {t.status}
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
      </Card>
    );
  }

  export default SprintTaskList;
