import "@/assets/styles/TrelloDescription.css";
import { useState, type ReactNode } from "react";

const HEADER_PATTERN = /^(#{1,6})\s+(.+)$/;
const UNORDERED_LIST_PATTERN = /^[-*+]\s+(.+)$/;
const ORDERED_LIST_PATTERN = /^\d+\.\s+(.+)$/;
const AUTO_LINK_PATTERN =
  /^(https?:\/\/[^\s<>"']+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/;

type InlineMatch =
  | { kind: "image"; alt: string; url: string; length: number }
  | { kind: "link"; label: string; url: string; length: number }
  | { kind: "bold"; text: string; length: number }
  | { kind: "italic"; text: string; length: number }
  | { kind: "code"; text: string; length: number }
  | { kind: "autolink"; url: string; length: number };

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeUrl(url: string): string {
  return decodeHtmlEntities(url.trim());
}

function isImageUrl(url: string): boolean {
  const normalized = normalizeUrl(url).toLowerCase();
  if (!normalized) return false;

  if (/\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?|#|$)/i.test(normalized)) {
    return true;
  }

  if (/trello-attachments\.s3[\w.-]*\.amazonaws\.com/i.test(normalized)) {
    return true;
  }

  if (/trello\.com\/.*\/attachments\/.*\/(download|preview)/i.test(normalized)) {
    return true;
  }

  if (/\/previews\/.*\/download/i.test(normalized)) {
    return true;
  }

  return false;
}

function preprocessTrelloContent(content: string): string {
  return content.replace(
    /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi,
    (_match, src: string) => `\n\n![attachment](${normalizeUrl(src)})\n\n`,
  );
}

function parseMarkdownWithUrl(
  text: string,
  opener: string,
): { label: string; url: string; length: number } | null {
  if (!text.startsWith(opener)) return null;

  const labelEnd = text.indexOf("](", opener.length - 1);
  if (labelEnd === -1) return null;

  const label = text.slice(opener.length, labelEnd);
  let index = labelEnd + 2;

  if (text[index] !== "(") return null;
  index += 1;

  let depth = 1;
  const urlStart = index;

  while (index < text.length && depth > 0) {
    if (text[index] === "(") depth += 1;
    else if (text[index] === ")") depth -= 1;
    if (depth > 0) index += 1;
  }

  if (depth !== 0) return null;

  return {
    label,
    url: normalizeUrl(text.slice(urlStart, index)),
    length: index + 1,
  };
}

function findNextInlineMatch(text: string): InlineMatch | null {
  const imageMatch = parseMarkdownWithUrl(text, "![");
  if (imageMatch) {
    return {
      kind: "image",
      alt: imageMatch.label,
      url: imageMatch.url,
      length: imageMatch.length,
    };
  }

  const linkMatch = parseMarkdownWithUrl(text, "[");
  if (linkMatch) {
    return {
      kind: "link",
      label: linkMatch.label,
      url: linkMatch.url,
      length: linkMatch.length,
    };
  }

  const boldMatch = text.match(/^\*\*([^*]+)\*\*/);
  if (boldMatch) {
    return {
      kind: "bold",
      text: boldMatch[1],
      length: boldMatch[0].length,
    };
  }

  const italicMatch = text.match(/^\*([^*]+)\*/);
  if (italicMatch) {
    return {
      kind: "italic",
      text: italicMatch[1],
      length: italicMatch[0].length,
    };
  }

  const codeMatch = text.match(/^`([^`]+)`/);
  if (codeMatch) {
    return {
      kind: "code",
      text: codeMatch[1],
      length: codeMatch[0].length,
    };
  }

  const autolinkMatch = text.match(/^(https?:\/\/[^\s<>"']+)/);
  if (autolinkMatch) {
    return {
      kind: "autolink",
      url: normalizeUrl(autolinkMatch[1]),
      length: autolinkMatch[0].length,
    };
  }

  return null;
}

type TrelloDescriptionImageProps = {
  alt: string;
  url: string;
  className: string;
};

function TrelloDescriptionImage({
  alt,
  url,
  className,
}: TrelloDescriptionImageProps) {
  const [hasError, setHasError] = useState(false);
  const normalizedUrl = normalizeUrl(url);

  if (hasError) {
    return (
      <a
        href={normalizedUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="trello-description__image-fallback"
      >
        Open image attachment
      </a>
    );
  }

  return (
    <img
      src={normalizedUrl}
      alt={alt || "Trello attachment"}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setHasError(true)}
    />
  );
}

function renderImageBlock(alt: string, url: string, key: string): ReactNode {
  return (
    <figure key={key} className="trello-description__figure">
      <TrelloDescriptionImage
        alt={alt}
        url={url}
        className="trello-description__block-image"
      />
      {alt ? <figcaption className="trello-description__caption">{alt}</figcaption> : null}
    </figure>
  );
}

function parseInlineContent(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let remaining = text;
  let index = 0;

  while (remaining.length > 0) {
    const match = findNextInlineMatch(remaining);
    if (match) {
      const key = `${keyPrefix}-inline-${index}`;

      if (match.kind === "image" || (match.kind === "link" && isImageUrl(match.url))) {
        nodes.push(
          <TrelloDescriptionImage
            key={key}
            alt={match.kind === "image" ? match.alt : match.label}
            url={match.url}
            className="trello-description__inline-image"
          />,
        );
      } else if (match.kind === "link") {
        nodes.push(
          <a
            key={key}
            href={match.url}
            target="_blank"
            rel="noreferrer noopener"
            className="trello-description__link"
          >
            {match.label}
          </a>,
        );
      } else if (match.kind === "bold") {
        nodes.push(
          <strong key={key}>{parseInlineContent(match.text, `${keyPrefix}-bold-${index}`)}</strong>,
        );
      } else if (match.kind === "italic") {
        nodes.push(
          <em key={key}>{parseInlineContent(match.text, `${keyPrefix}-italic-${index}`)}</em>,
        );
      } else if (match.kind === "code") {
        nodes.push(
          <code key={key} className="trello-description__code">
            {match.text}
          </code>,
        );
      } else if (match.kind === "autolink") {
        if (isImageUrl(match.url)) {
          nodes.push(
            <TrelloDescriptionImage
              key={key}
              alt="Trello attachment"
              url={match.url}
              className="trello-description__inline-image"
            />,
          );
        } else {
          nodes.push(
            <a
              key={key}
              href={match.url}
              target="_blank"
              rel="noreferrer noopener"
              className="trello-description__link"
            >
              {match.url}
            </a>,
          );
        }
      }

      remaining = remaining.slice(match.length);
      index += 1;
      continue;
    }

    const nextTokenIndex = remaining.search(/[!\\[*`]|https?:\/\//);
    if (nextTokenIndex === -1) {
      if (remaining) nodes.push(remaining);
      break;
    }

    if (nextTokenIndex > 0) {
      nodes.push(remaining.slice(0, nextTokenIndex));
      remaining = remaining.slice(nextTokenIndex);
      continue;
    }

    nodes.push(remaining[0]);
    remaining = remaining.slice(1);
    index += 1;
  }

  return nodes;
}

function renderHeading(level: number, key: string, content: ReactNode): ReactNode {
  const className = `trello-description__heading trello-description__heading--h${level}`;

  switch (level) {
    case 1:
      return (
        <h1 key={key} className={className}>
          {content}
        </h1>
      );
    case 2:
      return (
        <h2 key={key} className={className}>
          {content}
        </h2>
      );
    case 3:
      return (
        <h3 key={key} className={className}>
          {content}
        </h3>
      );
    case 4:
      return (
        <h4 key={key} className={className}>
          {content}
        </h4>
      );
    case 5:
      return (
        <h5 key={key} className={className}>
          {content}
        </h5>
      );
    default:
      return (
        <h6 key={key} className={className}>
          {content}
        </h6>
      );
  }
}

function renderLine(line: string, key: string): ReactNode {
  const trimmedLine = line.trim();

  if (!trimmedLine) {
    return <br key={key} />;
  }

  const imageMatch = parseMarkdownWithUrl(trimmedLine, "![");
  if (imageMatch) {
    return renderImageBlock(imageMatch.label, imageMatch.url, key);
  }

  const linkOnlyMatch = parseMarkdownWithUrl(trimmedLine, "[");
  if (linkOnlyMatch) {
    if (isImageUrl(linkOnlyMatch.url)) {
      return renderImageBlock(linkOnlyMatch.label, linkOnlyMatch.url, key);
    }

    return (
      <p key={key} className="trello-description__paragraph">
        <a
          href={linkOnlyMatch.url}
          target="_blank"
          rel="noreferrer noopener"
          className="trello-description__link"
        >
          {linkOnlyMatch.label}
        </a>
      </p>
    );
  }

  if (AUTO_LINK_PATTERN.test(trimmedLine)) {
    const normalizedLine = normalizeUrl(trimmedLine);

    if (isImageUrl(normalizedLine)) {
      return renderImageBlock("", normalizedLine, key);
    }

    const href = normalizedLine.includes("@") ? `mailto:${normalizedLine}` : normalizedLine;
    return (
      <p key={key} className="trello-description__paragraph">
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="trello-description__link"
        >
          {normalizedLine}
        </a>
      </p>
    );
  }

  const headerMatch = trimmedLine.match(HEADER_PATTERN);
  if (headerMatch) {
    const level = Math.min(headerMatch[1].length, 6);
    return renderHeading(level, key, parseInlineContent(headerMatch[2], key));
  }

  const unorderedMatch = trimmedLine.match(UNORDERED_LIST_PATTERN);
  if (unorderedMatch) {
    return (
      <li key={key} className="trello-description__list-item">
        {parseInlineContent(unorderedMatch[1], key)}
      </li>
    );
  }

  const orderedMatch = trimmedLine.match(ORDERED_LIST_PATTERN);
  if (orderedMatch) {
    return (
      <li key={key} className="trello-description__list-item">
        {parseInlineContent(orderedMatch[1], key)}
      </li>
    );
  }

  return (
    <p key={key} className="trello-description__paragraph">
      {parseInlineContent(trimmedLine, key)}
    </p>
  );
}

function renderBlock(block: string, blockIndex: number): ReactNode {
  const lines = block.split("\n").filter((line, index, allLines) => {
    return line.length > 0 || index < allLines.length - 1;
  });

  if (lines.length === 0) {
    return null;
  }

  const isUnorderedList = lines.every((line) => UNORDERED_LIST_PATTERN.test(line.trim()));
  if (isUnorderedList) {
    return (
      <ul key={`block-${blockIndex}`} className="trello-description__list">
        {lines.map((line, lineIndex) =>
          renderLine(line, `block-${blockIndex}-line-${lineIndex}`),
        )}
      </ul>
    );
  }

  const isOrderedList = lines.every((line) => ORDERED_LIST_PATTERN.test(line.trim()));
  if (isOrderedList) {
    return (
      <ol key={`block-${blockIndex}`} className="trello-description__list trello-description__list--ordered">
        {lines.map((line, lineIndex) =>
          renderLine(line, `block-${blockIndex}-line-${lineIndex}`),
        )}
      </ol>
    );
  }

  if (lines.length === 1) {
    return renderLine(lines[0], `block-${blockIndex}-line-0`);
  }

  return (
    <div key={`block-${blockIndex}`} className="trello-description__block">
      {lines.map((line, lineIndex) =>
        renderLine(line, `block-${blockIndex}-line-${lineIndex}`),
      )}
    </div>
  );
}

type TrelloDescriptionProps = {
  content: string;
  className?: string;
  emptyLabel?: string;
};

export default function TrelloDescription({
  content,
  className = "",
  emptyLabel = "No description provided.",
}: TrelloDescriptionProps) {
  const trimmedContent = preprocessTrelloContent(content).trim();

  if (!trimmedContent) {
    return (
      <p className={`trello-description__empty ${className}`.trim()}>{emptyLabel}</p>
    );
  }

  const blocks = trimmedContent.split(/\n{2,}/);

  return (
    <div className={`trello-description ${className}`.trim()}>
      {blocks.map((block, blockIndex) => renderBlock(block, blockIndex))}
    </div>
  );
}
