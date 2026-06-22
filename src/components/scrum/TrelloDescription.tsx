import "@/assets/styles/TrelloDescription.css";
import type { ReactNode } from "react";

const IMAGE_MARKDOWN_PATTERN = /^!\[([^\]]*)\]\(([^)]+)\)$/;
const LINK_MARKDOWN_PATTERN = /^\[([^\]]+)\]\(([^)]+)\)$/;
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

function findNextInlineMatch(text: string): InlineMatch | null {
  const imageMatch = text.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
  if (imageMatch) {
    return {
      kind: "image",
      alt: imageMatch[1],
      url: imageMatch[2],
      length: imageMatch[0].length,
    };
  }

  const linkMatch = text.match(/^\[([^\]]+)\]\(([^)]+)\)/);
  if (linkMatch) {
    return {
      kind: "link",
      label: linkMatch[1],
      url: linkMatch[2],
      length: linkMatch[0].length,
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
      url: autolinkMatch[1],
      length: autolinkMatch[0].length,
    };
  }

  return null;
}

function parseInlineContent(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let remaining = text;
  let index = 0;

  while (remaining.length > 0) {
    const match = findNextInlineMatch(remaining);
    if (match) {
      const key = `${keyPrefix}-inline-${index}`;

      if (match.kind === "image") {
        nodes.push(
          <img
            key={key}
            src={match.url}
            alt={match.alt || "Trello attachment"}
            className="trello-description__inline-image"
            loading="lazy"
            referrerPolicy="no-referrer"
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

function renderImageBlock(alt: string, url: string, key: string): ReactNode {
  return (
    <figure key={key} className="trello-description__figure">
      <img
        src={url}
        alt={alt || "Trello attachment"}
        className="trello-description__block-image"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      {alt ? <figcaption className="trello-description__caption">{alt}</figcaption> : null}
    </figure>
  );
}

function renderLine(line: string, key: string): ReactNode {
  const trimmedLine = line.trim();

  if (!trimmedLine) {
    return <br key={key} />;
  }

  const imageMatch = trimmedLine.match(IMAGE_MARKDOWN_PATTERN);
  if (imageMatch) {
    return renderImageBlock(imageMatch[1], imageMatch[2], key);
  }

  const linkOnlyMatch = trimmedLine.match(LINK_MARKDOWN_PATTERN);
  if (linkOnlyMatch) {
    return (
      <p key={key} className="trello-description__paragraph">
        <a
          href={linkOnlyMatch[2]}
          target="_blank"
          rel="noreferrer noopener"
          className="trello-description__link"
        >
          {linkOnlyMatch[1]}
        </a>
      </p>
    );
  }

  if (AUTO_LINK_PATTERN.test(trimmedLine)) {
    const href = trimmedLine.includes("@") ? `mailto:${trimmedLine}` : trimmedLine;
    return (
      <p key={key} className="trello-description__paragraph">
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="trello-description__link"
        >
          {trimmedLine}
        </a>
      </p>
    );
  }

  const headerMatch = trimmedLine.match(HEADER_PATTERN);
  if (headerMatch) {
    const level = Math.min(headerMatch[1].length, 6);
    const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
    return (
      <HeadingTag key={key} className={`trello-description__heading trello-description__heading--h${level}`}>
        {parseInlineContent(headerMatch[2], key)}
      </HeadingTag>
    );
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
  const trimmedContent = content.trim();

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
