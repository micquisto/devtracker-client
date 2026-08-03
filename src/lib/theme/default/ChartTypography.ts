/**
 * Graph/chart label typography site-wide.
 * Uses CSS `px` (not SVG user units) so size stays stable across viewBox scaling.
 */
export const ChartLabelTypography = {
  fontSizePx: 9,
  fontFamily: "'DM Mono',monospace",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "rgba(160, 210, 255, 0.82)",
  lineHeight: 1.25,
  maxLines: 4,
} as const;

export const CHART_LABEL_FONT_SIZE = ChartLabelTypography.fontSizePx;
export const CHART_LABEL_FONT_FAMILY = ChartLabelTypography.fontFamily;
export const CHART_LABEL_FONT_WEIGHT = ChartLabelTypography.fontWeight;
export const CHART_LABEL_LETTER_SPACING = ChartLabelTypography.letterSpacing;
export const CHART_LABEL_TEXT_TRANSFORM = ChartLabelTypography.textTransform;
export const CHART_LABEL_COLOR = ChartLabelTypography.color;
export const CHART_LABEL_LINE_HEIGHT = ChartLabelTypography.lineHeight;
export const CHART_LABEL_MAX_LINES = ChartLabelTypography.maxLines;
export const CHART_LABEL_LINE_HEIGHT_PX = Math.ceil(
  CHART_LABEL_FONT_SIZE * CHART_LABEL_LINE_HEIGHT,
);

/** CSS style object for HTML chart labels (wraps instead of clipping) */
export const chartLabelStyle = {
  fontSize: `${CHART_LABEL_FONT_SIZE}px`,
  fontFamily: CHART_LABEL_FONT_FAMILY,
  fontWeight: CHART_LABEL_FONT_WEIGHT,
  letterSpacing: CHART_LABEL_LETTER_SPACING,
  textTransform: CHART_LABEL_TEXT_TRANSFORM,
  lineHeight: CHART_LABEL_LINE_HEIGHT,
  whiteSpace: "normal" as const,
  overflowWrap: "anywhere" as const,
  wordBreak: "break-word" as const,
} as const;

export const CHART_LEGEND_FONT_SIZE = 13;

/** CSS style for chart legend text (10px across all graphs). */
export const chartLegendStyle = {
  fontSize: `${CHART_LEGEND_FONT_SIZE}px`,
  fontFamily: CHART_LABEL_FONT_FAMILY,
  fontWeight: CHART_LABEL_FONT_WEIGHT,
  letterSpacing: CHART_LABEL_LETTER_SPACING,
  textTransform: CHART_LABEL_TEXT_TRANSFORM,
  lineHeight: 1.3,
  whiteSpace: "normal" as const,
  overflowWrap: "anywhere" as const,
  wordBreak: "break-word" as const,
} as const;

/**
 * SVG text props. Prefer CSS `px` + `.chart-label`.
 * Do not set a presentation `fontSize` attribute (that would be viewBox units).
 */
export const chartLabelSvgProps = {
  className: "chart-label",
  style: {
    fontSize: `${CHART_LABEL_FONT_SIZE}px`,
    fontFamily: CHART_LABEL_FONT_FAMILY,
    fontWeight: CHART_LABEL_FONT_WEIGHT,
    letterSpacing: CHART_LABEL_LETTER_SPACING,
    textTransform: CHART_LABEL_TEXT_TRANSFORM,
  },
} as const;

/** Wrap chart labels so they stay visible instead of being clipped/truncated. */
export function wrapChartLabel(
  label: string,
  maxWidthPx: number,
  fontSize: number = CHART_LABEL_FONT_SIZE,
  maxLines: number = CHART_LABEL_MAX_LINES,
): string[] {
  const trimmed = label.trim();
  if (!trimmed) {
    return [""];
  }

  // Mono + uppercase + letter-spacing (~0.12em) reads wider than plain glyphs.
  const avgCharWidth = fontSize * 0.95;
  // Prefer whole words; only hard-break when clearly longer than the column.
  const maxChars = Math.max(6, Math.floor(maxWidthPx / avgCharWidth));
  const hardBreakChars = Math.max(maxChars, 6);
  const words = trimmed.split(/\s+/u);
  const lines: string[] = [];
  let current = "";

  const pushHardBroken = (word: string) => {
    let rest = word;
    while (rest.length > hardBreakChars) {
      lines.push(rest.slice(0, hardBreakChars));
      rest = rest.slice(hardBreakChars);
      if (lines.length >= maxLines) {
        return;
      }
    }
    current = rest;
  };

  for (const word of words) {
    if (lines.length >= maxLines) {
      break;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
      if (lines.length >= maxLines) {
        break;
      }
    }

    // Keep short words intact (e.g. "sprint") instead of "sprin"/"t".
    if (word.length > hardBreakChars) {
      pushHardBroken(word);
    } else {
      current = word;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (lines.length === 0) {
    return [trimmed.slice(0, maxChars)];
  }

  const usedLength = lines.join(" ").length;
  if (usedLength < trimmed.length && lines.length > 0) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] =
      last.length > 1 ? `${last.slice(0, Math.max(1, last.length - 1))}…` : "…";
  }

  return lines;
}
