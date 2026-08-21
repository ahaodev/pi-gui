import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { NewThreadEnvironment } from "./desktop-state";
import { trapDialogFocus } from "./dialog-focus";
import { environmentButtonClass } from "./new-thread-view";
import { cn } from "@/lib/utils";

interface ForkModalProps {
  readonly submitting: boolean;
  readonly error?: string;
  /** Preview of the assistant response the fork will branch after. */
  readonly messagePreview?: string;
  /** Whether forking into a new worktree is available for the source workspace. */
  readonly canUseWorktree: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (environment: NewThreadEnvironment) => void;
}

export function ForkModal({
  submitting,
  error,
  messagePreview,
  canUseWorktree,
  onClose,
  onSubmit,
}: ForkModalProps) {
  const [environment, setEnvironment] = useState<NewThreadEnvironment>("local");
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLButtonElement>("[data-fork-confirm='true']")?.focus();
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      trapDialogFocus(event, dialogRef.current);
      return;
    }

    if (event.key === "Escape" && !submitting) {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="tree-modal-backdrop fixed inset-0 z-[34] grid place-items-center bg-[rgba(24,31,44,0.3)] p-6 backdrop-blur-[10px]"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget || submitting) {
          return;
        }
        onClose();
      }}
    >
      <div
        aria-modal="true"
        className={cn(
          "tree-modal tree-modal--compact grid max-h-[min(760px,calc(100vh-48px))] gap-3.5 overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface p-[22px] shadow-[var(--shadow-xl)] [.enable-transparency_&]:[backdrop-filter:var(--glass-blur)_var(--glass-saturation)]",
          "w-[min(520px,100%)]",
        )}
        data-testid="fork-modal"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="tree-modal__header flex items-start justify-between gap-4">
          <div>
            <div className="tree-modal__eyebrow text-xs font-[650] tracking-[0.08em] text-muted-soft uppercase">分叉对话</div>
            <h2 className="tree-modal__title m-0 mt-1 text-[22px] font-[650] tracking-[-0.02em] text-foreground-strong">开始新对话</h2>
          </div>
          <button
            aria-label="关闭分叉对话框"
            className="tree-modal__close size-9 cursor-pointer rounded-full border-0 bg-overlay-hover p-0 text-[22px] text-muted-strong hover:enabled:text-foreground-strong"
            disabled={submitting}
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {error ? (
          <div
            className="tree-modal__error error-banner mb-[-2px] w-full rounded-xl border border-danger-tint-border bg-danger-tint-bg px-3.5 py-3 font-semibold text-error-ink"
            data-testid="fork-modal-error"
          >
            {error}
          </div>
        ) : null}

        <div className="tree-modal__summary-step grid gap-4">
          <div className="tree-modal__summary-copy text-[13px] leading-[1.6] text-muted-strong">
            将对话（含该回复）分叉为侧边栏中的新对话，输入框为空，你可以朝不同方向继续。原对话保持不变。
          </div>

          {messagePreview ? (
            <div
              className="fork-modal__preview max-h-[140px] overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-border bg-surface-muted px-3.5 py-3 text-[13px] leading-[1.5] text-foreground-strong"
              data-testid="fork-modal-preview"
            >
              {messagePreview}
            </div>
          ) : null}

          <div className="new-thread__environment-group inline-flex gap-2" role="radiogroup" aria-label="分叉环境">
            <button
              aria-pressed={environment === "local"}
              className={environmentButtonClass(environment === "local")}
              data-testid="fork-environment-local"
              type="button"
              onClick={() => setEnvironment("local")}
            >
              <span>相同工作树</span>
            </button>
            <button
              aria-pressed={environment === "worktree"}
              className={environmentButtonClass(environment === "worktree")}
              data-testid="fork-environment-worktree"
              disabled={!canUseWorktree}
              title={canUseWorktree ? undefined : "该工作区无法创建工作树。"}
              type="button"
              onClick={() => setEnvironment("worktree")}
            >
              <span>新工作树</span>
            </button>
          </div>

          <div className="tree-modal__footer flex items-center justify-between gap-3 max-[980px]:flex-col max-[980px]:items-stretch">
            <div className="tree-modal__hint text-[13px] leading-[1.6] text-muted-strong">
              {environment === "worktree"
                ? "将创建新的工作树，分叉后的对话在其中打开。"
                : "分叉后的对话与原对话在同一文件夹中打开。"}
            </div>
            <div className="tree-modal__actions flex flex-none gap-2">
              <button className="button button--secondary" disabled={submitting} type="button" onClick={onClose}>
                取消
              </button>
              <button
                className="button button--primary"
                data-fork-confirm="true"
                data-testid="fork-modal-confirm"
                disabled={submitting}
                type="button"
                onClick={() => onSubmit(environment)}
              >
                {submitting ? "正在分叉……" : "分叉对话"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
