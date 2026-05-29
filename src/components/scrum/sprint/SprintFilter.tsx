import { StyledSelect } from "@/components/shared/Elements";
import { SPRINT_BOARD_HISTORY } from "@/data/SprintBoard.data";

export type SprintStatus = "open" | "active" | "closed";

type SprintFilterOption = {
  value: string;
  label: string;
  status: SprintStatus;
};

type SprintFilterProps = {
  selectedSprint: string;
  onSprintChange: (value: string) => void;
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

export default function SprintFilter({
  selectedSprint,
  onSprintChange,
}: SprintFilterProps) {
  const selectedSprintOption = getSprintFilterOption(selectedSprint);
  const selectedSprintStatusStyle =
    SPRINT_STATUS_STYLE[selectedSprintOption.status];

  return (
    <div
      className="sprint-selector-row"
      style={{
        display: "flex",
        justifyContent: "flex-end",
        marginBottom: 12,
      }}
    >
      <StyledSelect
        value={selectedSprint}
        onChange={onSprintChange}
        accent={selectedSprintStatusStyle.color}
      >
        {sprintFilterOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </StyledSelect>
    </div>
  );
}
