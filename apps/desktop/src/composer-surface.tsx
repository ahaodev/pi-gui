import { useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import type { ComposerAttachment } from "./desktop-state";
import type { MentionOption } from "./hooks/use-mention-menu";
import type {
  ComposerSlashCommand,
  ComposerSlashCommandSection,
  ComposerSlashOption,
  ComposerSlashOptionEmptyState,
} from "./composer-commands";
import { hasFilesInDataTransfer } from "./composer-attachments";
import { ExtensionDock, type ExtensionDockModel } from "./extension-session-ui";
import { ExtensionIcon, FileIcon, ModelIcon, ReasoningIcon, SettingsIcon, SkillIcon, SparkIcon, StatusIcon } from "./icons";
import { QueuedComposerMessages } from "./queued-composer-messages";
import { cn } from "@/lib/utils";

type ExtensionMentionOption = Extract<MentionOption, { kind: "extension" }>;
type FileMentionOption = Extract<MentionOption, { kind: "file" }>;

interface ComposerSurfaceProps {
  readonly lastError?: string;
  readonly activeSlashCommand?: ComposerSlashCommand;
  readonly activeSlashCommandMeta?: string;
  readonly topNotice?: ReactNode;
  readonly composerDraft: string;
  readonly setComposerDraft: (draft: string) => void;
  readonly composerRef: RefObject<HTMLTextAreaElement | null>;
  readonly attachments: readonly ComposerAttachment[];
  readonly queuedMessages: readonly import("./desktop-state").QueuedComposerMessage[];
  readonly editingQueuedMessageId?: string;
  readonly slashSections: readonly ComposerSlashCommandSection[];
  readonly slashOptions: readonly ComposerSlashOption[];
  readonly selectedSlashCommand?: ComposerSlashCommand;
  readonly selectedSlashOption?: ComposerSlashOption;
  readonly showSlashMenu: boolean;
  readonly showSlashOptionMenu: boolean;
  readonly slashOptionEmptyState?: ComposerSlashOptionEmptyState;
  readonly onClearSlashCommand: () => void;
  readonly onComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  readonly onComposerPaste: (event: ClipboardEvent<HTMLDivElement>) => void;
  readonly onComposerDrop: (event: DragEvent<HTMLDivElement>) => void;
  readonly onRemoveAttachment: (attachmentId: string) => void;
  readonly onEditQueuedMessage: (messageId: string) => void;
  readonly onCancelQueuedEdit: () => void;
  readonly onRemoveQueuedMessage: (messageId: string) => void;
  readonly onSteerQueuedMessage: (messageId: string) => void;
  readonly onSelectSlashCommand: (command: ComposerSlashCommand) => void;
  readonly onSelectSlashOption: (option: ComposerSlashOption) => void;
  readonly showMentionMenu: boolean;
  readonly mentionOptions: readonly MentionOption[];
  readonly selectedMentionIndex: number;
  readonly onSelectMention: (option: MentionOption) => void;
  readonly onEnableMentionExtension: (option: ExtensionMentionOption) => void;
  readonly textareaLabel: string;
  readonly textareaTestId: string;
  readonly textareaPlaceholder: string;
  readonly textareaClassName?: string;
  readonly extensionDock?: ExtensionDockModel;
  readonly extensionDockExpanded?: boolean;
  readonly onToggleExtensionDock?: () => void;
  readonly footer: ReactNode;
}

export function ComposerSurface({
  lastError,
  activeSlashCommand,
  activeSlashCommandMeta,
  topNotice,
  composerDraft,
  setComposerDraft,
  composerRef,
  attachments,
  queuedMessages,
  editingQueuedMessageId,
  slashSections,
  slashOptions,
  selectedSlashCommand,
  selectedSlashOption,
  showSlashMenu,
  showSlashOptionMenu,
  slashOptionEmptyState,
  onClearSlashCommand,
  onComposerKeyDown,
  onComposerPaste,
  onComposerDrop,
  onRemoveAttachment,
  onEditQueuedMessage,
  onCancelQueuedEdit,
  onRemoveQueuedMessage,
  onSteerQueuedMessage,
  onSelectSlashCommand,
  onSelectSlashOption,
  showMentionMenu,
  mentionOptions,
  selectedMentionIndex,
  onSelectMention,
  onEnableMentionExtension,
  textareaLabel,
  textareaTestId,
  textareaPlaceholder,
  textareaClassName,
  extensionDock,
  extensionDockExpanded = false,
  onToggleExtensionDock,
  footer,
}: ComposerSurfaceProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const dragDepthRef = useRef(0);

  const clearDragState = () => {
    dragDepthRef.current = 0;
    setIsDragActive(false);
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFilesInDataTransfer(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!isDragActive) {
      return;
    }
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFilesInDataTransfer(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!isDragActive) {
      setIsDragActive(true);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    clearDragState();
    onComposerDrop(event);
  };

  return (
    <div
      className={cn(
        "composer__surface relative w-full overflow-visible rounded-[var(--radius-4xl)] border px-3.5 pt-3 pb-[11px] transition-[border-color,box-shadow,background-color] duration-[var(--motion-base)] ease-[var(--ease-out)]",
        isDragActive
          ? "border-[var(--focus-ring-border)] bg-accent-tint shadow-[var(--focus-ring),var(--shadow-md)]"
          : "border-[var(--theme-control-border,var(--line))] bg-[var(--theme-control-bg,var(--surface))] shadow-[0_0_0_1px_var(--theme-focus-ring,transparent),var(--shadow-md)]",
      )}
      data-testid={`${textareaTestId}-surface`}
      onPaste={onComposerPaste}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {isDragActive ? (
        <div
          className="composer__drop-indicator pointer-events-none absolute top-3 right-3.5 z-[2] rounded-full bg-accent-tint px-2.5 py-1.5 text-xs font-semibold text-[var(--accent)]"
          data-testid="composer-drop-indicator"
        >
          拖放图片或文件以附加
        </div>
      ) : null}
      {activeSlashCommand ? (
        <div className="mb-2.5 flex items-center gap-2.5 border-b border-border pt-1.5 pb-2.5">
          <span className="composer__slash-intent-icon grid size-5 shrink-0 place-items-center text-muted-strong [&_svg]:size-[18px]" aria-hidden="true">
            <SlashCommandIcon command={activeSlashCommand} />
          </span>
          <span className="grid min-w-0 gap-px">
            <span className="text-[13px] font-semibold text-foreground-strong">{activeSlashCommand.title}</span>
            {activeSlashCommandMeta ? (
              <span className="text-xs text-muted-soft">{activeSlashCommandMeta}</span>
            ) : null}
          </span>
          <button
            aria-label={`清除 ${activeSlashCommand.title}`}
            className="ml-auto size-6 rounded-full text-muted-soft"
            type="button"
            onClick={onClearSlashCommand}
          >
            ×
          </button>
        </div>
      ) : null}
      <QueuedComposerMessages
        messages={queuedMessages}
        editingQueuedMessageId={editingQueuedMessageId}
        onEditMessage={onEditQueuedMessage}
        onCancelEdit={onCancelQueuedEdit}
        onRemoveMessage={onRemoveQueuedMessage}
        onSteerMessage={onSteerQueuedMessage}
      />
      {attachments.length > 0 ? (
        <div className="mb-2.5 flex flex-wrap gap-2.5">
          {attachments.map((attachment) => (
            <div
              className={`composer-attachment composer-attachment--${attachment.kind} inline-flex min-w-0 max-w-[min(280px,100%)] items-center gap-2 rounded-full border border-border bg-surface-muted p-1.5 pr-2.5`}
              key={attachment.id}
            >
              {attachment.kind === "image" ? (
                <img
                  alt={attachment.name}
                  className="composer-attachment__preview size-7 rounded-[var(--radius-md)] bg-surface-muted object-cover"
                  src={`data:${attachment.mimeType};base64,${attachment.data}`}
                />
              ) : (
                <span className="composer-attachment__icon grid size-7 shrink-0 place-items-center rounded-[var(--radius-md)] bg-surface-muted text-muted-soft" aria-hidden="true">
                  <FileIcon />
                </span>
              )}
              <span className="composer-attachment__name min-w-0 truncate text-[13px] font-[520] text-muted-strong">
                {attachment.name}
              </span>
              <button
                aria-label={`移除 ${attachment.name}`}
                className="text-lg leading-none text-muted-soft"
                type="button"
                onClick={() => onRemoveAttachment(attachment.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {extensionDock && onToggleExtensionDock ? (
        <ExtensionDock dock={extensionDock} expanded={extensionDockExpanded} onToggle={onToggleExtensionDock} />
      ) : null}
      {lastError ? (
        <div
          className="error-banner composer__error mb-3 w-full rounded-[var(--radius-xl)] border border-danger-tint-border bg-danger-tint-bg px-3.5 py-3 font-semibold text-error-ink"
          data-testid="composer-error-banner"
        >
          {lastError}
        </div>
      ) : null}
      <div className="composer__editor relative grid gap-2.5">
        {topNotice}
        {showMentionMenu ? (
          <div className="composer__menus pointer-events-none absolute inset-x-0 bottom-[calc(100%+12px)] z-[4] grid gap-2">
            <div
              className="mention-menu pointer-events-auto max-h-[320px] overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-md"
              data-testid="mention-menu"
              onWheel={(event) => event.stopPropagation()}
            >
              <MentionMenuSections
                options={mentionOptions}
                selectedIndex={selectedMentionIndex}
                onSelect={onSelectMention}
                onEnableExtension={onEnableMentionExtension}
              />
            </div>
          </div>
        ) : null}
        {showSlashMenu || (showSlashOptionMenu && selectedSlashCommand) ? (
          <div className="composer__menus pointer-events-none absolute inset-x-0 bottom-[calc(100%+12px)] z-[4] grid gap-2">
            {showSlashMenu ? (
              <div
                className="slash-menu pointer-events-auto relative z-[2] grid max-h-[min(420px,48vh)] gap-1 overflow-y-auto rounded-2xl border border-border bg-surface p-1.5 shadow-lg touch-pan-y [overscroll-behavior:contain] [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]"
                data-testid="slash-menu"
                onWheel={(event) => event.stopPropagation()}
              >
                {slashSections.map((section, sectionIndex) => (
                  <div
                    className={cn("slash-menu__section grid gap-0.5", sectionIndex > 0 && "mt-1 border-t border-border pt-1.5")}
                    key={section.id}
                  >
                    {section.title ? (
                      <div
                        className={cn(
                          "slash-menu__section-title inline-flex items-center gap-2 px-2.5 pt-2 pb-1 text-xs font-[560]",
                          `slash-menu__section-title--${section.id}`,
                          section.id === "runtime" ? "text-foreground-strong" : section.id === "host" ? "text-muted-strong" : "text-muted-soft",
                        )}
                      >
                        <span className="slash-menu__section-icon inline-grid size-3.5 place-items-center" aria-hidden="true">
                          {section.id === "runtime" ? <SparkIcon /> : <SettingsIcon />}
                        </span>
                        <span>{section.title}</span>
                      </div>
                    ) : null}
                    {section.items.map((command) => (
                      <button
                        className={cn(
                          "slash-menu__item grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-overlay-hover",
                          command.section === "runtime" && "slash-menu__item--skill items-start py-2",
                          selectedSlashCommand?.id === command.id && "slash-menu__item--active bg-overlay-hover",
                        )}
                        key={command.id}
                        type="button"
                        onClick={() => onSelectSlashCommand(command)}
                      >
                        <span className="slash-menu__icon grid size-[18px] place-items-center text-muted-strong [&_svg]:size-[18px]" aria-hidden="true">
                          <SlashCommandIcon command={command} />
                        </span>
                        {command.section === "runtime" ? (
                          <span className="slash-menu__content slash-menu__content--skill grid min-w-0 gap-0.5">
                            <span className="slash-menu__line flex items-center gap-2.5">
                              <span className="slash-menu__title text-[13px] font-semibold text-foreground-strong">{command.title}</span>
                              {command.sourceLabel ? <span className="slash-menu__skill-badge ml-auto text-[10px] font-semibold tracking-[0.08em] text-muted uppercase">{command.sourceLabel}</span> : null}
                              {command.compatibility?.status === "terminal-only" ? (
                                <span className="slash-menu__skill-badge slash-menu__skill-badge--warning ml-auto text-[10px] font-semibold tracking-[0.08em] text-warning-ink uppercase">仅限终端</span>
                              ) : null}
                            </span>
                            <span className="slash-menu__description text-xs text-muted-soft">{command.description}</span>
                            <span className="slash-menu__meta inline-flex min-w-0 items-center gap-2">
                              <span className="slash-menu__command slash-menu__command--skill font-mono text-[11px] tracking-[0.01em] text-muted">{command.command}</span>
                            </span>
                          </span>
                        ) : (
                          <span className="slash-menu__content grid min-w-0 gap-0.5">
                            <span className="slash-menu__line flex items-center gap-2.5">
                              <span className="slash-menu__title text-[13px] font-semibold text-foreground-strong">{command.title}</span>
                              <span className="slash-menu__command text-xs text-muted-soft">{command.command}</span>
                            </span>
                            <span className="slash-menu__description text-xs text-muted-soft">{command.description}</span>
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
            {showSlashOptionMenu && selectedSlashCommand ? (
              <div
                className="slash-menu slash-menu--options pointer-events-auto relative z-[2] grid max-h-[min(420px,48vh)] gap-0.5 overflow-y-auto rounded-2xl border border-border bg-surface p-1.5 shadow-lg touch-pan-y [overscroll-behavior:contain] [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]"
                data-testid="slash-options-menu"
                onWheel={(event) => event.stopPropagation()}
              >
                <div className="slash-menu__search px-3 py-2.5 text-[13px] font-[560] text-muted-soft">{selectedSlashCommand.title}</div>
                {slashOptions.length > 0
                  ? slashOptions.map((option) => (
                      <button
                        className={cn(
                          "slash-menu__option grid grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-lg px-3 py-2.5 text-left after:h-2 after:w-2 after:rounded-full after:bg-transparent after:content-[''] hover:bg-overlay-hover",
                          selectedSlashOption?.value === option.value &&
                            "slash-menu__option--active bg-overlay-hover after:bg-[var(--accent)]",
                        )}
                        key={option.value}
                        type="button"
                        onClick={() => onSelectSlashOption(option)}
                      >
                        <span className="slash-menu__option-title text-sm font-[560] text-foreground-strong">{option.label}</span>
                        <span className="slash-menu__option-description text-[13px] text-muted-soft">{option.description}</span>
                      </button>
                    ))
                  : slashOptionEmptyState ? (
                      <div className="slash-menu__empty grid gap-1.5 p-3 text-muted-soft">
                        <div className="slash-menu__empty-title text-sm font-[560] text-foreground-strong">{slashOptionEmptyState.title}</div>
                        <div className="slash-menu__empty-description text-[13px] leading-[1.4]">{slashOptionEmptyState.description}</div>
                      </div>
                    ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <textarea
          aria-label={textareaLabel}
          className={cn(
            "w-full min-h-6 max-h-[220px] resize-none border-0 bg-transparent p-0 text-[15px] leading-[1.5] text-foreground-strong outline-none",
            textareaClassName,
          )}
          data-testid={textareaTestId}
          ref={composerRef}
          value={composerDraft}
          onChange={(event) => {
            setComposerDraft(event.target.value);
          }}
          onKeyDown={onComposerKeyDown}
          placeholder={textareaPlaceholder}
        />
        <div className="composer__bar mt-2 w-full">{footer}</div>
      </div>
    </div>
  );
}

function MentionMenuSections({
  options,
  selectedIndex,
  onSelect,
  onEnableExtension,
}: {
  readonly options: readonly MentionOption[];
  readonly selectedIndex: number;
  readonly onSelect: (option: MentionOption) => void;
  readonly onEnableExtension: (option: ExtensionMentionOption) => void;
}) {
  const extensionOptions = options.filter((option): option is ExtensionMentionOption => option.kind === "extension");
  const fileOptions = options.filter((option): option is FileMentionOption => option.kind === "file");

  return (
    <>
      {extensionOptions.length > 0 ? (
        <MentionMenuSection
          title="扩展"
          options={extensionOptions}
          selectedIndex={selectedIndex}
          allOptions={options}
          isLaterSection={false}
          onSelect={onSelect}
          onEnableExtension={onEnableExtension}
        />
      ) : null}
      {fileOptions.length > 0 ? (
        <MentionMenuSection
          title="文件"
          options={fileOptions}
          selectedIndex={selectedIndex}
          allOptions={options}
          isLaterSection={extensionOptions.length > 0}
          onSelect={onSelect}
          onEnableExtension={onEnableExtension}
        />
      ) : null}
    </>
  );
}

function MentionMenuSection({
  title,
  options,
  selectedIndex,
  allOptions,
  isLaterSection,
  onSelect,
  onEnableExtension,
}: {
  readonly title: string;
  readonly options: readonly MentionOption[];
  readonly selectedIndex: number;
  readonly allOptions: readonly MentionOption[];
  readonly isLaterSection: boolean;
  readonly onSelect: (option: MentionOption) => void;
  readonly onEnableExtension: (option: ExtensionMentionOption) => void;
}) {
  return (
    <div className={cn("mention-menu__section grid gap-0.5", isLaterSection && "mt-1 border-t border-border pt-1.5")}>
      <div className="mention-menu__section-title px-2.5 pt-1.5 pb-[3px] text-[11px] font-[650] text-muted-soft uppercase">
        {title}
      </div>
      {options.map((option) => (
        <MentionMenuItem
          key={option.id}
          option={option}
          active={allOptions[selectedIndex]?.id === option.id}
          onSelect={onSelect}
          onEnableExtension={onEnableExtension}
        />
      ))}
    </div>
  );
}

function MentionMenuItem({
  option,
  active,
  onSelect,
  onEnableExtension,
}: {
  readonly option: MentionOption;
  readonly active: boolean;
  readonly onSelect: (option: MentionOption) => void;
  readonly onEnableExtension: (option: ExtensionMentionOption) => void;
}) {
  if (option.kind === "extension") {
    return (
      <div
        className={cn(
          "mention-menu__item mention-menu__item--extension flex w-full justify-between p-0 text-left text-[13px] leading-[1.4]",
          option.enabled ? "text-foreground" : "mention-menu__item--disabled text-muted",
          active && "mention-menu__item--active",
        )}
      >
        <button
          className={cn(
            "mention-menu__item-main flex min-w-0 flex-1 cursor-pointer items-center gap-2 border-0 bg-none px-2.5 py-[7px] text-left",
            "hover:bg-surface-muted",
            active && "bg-overlay-active",
          )}
          disabled={option.enabling}
          type="button"
          onClick={() => {
            if (option.enabled) {
              onSelect(option);
              return;
            }
            onEnableExtension(option);
          }}
        >
          <span className="mention-menu__icon inline-grid size-4 flex-none place-items-center text-muted-strong" aria-hidden="true">
            <ExtensionIcon />
          </span>
          <span className="mention-menu__content grid min-w-0 gap-px">
            <span className="mention-menu__line flex min-w-0 items-center gap-2">
              <span className="mention-menu__filename font-semibold">{option.displayName}</span>
              {option.enabled ? null : (
                <span className="mention-menu__badge text-[10px] font-[650] text-muted uppercase">
                  {option.enabling ? "启用中" : "已禁用"}
                </span>
              )}
            </span>
            <span className="mention-menu__description text-xs text-muted-soft">{option.description}</span>
          </span>
        </button>
        {option.enabled ? null : (
          <button
            aria-label={`启用 ${option.displayName}`}
            className="mention-menu__enable mr-1.5 flex-none cursor-pointer rounded-sm border border-border bg-surface px-2 py-1 text-xs font-semibold text-foreground-strong hover:bg-surface-muted"
            disabled={option.enabling}
            type="button"
            onClick={() => onEnableExtension(option)}
          >
            {option.enabling ? "启用中" : "启用"}
          </button>
        )}
      </div>
    );
  }

  const lastSlash = option.filePath.lastIndexOf("/");
  const dirPart = lastSlash >= 0 ? option.filePath.slice(0, lastSlash + 1) : "";
  const namePart = lastSlash >= 0 ? option.filePath.slice(lastSlash + 1) : option.filePath;
  return (
    <button
      className={cn(
        "mention-menu__item flex w-full cursor-pointer items-center gap-2 rounded-xs border-0 bg-none px-2.5 py-1.5 text-left text-[13px] leading-[1.4] text-foreground hover:bg-surface-muted",
        active && "mention-menu__item--active bg-overlay-active",
      )}
      type="button"
      onClick={() => onSelect(option)}
    >
      <span className="mention-menu__icon inline-grid size-4 flex-none place-items-center text-muted-strong" aria-hidden="true">
        <FileIcon />
      </span>
      <span className="mention-menu__file min-w-0 font-mono">
        {dirPart ? <span className="mention-menu__dirname text-muted-soft">{dirPart}</span> : null}
        <span className="mention-menu__filename font-semibold">{namePart}</span>
      </span>
    </button>
  );
}

function SlashCommandIcon({ command }: { readonly command: ComposerSlashCommand }) {
  switch (command.kind) {
    case "runtime":
      return command.runtimeCommand?.source === "skill" ? <SkillIcon /> : <SparkIcon />;
    case "model":
      return <ModelIcon />;
    case "thinking":
      return <ReasoningIcon />;
    case "status":
      return <StatusIcon />;
    default:
      return <SparkIcon />;
  }
}
