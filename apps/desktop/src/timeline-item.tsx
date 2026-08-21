import type { SessionTranscriptMessage } from "@pi-gui/pi-sdk-driver";
import type { DisplayTimelineItem, TimelineActivity, TimelineToolCall, TimelineSummary, TimelineTurnMarker } from "./timeline-types";
import { MessageMarkdown } from "./message-markdown";
import { InlineDiff, extractDiffFromOutput } from "./diff-inline";
import { ChevronRightIcon, CopyIcon, DiffIcon, FileIcon, ForkIcon, SparkIcon, TerminalIcon } from "./icons";
import { extensionToLanguage } from "./syntax-highlight";
import { cn } from "@/lib/utils";

export function TimelineItem({
  item,
  expandedToolCallIds,
  onToggleToolCall,
  onViewFileInDiff,
  sourceMessageIndex,
  onForkFromMessage,
}: {
  readonly item: DisplayTimelineItem;
  readonly expandedToolCallIds?: ReadonlySet<string>;
  readonly onToggleToolCall?: (callId: string) => void;
  readonly onViewFileInDiff?: (path: string) => void;
  readonly sourceMessageIndex?: number;
  readonly onForkFromMessage?: (messageIndex: number, preview?: string) => void;
}) {
  switch (item.kind) {
    case "turn-marker":
      return <TimelineTurnMarkerItem item={item} />;
    case "message":
      return (
        <TimelineMessage
          item={item}
          sourceMessageIndex={sourceMessageIndex}
          onForkFromMessage={onForkFromMessage}
        />
      );
    case "activity":
      return <TimelineActivityItem item={item} />;
    case "tool":
      return (
        <TimelineToolCallItem
          item={item}
          expanded={expandedToolCallIds?.has(item.callId) ?? false}
          onToggle={onToggleToolCall}
          onViewFileInDiff={onViewFileInDiff}
        />
      );
    case "summary":
      return <TimelineSummaryItem item={item} />;
    default:
      return null;
  }
}

function TimelineMessage({
  item,
  sourceMessageIndex,
  onForkFromMessage,
}: {
  readonly item: SessionTranscriptMessage;
  readonly sourceMessageIndex?: number;
  readonly onForkFromMessage?: (messageIndex: number, preview?: string) => void;
}) {
  if (item.role === "user") {
    return (
      <article className="timeline-item timeline-item--user flex min-w-0 items-center justify-end gap-2">
        <div className="timeline-item__bubble w-[min(620px,100%)] min-w-0 rounded-3xl border border-[var(--theme-bubble-border,var(--line))] bg-[var(--theme-bubble-bg,var(--main))] px-[17px] py-[13px]">
          {item.attachments?.length ? (
            <div className="timeline-item__attachments mb-2.5 flex flex-wrap gap-2.5">
              {item.attachments.map((attachment, index) =>
                attachment.kind === "image" ? (
                  <img
                    alt={attachment.name ?? `附件 ${index + 1}`}
                    className="timeline-item__attachment timeline-item__attachment--image size-22 rounded-xl border border-border bg-surface-muted object-cover"
                    key={`${item.id}:${index}`}
                    src={`data:${attachment.mimeType};base64,${attachment.data}`}
                  />
                ) : (
                  <div
                    className="timeline-item__attachment timeline-item__attachment--file inline-flex min-w-0 max-w-[min(320px,100%)] items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2.5"
                    key={`${item.id}:${index}`}
                    title={attachment.fsPath}
                  >
                    <span className="timeline-item__attachment-icon grid size-[18px] flex-none place-items-center text-muted-soft [&_svg]:size-[18px]" aria-hidden="true">
                      <FileIcon />
                    </span>
                    <span className="timeline-item__attachment-name min-w-0 truncate text-[13px] font-[520] text-foreground-strong">{attachment.name}</span>
                  </div>
                ),
              )}
            </div>
          ) : null}
          <MessageMarkdown text={item.text} />
        </div>
      </article>
    );
  }

  if (item.role === "branchSummary" || item.role === "compactionSummary") {
    return (
      <article className="timeline-item timeline-item--summary-card max-w-full min-w-0 rounded-4xl border border-[var(--summary-card-border)] bg-[var(--summary-card-bg)] px-4 py-3.5">
        <div className="timeline-item__summary-eyebrow mb-2 text-[11px] font-bold tracking-[0.08em] text-[var(--summary-eyebrow)] uppercase">
          {item.role === "branchSummary" ? "分支摘要" : "压缩摘要"}
        </div>
        <MessageMarkdown text={item.text} />
      </article>
    );
  }

  const canFork = onForkFromMessage != null && sourceMessageIndex !== undefined;
  return (
    <article className="timeline-item timeline-item--assistant group relative max-w-full min-w-0">
      <MessageMarkdown text={item.text} />
      {canFork ? (
        <div className="timeline-item__actions absolute top-full left-0 z-[2] mt-0.5 flex -translate-y-0.5 items-center gap-1 opacity-0 transition-[opacity,transform] duration-[var(--motion-fast)] ease-[var(--ease-out)] group-hover:translate-y-0 group-hover:opacity-100 hover:translate-y-0 hover:opacity-100 focus-within:translate-y-0 focus-within:opacity-100">
          <button
            type="button"
            className="timeline-item__action inline-flex h-6 cursor-pointer items-center gap-[5px] rounded-md border border-transparent bg-transparent px-2 text-xs leading-none text-muted-strong [&_svg]:size-[13px] hover:border-border hover:bg-surface-muted hover:text-foreground"
            title="从此处分叉对话"
            aria-label="从此处分叉对话"
            data-testid="fork-from-message"
            onClick={() => onForkFromMessage(sourceMessageIndex, item.text)}
          >
            <ForkIcon />
            <span className="timeline-item__action-label font-medium">分叉</span>
          </button>
        </div>
      ) : null}
    </article>
  );
}

function TimelineActivityItem({ item }: { readonly item: TimelineActivity }) {
  return (
    <div
      className={cn(
        "timeline-activity flex flex-wrap items-baseline gap-1.5 text-[13px] text-muted-soft",
        `timeline-activity--${item.tone ?? "neutral"}`,
        item.tone === "error" && "text-error-ink",
      )}
    >
      <span className="timeline-activity__label">{item.label}</span>
      {item.detail ? <span className="timeline-activity__detail text-muted-soft">{item.detail}</span> : null}
      {item.metadata ? <span className="timeline-activity__meta text-muted-soft">{item.metadata}</span> : null}
    </div>
  );
}

function TimelineToolCallItem({
  item,
  expanded,
  onToggle,
  onViewFileInDiff,
}: {
  readonly item: TimelineToolCall;
  readonly expanded: boolean;
  readonly onToggle?: (callId: string) => void;
  readonly onViewFileInDiff?: (path: string) => void;
}) {
  const hasContent = item.input !== undefined || item.output !== undefined;
  const diffText = isWriteTool(item.toolName) ? extractDiffFromOutput(item.output) : undefined;
  const diffStats = diffText ? countDiffStats(diffText) : undefined;
  const compactLabel = buildCompactLabel(item, diffStats);
  const filePath = isWriteTool(item.toolName) ? extractFilename(item.input) || undefined : undefined;
  const diffLanguage = diffText && filePath ? extensionToLanguage(filePath) : undefined;
  const inlineDetail = item.status === "error" ? item.detail : undefined;

  const handleCopy = () => {
    const text = diffText ?? formatToolContent(item.input, item.output);
    void navigator.clipboard.writeText(text);
  };

  const pipClass = cn(
    "timeline-tool__status-pip size-1.5 flex-none rounded-full bg-muted-soft",
    item.status === "success" && "bg-success",
    item.status === "error" && "bg-destructive",
    item.status === "running" && "bg-[var(--accent)] animate-[timeline-pip-pulse_1.4s_var(--ease-in-out)_infinite]",
  );

  return (
    <article className={cn("timeline-tool grid max-w-full min-w-0 gap-0.5 p-0", `timeline-tool--${item.status}`)}>
      <div className="timeline-tool__header-row flex items-center gap-1.5">
        <span className={cn("timeline-tool__glyph inline-flex size-4 flex-none items-center justify-center text-muted-soft [&_svg]:size-3.5", item.status === "error" && "text-destructive")} aria-hidden="true">
          {toolGlyph(item.toolName)}
        </span>
        <button
          className="timeline-tool__header flex min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-1 border-0 bg-none p-0 text-left disabled:cursor-default"
          type="button"
          aria-expanded={expanded}
          disabled={!hasContent}
          onClick={() => onToggle?.(item.callId)}
        >
          {hasContent ? (
            <span className={cn("timeline-tool__chevron inline-flex size-4 flex-none text-muted-soft transition-transform duration-[var(--motion-base)] ease-[var(--ease-out)]", expanded && "timeline-tool__chevron--expanded rotate-90")}>
              <ChevronRightIcon />
            </span>
          ) : null}
          <span className={cn("timeline-tool__label text-[13px] leading-[1.45] text-muted-strong", item.status === "error" && "text-error-ink")}>
            {compactLabel}
          </span>
          {inlineDetail ? <span className="timeline-tool__detail min-w-0 text-xs leading-[1.45] text-error-ink wrap-anywhere">{inlineDetail}</span> : null}
          {diffStats ? (
            <span className="timeline-tool__diff-stats ml-1.5 font-mono text-xs">
              <span className="timeline-tool__stat-add text-success">+{diffStats.added}</span>
              {" "}
              <span className="timeline-tool__stat-del text-destructive">-{diffStats.removed}</span>
            </span>
          ) : null}
          <span className="timeline-tool__meta-inline ml-1.5 inline-flex items-center gap-[5px] whitespace-nowrap text-xs text-muted-soft">
            <span className={pipClass} aria-hidden="true" />
            {`${item.toolName} \u00b7 ${statusLabel(item.status)}`}
          </span>
        </button>
        {filePath && onViewFileInDiff ? (
          <button
            aria-label={`在变更中查看 ${filePath}`}
            className="timeline-tool__view-in-diff inline-flex size-[22px] flex-none cursor-pointer items-center justify-center rounded-md border border-transparent bg-none text-muted-soft hover:border-[var(--theme-control-border,var(--border-heavy))] hover:bg-[var(--theme-control-hover-bg,var(--overlay-hover))] hover:text-foreground"
            data-testid="timeline-tool-view-in-diff"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onViewFileInDiff(filePath);
            }}
          >
            <DiffIcon />
          </button>
        ) : null}
      </div>
      {expanded && hasContent ? (
        <div className="timeline-tool__body mt-1.5 max-h-[400px] overflow-x-hidden overflow-y-auto rounded-sm border border-border">
          {diffText ? (
            <>
              <div className="timeline-tool__diff-header flex items-center justify-between border-b border-border bg-surface-muted px-3 py-1.5">
                <span className="timeline-tool__diff-filename font-mono text-xs font-semibold text-foreground">
                  {extractFilename(item.input)}
                  {diffStats ? (
                    <span className="timeline-tool__diff-stats ml-1.5 font-mono text-xs">
                      {" "}<span className="timeline-tool__stat-add text-success">+{diffStats.added}</span>
                      {" "}<span className="timeline-tool__stat-del text-destructive">-{diffStats.removed}</span>
                    </span>
                  ) : null}
                </span>
                <button className="timeline-tool__copy inline-flex size-6 cursor-pointer items-center justify-center rounded-md border border-transparent bg-none text-muted-soft hover:border-[var(--theme-control-border,var(--border-heavy))] hover:bg-[var(--theme-control-hover-bg,var(--overlay-hover))] hover:text-[var(--ink-strong)]" type="button" onClick={handleCopy} aria-label="复制">
                  <CopyIcon />
                </button>
              </div>
              <InlineDiff diff={diffText} language={diffLanguage} />
            </>
          ) : (
            <>
              <div className="timeline-tool__body-actions flex justify-end border-b border-border bg-surface-muted px-1.5 py-1">
                <button className="timeline-tool__copy inline-flex size-6 cursor-pointer items-center justify-center rounded-md border border-transparent bg-none text-muted-soft hover:border-[var(--theme-control-border,var(--border-heavy))] hover:bg-[var(--theme-control-hover-bg,var(--overlay-hover))] hover:text-[var(--ink-strong)]" type="button" onClick={handleCopy} aria-label="复制">
                  <CopyIcon />
                </button>
              </div>
              <pre className="timeline-tool__pre m-0 whitespace-pre-wrap break-words px-3 py-2 font-mono text-xs leading-[1.5] text-foreground">{formatToolContent(item.input, item.output)}</pre>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}

function isWriteTool(toolName: string): boolean {
  return /write|edit|patch|apply/i.test(toolName);
}

function toolGlyph(toolName: string) {
  if (isWriteTool(toolName)) {
    return <DiffIcon />;
  }
  if (/bash|shell|exec|terminal|command|run/i.test(toolName)) {
    return <TerminalIcon />;
  }
  if (/read|view|cat|open|file|glob|grep|search|ls/i.test(toolName)) {
    return <FileIcon />;
  }
  return <SparkIcon />;
}

function buildCompactLabel(item: TimelineToolCall, diffStats: { added: number; removed: number } | undefined): string {
  if (isWriteTool(item.toolName)) {
    const filename = extractFilename(item.input);
    if (filename) {
      return `已编辑 ${shortenPath(filename)}`;
    }
  }
  return item.label;
}

function extractFilename(input: unknown): string {
  if (typeof input === "object" && input !== null) {
    const record = input as Record<string, unknown>;
    const path = record.file_path ?? record.filePath ?? record.path ?? record.filename;
    if (typeof path === "string") {
      return path;
    }
  }
  return "";
}

function shortenPath(filePath: string): string {
  // Show last 2-3 path segments for readability
  const parts = filePath.split("/");
  if (parts.length <= 3) {
    return filePath;
  }
  return parts.slice(-3).join("/");
}

function countDiffStats(diff: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      added += 1;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      removed += 1;
    }
  }
  return { added, removed };
}

function formatToolContent(input: unknown, output: unknown): string {
  const parts: string[] = [];
  if (input !== undefined) {
    parts.push(typeof input === "string" ? input : JSON.stringify(input, null, 2));
  }
  if (output !== undefined) {
    parts.push(typeof output === "string" ? output : JSON.stringify(output, null, 2));
  }
  return parts.join("\n\n");
}

function statusLabel(status: "running" | "success" | "error") {
  if (status === "running") return "运行中";
  if (status === "success") return "已完成";
  return "失败";
}

function TimelineTurnMarkerItem({ item }: { readonly item: TimelineTurnMarker }) {
  return (
    <div
      className="timeline-turn-marker flex items-center gap-2.5 py-0.5 after:flex-1 after:h-px after:bg-border after:content-[''] before:flex-1 before:h-px before:bg-border before:content-['']"
      data-testid="timeline-turn-marker"
    >
      <span className="timeline-turn-marker__label flex-none text-xs font-medium tracking-[0.01em] text-muted-soft">
        {`用时 ${formatWorkedDuration(item.durationMs)}`}
      </span>
    </div>
  );
}

function formatWorkedDuration(durationMs: number): string {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

function TimelineSummaryItem({ item }: { readonly item: TimelineSummary }) {
  if (item.presentation === "divider") {
    return (
      <div className="timeline-summary flex items-center gap-2 text-xs text-muted-soft after:flex-1 after:h-px after:bg-border after:content-[''] before:flex-1 before:h-px before:bg-border before:content-['']">
        <span>{item.label}</span>
        {item.metadata ? <span className="timeline-summary__meta text-muted-soft">{item.metadata}</span> : null}
      </div>
    );
  }

  return (
    <div className="timeline-activity timeline-activity--summary mt-0.5 flex flex-wrap items-baseline gap-1.5 text-[13px] text-muted-soft">
      <span className="timeline-activity__label">{item.label}</span>
      {item.metadata ? <span className="timeline-activity__meta text-muted-soft">{item.metadata}</span> : null}
    </div>
  );
}
