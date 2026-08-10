import { StyledSelect } from "@/components/shared/Elements";
import { Palette } from "@/lib/theme";
import {
  groupSprintsByYearQuarter,
  type SprintListingLike,
} from "@/lib/utils/scrum/sprintListing.utils";
import "@/assets/styles/SprintGroupedSelect.css";

type SprintGroupedSelectProps<T extends SprintListingLike> = {
  sprints: T[];
  value: string;
  onChange: (value: string) => void;
  getLabel: (sprint: T) => string;
  placeholder?: string;
  accent?: string;
  disabled?: boolean;
  emptyMessage?: string;
};

export function SprintGroupedSelectOptions<T extends SprintListingLike>({
  sprints,
  getLabel,
}: {
  sprints: T[];
  getLabel: (sprint: T) => string;
}) {
  const groups = groupSprintsByYearQuarter(sprints);

  return (
    <>
      {groups.map((group) => (
        <optgroup
          key={group.key}
          label={group.label}
          className="sprint-quarter-group"
        >
          {group.sprints.map((sprint) => (
            <option key={sprint.id ?? group.key} value={sprint.id ?? ""}>
              {getLabel(sprint)}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

export default function SprintGroupedSelect<T extends SprintListingLike>({
  sprints,
  value,
  onChange,
  getLabel,
  placeholder,
  accent = Palette.cyan,
  disabled = false,
  emptyMessage = "No sprints available",
}: SprintGroupedSelectProps<T>) {
  const groups = groupSprintsByYearQuarter(sprints);

  return (
    <div className="sprint-grouped-select-wrap">
      <StyledSelect
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        accent={accent}
        disabled={disabled}
      >
        {sprints.length === 0 ? (
          <option value="">{emptyMessage}</option>
        ) : (
          groups.map((group) => (
            <optgroup key={group.key} label={group.label}>
              {group.sprints.map((sprint) => (
                <option key={sprint.id ?? group.key} value={sprint.id ?? ""}>
                  {getLabel(sprint)}
                </option>
              ))}
            </optgroup>
          ))
        )}
      </StyledSelect>
    </div>
  );
}
