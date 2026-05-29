import { StyledSelect, DropArrow } from "@/components/shared/Elements";
import type { FilterState, FilterMode } from "@/interfaces";
import { FilterAccent } from "@/lib/theme";
import { QUARTERS, FILTER_YEARS, QUARTER_SPRINT_COUNT, MONTHS } from "@/data/Mock.data";
import { getFilterLabel } from "@/lib/utils";

/* ── Main filter bar ── */
const SprintFilterBar =({
    filter,
    setFilter,
  }: {
    filter: FilterState;
    setFilter: (f: FilterState) => void;
  }) => {
    const modeColor = FilterAccent;
    const accent = modeColor[filter.mode];
  
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap" as const,
        }}
      >
        {/* ── 1st: Mode selector ── */}
        <StyledSelect
          value={filter.mode}
          onChange={(v) => setFilter({ mode: v as FilterMode })}
          accent={accent}
        >
          <option value="current">Current Sprint</option>
          <option value="sprint">By Sprint</option>
          <option value="month">By Month</option>
          <option value="quarter">By Quarter</option>
          <option value="year">By Year</option>
        </StyledSelect>
  
        {/* ════════════════════════════════════
            BY SPRINT  →  Year → Quarter → Sprint
            ════════════════════════════════════ */}
        {filter.mode === "sprint" && (
          <>
            <DropArrow />
            <StyledSelect
              value={String(filter.sprintYear ?? "")}
              placeholder="Select year…"
              onChange={(v) =>
                setFilter({ mode: "sprint", sprintYear: Number(v) })
              }
              accent={FilterAccent.sprint}
            >
              {FILTER_YEARS.slice()
                .reverse()
                .map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
            </StyledSelect>
  
            {filter.sprintYear !== undefined && (
              <>
                <DropArrow />
                <StyledSelect
                  value={String(filter.sprintQuarter ?? "")}
                  placeholder="Select quarter…"
                  onChange={(v) =>
                    setFilter({
                      ...filter,
                      sprintQuarter: Number(v),
                      sprintNum: undefined,
                    })
                  }
                  accent={FilterAccent.sprint}
                >
                  {QUARTERS.map((q, i) => (
                    <option key={i + 1} value={i + 1}>
                      {q}
                    </option>
                  ))}
                </StyledSelect>
              </>
            )}
  
            {filter.sprintYear !== undefined &&
              filter.sprintQuarter !== undefined && (
                <>
                  <DropArrow />
                  <StyledSelect
                    value={String(filter.sprintNum ?? "")}
                    placeholder="Select sprint…"
                    onChange={(v) =>
                      setFilter({ ...filter, sprintNum: Number(v) })
                    }
                    accent={FilterAccent.sprint}
                  >
                    {Array.from({ length: QUARTER_SPRINT_COUNT }, (_, i) => {
                      const globalNum = (filter.sprintQuarter! - 1) * 7 + (i + 1);
                      return (
                        <option key={i + 1} value={i + 1}>
                          Sprint {globalNum}
                        </option>
                      );
                    })}
                  </StyledSelect>
                </>
              )}
          </>
        )}
  
        {/* ════════════════════════════════════
            BY MONTH  →  Month picker
            ════════════════════════════════════ */}
        {filter.mode === "month" && (
          <>
            <DropArrow />
            <StyledSelect
              value={filter.month !== undefined ? String(filter.month) : ""}
              placeholder="Select month…"
              onChange={(v) => setFilter({ ...filter, month: Number(v) })}
              accent={FilterAccent.month}
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i}>
                  {m}
                </option>
              ))}
            </StyledSelect>
          </>
        )}
  
        {/* ════════════════════════════════════
            BY QUARTER  →  Year → Quarter
            ════════════════════════════════════ */}
        {filter.mode === "quarter" && (
          <>
            <DropArrow />
            <StyledSelect
              value={String(filter.quarterYear ?? "")}
              placeholder="Select year…"
              onChange={(v) =>
                setFilter({ mode: "quarter", quarterYear: Number(v) })
              }
              accent={FilterAccent.quarter}
            >
              {FILTER_YEARS.slice()
                .reverse()
                .map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
            </StyledSelect>
  
            {filter.quarterYear !== undefined && (
              <>
                <DropArrow />
                <StyledSelect
                  value={String(filter.quarter ?? "")}
                  placeholder="Select quarter…"
                  onChange={(v) => setFilter({ ...filter, quarter: Number(v) })}
                  accent={FilterAccent.quarter}
                >
                  {QUARTERS.map((q, i) => (
                    <option key={i + 1} value={i + 1}>
                      {q}
                    </option>
                  ))}
                </StyledSelect>
              </>
            )}
          </>
        )}
  
        {/* ════════════════════════════════════
            BY YEAR  →  Year picker
            ════════════════════════════════════ */}
        {filter.mode === "year" && (
          <>
            <DropArrow />
            <StyledSelect
              value={String(filter.year ?? "")}
              placeholder="Select year…"
              onChange={(v) => setFilter({ ...filter, year: Number(v) })}
              accent={FilterAccent.year}
            >
              {FILTER_YEARS.slice()
                .reverse()
                .map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
            </StyledSelect>
          </>
        )}
  
        {/* ── Active filter badge ── */}
        {filter.mode !== "current" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px 5px 8px",
              borderRadius: 99,
              background: `${accent}12`,
              border: `1px solid ${accent}40`,
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: accent,
                boxShadow: `0 0 5px ${accent}`,
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontFamily: "'DM Mono',monospace",
                fontWeight: 700,
                color: accent,
                whiteSpace: "nowrap" as const,
              }}
            >
              {getFilterLabel(filter)}
            </span>
            {/* Clear button */}
            <button
              onClick={() => setFilter({ mode: filter.mode })}
              title="Clear selection"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: `${accent}99`,
                padding: "0 0 0 2px",
                fontSize: 12,
                lineHeight: 1,
                fontFamily: "monospace",
                display: "flex",
                alignItems: "center",
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    );
  }

  export default SprintFilterBar;