import { useEffect, useMemo, useRef, useState } from "react";
import type { RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import {
  buildModelOptions,
  MODEL_OPTIONS_EMPTY_TITLE,
  THINKING_OPTIONS,
  type ComposerModelOption,
} from "./composer-commands";

interface ModelSelectorProps {
  readonly runtime: RuntimeSnapshot | undefined;
  readonly provider: string | undefined;
  readonly modelId: string | undefined;
  readonly thinkingLevel: string | undefined;
  readonly disabled?: boolean;
  readonly dropdownPlacement?: "above" | "below";
  readonly showEmptyModelControl?: boolean;
  readonly unselectedModelLabel?: string;
  readonly emptyModelLabel?: string;
  readonly emptyModelTitle?: string;
  readonly onSetModel: (provider: string, modelId: string) => void;
  readonly onSetThinking: (level: string) => void;
}

type OpenDropdown = "none" | "model" | "thinking";

export function ModelSelector({
  runtime,
  provider,
  modelId,
  thinkingLevel,
  disabled,
  dropdownPlacement = "above",
  showEmptyModelControl = false,
  unselectedModelLabel = "选择模型",
  emptyModelLabel = "选择模型",
  emptyModelTitle = MODEL_OPTIONS_EMPTY_TITLE,
  onSetModel,
  onSetThinking,
}: ModelSelectorProps) {
  const [open, setOpen] = useState<OpenDropdown>("none");
  const [modelFilter, setModelFilter] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const modelOptions = useMemo(() => buildModelOptions(runtime), [runtime]);
  const filteredModels = useMemo(() => {
    if (!modelFilter) return modelOptions;
    const q = modelFilter.toLowerCase();
    return modelOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.description.toLowerCase().includes(q) ||
        opt.providerId.toLowerCase().includes(q),
    );
  }, [modelOptions, modelFilter]);

  const groupedModels = useMemo(() => groupByProvider(filteredModels), [filteredModels]);
  const hasAvailableModelOptions = modelOptions.length > 0;
  const hasModelControl = Boolean(provider && modelId) || hasAvailableModelOptions;
  const shouldRenderModelControl = hasModelControl || showEmptyModelControl;
  const modelBadgeLabel = provider && modelId ? `${provider}:${modelId}` : hasAvailableModelOptions ? unselectedModelLabel : emptyModelLabel;
  const noMatchingModels = hasAvailableModelOptions && modelFilter.trim().length > 0 && groupedModels.length === 0;

  useEffect(() => {
    if (open === "none") {
      setModelFilter("");
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen("none");
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen("none");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (!shouldRenderModelControl && !thinkingLevel) {
    return null;
  }

  const dropdownClass = `model-selector__dropdown absolute left-0 z-20 flex min-w-[280px] max-h-[320px] flex-col overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-[var(--elevation-menu)] ${dropdownPlacement === "below" ? "model-selector__dropdown--below top-full mt-1.5" : "bottom-full mb-1.5"}`;

  return (
    <span className="model-selector relative inline-flex items-center gap-1.5" ref={containerRef}>
      {shouldRenderModelControl ? (
        <span className="model-selector__anchor relative inline-flex">
          <button
            className="model-selector__badge inline-flex min-h-6 cursor-pointer items-center gap-[5px] rounded-full border border-border bg-surface-muted px-[9px] py-0.5 text-xs font-[560] tracking-[-0.01em] text-muted-strong transition-colors hover:enabled:border-[var(--border-heavy)] hover:enabled:bg-overlay-hover hover:enabled:text-foreground-strong disabled:cursor-default disabled:opacity-60"
            type="button"
            disabled={disabled}
            onClick={() => setOpen(open === "model" ? "none" : "model")}
          >
            {modelBadgeLabel}
          </button>
          {open === "model" ? (
            <div className={dropdownClass} onWheel={(event) => event.stopPropagation()}>
              <div className="model-selector__filter sticky top-0 z-[1] bg-surface px-2 pt-1 pb-2">
                <input
                  className="model-selector__filter-input w-full rounded-sm border border-border bg-surface-muted px-2.5 py-1.5 text-[13px] text-foreground outline-none focus:border-[var(--accent)]"
                  placeholder="筛选模型……"
                  value={modelFilter}
                  onChange={(e) => setModelFilter(e.target.value)}
                  autoFocus
                />
              </div>
              {groupedModels.map((group) => (
                <div key={group.provider}>
                  <div className="model-selector__group-title px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.04em] text-muted uppercase">{group.provider}</div>
                  {group.items.map((option) => {
                    const isActive = option.providerId === provider && option.modelId === modelId;
                    return (
                      <button
                        className={`model-selector__item flex w-full cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-2.5 py-1.5 text-left text-[13px] text-foreground hover:enabled:bg-surface-muted ${isActive ? "model-selector__item--active font-medium text-[var(--accent)]" : ""}`}
                        key={`${option.providerId}:${option.modelId}`}
                        type="button"
                        onClick={() => {
                          if (!isActive) {
                            onSetModel(option.providerId, option.modelId);
                          }
                          setOpen("none");
                        }}
                      >
                        <span className="model-selector__item-label flex-1">{option.label}</span>
                        {isActive ? <span className="model-selector__item-meta text-[11px] text-muted">当前</span> : null}
                      </button>
                    );
                  })}
                </div>
              ))}
              {groupedModels.length === 0 ? (
                <>
                  <div className="model-selector__group-title px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.04em] text-muted uppercase">
                    {noMatchingModels ? "没有匹配的模型" : emptyModelTitle}
                  </div>
                  {noMatchingModels ? <div className="model-selector__empty px-2.5 pb-2 text-xs text-muted leading-[1.4]">试试其他筛选条件。</div> : null}
                </>
              ) : null}
            </div>
          ) : null}
        </span>
      ) : null}
      {thinkingLevel ? (
        <span className="model-selector__anchor relative inline-flex">
          <button
            className="model-selector__badge inline-flex min-h-6 cursor-pointer items-center gap-[5px] rounded-full border border-border bg-surface-muted px-[9px] py-0.5 text-xs font-[560] tracking-[-0.01em] text-muted-strong transition-colors hover:enabled:border-[var(--border-heavy)] hover:enabled:bg-overlay-hover hover:enabled:text-foreground-strong disabled:cursor-default disabled:opacity-60"
            type="button"
            disabled={disabled}
            onClick={() => setOpen(open === "thinking" ? "none" : "thinking")}
          >
            {thinkingLevel}
          </button>
          {open === "thinking" ? (
            <div className={dropdownClass} onWheel={(event) => event.stopPropagation()}>
              <div className="model-selector__group-title px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.04em] text-muted uppercase">思考等级</div>
              {THINKING_OPTIONS.map((option) => {
                const isActive = option.value === thinkingLevel;
                return (
                  <button
                    className={`model-selector__item flex w-full cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-2.5 py-1.5 text-left text-[13px] text-foreground hover:enabled:bg-surface-muted ${isActive ? "model-selector__item--active font-medium text-[var(--accent)]" : ""}`}
                    key={option.value}
                    type="button"
                    onClick={() => {
                      if (!isActive) {
                        onSetThinking(option.value);
                      }
                      setOpen("none");
                    }}
                  >
                    <span className="model-selector__item-label flex-1">{option.label}</span>
                    <span className="model-selector__item-meta text-[11px] text-muted">{option.description}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

interface ModelGroup {
  readonly provider: string;
  readonly items: readonly ComposerModelOption[];
}

function groupByProvider(options: readonly ComposerModelOption[]): readonly ModelGroup[] {
  const groups = new Map<string, ComposerModelOption[]>();
  for (const option of options) {
    const existing = groups.get(option.providerId);
    if (existing) {
      existing.push(option);
    } else {
      groups.set(option.providerId, [option]);
    }
  }
  return Array.from(groups.entries()).map(([provider, items]) => ({ provider, items }));
}
