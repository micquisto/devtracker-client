import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

type ThemedDatePickerProps = {
  disabled?: boolean;
  min?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CALENDAR_WIDTH = 304;
const CALENDAR_GAP = 8;
const VIEWPORT_PADDING = 12;
const ESTIMATED_CALENDAR_HEIGHT = 332;

function getViewportBounds() {
  const visualViewport = window.visualViewport;

  return {
    height: visualViewport?.height ?? window.innerHeight,
    offsetLeft: visualViewport?.offsetLeft ?? 0,
    offsetTop: visualViewport?.offsetTop ?? 0,
    width: visualViewport?.width ?? window.innerWidth,
  };
}

function computeCalendarPosition(
  triggerRect: DOMRect,
  menuHeight: number,
): Pick<CSSProperties, "left" | "maxHeight" | "top" | "width"> {
  const viewport = getViewportBounds();
  const width = Math.min(
    CALENDAR_WIDTH,
    Math.max(240, viewport.width - VIEWPORT_PADDING * 2),
  );
  const maxHeight = Math.max(220, viewport.height - VIEWPORT_PADDING * 2);
  const resolvedMenuHeight = Math.min(menuHeight, maxHeight);
  const viewportTop = viewport.offsetTop;
  const viewportBottom = viewport.offsetTop + viewport.height;
  const viewportLeft = viewport.offsetLeft;
  const viewportRight = viewport.offsetLeft + viewport.width;

  let left = triggerRect.left + (triggerRect.width - width) / 2;
  left = Math.min(
    Math.max(viewportLeft + VIEWPORT_PADDING, left),
    viewportRight - width - VIEWPORT_PADDING,
  );

  const spaceBelow = viewportBottom - triggerRect.bottom - CALENDAR_GAP;
  const spaceAbove = triggerRect.top - viewportTop - CALENDAR_GAP;
  const openBelow = spaceBelow >= resolvedMenuHeight || spaceBelow >= spaceAbove;

  let top = openBelow
    ? triggerRect.bottom + CALENDAR_GAP
    : triggerRect.top - resolvedMenuHeight - CALENDAR_GAP;

  top = Math.min(
    Math.max(viewportTop + VIEWPORT_PADDING, top),
    viewportBottom - resolvedMenuHeight - VIEWPORT_PADDING,
  );

  return {
    left,
    maxHeight,
    top,
    width,
  };
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(value: string): string {
  const date = parseDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, offset: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
}

function buildCalendarDays(monthDate: Date): Date[] {
  const monthStart = getMonthStart(monthDate);
  const gridStart = new Date(monthStart);
  gridStart.setUTCDate(monthStart.getUTCDate() - monthStart.getUTCDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    return date;
  });
}

export default function ThemedDatePicker({
  disabled = false,
  min,
  onChange,
  placeholder = "Select date",
  value,
}: ThemedDatePickerProps) {
  const calendarId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedDate = parseDate(value);
  const minDate = parseDate(min ?? "");
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [visibleMonth, setVisibleMonth] = useState<Date>(
    getMonthStart(selectedDate ?? minDate ?? new Date()),
  );
  const calendarDays = useMemo(
    () => buildCalendarDays(visibleMonth),
    [visibleMonth],
  );

  useEffect(() => {
    if (selectedDate) setVisibleMonth(getMonthStart(selectedDate));
  }, [value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const updateMenuPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }

      const menuHeight =
        menuRef.current?.getBoundingClientRect().height ??
        ESTIMATED_CALENDAR_HEIGHT;

      setMenuStyle({
        position: "fixed",
        zIndex: 1300,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        ...computeCalendarPosition(trigger.getBoundingClientRect(), menuHeight),
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    window.visualViewport?.addEventListener("resize", updateMenuPosition);
    window.visualViewport?.addEventListener("scroll", updateMenuPosition);

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) {
        return;
      }

      if (menuRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.visualViewport?.removeEventListener("resize", updateMenuPosition);
      window.visualViewport?.removeEventListener("scroll", updateMenuPosition);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !menuRef.current || !triggerRef.current) {
      return;
    }

    const menuHeight = menuRef.current.getBoundingClientRect().height;
    setMenuStyle({
      position: "fixed",
      zIndex: 1300,
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
      ...computeCalendarPosition(
        triggerRef.current.getBoundingClientRect(),
        menuHeight,
      ),
    });
  }, [open, visibleMonth]);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <button
        ref={triggerRef}
        aria-controls={calendarId}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        type="button"
        style={{
          alignItems: "center",
          background: "rgba(9,18,38,0.84)",
          border: "1px solid rgba(100,180,255,0.18)",
          borderRadius: 11,
          color: value ? "rgba(232,244,255,0.9)" : "rgba(140,185,230,0.42)",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          fontWeight: 700,
          justifyContent: "space-between",
          minHeight: 41,
          opacity: disabled ? 0.68 : 1,
          outline: "none",
          padding: "10px 12px",
          textAlign: "left",
          width: "100%",
        }}
      >
        <span>{value ? formatDisplayDate(value) : placeholder}</span>
        <span
          aria-hidden="true"
          style={{
            color: "#00c8ff",
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          CAL
        </span>
      </button>

      {open && !disabled
        ? createPortal(
            <div
              ref={menuRef}
              id={calendarId}
              role="dialog"
              aria-label="Choose date"
              style={{
                ...menuStyle,
                background:
                  "linear-gradient(145deg, rgba(8,16,34,0.98), rgba(6,13,31,0.98))",
                border: "1px solid rgba(0,200,255,0.28)",
                borderRadius: 16,
                boxShadow:
                  "0 20px 60px rgba(0,0,0,0.45), 0 0 28px rgba(0,200,255,0.14)",
                color: "rgba(232,244,255,0.9)",
                padding: 12,
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <button
                  onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
                  type="button"
                  style={navButtonStyle}
                >
                  {"<"}
                </button>
                <div
                  style={{
                    color: "#e8f4ff",
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {MONTH_LABELS[visibleMonth.getUTCMonth()]}{" "}
                  {visibleMonth.getUTCFullYear()}
                </div>
                <button
                  onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
                  type="button"
                  style={navButtonStyle}
                >
                  {">"}
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 5,
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                }}
              >
                {WEEKDAY_LABELS.map((day) => (
                  <div
                    key={day}
                    style={{
                      color: "rgba(100,180,255,0.58)",
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 9,
                      fontWeight: 900,
                      textAlign: "center",
                      textTransform: "uppercase",
                    }}
                  >
                    {day}
                  </div>
                ))}
                {calendarDays.map((date) => {
                  const dateValue = formatDateValue(date);
                  const isCurrentMonth =
                    date.getUTCMonth() === visibleMonth.getUTCMonth();
                  const isSelected = value === dateValue;
                  const isDisabled = Boolean(minDate && date < minDate);

                  return (
                    <button
                      disabled={isDisabled}
                      key={dateValue}
                      onClick={() => {
                        onChange(dateValue);
                        setOpen(false);
                      }}
                      type="button"
                      style={{
                        alignItems: "center",
                        background: isSelected
                          ? "linear-gradient(135deg, rgba(0,200,255,0.36), rgba(0,229,160,0.2))"
                          : "rgba(255,255,255,0.035)",
                        border: isSelected
                          ? "1px solid rgba(0,200,255,0.78)"
                          : "1px solid rgba(100,180,255,0.1)",
                        borderRadius: 10,
                        color: isDisabled
                          ? "rgba(140,185,230,0.24)"
                          : isCurrentMonth
                            ? "#e8f4ff"
                            : "rgba(140,185,230,0.42)",
                        cursor: isDisabled ? "not-allowed" : "pointer",
                        display: "flex",
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 11,
                        fontWeight: 900,
                        height: 34,
                        justifyContent: "center",
                        opacity: isDisabled ? 0.6 : 1,
                        boxShadow: isSelected
                          ? "0 0 14px rgba(0,200,255,0.22)"
                          : "none",
                      }}
                    >
                      {date.getUTCDate()}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

const navButtonStyle = {
  background: "rgba(0,200,255,0.08)",
  border: "1px solid rgba(0,200,255,0.24)",
  borderRadius: 9,
  color: "#00c8ff",
  cursor: "pointer",
  fontFamily: "'DM Mono', monospace",
  fontSize: 12,
  fontWeight: 900,
  height: 30,
  width: 34,
};
