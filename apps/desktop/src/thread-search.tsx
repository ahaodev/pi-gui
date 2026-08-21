import type { RefObject } from "react";

interface ThreadSearchBarProps {
  readonly query: string;
  readonly matchCount: number;
  readonly activeIndex: number;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly onSearch: (query: string) => void;
  readonly onNext: () => void;
  readonly onPrev: () => void;
  readonly onClose: () => void;
}

export function ThreadSearchBar({
  query,
  matchCount,
  activeIndex,
  inputRef,
  onSearch,
  onNext,
  onPrev,
  onClose,
}: ThreadSearchBarProps) {
  return (
    <div className="thread-search-bar sticky top-0 z-10 flex items-center gap-1.5 border-b border-border bg-surface px-3 py-1.5" data-testid="thread-search-bar">
      <input
        ref={inputRef}
        className="thread-search-bar__input flex-1 rounded-sm border border-border bg-background px-2 py-1 text-[13px] text-foreground outline-none focus:border-[var(--accent)]"
        type="text"
        placeholder="搜索对话……"
        value={query}
        onChange={(e) => onSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) {
              onPrev();
            } else {
              onNext();
            }
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
      />
      <span className="thread-search-bar__count min-w-[72px] text-center text-xs text-muted">
        {query ? (matchCount > 0 ? `${activeIndex + 1} / ${matchCount}` : "0 个结果") : ""}
      </span>
      <div className="thread-search-bar__actions flex gap-0.5">
        <button
          aria-label="上一处匹配"
          className="icon-button"
          type="button"
          disabled={matchCount === 0}
          onClick={onPrev}
        >
          &#x25B2;
        </button>
        <button
          aria-label="下一处匹配"
          className="icon-button"
          type="button"
          disabled={matchCount === 0}
          onClick={onNext}
        >
          &#x25BC;
        </button>
        <button
          aria-label="关闭搜索"
          className="icon-button"
          type="button"
          onClick={onClose}
        >
          &#x2715;
        </button>
      </div>
    </div>
  );
}
