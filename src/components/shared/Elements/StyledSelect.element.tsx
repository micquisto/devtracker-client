import { Background, Border, Palette, Text } from "@/lib/theme";

/* ── Reusable styled native <select> ── */
const StyledSelect = ({
    value,
    onChange,
    placeholder,
    children,
    accent = Palette.cyan,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    children: React.ReactNode;
    accent?: string;
  }) =>{
    const isEmpty = value === "" || value === undefined;
    return (
      <div style={{ position: "relative" as const, flexShrink: 0 }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            appearance: "none" as const,
            WebkitAppearance: "none" as const,
            MozAppearance: "none" as const,
            padding: "7px 32px 7px 12px",
            borderRadius: 9,
            border: `1px solid ${isEmpty ? Border.select : accent + "88"}`,
            background: isEmpty ? Background.select : Background.selectActive,
            color: isEmpty ? Text.muted : Text.primary,
            fontSize: 11,
            fontFamily: "'DM Mono',monospace",
            fontWeight: 700,
            cursor: "pointer",
            outline: "none",
            minWidth: 148,
            transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
            boxShadow: "none",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = accent;
            e.currentTarget.style.boxShadow = `0 0 0 2px ${accent}28`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = isEmpty
              ? Border.select
              : `${accent}88`;
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {children}
        </select>
        {/* Chevron icon */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          style={{
            position: "absolute" as const,
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none" as const,
            opacity: 0.7,
          }}
        >
          <path
            d="M2 3.5l3 3 3-3"
            stroke={isEmpty ? Text.muted : accent}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  } 

  export default StyledSelect;