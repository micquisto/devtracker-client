/** CSS color functions html2canvas cannot parse. Longer names first. */
const UNSUPPORTED_COLOR_FUNCTIONS = [
  "color-mix",
  "light-dark",
  "oklch",
  "oklab",
  "lab",
  "lch",
  "hwb",
  "color",
] as const;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function findCssFunctionStart(
  cssText: string,
  functionName: string,
  fromIndex: number,
): number {
  const lower = cssText.toLowerCase();
  const needle = `${functionName.toLowerCase()}(`;
  let start = fromIndex;

  while (start < lower.length) {
    const index = lower.indexOf(needle, start);
    if (index === -1) {
      return -1;
    }

    // Avoid matching inside identifiers (e.g. "border-color(" is not "color(").
    if (index > 0 && /[a-z0-9_-]/i.test(cssText.charAt(index - 1))) {
      start = index + 1;
      continue;
    }

    return index;
  }

  return -1;
}

function replaceCssFunctionCalls(
  cssText: string,
  functionName: string,
  replacement: string,
): string {
  let index = 0;
  let output = "";

  while (index < cssText.length) {
    const start = findCssFunctionStart(cssText, functionName, index);
    if (start === -1) {
      output += cssText.slice(index);
      break;
    }

    output += cssText.slice(index, start);

    let depth = 0;
    let cursor = start + functionName.length;
    for (; cursor < cssText.length; cursor += 1) {
      const char = cssText.charAt(cursor);
      if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          cursor += 1;
          break;
        }
      }
    }

    output += replacement;
    index = cursor;
  }

  return output;
}

/** Replace modern CSS color functions with a simple fallback html2canvas can parse. */
export function replaceUnsupportedCssColorFunctions(
  cssText: string,
  replacement = "transparent",
): string {
  let result = cssText;
  for (const functionName of UNSUPPORTED_COLOR_FUNCTIONS) {
    result = replaceCssFunctionCalls(result, functionName, replacement);
  }
  return result;
}

/** Convert browser color values (including color(srgb ...)) to rgb/rgba. */
export function toHtml2CanvasColor(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "none") {
    return "rgba(0, 0, 0, 0)";
  }
  if (
    trimmed.startsWith("rgb") ||
    trimmed.startsWith("#") ||
    trimmed === "transparent" ||
    trimmed === "currentcolor"
  ) {
    return trimmed === "currentcolor" ? "rgba(230, 240, 255, 0.92)" : trimmed;
  }

  const srgb = /^color\(\s*srgb\s+([0-9.eE+-]+)\s+([0-9.eE+-]+)\s+([0-9.eE+-]+)(?:\s*\/\s*([0-9.eE+-]+))?\s*\)$/i.exec(
    trimmed,
  );
  if (srgb) {
    const red = Math.round(clamp01(Number.parseFloat(srgb[1] ?? "0")) * 255);
    const green = Math.round(clamp01(Number.parseFloat(srgb[2] ?? "0")) * 255);
    const blue = Math.round(clamp01(Number.parseFloat(srgb[3] ?? "0")) * 255);
    const alpha =
      srgb[4] !== undefined ? clamp01(Number.parseFloat(srgb[4])) : 1;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) {
      return "rgba(0, 0, 0, 0)";
    }
    context.fillStyle = "#000000";
    context.fillStyle = trimmed;
    const resolved = context.fillStyle;
    if (
      typeof resolved === "string" &&
      resolved.length > 0 &&
      !/color-mix\(|(?:^|[^a-z-])color\(/i.test(resolved)
    ) {
      return resolved;
    }
  } catch {
    // Ignore unresolved colors.
  }

  return "rgba(0, 0, 0, 0)";
}

/**
 * Prepare a cloned DOM tree for html2canvas by removing unsupported color
 * functions from stylesheets and flattening colors onto elements.
 */
export function sanitizeHtml2CanvasClone(
  sourceRoot: HTMLElement,
  clonedDocument: Document,
  clonedRoot: HTMLElement,
): void {
  const sanitizedRules: string[] = [];
  for (const styleSheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(styleSheet.cssRules)) {
        sanitizedRules.push(
          replaceUnsupportedCssColorFunctions(rule.cssText),
        );
      }
    } catch {
      // Skip cross-origin or unreadable stylesheets.
    }
  }

  clonedDocument
    .querySelectorAll("style, link[rel='stylesheet']")
    .forEach((node) => {
      if (node instanceof HTMLStyleElement) {
        node.textContent = "";
      }
      if (node instanceof HTMLLinkElement) {
        node.disabled = true;
        node.removeAttribute("href");
      }
    });

  const safeStyle = clonedDocument.createElement("style");
  safeStyle.setAttribute("data-html2canvas-safe", "true");
  safeStyle.textContent = sanitizedRules.join("\n");
  (clonedDocument.head ?? clonedDocument.documentElement).appendChild(safeStyle);

  clonedDocument.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    const styleAttribute = element.getAttribute("style");
    if (
      styleAttribute &&
      /color-mix\(|(?:^|[^a-z-])color\(|oklch\(|oklab\(|lab\(|lch\(|hwb\(|light-dark\(/i.test(
        styleAttribute,
      )
    ) {
      element.setAttribute(
        "style",
        replaceUnsupportedCssColorFunctions(
          styleAttribute,
          "rgba(230, 240, 255, 0.92)",
        ),
      );
    }
  });

  const sourceElements = [
    sourceRoot,
    ...Array.from(sourceRoot.querySelectorAll("*")),
  ];
  const clonedElements = [
    clonedRoot,
    ...Array.from(clonedRoot.querySelectorAll("*")),
  ];
  const count = Math.min(sourceElements.length, clonedElements.length);

  for (let index = 0; index < count; index += 1) {
    const source = sourceElements[index];
    const clone = clonedElements[index];
    if (
      !(source instanceof HTMLElement || source instanceof SVGElement) ||
      !(clone instanceof HTMLElement || clone instanceof SVGElement)
    ) {
      continue;
    }

    const computed = window.getComputedStyle(source);
    const color = toHtml2CanvasColor(computed.color);
    const backgroundColor = toHtml2CanvasColor(computed.backgroundColor);
    const borderTopColor = toHtml2CanvasColor(computed.borderTopColor);
    const borderRightColor = toHtml2CanvasColor(computed.borderRightColor);
    const borderBottomColor = toHtml2CanvasColor(computed.borderBottomColor);
    const borderLeftColor = toHtml2CanvasColor(computed.borderLeftColor);

    clone.style.setProperty("color", color, "important");
    clone.style.setProperty("background-color", backgroundColor, "important");
    clone.style.setProperty("background-image", "none", "important");
    clone.style.setProperty("box-shadow", "none", "important");
    clone.style.setProperty("text-shadow", "none", "important");
    clone.style.setProperty("filter", "none", "important");
    clone.style.setProperty(
      "border-top",
      `${computed.borderTopWidth} ${computed.borderTopStyle} ${borderTopColor}`,
      "important",
    );
    clone.style.setProperty(
      "border-right",
      `${computed.borderRightWidth} ${computed.borderRightStyle} ${borderRightColor}`,
      "important",
    );
    clone.style.setProperty(
      "border-bottom",
      `${computed.borderBottomWidth} ${computed.borderBottomStyle} ${borderBottomColor}`,
      "important",
    );
    clone.style.setProperty(
      "border-left",
      `${computed.borderLeftWidth} ${computed.borderLeftStyle} ${borderLeftColor}`,
      "important",
    );

    const fill = computed.fill;
    const stroke = computed.stroke;
    if (fill && fill !== "none") {
      clone.style.setProperty("fill", toHtml2CanvasColor(fill), "important");
    }
    if (stroke && stroke !== "none") {
      clone.style.setProperty(
        "stroke",
        toHtml2CanvasColor(stroke),
        "important",
      );
    }
  }
}
