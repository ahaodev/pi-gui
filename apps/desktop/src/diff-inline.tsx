import { useMemo, type ReactNode } from "react";
import { MAX_HIGHLIGHTED_LINES, highlightLine, type HighlightLine } from "./syntax-highlight";
import { cn } from "@/lib/utils";

interface DiffLine {
  readonly type: "added" | "removed" | "context" | "header";
  readonly content: string;
  readonly lineNumber?: number;
}

export function InlineDiff({
  diff,
  language,
}: {
  readonly diff: string;
  readonly language?: string;
}) {
  const lines = useMemo(() => parseDiff(diff), [diff]);
  const highlightActive = language !== undefined && lines.length <= MAX_HIGHLIGHTED_LINES;

  if (lines.length === 0) {
    return null;
  }

  return (
    <pre
      className="diff-inline m-0 p-0 font-mono text-xs leading-[1.6]"
      data-language={highlightActive ? language : undefined}
    >
      {lines.map((line, index) => (
        <div
          className={cn(
            "diff-line flex pr-3",
            `diff-line--${line.type}`,
            line.type === "added" && "bg-[var(--diff-added-bg)] text-[var(--diff-added-ink)]",
            line.type === "removed" && "bg-[var(--diff-removed-bg)] text-[var(--diff-removed-ink)]",
            line.type === "header" && "bg-[var(--diff-header-bg)] text-muted-soft italic",
          )}
          key={index}
        >
          {line.lineNumber !== undefined ? (
            <span className="diff-line__number inline-block min-w-10 flex-none px-2 text-right text-muted-soft select-none">{line.lineNumber}</span>
          ) : (
            <span className="diff-line__number inline-block min-w-10 flex-none px-2 text-right select-none" />
          )}
          <span className="diff-line__content whitespace-pre-wrap break-words">
            {highlightActive && line.type !== "header" ? (
              <HighlightedContent content={line.content} language={language!} />
            ) : (
              line.content
            )}
          </span>
        </div>
      ))}
    </pre>
  );
}

function HighlightedContent({
  content,
  language,
}: {
  readonly content: string;
  readonly language: string;
}) {
  const tokens = useMemo(() => highlightLine(content, language), [content, language]);
  return <>{renderTokens(tokens)}</>;
}

function renderTokens(tokens: HighlightLine): ReactNode {
  return tokens.map((token, index) =>
    typeof token === "string" ? (
      token
    ) : (
      <span className={token.className} key={index}>
        {renderTokens(token.children)}
      </span>
    ),
  );
}

function parseDiff(diff: string): DiffLine[] {
  const lines = diff.split("\n");
  const result: DiffLine[] = [];
  let lineNumber = 0;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      const match = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(line);
      lineNumber = match ? parseInt(match[1] ?? "0", 10) : 0;
      result.push({ type: "header", content: line });
      continue;
    }
    if (line.startsWith("---") || line.startsWith("+++")) {
      continue;
    }
    if (line.startsWith("+")) {
      result.push({ type: "added", content: line.slice(1), lineNumber });
      lineNumber += 1;
    } else if (line.startsWith("-")) {
      result.push({ type: "removed", content: line.slice(1) });
    } else if (line.startsWith(" ") || line === "") {
      result.push({ type: "context", content: line.slice(1), lineNumber });
      lineNumber += 1;
    }
  }

  return result;
}

export function extractDiffFromOutput(output: unknown): string | undefined {
  if (typeof output === "string" && (output.includes("@@") || output.startsWith("diff "))) {
    return output;
  }
  if (isObj(output)) {
    if (typeof output.diff === "string") {
      return output.diff;
    }
    if (isObj(output.details) && typeof output.details.diff === "string") {
      return output.details.diff;
    }
    if (Array.isArray(output.content)) {
      for (const part of output.content) {
        if (isObj(part) && part.type === "text" && typeof part.text === "string") {
          if (part.text.includes("@@") || part.text.startsWith("diff ")) {
            return part.text;
          }
        }
      }
    }
  }
  return undefined;
}

function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
