import { type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import type { AppView, SessionRecord, WorkspaceRecord, WorktreeRecord } from "./desktop-state";
import { DiffIcon, FileIcon, PromptRailIcon, TerminalIcon } from "./icons";
import { getDesktopShortcutLabel, type PiDesktopApi } from "./ipc";
import type { WorkspaceMenuState } from "./hooks/use-workspace-menu";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TopbarProps {
  readonly activeView: AppView;
  readonly rootWorkspace: WorkspaceRecord | undefined;
  readonly selectedWorkspace: WorkspaceRecord | undefined;
  readonly selectedSession: SessionRecord | undefined;
  readonly selectedSessionTitle: string | undefined;
  readonly selectedWorktree: WorktreeRecord | undefined;
  readonly activeWorktrees: readonly WorktreeRecord[];
  readonly workspaces: readonly WorkspaceRecord[];
  readonly wsMenu: WorkspaceMenuState;
  readonly api: PiDesktopApi;
  readonly terminalAvailable: boolean;
  readonly terminalVisible: boolean;
  readonly onToggleTerminal: () => void;
  readonly panelAvailable: boolean;
  readonly changesVisible: boolean;
  readonly onToggleChanges: () => void;
  readonly filesVisible: boolean;
  readonly onToggleFiles: () => void;
  readonly promptRailVisible: boolean;
  readonly onTogglePromptRail: () => void;
}

export function Topbar(props: TopbarProps) {
  const {
    activeView,
    rootWorkspace,
    selectedWorkspace,
    selectedSession,
    selectedSessionTitle,
    selectedWorktree,
    activeWorktrees,
    workspaces,
    wsMenu,
    api,
    terminalAvailable,
    terminalVisible,
    onToggleTerminal,
    panelAvailable,
    changesVisible,
    onToggleChanges,
    filesVisible,
    onToggleFiles,
    promptRailVisible,
    onTogglePromptRail,
  } = props;
  const terminalShortcut = getDesktopShortcutLabel(api.platform, "J");
  const diffShortcut = getDesktopShortcutLabel(api.platform, "D");

  const handleDoubleClick = (event: ReactMouseEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.closest(".topbar__actions")) {
      return;
    }

    void api.toggleWindowMaximize();
  };

  return (
    <header
      className="topbar flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2 [-webkit-app-region:drag] max-[980px]:flex-col max-[980px]:items-stretch max-[980px]:px-[18px] [.enable-transparency_&]:[background:var(--surface-glass)]! [.enable-transparency_&]:[backdrop-filter:var(--glass-blur)_var(--glass-saturation)]"
      data-testid="topbar"
      onDoubleClick={handleDoubleClick}
    >
      <div className="topbar__title flex min-w-0 items-center gap-1.5">
        <span className="topbar__workspace shrink-0 text-[13px] font-[560] tracking-[-0.02em] text-muted-soft">
          {rootWorkspace ? rootWorkspace.name : "打开文件夹以开始"}
        </span>
        {selectedWorkspace && activeView === "threads" ? (
          <>
            <span className="topbar__separator shrink-0 text-muted-soft">/</span>
            <div className="environment-picker relative" ref={wsMenu.environmentMenuRef}>
              <button
                aria-expanded={wsMenu.environmentMenuOpen}
                aria-haspopup="menu"
                className="environment-picker__button grid h-6 place-items-center whitespace-nowrap rounded-full border border-border bg-card px-2.5 text-xs font-[560] text-muted-strong transition hover:border-[var(--theme-control-border,var(--border-heavy))] hover:bg-[var(--theme-control-hover-bg,var(--surface-overlay-hover))]"
                type="button"
                onClick={() => wsMenu.setEnvironmentMenuOpen((current) => !current)}
              >
                {selectedWorkspace.kind === "worktree" ? selectedWorktree?.name ?? selectedWorkspace.name : "本地"}
              </button>
              {wsMenu.environmentMenuOpen && rootWorkspace ? (
                <div className="workspace-menu environment-picker__menu absolute left-0 right-auto top-[calc(100%+8px)] z-10 grid min-w-[190px] gap-0.5 rounded-2xl border border-border bg-card p-1.5 shadow-xl">
                  <button
                    className="workspace-menu__item flex w-full items-center justify-between gap-4 rounded-lg px-[11px] py-[9px] text-left text-[13px] whitespace-nowrap text-foreground-strong hover:bg-[var(--theme-control-hover-bg,var(--surface-muted))]"
                    type="button"
                    onClick={() => wsMenu.selectWorkspace(rootWorkspace.id)}
                  >
                    本地
                  </button>
                  {activeWorktrees.map((worktree) => {
                    const linkedWorkspace = workspaces.find(
                      (workspace) => workspace.id === worktree.linkedWorkspaceId,
                    );
                    const worktreeSelectable = Boolean(linkedWorkspace) && worktree.status === "ready";
                    return (
                      <button
                        className="workspace-menu__item flex w-full items-center justify-between gap-4 rounded-lg px-[11px] py-[9px] text-left text-[13px] whitespace-nowrap text-foreground-strong hover:bg-[var(--theme-control-hover-bg,var(--surface-muted))] disabled:cursor-default disabled:opacity-50"
                        key={worktree.id}
                        type="button"
                        disabled={!worktreeSelectable}
                        onClick={() => {
                          if (worktreeSelectable && linkedWorkspace) {
                            wsMenu.selectWorkspace(linkedWorkspace.id);
                          }
                        }}
                      >
                        {worktree.name}
                        {!worktreeSelectable
                          ? <span className="text-muted-foreground">({worktree.status !== "ready" ? worktree.status : "不可用"})</span>
                          : ""}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
        {selectedWorkspace && activeView === "threads" && selectedSession ? (
          <>
            <span className="topbar__separator shrink-0 text-muted-soft">/</span>
            <span className="topbar__session min-w-0 truncate text-[13px] font-[560] tracking-[-0.02em] text-muted-strong">
              {selectedSessionTitle ?? selectedSession.title}
            </span>
          </>
        ) : activeView === "new-thread" && rootWorkspace ? (
          <>
            <span className="topbar__separator shrink-0 text-muted-soft">/</span>
            <span className="topbar__session min-w-0 truncate text-[13px] font-[560] tracking-[-0.02em] text-muted-strong">
              新建对话
            </span>
          </>
        ) : null}
      </div>

      <div className="topbar__actions flex items-center gap-2 max-[980px]:justify-start">
        <TopbarActionButton
          active={terminalVisible}
          disabled={!terminalAvailable}
          icon={<TerminalIcon />}
          label="切换终端"
          shortcut={terminalShortcut}
          onClick={onToggleTerminal}
        />
        <TopbarActionButton
          active={changesVisible}
          disabled={!panelAvailable}
          icon={<DiffIcon />}
          label="切换变更"
          shortcut={diffShortcut}
          onClick={onToggleChanges}
        />
        <TopbarActionButton
          active={filesVisible}
          disabled={!panelAvailable}
          icon={<FileIcon />}
          label="切换文件"
          onClick={onToggleFiles}
        />
        <TopbarActionButton
          active={promptRailVisible}
          icon={<PromptRailIcon />}
          label={promptRailVisible ? "隐藏提示导航" : "显示提示导航"}
          onClick={onTogglePromptRail}
        />
      </div>
    </header>
  );
}

interface TopbarActionButtonProps {
  readonly label: string;
  readonly icon: ReactNode;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly shortcut?: string;
  readonly onClick: () => void;
}

function TopbarActionButton({
  label,
  icon,
  active = false,
  disabled = false,
  shortcut,
  onClick,
}: TopbarActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={active}
          className={cn("topbar__icon size-7 rounded-md text-muted-soft hover:text-muted-soft", active && "topbar__icon--active text-ring hover:text-ring")}
          type="button"
          disabled={disabled}
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8} className="topbar__tooltip gap-2 bg-card text-muted-strong">
        <span>{label}</span>
        {shortcut ? (
          <Kbd className="h-[18px] min-w-[28px] border border-border bg-muted px-[5px] pt-px text-[11px] font-semibold text-muted-strong">
            {shortcut}
          </Kbd>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
