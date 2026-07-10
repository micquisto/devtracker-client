import { Palette, Text } from "@/lib/theme";
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import "@/assets/styles/StyledSelect.css";

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectGroup = {
  label: string;
  options: SelectOption[];
};

function parseSelectChildren(children: ReactNode): {
  groups: SelectGroup[];
  options: SelectOption[];
} {
  const groups: SelectGroup[] = [];
  const options: SelectOption[] = [];

  const walk = (nodes: ReactNode) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) {
        return;
      }

      if (child.type === "option") {
        const { value = "", children: label, disabled } = child.props as {
          value?: string;
          children?: ReactNode;
          disabled?: boolean;
        };

        options.push({
          value: String(value),
          label: String(label ?? ""),
          disabled,
        });
        return;
      }

      if (child.type === "optgroup") {
        const { label, children: groupChildren } = child.props as {
          label?: string;
          children?: ReactNode;
        };
        const groupOptions: SelectOption[] = [];

        Children.forEach(groupChildren, (groupChild) => {
          if (!isValidElement(groupChild) || groupChild.type !== "option") {
            return;
          }

          const { value = "", children: optionLabel, disabled } =
            groupChild.props as {
              value?: string;
              children?: ReactNode;
              disabled?: boolean;
            };

          groupOptions.push({
            value: String(value),
            label: String(optionLabel ?? ""),
            disabled,
          });
        });

        groups.push({
          label: String(label ?? ""),
          options: groupOptions,
        });
        return;
      }

      const nestedChildren = (child.props as { children?: ReactNode }).children;
      if (nestedChildren) {
        walk(nestedChildren);
      }
    });
  };

  walk(children);

  return { groups, options };
}

function findSelectedLabel(
  value: string,
  groups: SelectGroup[],
  options: SelectOption[],
): string | null {
  for (const option of options) {
    if (option.value === value) {
      return option.label;
    }
  }

  for (const group of groups) {
    for (const option of group.options) {
      if (option.value === value) {
        return option.label;
      }
    }
  }

  return null;
}

function hasSelectableItems(groups: SelectGroup[], options: SelectOption[]) {
  if (options.length > 0) {
    return true;
  }

  return groups.some((group) => group.options.length > 0);
}

const StyledSelect = ({
  value,
  onChange,
  placeholder,
  children,
  accent = Palette.cyan,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  children: ReactNode;
  accent?: string;
  disabled?: boolean;
}) => {
  const listboxId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const { groups, options } = useMemo(
    () => parseSelectChildren(children),
    [children],
  );
  const isEmpty = value === "" || value === undefined;
  const selectedLabel = findSelectedLabel(value, groups, options);
  const displayLabel = selectedLabel ?? placeholder ?? "Select";
  const hasItems = hasSelectableItems(groups, options);

  useEffect(() => {
    if (!open) {
      return;
    }

    const updateMenuPosition = () => {
      const trigger = wrapRef.current;
      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
        zIndex: 1200,
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        const menu = document.getElementById(listboxId);
        if (menu?.contains(event.target as Node)) {
          return;
        }

        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [listboxId, open]);

  const handleSelect = (nextValue: string, isDisabled?: boolean) => {
    if (disabled || isDisabled) {
      return;
    }

    onChange(nextValue);
    setOpen(false);
  };

  const renderOption = (option: SelectOption) => {
    const isSelected = option.value === value;

    return (
      <button
        key={`${option.value}-${option.label}`}
        type="button"
        role="option"
        aria-selected={isSelected}
        className={`styled-select-option${isSelected ? " is-selected" : ""}`}
        disabled={option.disabled}
        onClick={() => handleSelect(option.value, option.disabled)}
      >
        {option.label}
      </button>
    );
  };

  return (
    <div className="styled-select-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`styled-select-trigger${isEmpty ? " is-empty" : ""}${
          open ? " is-open" : ""
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        disabled={disabled}
        style={{
          borderColor: isEmpty ? "rgba(100,180,255,0.2)" : `${accent}88`,
        }}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current);
          }
        }}
      >
        <span className="styled-select-trigger__label">{displayLabel}</span>
        <svg
          className="styled-select-trigger__chevron"
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2 3.5l3 3 3-3"
            stroke={isEmpty ? Text.muted : accent}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open
        ? createPortal(
            <div
              id={listboxId}
              className="styled-select-menu"
              role="listbox"
              aria-label={placeholder ?? "Select option"}
              style={menuStyle}
            >
              {!hasItems ? (
                <div className="styled-select-empty">No options available</div>
              ) : groups.length > 0 ? (
                groups.map((group) => (
                  <div key={group.label}>
                    <div className="styled-select-group-label">{group.label}</div>
                    {group.options.map((option) => renderOption(option))}
                  </div>
                ))
              ) : (
                options.map((option) => renderOption(option))
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};

export default StyledSelect;
