export const Icon = {
  burger: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="4.5" width="16" height="1.8" rx="1" fill="currentColor" />
      <rect x="2" y="9.1" width="16" height="1.8" rx="1" fill="currentColor" />
      <rect x="2" y="13.7" width="16" height="1.8" rx="1" fill="currentColor" />
    </svg>
  ),
  close: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M4 4L16 16M16 4L4 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".9" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5" />
    </svg>
  ),
  profile: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.5" r="3" fill="currentColor" opacity=".9" />
      <path
        d="M2 13.5c0-3.314 2.686-5 6-5s6 1.686 6 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity=".7"
      />
    </svg>
  ),
  album: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect
        x="1.5"
        y="1.5"
        width="13"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity=".7"
      />
      <circle cx="5.5" cy="5.5" r="1.5" fill="currentColor" opacity=".8" />
      <path
        d="M2 11l3.5-3.5 2.5 2.5 2-2 3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity=".8"
      />
    </svg>
  ),
  collection: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M2 5h12M2 8h12M2 11h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity=".8"
      />
    </svg>
  ),
  history: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" opacity=".7" />
      <path
        d="M8 5v3.5l2.5 1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity=".9"
      />
    </svg>
  ),
  battlefield: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M2 13L8 3l6 10H2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity=".8"
      />
      <path d="M6 13V9h4v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".7" />
    </svg>
  ),
  stats: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="9" width="3" height="5" rx="1" fill="currentColor" opacity=".6" />
      <rect x="6.5" y="5" width="3" height="9" rx="1" fill="currentColor" opacity=".8" />
      <rect x="11" y="2" width="3" height="12" rx="1" fill="currentColor" opacity=".95" />
    </svg>
  ),
  scrum: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 4.5h10M3 8h10M3 11.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".85" />
      <circle cx="2.5" cy="4.5" r="1" fill="currentColor" opacity=".65" />
      <circle cx="2.5" cy="8" r="1" fill="currentColor" opacity=".85" />
      <circle cx="2.5" cy="11.5" r="1" fill="currentColor" opacity=".65" />
    </svg>
  ),
  favorite: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 13s-6-3.5-6-7a4 4 0 018 0 4 4 0 018 0c0 3.5-6 7-6 7z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity=".8"
      />
    </svg>
  ),
  replays: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <polygon points="5,3 13,8 5,13" fill="currentColor" opacity=".85" />
      <rect x="2" y="3" width="2" height="10" rx="1" fill="currentColor" opacity=".6" />
    </svg>
  ),
  credit: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="3.5" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" opacity=".7" />
      <path d="M1.5 7h13" stroke="currentColor" strokeWidth="1.5" opacity=".6" />
      <rect x="3.5" y="9.5" width="4" height="1.5" rx=".75" fill="currentColor" opacity=".6" />
    </svg>
  ),
  chevron: (open: boolean) => (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.3s ease",
      }}
    >
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  badge: (
    <span
      style={{
        fontSize: 8,
        fontFamily: "'DM Mono', monospace",
        fontWeight: 800,
        color: "#060d1f",
        background: "#00e5a0",
        padding: "1px 5px",
        borderRadius: 99,
        letterSpacing: "0.05em",
      }}
    >
      NEW
    </span>
  ),
  logo: (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <polygon points="14,2 26,9 26,19 14,26 2,19 2,9" fill="none" stroke="url(#logoGrad)" strokeWidth="2" />
      <polygon points="14,7 21,11 21,17 14,21 7,17 7,11" fill="url(#logoGrad)" opacity="0.3" />
      <circle cx="14" cy="14" r="3" fill="url(#logoGrad)" />
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="28" y2="28">
          <stop stopColor="#00c8ff" />
          <stop offset="1" stopColor="#00e5a0" />
        </linearGradient>
      </defs>
    </svg>
  ),
} as const;

export type IconKey = Exclude<keyof typeof Icon, "badge" | "chevron" | "logo">;

export default Icon;
