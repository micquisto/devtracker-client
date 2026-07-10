import { StyledSelect } from "@/components/shared/Elements";
import { SPRINT_BOARD_HISTORY } from "@/data/SprintBoard.data";
import { Palette } from "@/lib/theme";
import { groupSprintsByYearQuarter } from "@/lib/utils/scrum/sprintListing.utils";
import type { ReactNode } from "react";
import "@/assets/styles/SprintGroupedSelect.css";

export type SprintStatus = "open" | "active" | "closed";

export type SprintFilterOption = {
  value: string;
  label: string;
  status: SprintStatus;
  year?: number | null;
  quarter?: number | null;
  startDate?: string | null;
  endDate?: string | null;
};

type SprintFilterProps = {
  selectedSprint: string;
  onSprintChange: (value: string) => void;
  options?: SprintFilterOption[];
  actions?: ReactNode;
};

export const SPRINT_STATUS_STYLE: Record<
  SprintStatus,
  { color: string; background: string; border: string }
> = {
  open: {
    color: "#00c8ff",
    background: "rgba(0,200,255,0.12)",
    border: "rgba(0,200,255,0.45)",
  },
  active: {
    color: "#00e5a0",
    background: "rgba(0,229,160,0.12)",
    border: "rgba(0,229,160,0.45)",
  },
  closed: {
    color: "rgba(160,210,255,0.72)",
    background: "rgba(160,210,255,0.08)",
    border: "rgba(160,210,255,0.24)",
  },
};

export const sprintFilterOptions: SprintFilterOption[] = [
  { value: "current", label: "Current Sprint", status: "active" },
  ...SPRINT_BOARD_HISTORY.slice(0, -1)
    .reverse()
    .map((sprint) => ({
      value: sprint.sprint,
      label: sprint.sprint,
      status: "closed" as SprintStatus,
    })),
];

export const getSprintFilterOption = (selectedSprint: string) =>
  sprintFilterOptions.find((option) => option.value === selectedSprint) ??
  sprintFilterOptions[0];

function canGroupSprintFilterOptions(options: SprintFilterOption[]): boolean {
  return (
    options.length > 0 &&
    options.every(
      (option) =>
        typeof option.year === "number" &&
        option.year > 0 &&
        typeof option.quarter === "number" &&
        option.quarter > 0,
    )
  );
}

function renderGroupedSprintFilterOptions(options: SprintFilterOption[]) {
  const groups = groupSprintsByYearQuarter(
    options.map((option) => ({
      id: option.value,
      name: option.label,
      sprint_year: option.year ?? null,
      sprint_quarter: option.quarter ?? null,
      start_date: option.startDate ?? null,
      end_date: option.endDate ?? null,
    })),
  );

  return groups.map((group) => (
    <optgroup key={group.key} label={group.label} className="sprint-quarter-group">
      {group.sprints.map((sprint) => {
        const option = options.find((item) => item.value === sprint.id);
        if (!option) {
          return null;
        }

        return (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        );
      })}
    </optgroup>
  ));
}

export default function SprintFilter({
  selectedSprint,
  onSprintChange,
  options = sprintFilterOptions,
  actions,
}: SprintFilterProps) {
  const groupedOptions = canGroupSprintFilterOptions(options);

  return (
    <div
      className="sprint-selector-row"
      style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
      }}
    >
      {actions}
      <div className="sprint-grouped-select-wrap">
        <StyledSelect
          value={selectedSprint}
          onChange={onSprintChange}
          accent={Palette.cyan}
        >
          {groupedOptions
            ? renderGroupedSprintFilterOptions(options)
            : options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
        </StyledSelect>
      </div>
    </div>
  );
}
