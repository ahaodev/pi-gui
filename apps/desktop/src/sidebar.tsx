import {
  forwardRef,
  useEffect,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  AppView,
  DesktopAppState,
  SessionRecord,
  WorkspaceRecord,
  WorktreeRecord,
} from "./desktop-state";
import {
  ArchiveIcon,
  ChevronDownIcon,
  ExtensionIcon,
  FolderIcon,
  PinIcon,
  PlusIcon,
  RestoreIcon,
  SettingsIcon,
  SkillIcon,
  WorktreeIcon,
} from "./icons";
import type { PiDesktopApi } from "./ipc";
import { formatRelativeTime } from "./string-utils";
import type { WorkspaceMenuState } from "./hooks/use-workspace-menu";
import { useThreadMenu, type ThreadMenuState } from "./hooks/use-thread-menu";
import {
  comparePinnedThreads,
  sessionThreadKey,
  type ThreadGroup,
  type ThreadListEntry,
} from "./thread-groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SidebarProps {
  readonly activeView: AppView;
  readonly selectedWorkspace: WorkspaceRecord | undefined;
  readonly selectedSession: SessionRecord | undefined;
  readonly visibleWorkspaces: readonly WorkspaceRecord[];
  readonly threadGroups: readonly ThreadGroup[];
  readonly pinnedSessionOrder: readonly string[];
  readonly linkedWorktreeByWorkspaceId: ReadonlyMap<string, WorktreeRecord>;
  readonly wsMenu: WorkspaceMenuState;
  readonly api: PiDesktopApi;
  readonly setSnapshot: Dispatch<SetStateAction<DesktopAppState | null>>;
  readonly updateSnapshot: (
    api: PiDesktopApi,
    setSnapshot: Dispatch<SetStateAction<DesktopAppState | null>>,
    action: () => Promise<DesktopAppState>,
  ) => Promise<DesktopAppState>;
  readonly onNewThread: () => void;
  readonly onSetActiveView: (view: AppView) => void;
  readonly onOpenSkills: (workspaceId?: string) => void;
  readonly onOpenExtensions: (workspaceId?: string) => void;
  readonly onOpenSettings: (workspaceId?: string) => void;
  readonly onArchiveSession: (target: { workspaceId: string; sessionId: string }) => void;
  readonly onSelectSession: (target: { workspaceId: string; sessionId: string }) => void;
  readonly onSetSessionPinned: (target: { workspaceId: string; sessionId: string }, pinned: boolean) => void;
  readonly onUnarchiveSession: (target: { workspaceId: string; sessionId: string }) => void;
}

const IS_MAC = typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);
const RENAME_THREAD_SHORTCUT_HINT = IS_MAC ? "⇧⌘R" : "Ctrl+Shift+R";

export function Sidebar(props: SidebarProps) {
  const {
    activeView,
    selectedWorkspace,
    selectedSession,
    visibleWorkspaces,
    threadGroups,
    pinnedSessionOrder,
    linkedWorktreeByWorkspaceId,
    wsMenu,
    api,
    setSnapshot,
    updateSnapshot,
    onNewThread,
    onSetActiveView,
    onOpenSkills,
    onOpenExtensions,
    onOpenSettings,
    onArchiveSession,
    onSelectSession,
    onSetSessionPinned,
    onUnarchiveSession,
  } = props;

  const [activeId, setActiveId] = useState<string | null>(null);
  const threadMenu = useThreadMenu({ api, setSnapshot, updateSnapshot });

  // Cmd+Shift+R renames the currently selected thread (same flow as the
  // "重命名对话" context-menu item).
  useEffect(() => {
    const handleRenameShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return;
      if (event.key.toLowerCase() !== "r" && event.code !== "KeyR") return;
      if (activeView !== "threads" || !selectedWorkspace || !selectedSession) return;
      const entry = threadGroups
        .flatMap((group) => [...group.pinnedThreads, ...group.threads, ...group.archivedThreads])
        .find((t) => t.workspaceId === selectedWorkspace.id && t.session.id === selectedSession.id);
      if (!entry) return;
      event.preventDefault();
      threadMenu.startRename(entry);
    };
    window.addEventListener("keydown", handleRenameShortcut);
    return () => window.removeEventListener("keydown", handleRenameShortcut);
  }, [activeView, selectedWorkspace, selectedSession, threadGroups, threadMenu]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const pinnedSortableId = (thread: ThreadListEntry) => `pinned:${sessionThreadKey(thread)}`;
  const pinnedSessionKeyFromSortableId = (id: string) =>
    id.startsWith("pinned:") ? id.slice("pinned:".length) : id;

  // Collision detection based on workspace row headers only (~30px top of each group),
  // not the full group height including all sessions.
  const headerCollision: CollisionDetection = (args) => {
    if (String(args.active.id).startsWith("pinned:")) {
      const pointerY = args.pointerCoordinates?.y;
      if (pointerY == null) return [];
      let closest: { id: string; distance: number } | null = null;
      for (const container of args.droppableContainers) {
        const containerId = String(container.id);
        if (!containerId.startsWith("pinned:") || containerId === String(args.active.id)) {
          continue;
        }
        const rect = container.rect.current;
        if (!rect) continue;
        const rowCenter = rect.top + rect.height / 2;
        const distance = Math.abs(pointerY - rowCenter);
        if (!closest || distance < closest.distance) {
          closest = { id: containerId, distance };
        }
      }
      return closest
        ? [
            {
              id: closest.id,
              data: {
                droppableContainer:
                  args.droppableContainers.find((c) => String(c.id) === closest!.id)!,
              },
            },
          ]
        : [];
    }
    const pointerY = args.pointerCoordinates?.y;
    if (pointerY == null) return [];

    let closest: { id: string; distance: number } | null = null;
    for (const container of args.droppableContainers) {
      if (String(container.id).startsWith("pinned:")) {
        continue;
      }
      const rect = container.rect.current;
      if (!rect) continue;
      const headerCenter = rect.top + 15; // center of the ~30px workspace row header
      const distance = Math.abs(pointerY - headerCenter);
      if (!closest || distance < closest.distance) {
        closest = { id: String(container.id), distance };
      }
    }
    return closest
      ? [
          {
            id: closest.id,
            data: {
              droppableContainer:
                args.droppableContainers.find((c) => String(c.id) === closest!.id)!,
            },
          },
        ]
      : [];
  };

  const rootGroups = threadGroups.filter((g) => g.rootWorkspace.kind === "primary");
  const orphanGroups = threadGroups.filter((g) => g.rootWorkspace.kind !== "primary");
  const pinnedThreads = threadGroups
    .flatMap((group) => group.pinnedThreads)
    .sort((left, right) => comparePinnedThreads(left, right, pinnedSessionOrder));
  const pinnedSortableIds = pinnedThreads.map(pinnedSortableId);
  const rootGroupIds = rootGroups.map((g) => g.rootWorkspace.id);
  const canDrag = rootGroups.length > 1;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (String(active.id).startsWith("pinned:")) {
      const oldIndex = pinnedSortableIds.indexOf(String(active.id));
      const newIndex = pinnedSortableIds.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const newOrder = arrayMove(pinnedSortableIds, oldIndex, newIndex).map(
        pinnedSessionKeyFromSortableId,
      );
      applyOptimisticReorder(
        (prev) => ({ ...prev, pinnedSessionOrder: newOrder }),
        () => api.reorderPinnedSessions(newOrder),
      );
      return;
    }

    const oldIndex = rootGroupIds.indexOf(String(active.id));
    const newIndex = rootGroupIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const newOrder = arrayMove(rootGroupIds, oldIndex, newIndex);
    applyOptimisticReorder(
      (prev) => ({ ...prev, workspaceOrder: newOrder }),
      () => api.reorderWorkspaces(newOrder),
    );
  }

  // Optimistically update local state to avoid snap-back animation, then reconcile with the
  // authoritative state the IPC call returns; roll back to the pre-reorder snapshot on rejection.
  function applyOptimisticReorder(
    optimistic: (prev: DesktopAppState) => DesktopAppState,
    commit: () => Promise<DesktopAppState>,
  ) {
    let previousSnapshot: DesktopAppState | null = null;
    setSnapshot((prev) => {
      previousSnapshot = prev;
      return prev ? optimistic(prev) : prev;
    });
    void commit().then(
      (state) => setSnapshot(state),
      () => setSnapshot(previousSnapshot),
    );
  }

  const activeGroup = activeId ? rootGroups.find((g) => g.rootWorkspace.id === activeId) : undefined;
  const activePinnedThread = activeId?.startsWith("pinned:")
    ? pinnedThreads.find((thread) => pinnedSortableId(thread) === activeId)
    : undefined;

  return (
    <aside className="sidebar grid min-h-0 grid-rows-[auto_1fr] overflow-hidden border-r border-border bg-sidebar [.enable-transparency_&]:[backdrop-filter:var(--glass-blur)_var(--glass-saturation)]">
      <div className="sidebar__top px-3 py-2.5 pt-[52px]">
        <Button
          type="button"
          disabled={!selectedWorkspace}
          onClick={onNewThread}
          className={cn(
            "sidebar__new h-8 w-full justify-start rounded-md border border-[var(--theme-control-border,var(--line))] bg-[var(--theme-control-bg,var(--surface-muted))] px-2.5 text-[13px] font-semibold text-foreground-strong disabled:opacity-45",
            "hover:bg-[var(--theme-control-bg,var(--surface-muted))]",
          )}
        >
          <PlusIcon />
          <span>新建对话</span>
        </Button>

        <div className="sidebar__nav mt-2 grid gap-0.5">
          <SidebarNavItem
            active={activeView === "threads"}
            icon={<FolderIcon />}
            label="对话"
            onClick={() => onSetActiveView("threads")}
          />
          <SidebarNavItem
            icon={<SkillIcon />}
            label="技能"
            onClick={() => onOpenSkills(selectedWorkspace?.rootWorkspaceId ?? selectedWorkspace?.id)}
          />
          <SidebarNavItem
            icon={<ExtensionIcon />}
            label="扩展"
            onClick={() => onOpenExtensions(selectedWorkspace?.rootWorkspaceId ?? selectedWorkspace?.id)}
          />
          <SidebarNavItem
            icon={<SettingsIcon />}
            label="设置"
            onClick={() => onOpenSettings(selectedWorkspace?.rootWorkspaceId ?? selectedWorkspace?.id)}
          />
        </div>
      </div>

      <div className="sidebar__section min-h-0 overflow-auto px-3 py-2.5">
        <div className="section__head mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-subtle">
          <span>对话</span>
          <div className="section__tools flex items-center gap-2">
            <button
              aria-label="打开文件夹"
              className="icon-button"
              type="button"
              onClick={() => {
                void updateSnapshot(api, setSnapshot, () => api.pickWorkspace());
              }}
            >
              <FolderIcon />
            </button>
          </div>
        </div>

        {visibleWorkspaces.length === 0 ? (
          <div className="empty-state" data-testid="empty-state">
            <h2 className="mb-2 text-[17px] tracking-tight">还没有工作区</h2>
            <p className="mb-3 text-[15px] leading-normal text-muted-foreground">
              打开一个项目文件夹，开始创建工作区与对话列表。
            </p>
            <Button
              type="button"
              className="rounded-lg px-3 py-2 text-sm font-semibold"
              onClick={() => {
                void updateSnapshot(api, setSnapshot, () => api.pickWorkspace());
              }}
            >
              打开第一个文件夹
            </Button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={headerCollision}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="workspace-list grid gap-2" data-testid="workspace-list">
              {pinnedThreads.length > 0 ? (
                <PinnedThreadsSection
                  pinnedThreads={pinnedThreads}
                  sortableIds={pinnedSortableIds}
                  sortableIdForThread={pinnedSortableId}
                  selectedWorkspace={selectedWorkspace}
                  selectedSession={selectedSession}
                  threadMenu={threadMenu}
                  onArchiveSession={onArchiveSession}
                  onSelectSession={onSelectSession}
                  onSetSessionPinned={onSetSessionPinned}
                />
              ) : null}
              <SortableContext items={rootGroupIds} strategy={verticalListSortingStrategy}>
                {rootGroups.map((group) => (
                  <SortableWorkspaceGroup
                    key={group.rootWorkspace.id}
                    group={group}
                    canDrag={canDrag}
                    selectedWorkspace={selectedWorkspace}
                    selectedSession={selectedSession}
                    linkedWorktreeByWorkspaceId={linkedWorktreeByWorkspaceId}
                    wsMenu={wsMenu}
                    api={api}
                    threadMenu={threadMenu}
                    onArchiveSession={onArchiveSession}
                    onSelectSession={onSelectSession}
                    onSetSessionPinned={onSetSessionPinned}
                    onUnarchiveSession={onUnarchiveSession}
                  />
                ))}
              </SortableContext>
              {orphanGroups.map((group) => (
                <WorkspaceGroupContent
                  key={group.rootWorkspace.id}
                  group={group}
                  canDrag={false}
                  selectedWorkspace={selectedWorkspace}
                  selectedSession={selectedSession}
                  linkedWorktreeByWorkspaceId={linkedWorktreeByWorkspaceId}
                  wsMenu={wsMenu}
                  api={api}
                  threadMenu={threadMenu}
                  onArchiveSession={onArchiveSession}
                  onSelectSession={onSelectSession}
                  onSetSessionPinned={onSetSessionPinned}
                  onUnarchiveSession={onUnarchiveSession}
                />
              ))}
            </div>
            <DragOverlay>
              {activePinnedThread ? (
                <ThreadSessionRow
                  active={
                    activePinnedThread.workspaceId === selectedWorkspace?.id &&
                    activePinnedThread.session.id === selectedSession?.id
                  }
                  thread={activePinnedThread}
                  showContext
                  overlay
                  onAction={() => undefined}
                  onSelect={() => undefined}
                  onTogglePinned={() => undefined}
                />
              ) : activeGroup ? (
                <div className="workspace-group--overlay grid content-start gap-0.5 opacity-60 pointer-events-none">
                  <WorkspaceGroupContent
                    group={activeGroup}
                    canDrag={false}
                    selectedWorkspace={selectedWorkspace}
                    selectedSession={selectedSession}
                    linkedWorktreeByWorkspaceId={linkedWorktreeByWorkspaceId}
                    wsMenu={wsMenu}
                    api={api}
                    threadMenu={threadMenu}
                    onArchiveSession={onArchiveSession}
                    onSelectSession={onSelectSession}
                    onSetSessionPinned={onSetSessionPinned}
                    onUnarchiveSession={onUnarchiveSession}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </aside>
  );
}

function SidebarNavItem({
  active = false,
  icon,
  label,
  onClick,
}: {
  readonly active?: boolean;
  readonly icon: ReactNode;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "sidebar__nav-item flex min-h-[30px] w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-[13px] font-[560] text-muted-strong [&_svg]:size-[15px]",
        active &&
          "sidebar__nav-item--active border-[var(--theme-selection-border,var(--line))] bg-[var(--theme-selection-bg,var(--surface-overlay))] text-[var(--theme-selection-ink,var(--text-strong))]",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* ── Sortable workspace group wrapper ──────────────────── */

interface WorkspaceGroupProps {
  readonly group: ThreadGroup;
  readonly canDrag: boolean;
  readonly selectedWorkspace: WorkspaceRecord | undefined;
  readonly selectedSession: SessionRecord | undefined;
  readonly linkedWorktreeByWorkspaceId: ReadonlyMap<string, WorktreeRecord>;
  readonly wsMenu: WorkspaceMenuState;
  readonly api: PiDesktopApi;
  readonly threadMenu: ThreadMenuState;
  readonly onArchiveSession: (target: { workspaceId: string; sessionId: string }) => void;
  readonly onSelectSession: (target: { workspaceId: string; sessionId: string }) => void;
  readonly onSetSessionPinned: (target: { workspaceId: string; sessionId: string }, pinned: boolean) => void;
  readonly onUnarchiveSession: (target: { workspaceId: string; sessionId: string }) => void;
}

function SortableWorkspaceGroup(props: WorkspaceGroupProps) {
  const { group, wsMenu } = props;
  const isRenaming = wsMenu.workspaceRenameId === group.rootWorkspace.id;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.rootWorkspace.id,
    disabled: isRenaming,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : undefined,
  };

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={cn("workspace-group grid content-start gap-0.5", isDragging && "workspace-group--dragging")}
    >
      <WorkspaceGroupContent
        {...props}
        dragHandleProps={props.canDrag && !isRenaming ? { attributes, listeners } : undefined}
      />
    </section>
  );
}

/* ── Workspace group content (used both inline and in overlay) ──── */

interface DragHandleProps {
  readonly attributes: DraggableAttributes;
  readonly listeners: DraggableSyntheticListeners;
}

function WorkspaceGroupContent(
  props: WorkspaceGroupProps & { readonly dragHandleProps?: DragHandleProps },
) {
  const {
    group: { rootWorkspace, threads, archivedThreads },
    selectedWorkspace,
    selectedSession,
    linkedWorktreeByWorkspaceId,
    wsMenu,
    api,
    threadMenu,
    onArchiveSession,
    onSelectSession,
    onSetSessionPinned,
    onUnarchiveSession,
    dragHandleProps,
  } = props;

  const workspaceActive =
    rootWorkspace.id === selectedWorkspace?.id ||
    rootWorkspace.id === selectedWorkspace?.rootWorkspaceId;
  const linkedWorktree = linkedWorktreeByWorkspaceId.get(rootWorkspace.id);
  const archivedSectionOpen = wsMenu.expandedArchivedByWorkspace[rootWorkspace.id] ?? false;
  const isCollapsed = wsMenu.collapsedWorkspaces[rootWorkspace.id] ?? false;

  return (
    <>
      <div
        className={cn(
          "workspace-row group relative grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 rounded-md border border-transparent px-1 pt-0.5 pb-px",
          "hover:bg-[var(--theme-control-hover-bg,var(--overlay-hover))] hover:border-[var(--theme-control-border,var(--line))]",
          workspaceActive &&
            "workspace-row--active border-[var(--theme-selection-border,transparent)] bg-[var(--theme-selection-bg,transparent)] text-foreground-strong",
        )}
      >
        <Button
          variant="ghost"
          type="button"
          className={cn(
            "workspace-row__select relative h-auto w-full min-w-0 justify-start gap-0 px-0 py-0.5 pl-[23px] text-left text-[13px] font-[470]",
            workspaceActive ? "text-foreground-strong" : "text-muted-strong",
            dragHandleProps && "cursor-grab active:cursor-grabbing",
          )}
          onClick={() => {
            wsMenu.selectWorkspace(rootWorkspace.id);
            wsMenu.toggleWorkspaceCollapsed(rootWorkspace.id);
          }}
          {...(dragHandleProps ? { ...dragHandleProps.attributes, ...dragHandleProps.listeners } : {})}
        >
          <span
            className="workspace-row__icon pointer-events-none absolute left-0 top-1/2 grid size-[18px] -translate-y-1/2 place-items-center text-muted-icon [&_svg]:size-[18px]"
            aria-hidden="true"
          >
            <span
              className={cn(
                "workspace-row__icon-chevron place-items-center",
                isCollapsed ? "hidden group-hover:grid" : "grid",
              )}
            >
              <ChevronDownIcon />
            </span>
            <span
              className={cn(
                "workspace-row__icon-folder place-items-center",
                isCollapsed ? "grid group-hover:hidden" : "hidden",
              )}
            >
              <FolderIcon />
            </span>
          </span>
          <span className="workspace-row__name min-w-0 truncate text-left">{rootWorkspace.name}</span>
        </Button>
        <span
          className="workspace-row__menu-wrap relative grid justify-items-end"
          ref={wsMenu.workspaceMenuId === rootWorkspace.id ? wsMenu.workspaceMenuWrapRef : undefined}
        >
          <button
            aria-label={`工作区操作：${rootWorkspace.name}`}
            aria-haspopup="menu"
            className="workspace-row__menu-button grid size-7 place-items-center rounded-lg border border-transparent text-[18px] leading-none text-muted-soft transition hover:border-[var(--theme-control-border,var(--border-heavy))] hover:bg-[var(--theme-control-hover-bg,var(--overlay-hover))]"
            aria-expanded={wsMenu.workspaceMenuId === rootWorkspace.id}
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              wsMenu.openWorkspaceMenu(rootWorkspace.id);
            }}
          >
            …
          </button>
          {wsMenu.workspaceMenuId === rootWorkspace.id ? (
            <div className="workspace-menu absolute right-0 top-[calc(100%+8px)] z-10 grid min-w-40 gap-0.5 rounded-2xl border border-border bg-card p-1.5 shadow-xl">
              <button
                className="workspace-menu__item flex w-full items-center justify-between gap-4 rounded-lg px-[11px] py-[9px] text-left text-[13px] whitespace-nowrap text-foreground-strong hover:bg-[var(--theme-control-hover-bg,var(--surface-muted))]"
                type="button"
                onClick={(event) =>
                  wsMenu.runWorkspaceMenuAction(event, () => {
                    void api.openWorkspaceInFinder(rootWorkspace.id);
                  })
                }
              >
                打开文件夹
              </button>
              {linkedWorktree ? (
                <button
                  className="workspace-menu__item workspace-menu__item--danger flex w-full items-center justify-between gap-4 rounded-lg px-[11px] py-[9px] text-left text-[13px] whitespace-nowrap text-destructive hover:bg-[var(--theme-control-hover-bg,var(--surface-muted))]"
                  type="button"
                  onClick={(event) =>
                    wsMenu.runWorkspaceMenuAction(event, () =>
                      wsMenu.removeWorktree(linkedWorktree.rootWorkspaceId || rootWorkspace.id, linkedWorktree),
                    )
                  }
                >
                  移除工作树
                </button>
              ) : (
                <button
                  className="workspace-menu__item flex w-full items-center justify-between gap-4 rounded-lg px-[11px] py-[9px] text-left text-[13px] whitespace-nowrap text-foreground-strong hover:bg-[var(--theme-control-hover-bg,var(--surface-muted))]"
                  type="button"
                  onClick={(event) => wsMenu.runWorkspaceMenuAction(event, () => wsMenu.createWorktree(rootWorkspace.id))}
                >
                  创建永久工作树
                </button>
              )}
              <button
                className="workspace-menu__item flex w-full items-center justify-between gap-4 rounded-lg px-[11px] py-[9px] text-left text-[13px] whitespace-nowrap text-foreground-strong hover:bg-[var(--theme-control-hover-bg,var(--surface-muted))]"
                type="button"
                onClick={(event) => wsMenu.runWorkspaceMenuAction(event, () => wsMenu.startRename(rootWorkspace))}
              >
                重命名
              </button>
              <button
                className="workspace-menu__item workspace-menu__item--danger flex w-full items-center justify-between gap-4 rounded-lg px-[11px] py-[9px] text-left text-[13px] whitespace-nowrap text-destructive hover:bg-[var(--theme-control-hover-bg,var(--surface-muted))]"
                type="button"
                onClick={(event) => wsMenu.runWorkspaceMenuAction(event, () => wsMenu.removeWorkspace(rootWorkspace))}
              >
                移除
              </button>
            </div>
          ) : null}
        </span>
      </div>
      {wsMenu.workspaceRenameId === rootWorkspace.id ? (
        <form
          className="workspace-rename grid gap-2 mt-1 mb-0.5 ml-[22px] rounded-xl border border-[var(--theme-control-border,var(--line))] bg-[var(--theme-control-bg,var(--surface))] p-2.5 pb-[11px]"
          ref={wsMenu.workspaceRenamePanelRef}
          onSubmit={(event) => {
            event.preventDefault();
            wsMenu.submitRename(rootWorkspace);
          }}
        >
          <Input
            aria-label={`重命名 ${rootWorkspace.name}`}
            ref={wsMenu.workspaceRenameInputRef}
            value={wsMenu.workspaceRenameDraft}
            onChange={(event) => {
              wsMenu.setWorkspaceRenameDraft(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                wsMenu.cancelRename();
              }
            }}
            data-testid="workspace-rename-input"
            className="workspace-rename__input h-[34px] rounded-lg border-[var(--theme-control-border,var(--line))] bg-card px-2.5 text-[14px] font-[520] text-foreground-strong"
          />
          <div className="workspace-rename__actions flex items-center justify-end gap-2">
            <Button
              type="button"
              className="workspace-rename__button h-[30px] rounded-md border border-[var(--theme-control-border,var(--line))] bg-muted px-2.5 text-xs font-semibold text-muted-strong shadow-none hover:bg-muted"
              onClick={wsMenu.cancelRename}
            >
              取消
            </Button>
            <Button
              type="submit"
              className="workspace-rename__button--primary h-[30px] rounded-md px-2.5 text-xs font-semibold"
            >
              保存
            </Button>
          </div>
        </form>
      ) : null}
      {!isCollapsed ? (
        <>
          <div className="session-list grid gap-0.5">
            {threads.map((thread) => {
              const active =
                thread.workspaceId === selectedWorkspace?.id &&
                thread.session.id === selectedSession?.id;
              return (
                <ThreadSessionRow
                  key={`${thread.workspaceId}:${thread.session.id}`}
                  active={active}
                  thread={thread}
                  threadMenu={threadMenu}
                  onAction={() =>
                    onArchiveSession({
                      workspaceId: thread.workspaceId,
                      sessionId: thread.session.id,
                    })
                  }
                  onSelect={() =>
                    onSelectSession({ workspaceId: thread.workspaceId, sessionId: thread.session.id })
                  }
                  onTogglePinned={() =>
                    onSetSessionPinned(
                      { workspaceId: thread.workspaceId, sessionId: thread.session.id },
                      !thread.session.pinnedAt,
                    )
                  }
                />
              );
            })}
          </div>
          {archivedThreads.length > 0 ? (
            <div className="archived-thread-group grid gap-1 pl-6">
              <Button
                variant="ghost"
                aria-expanded={archivedSectionOpen}
                type="button"
                className="archived-thread-group__toggle h-7 w-fit justify-start gap-1.5 rounded-full px-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-soft hover:bg-[var(--overlay-hover)] hover:text-muted-soft"
                onClick={() => wsMenu.toggleArchived(rootWorkspace.id, !archivedSectionOpen)}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "archived-thread-group__chevron grid size-3.5 place-items-center transition-transform [&_svg]:size-3.5",
                    !archivedSectionOpen && "-rotate-90",
                  )}
                >
                  <ChevronDownIcon />
                </span>
                <span>已归档</span>
                <span className="archived-thread-group__count text-muted-subtle">
                  {archivedThreads.length}
                </span>
              </Button>
              {archivedSectionOpen ? (
                <div className="session-list session-list--archived grid gap-0.5">
                  {archivedThreads.map((thread) => {
                    const active =
                      thread.workspaceId === selectedWorkspace?.id &&
                      thread.session.id === selectedSession?.id;
                    return (
                      <ThreadSessionRow
                        key={`${thread.workspaceId}:${thread.session.id}`}
                        active={active}
                        archived
                        thread={thread}
                        threadMenu={threadMenu}
                        onAction={() =>
                          onUnarchiveSession({
                            workspaceId: thread.workspaceId,
                            sessionId: thread.session.id,
                          })
                        }
                        onSelect={() =>
                          onSelectSession({
                            workspaceId: thread.workspaceId,
                            sessionId: thread.session.id,
                          })
                        }
                        onTogglePinned={() =>
                          onSetSessionPinned(
                            { workspaceId: thread.workspaceId, sessionId: thread.session.id },
                            !thread.session.pinnedAt,
                          )
                        }
                      />
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function PinnedThreadsSection({
  pinnedThreads,
  sortableIds,
  sortableIdForThread,
  selectedWorkspace,
  selectedSession,
  threadMenu,
  onArchiveSession,
  onSelectSession,
  onSetSessionPinned,
}: {
  readonly pinnedThreads: readonly ThreadListEntry[];
  readonly sortableIds: readonly string[];
  readonly sortableIdForThread: (thread: ThreadListEntry) => string;
  readonly selectedWorkspace: WorkspaceRecord | undefined;
  readonly selectedSession: SessionRecord | undefined;
  readonly threadMenu: ThreadMenuState;
  readonly onArchiveSession: (target: { workspaceId: string; sessionId: string }) => void;
  readonly onSelectSession: (target: { workspaceId: string; sessionId: string }) => void;
  readonly onSetSessionPinned: (target: { workspaceId: string; sessionId: string }, pinned: boolean) => void;
}) {
  return (
    <section className="pinned-thread-group grid gap-1 border-b border-border pb-1" aria-label="固定的对话">
      <div className="pinned-thread-group__head flex h-6 items-center gap-[7px] px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-subtle [&_svg]:size-3.5">
        <PinIcon filled />
        <span>固定</span>
      </div>
      <SortableContext items={[...sortableIds]} strategy={verticalListSortingStrategy}>
        <div className="session-list session-list--pinned grid gap-0.5">
          {pinnedThreads.map((thread) => {
            const active =
              thread.workspaceId === selectedWorkspace?.id &&
              thread.session.id === selectedSession?.id;
            return (
              <SortablePinnedThreadRow
                key={`${thread.workspaceId}:${thread.session.id}`}
                id={sortableIdForThread(thread)}
                active={active}
                thread={thread}
                threadMenu={threadMenu}
                onAction={() =>
                  onArchiveSession({
                    workspaceId: thread.workspaceId,
                    sessionId: thread.session.id,
                  })
                }
                onSelect={() =>
                  onSelectSession({ workspaceId: thread.workspaceId, sessionId: thread.session.id })
                }
                onTogglePinned={() =>
                  onSetSessionPinned(
                    { workspaceId: thread.workspaceId, sessionId: thread.session.id },
                    !thread.session.pinnedAt,
                  )
                }
              />
            );
          })}
        </div>
      </SortableContext>
    </section>
  );
}

/* ── Thread session row ────────────────────────────────── */

function SortablePinnedThreadRow({
  id,
  active,
  thread,
  threadMenu,
  onAction,
  onSelect,
  onTogglePinned,
}: {
  readonly id: string;
  readonly active: boolean;
  readonly thread: ThreadListEntry;
  readonly threadMenu: ThreadMenuState;
  readonly onAction: () => void;
  readonly onSelect: () => void;
  readonly onTogglePinned: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : undefined,
  };
  return (
    <ThreadSessionRow
      ref={setNodeRef}
      style={style}
      active={active}
      thread={thread}
      threadMenu={threadMenu}
      showContext
      dragging={isDragging}
      dragAttributes={attributes}
      dragListeners={listeners}
      onAction={onAction}
      onSelect={onSelect}
      onTogglePinned={onTogglePinned}
    />
  );
}

function sessionIndicatorVariant(
  thread: ThreadListEntry,
): "running" | "failed" | "unseen" | "none" {
  if (thread.session.status === "running") {
    return "running";
  }
  if (thread.session.status === "failed") {
    return "failed";
  }
  if (thread.session.hasUnseenUpdate) {
    return "unseen";
  }
  return "none";
}

interface ThreadSessionRowProps {
  readonly active: boolean;
  readonly archived?: boolean;
  readonly showContext?: boolean;
  readonly overlay?: boolean;
  readonly dragging?: boolean;
  readonly style?: CSSProperties;
  readonly dragAttributes?: DraggableAttributes;
  readonly dragListeners?: DraggableSyntheticListeners;
  readonly thread: ThreadListEntry;
  readonly threadMenu?: ThreadMenuState;
  readonly onAction: () => void;
  readonly onSelect: () => void;
  readonly onTogglePinned: () => void;
}

const ThreadSessionRow = forwardRef<HTMLDivElement, ThreadSessionRowProps>(function ThreadSessionRow(
  {
    active,
    archived = false,
    showContext = false,
    overlay = false,
    dragging = false,
    style,
    dragAttributes,
    dragListeners,
    thread,
    threadMenu,
    onAction,
    onSelect,
    onTogglePinned,
  },
  ref,
) {
  const indicatorVariant = sessionIndicatorVariant(thread);
  const pinned = Boolean(thread.session.pinnedAt);
  const actionContext = showContext ? `（${thread.contextLabel}）` : "";
  const menuOpen = threadMenu?.menuSessionId === thread.session.id;

  return (
    <>
      <div
        ref={ref}
        style={style}
        className={cn(
          "session-row group relative grid min-h-8 grid-cols-[minmax(0,1fr)_auto] items-center gap-0.5 rounded-md border border-transparent px-2 py-1",
          "hover:bg-[var(--theme-control-hover-bg,var(--overlay-hover))] hover:border-[var(--theme-control-border,var(--line))]",
          active &&
            "session-row--active border-[var(--theme-selection-border,var(--line))] bg-[var(--theme-selection-bg,var(--surface-overlay))] text-[var(--theme-selection-ink,var(--text-strong))] shadow-sm",
          pinned && "session-row--pinned cursor-grab active:cursor-grabbing",
          dragging && "session-row--dragging shadow-md",
          overlay && "session-row--overlay min-w-[260px] border border-border bg-card shadow-lg",
        )}
        data-sidebar-indicator={indicatorVariant}
        data-session-pinned={pinned ? "true" : "false"}
        data-session-id={thread.session.id}
        onClick={() => {
          if (!dragging) onSelect();
        }}
        onContextMenu={(event) => {
          if (!threadMenu || overlay) return;
          event.preventDefault();
          event.stopPropagation();
          threadMenu.openMenu(thread.session.id);
        }}
      >
        <Button
          variant="ghost"
          type="button"
          className={cn(
            "session-row__select relative grid h-auto w-full min-w-0 justify-start gap-0 px-0 py-1 pl-[18px] text-left",
            dragAttributes && "cursor-grab active:cursor-grabbing",
          )}
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          {...dragAttributes}
          {...dragListeners}
        >
          <span
            className="session-row__leading pointer-events-none absolute left-0 top-1/2 grid size-3 -translate-y-1/2 place-items-center"
            aria-hidden="true"
          >
            {indicatorVariant === "running" ? (
              <span className="size-[11px] animate-spin rounded-full border-2 border-[var(--border-heavy)] border-r-[var(--status-running)] border-t-[var(--status-running)]" />
            ) : null}
            {indicatorVariant === "failed" ? (
              <span className="size-2 rounded-full bg-destructive" />
            ) : null}
            {indicatorVariant === "unseen" ? (
              <span className="size-2 rounded-full bg-ring" />
            ) : null}
          </span>
          <span className="session-row__body grid min-w-0 gap-px">
            <span className="session-row__title-line flex min-w-0 items-baseline gap-2">
              <span className="session-row__title min-w-0 truncate text-[13px] font-[470] text-foreground-strong">
                {thread.session.title}
              </span>
            </span>
            {showContext ? (
              <span className="session-row__context min-w-0 truncate text-[11px] text-muted-soft">
                {thread.contextLabel}
              </span>
            ) : null}
            {thread.session.preview ? (
              <span className="session-row__preview min-w-0 truncate text-xs text-muted-soft">
                {thread.session.preview}
              </span>
            ) : null}
          </span>
        </Button>
        <span
          className={cn(
            "session-row__trailing relative flex h-6 min-w-0 items-center justify-end",
            "group-hover:min-w-[74px] group-focus-within:min-w-[74px]",
            pinned && "min-w-[74px]",
            thread.environment.kind === "worktree" && "pl-[18px]",
          )}
        >
          {thread.environment.kind === "worktree" ? (
            <span
              className="session-row__workspace-icon pointer-events-none absolute left-0 top-1/2 grid size-3.5 -translate-y-1/2 place-items-center text-muted-soft [&_svg]:size-3.5"
              aria-hidden="true"
              title="工作树"
            >
              <WorktreeIcon />
            </span>
          ) : null}
          <span
            className={cn(
              "session-row__time inline-flex items-center justify-end text-[11px] font-medium text-muted-soft transition-opacity",
              "group-hover:opacity-0 group-focus-within:opacity-0",
              pinned && "opacity-0",
            )}
          >
            {formatRelativeTime(thread.session.updatedAt)}
          </span>
          <span className="session-row__action-cluster absolute right-0 top-1/2 z-[1] flex -translate-y-1/2 items-center gap-px">
            {!archived ? (
              <button
                aria-label={`${pinned ? "取消固定" : "固定"}：${thread.session.title}${actionContext}`}
                aria-pressed={pinned}
                className={cn(
                  "session-row__action session-row__pin-action grid h-7 place-items-center rounded-md px-1.5 pr-0 text-muted-strong transition",
                  "invisible scale-92 opacity-0 pointer-events-none group-hover:visible group-hover:scale-100 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:bg-[var(--theme-control-hover-bg,var(--overlay-hover))] group-focus-within:visible group-focus-within:scale-100 group-focus-within:opacity-100",
                  pinned && "visible scale-100 opacity-100 pointer-events-auto text-foreground-strong",
                )}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onTogglePinned();
                }}
              >
                <PinIcon filled={pinned} />
              </button>
            ) : null}
            <button
              aria-label={`${archived ? "恢复" : "归档"} ${thread.session.title}${actionContext}`}
              className={cn(
                "session-row__action grid h-7 place-items-center rounded-md px-1.5 pr-0 text-muted-strong transition",
                "invisible scale-92 opacity-0 pointer-events-none group-hover:visible group-hover:scale-100 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:bg-[var(--theme-control-hover-bg,var(--overlay-hover))] group-focus-within:visible group-focus-within:scale-100 group-focus-within:opacity-100",
              )}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAction();
              }}
            >
              {archived ? <RestoreIcon /> : <ArchiveIcon />}
            </button>
            {threadMenu && !overlay ? (
              <span
                className="session-row__menu-wrap relative inline-flex"
                ref={menuOpen ? threadMenu.menuWrapRef : undefined}
              >
                <button
                  aria-label={`对话操作：${thread.session.title}${actionContext}`}
                  aria-haspopup="menu"
                  className={cn(
                    "session-row__action session-row__menu-button grid h-7 place-items-center rounded-md px-1.5 pr-0 text-[18px] leading-none text-muted-soft transition",
                    "invisible scale-92 opacity-0 pointer-events-none group-hover:visible group-hover:scale-100 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:bg-[var(--theme-control-hover-bg,var(--overlay-hover))] group-focus-within:visible group-focus-within:scale-100 group-focus-within:opacity-100",
                    menuOpen && "visible scale-100 opacity-100 pointer-events-auto",
                  )}
                  aria-expanded={menuOpen}
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    threadMenu.toggleMenu(thread.session.id);
                  }}
                >
                  …
                </button>
                {menuOpen ? (
                  <div
                    className="workspace-menu session-row__menu absolute right-[-6px] top-[calc(100%+4px)] z-20 grid min-w-40 gap-0.5 rounded-2xl border border-border bg-card p-1.5 shadow-xl"
                    role="menu"
                  >
                    <button
                      className="workspace-menu__item flex w-full items-center justify-between gap-4 rounded-lg px-[11px] py-[9px] text-left text-[13px] whitespace-nowrap text-foreground-strong hover:bg-[var(--theme-control-hover-bg,var(--surface-muted))]"
                      type="button"
                      onClick={(event) => threadMenu.runMenuAction(event, () => threadMenu.startRename(thread))}
                    >
                      <span>重命名对话</span>
                      <span
                        className="workspace-menu__shortcut flex-none text-xs tracking-[0.5px] text-muted-foreground"
                        aria-hidden="true"
                      >
                        {RENAME_THREAD_SHORTCUT_HINT}
                      </span>
                    </button>
                    <button
                      className="workspace-menu__item flex w-full items-center justify-between gap-4 rounded-lg px-[11px] py-[9px] text-left text-[13px] whitespace-nowrap text-foreground-strong hover:bg-[var(--theme-control-hover-bg,var(--surface-muted))]"
                      type="button"
                      onClick={(event) => threadMenu.runMenuAction(event, () => threadMenu.archiveOrRestore(thread))}
                    >
                      {archived ? "恢复" : "归档"}
                    </button>
                    {thread.session.hasUnseenUpdate ? (
                      <button
                        className="workspace-menu__item flex w-full items-center justify-between gap-4 rounded-lg px-[11px] py-[9px] text-left text-[13px] whitespace-nowrap text-foreground-strong hover:bg-[var(--theme-control-hover-bg,var(--surface-muted))]"
                        type="button"
                        onClick={(event) => threadMenu.runMenuAction(event, () => threadMenu.markRead(thread))}
                      >
                        标记为已读
                      </button>
                    ) : null}
                    <button
                      className="workspace-menu__item flex w-full items-center justify-between gap-4 rounded-lg px-[11px] py-[9px] text-left text-[13px] whitespace-nowrap text-foreground-strong hover:bg-[var(--theme-control-hover-bg,var(--surface-muted))]"
                      type="button"
                      onClick={(event) => threadMenu.runMenuAction(event, () => threadMenu.copySessionId(thread))}
                    >
                      复制会话 ID
                    </button>
                  </div>
                ) : null}
              </span>
            ) : null}
          </span>
        </span>
      </div>
      {threadMenu?.renameSessionId === thread.session.id ? (
        <form
          className="workspace-rename session-rename grid gap-2 mt-1 mb-0.5 ml-[18px] rounded-xl border border-[var(--theme-control-border,var(--line))] bg-[var(--theme-control-bg,var(--surface))] p-2.5 pb-[11px]"
          ref={threadMenu.renamePanelRef}
          onSubmit={(event) => {
            event.preventDefault();
            threadMenu.submitRename(thread);
          }}
        >
          <Input
            aria-label={`重命名对话 ${thread.session.title}`}
            ref={threadMenu.renameInputRef}
            value={threadMenu.renameDraft}
            onChange={(event) => threadMenu.setRenameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                threadMenu.cancelRename();
              }
            }}
            data-testid="session-rename-input"
            className="workspace-rename__input h-[34px] rounded-lg border-[var(--theme-control-border,var(--line))] bg-card px-2.5 text-[14px] font-[520] text-foreground-strong"
          />
          <div className="workspace-rename__actions flex items-center justify-end gap-2">
            <Button
              type="button"
              className="workspace-rename__button h-[30px] rounded-md border border-[var(--theme-control-border,var(--line))] bg-muted px-2.5 text-xs font-semibold text-muted-strong shadow-none hover:bg-muted"
              onClick={threadMenu.cancelRename}
            >
              取消
            </Button>
            <Button
              type="submit"
              className="workspace-rename__button--primary h-[30px] rounded-md px-2.5 text-xs font-semibold"
            >
              保存
            </Button>
          </div>
        </form>
      ) : null}
    </>
  );
});
