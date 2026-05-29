/** Core brand palette */
export const Palette = {
  cyan: "#00c8ff",
  green: "#00e5a0",
  gold: "#f5c842",
  purple: "#a78bfa",
  pink: "#ff6eb4",
  red: "#ff4757",
  redSoft: "#ff6b6b",
  orange: "#ff9f43",
  indigo: "#6b89ff",
  white: "#e8f4ff",
  navy: "#060d1f",
  navyMid: "#0a1628",
} as const;

/** Typography colors */
export const Text = {
  primary: Palette.white,
  bright: "rgba(200,225,255,0.85)",
  body: "rgba(180,215,255,0.85)",
  label: "rgba(160,210,255,0.7)",
  muted: "rgba(140,185,230,0.6)",
  subtle: "rgba(120,170,215,0.6)",
  faint: "rgba(100,160,210,0.5)",
  dim: "rgba(80,130,180,0.5)",
  dimmer: "rgba(80,130,180,0.4)",
  section: "rgba(100,180,255,0.55)",
  accent: "rgba(140,190,240,0.8)",
  cyanMuted: "rgba(0,200,255,0.55)",
  cyanFaint: "rgba(0,200,255,0.45)",
  greenMuted: "rgba(0,229,160,0.7)",
  goldMuted: "rgba(245,200,66,0.6)",
  legend: "rgba(140,185,230,0.6)",
} as const;

/** Surface & overlay backgrounds */
export const Background = {
  card: "rgba(255,255,255,0.035)",
  cardSubtle: "rgba(255,255,255,0.025)",
  cardHover: "rgba(255,255,255,0.04)",
  row: "rgba(255,255,255,0.02)",
  track: "rgba(255,255,255,0.06)",
  pill: "rgba(255,255,255,0.04)",
  select: "rgba(9,18,38,0.7)",
  selectActive: "rgba(9,18,38,0.92)",
  tooltip: "rgba(10,22,44,0.95)",
  tooltipAlt: "rgba(8,16,34,0.97)",
  chartInner: "rgba(6,13,31,0.9)",
  currentPanel: "rgba(0,200,255,0.07)",
  successPanel: "rgba(0,229,160,0.07)",
  cyanPanel: "rgba(0,200,255,0.07)",
  goldPanel: "rgba(245,200,66,0.06)",
  dotHover: "rgba(0,200,255,0.05)",
  dotFill: "rgba(0,200,255,0.75)",
  rowHover: "rgba(0,200,255,0.04)",
  tabActive: "rgba(0,200,255,0.15)",
  tabActiveSoft: "rgba(0,200,255,0.1)",
  tabActiveFaint: "rgba(0,200,255,0.12)",
  tabActiveInset: "rgba(0,200,255,0.08)",
  tabHover: "rgba(0,200,255,0.05)",
  sortActive: "rgba(0,200,255,0.1)",
  filterInactive: "rgba(255,255,255,0.03)",
} as const;

/** Borders & dividers */
export const Border = {
  default: "rgba(100,180,255,0.1)",
  subtle: "rgba(100,180,255,0.08)",
  faint: "rgba(100,180,255,0.07)",
  dim: "rgba(100,180,255,0.14)",
  divider: "rgba(100,180,255,0.12)",
  hover: "rgba(0,200,255,0.2)",
  hoverSoft: "rgba(0,200,255,0.15)",
  select: "rgba(100,180,255,0.2)",
  tooltip: "rgba(0,200,255,0.3)",
  tooltipSoft: "rgba(0,200,255,0.4)",
  success: "rgba(0,229,160,0.15)",
  gold: "rgba(245,200,66,0.2)",
  grid: "rgba(100,180,255,0.07)",
  axis: "rgba(100,180,255,0.1)",
  chartStroke: "rgba(6,13,31,0.8)",
  insetActive: "inset 0 0 0 1px rgba(0,200,255,0.3)",
} as const;

/** Chart-specific tokens */
export const Chart = {
  line: Palette.cyan,
  lineGradientStart: Palette.cyan,
  lineAreaOpacityStart: 0.18,
  lineAreaOpacityEnd: 0.01,
  grid: Border.grid,
  axis: Border.axis,
  label: Text.faint,
  barDefault: "rgba(100,160,210,0.2)",
  barLabel: Text.dim,
  barValueMuted: "rgba(100,160,210,0.4)",
  highlight: Palette.gold,
  highlightLabel: Palette.gold,
  stackedLabel: Text.dim,
  stackedLegend: Text.legend,
  up: Palette.green,
  down: Palette.red,
  completed: Palette.green,
  completedBg: "rgba(0,229,160,0.35)",
  completedGradient: "linear-gradient(180deg,#00e5a0,#00e5a066)",
  completedGlow: "0 0 12px rgba(0,229,160,0.3)",
  remaining: Palette.redSoft,
  remainingBg: "rgba(255,107,107,0.35)",
  remainingBgActive: "rgba(255,107,107,0.6)",
  remainingGlow: "0 0 12px rgba(255,107,107,0.3)",
} as const;

/** Semantic / directional */
export const Semantic = {
  positive: Palette.green,
  negative: Palette.red,
  negativeSoft: Palette.redSoft,
  neutral: Palette.cyan,
  warning: Palette.gold,
} as const;

/** Filter mode accent colors */
export const FilterAccent = {
  current: Palette.green,
  sprint: Palette.cyan,
  month: Palette.gold,
  quarter: Palette.purple,
  year: Palette.pink,
} as const;

/** Default team member chart colors */
export const Team = {
  john: Palette.cyan,
  sarah: Palette.green,
  alex: Palette.gold,
  mia: Palette.pink,
  leo: Palette.purple,
} as const;

/** Task severity */
export const SeverityColor: Record<string, string> = {
  Critical: Palette.red,
  High: Palette.orange,
  Medium: Palette.gold,
  Low: Palette.green,
};

/** Task priority */
export const PriorityColor: Record<string, string> = {
  P0: Palette.red,
  P1: Palette.orange,
  P2: Palette.cyan,
  P3: Palette.purple,
};

/** Task status — foreground */
export const StatusColor: Record<string, string> = {
  Done: Palette.green,
  "In Progress": Palette.cyan,
  Review: Palette.gold,
  Blocked: Palette.red,
  Todo: Text.faint,
};

/** Task status — background */
export const StatusBg: Record<string, string> = {
  Done: "rgba(0,229,160,0.1)",
  "In Progress": "rgba(0,200,255,0.1)",
  Review: "rgba(245,200,66,0.1)",
  Blocked: "rgba(255,71,87,0.1)",
  Todo: "rgba(120,160,210,0.06)",
};

/** Aggregated export */
export const CustomColors = {
  palette: Palette,
  text: Text,
  background: Background,
  border: Border,
  chart: Chart,
  semantic: Semantic,
  filter: FilterAccent,
  team: Team,
  severity: SeverityColor,
  priority: PriorityColor,
  status: StatusColor,
  statusBg: StatusBg,
} as const;

export default CustomColors;
