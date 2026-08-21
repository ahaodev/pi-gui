import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { WorkspaceRecord, WorktreeRecord } from "./desktop-state";
import type { DiffPanelFileRequest, FileWorkbenchContext } from "./diff-panel-types";
import type { ChangedFileEntry, ChangedFilesResult, PiDesktopApi, WorkspaceFilePreview } from "./ipc";
import { InlineDiff } from "./diff-inline";
import { FileIcon, FolderIcon, RefreshIcon } from "./icons";
import { extensionToLanguage } from "./syntax-highlight";
import { loadReviewed, pruneReviewed, saveReviewed } from "./reviewed-files-store";

interface WorkbenchChangedFile extends ChangedFileEntry {
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly branchName?: string;
}

interface FileSelection {
  readonly workspaceId: string;
  readonly path: string;
}

interface FileTreeNode {
  readonly name: string;
  readonly path: string;
  readonly kind: "directory" | "file";
  readonly children: readonly FileTreeNode[];
}

interface DiffPanelProps {
  readonly panelMode: "changes" | "files";
  readonly workspaceId: string;
  readonly sessionId: string;
  readonly api: PiDesktopApi;
  readonly sessionStatus: string | undefined;
  readonly fileRequest?: DiffPanelFileRequest | null;
  readonly contexts: readonly FileWorkbenchContext[];
}

export function DiffPanel({
  panelMode,
  workspaceId,
  sessionId,
  api,
  sessionStatus,
  fileRequest,
  contexts,
}: DiffPanelProps) {
  const [filesByWorkspace, setFilesByWorkspace] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [changedByWorkspace, setChangedByWorkspace] =
    useState<Readonly<Record<string, ChangedFilesResult>>>({});
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(workspaceId);
  const [selectedFile, setSelectedFile] = useState<FileSelection | null>(null);
  const [viewerMode, setViewerMode] = useState<"preview" | "diff">("preview");
  const [diffText, setDiffText] = useState("");
  const [preview, setPreview] = useState<WorkspaceFilePreview | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [reviewed, setReviewed] = useState<ReadonlySet<string>>(() =>
    loadReviewed(workspaceId, sessionId),
  );
  const contextsRef = useRef(contexts);
  const viewerRequestNonceRef = useRef(0);
  const refreshRequestNonceRef = useRef(0);

  const contextIdsKey = useMemo(() => contexts.map((context) => context.workspace.id).join("\n"), [contexts]);
  const knownContextIds = useMemo(() => new Set(contextIdsKey ? contextIdsKey.split("\n") : []), [contextIdsKey]);
  const activeContext = contexts.find((context) => context.workspace.id === activeWorkspaceId) ?? contexts[0];
  const activeFiles = activeContext ? filesByWorkspace[activeContext.workspace.id] ?? [] : [];
  const activeTree = useMemo(() => buildFileTree(activeFiles), [activeFiles]);
  const changedGroups = useMemo(
    () =>
      contexts.map((context) => {
        const result = changedByWorkspace[context.workspace.id];
        return {
          context,
          error: result?.state === "unavailable" ? result.error : undefined,
          pending: result === undefined,
          files:
            result?.state === "available"
              ? result.files.map((file) => toWorkbenchChangedFile(context, file))
              : [],
        };
      }),
    [changedByWorkspace, contexts],
  );
  const changedRows = useMemo(() => changedGroups.flatMap((group) => group.files), [changedGroups]);
  const unavailableChangedGroupCount = useMemo(
    () => changedGroups.reduce((count, group) => count + (group.error ? 1 : 0), 0),
    [changedGroups],
  );
  const pendingChangedGroupCount = useMemo(
    () => changedGroups.reduce((count, group) => count + (group.pending ? 1 : 0), 0),
    [changedGroups],
  );
  const changedFilesSummary = buildChangedFilesSummary(
    changedRows.length,
    unavailableChangedGroupCount,
    pendingChangedGroupCount,
  );
  const changedRowsRef = useRef(changedRows);
  changedRowsRef.current = changedRows;
  const filesByWorkspaceRef = useRef(filesByWorkspace);
  filesByWorkspaceRef.current = filesByWorkspace;

  useEffect(() => {
    setReviewed(loadReviewed(workspaceId, sessionId));
  }, [workspaceId, sessionId]);

  useEffect(() => {
    contextsRef.current = contexts;
  }, [contexts]);

  useEffect(() => {
    if (knownContextIds.has(activeWorkspaceId)) {
      return;
    }
    setActiveWorkspaceId(workspaceId);
  }, [activeWorkspaceId, knownContextIds, workspaceId]);

  const refresh = useCallback((options: { readonly force?: boolean } = {}) => {
    const refreshContexts = contextsRef.current;
    // Latest-request-wins: overlapping refreshes (e.g. running→idle firing alongside a
    // context/mount refresh) must not let a slower earlier request overwrite newer state.
    refreshRequestNonceRef.current += 1;
    const requestNonce = refreshRequestNonceRef.current;
    if (refreshContexts.length === 0) {
      setFilesByWorkspace({});
      setChangedByWorkspace({});
      return;
    }

    setLoading(true);
    void Promise.all(
      refreshContexts.map(async (context) => {
        const [workspaceFiles, changedFiles] = await Promise.all([
          api.listWorkspaceFiles(context.workspace.id, { force: options.force ?? false }),
          api.getChangedFiles(context.workspace.id),
        ]);
        return { workspaceId: context.workspace.id, workspaceFiles, changedFiles };
      }),
    )
      .then((results) => {
        if (refreshRequestNonceRef.current !== requestNonce) {
          return;
        }
        const nextFilesByWorkspace: Record<string, readonly string[]> = {};
        const nextChangedByWorkspace: Record<string, ChangedFilesResult> = {};
        for (const result of results) {
          nextFilesByWorkspace[result.workspaceId] = result.workspaceFiles;
          nextChangedByWorkspace[result.workspaceId] = result.changedFiles;
        }
        setFilesByWorkspace(nextFilesByWorkspace);
        setChangedByWorkspace(nextChangedByWorkspace);
        setSelectedFile((current) => {
          if (!current) {
            return null;
          }
          const changedResult = nextChangedByWorkspace[current.workspaceId];
          const changedFiles = changedResult?.state === "available" ? changedResult.files : [];
          const availableFiles = new Set([
            ...(nextFilesByWorkspace[current.workspaceId] ?? []),
            ...changedFiles.map((file) => file.path),
          ]);
          return availableFiles.has(current.path) ? current : null;
        });
        setReviewed((current) => {
          const unavailableWorkspaceIds = new Set(
            results
              .filter((result) => result.changedFiles.state === "unavailable")
              .map((result) => result.workspaceId),
          );
          const retainedUnavailableKeys = [...current].filter((key) => {
            const reviewedWorkspaceId = workspaceIdFromReviewedFileKey(key);
            return reviewedWorkspaceId !== undefined && unavailableWorkspaceIds.has(reviewedWorkspaceId);
          });
          const pruned = pruneReviewed(
            current,
            [
              ...results.flatMap((result) =>
                result.changedFiles.state === "available"
                  ? result.changedFiles.files.map((file) => reviewedFileKey(result.workspaceId, file.path))
                  : [],
              ),
              ...retainedUnavailableKeys,
            ],
          );
          if (pruned !== current) {
            saveReviewed(workspaceId, sessionId, pruned);
          }
          return pruned;
        });
      })
      .finally(() => {
        if (refreshRequestNonceRef.current === requestNonce) {
          setLoading(false);
        }
      });
  }, [api, contextIdsKey, sessionId, workspaceId]);

  const prevStatusRef = useRef(sessionStatus);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = sessionStatus;
    if (prev === "running" && sessionStatus !== "running") {
      refresh();
    }
  }, [sessionStatus, refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Resolve the workspace/worktree a requested path actually belongs to, mirroring the in-list
  // click path (which uses file.workspaceId). Falling back to the top-level workspaceId prop would
  // query the wrong tree in multi-context (worktree) views.
  const resolveWorkspaceIdForPath = useCallback(
    (path: string): string => {
      const changedMatch = changedRowsRef.current.find((file) => file.path === path);
      if (changedMatch) {
        return changedMatch.workspaceId;
      }
      for (const context of contextsRef.current) {
        if ((filesByWorkspaceRef.current[context.workspace.id] ?? []).includes(path)) {
          return context.workspace.id;
        }
      }
      return workspaceId;
    },
    [workspaceId],
  );

  useEffect(() => {
    if (!fileRequest) {
      return;
    }
    setViewerMode("diff");
    setSelectedFile({ workspaceId: resolveWorkspaceIdForPath(fileRequest.path), path: fileRequest.path });
  }, [fileRequest, resolveWorkspaceIdForPath]);

  useEffect(() => {
    viewerRequestNonceRef.current += 1;
    const requestNonce = viewerRequestNonceRef.current;
    if (!selectedFile) {
      setDiffText("");
      setPreview(null);
      setViewerError(null);
      setViewerLoading(false);
      return;
    }

    setViewerLoading(true);
    setViewerError(null);
    if (viewerMode === "diff") {
      setPreview(null);
      void api
        .getFileDiff(selectedFile.workspaceId, selectedFile.path)
        .then((result) => {
          if (viewerRequestNonceRef.current === requestNonce) {
            setDiffText(result);
          }
        })
        .catch((error) => {
          if (viewerRequestNonceRef.current === requestNonce) {
            setDiffText("");
            setViewerError(error instanceof Error ? error.message : String(error));
          }
        })
        .finally(() => {
          if (viewerRequestNonceRef.current === requestNonce) {
            setViewerLoading(false);
          }
        });
      return;
    }

    setDiffText("");
    void api
      .readWorkspaceFile(selectedFile.workspaceId, selectedFile.path)
      .then((result) => {
        if (viewerRequestNonceRef.current === requestNonce) {
          setPreview(result);
        }
      })
      .catch((error) => {
        if (viewerRequestNonceRef.current === requestNonce) {
          setPreview(null);
          setViewerError(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (viewerRequestNonceRef.current === requestNonce) {
          setViewerLoading(false);
        }
      });
  }, [api, selectedFile, viewerMode]);

  const fileListRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!selectedFile) {
      return;
    }
    const row = fileListRef.current?.querySelector<HTMLElement>(
      `[data-file-path="${CSS.escape(selectedFile.path)}"]`,
    );
    row?.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, [selectedFile, changedRows]);

  const handleStage = (file: WorkbenchChangedFile) => {
    void api.stageFile(file.workspaceId, file.path, file.stagingSourcePath).then(() => refresh());
  };

  const toggleReviewed = useCallback(
    (file: WorkbenchChangedFile) => {
      setReviewed((current) => {
        const key = reviewedFileKey(file.workspaceId, file.path);
        const next = new Set(current);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        saveReviewed(workspaceId, sessionId, next);
        return next;
      });
    },
    [workspaceId, sessionId],
  );

  const reviewedCount = useMemo(
    () => changedRows.reduce((acc, file) => acc + (reviewed.has(reviewedFileKey(file.workspaceId, file.path)) ? 1 : 0), 0),
    [changedRows, reviewed],
  );
  const showContextStrip = contexts.length > 1;
  const showReviewCounter = panelMode === "changes" && changedRows.length > 0;

  useEffect(() => {
    if (panelMode === "files") {
      setViewerMode("preview");
    }
  }, [panelMode]);

  return (
    <section className={`diff-panel file-workbench file-workbench--${panelMode} flex h-full min-h-0 flex-col overflow-hidden bg-surface`}>
      <div className="diff-panel__header file-workbench__header flex items-center justify-between gap-2 border-b border-border px-4 pt-3 pb-2.5">
        <div className="file-workbench__heading min-w-0">
          <h2 className="diff-panel__title m-0 text-sm font-semibold text-foreground-strong">{panelMode === "changes" ? "变更" : "文件"}</h2>
          <span className="file-workbench__subtitle block max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-muted-soft">{buildSubtitle(activeContext)}</span>
        </div>
        {showReviewCounter ? (
          <span className="diff-panel__counter ml-auto mr-2 text-xs text-muted-strong tabular-nums" data-testid="diff-panel-counter">
            {`已审阅 ${reviewedCount} / ${changedRows.length}`}
          </span>
        ) : null}
        <button
          className="icon-button"
          type="button"
          onClick={() => refresh({ force: true })}
          aria-label="刷新"
          disabled={loading}
        >
          <RefreshIcon />
        </button>
      </div>

      {showContextStrip ? (
        <div className="file-workbench__context-strip flex gap-1.5 overflow-x-auto border-b border-border px-2.5 py-2" aria-label="文件作用域">
          {contexts.map((context) => {
            const isActive = activeContext?.workspace.id === context.workspace.id;
            const changedResult = changedByWorkspace[context.workspace.id];
            const changeCount = changedResult?.state === "available" ? changedResult.files.length : 0;
            return (
              <button
                className={[
                  "file-workbench__context flex min-w-[92px] max-w-[160px] items-center justify-between gap-2 rounded-md border px-2 py-[7px] text-xs",
                  "[&>span]:min-w-0 [&>span]:overflow-hidden [&>span]:text-ellipsis [&>span]:whitespace-nowrap",
                  isActive
                    ? "file-workbench__context--active border-[var(--accent)] bg-accent-tint text-[var(--accent)]"
                    : "border-border bg-surface-muted text-muted-strong",
                ].filter(Boolean).join(" ")}
                key={context.workspace.id}
                type="button"
                onClick={() => setActiveWorkspaceId(context.workspace.id)}
              >
                <span>{contextLabel(context)}</span>
                <strong>
                  {changedResult === undefined
                    ? "加载中"
                    : changedResult.state === "unavailable"
                      ? "不可用"
                      : changeCount}
                </strong>
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        className={[
          "file-workbench__body grid min-h-0 grid-rows-[minmax(0,1fr)] overflow-hidden border-b border-border",
          panelMode === "files" ? "flex-[0_1_42%] min-h-[180px]" : "flex-[0_0_min(42%,280px)]",
        ].join(" ")}
      >
        {panelMode === "files" ? (
          <section className="file-workbench__section file-workbench__section--tree grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden" aria-label="工作区文件树">
            <div className="file-workbench__section-header flex min-h-[30px] items-center justify-between gap-2 px-3 text-[11px] font-bold text-muted-soft uppercase">
              <span>工作区文件树</span>
              <span>{activeFiles.length}</span>
            </div>
            {activeTree.length === 0 ? (
              <div className="diff-panel__empty px-4 py-10 text-center text-[13px] text-muted-soft">没有已索引的文件</div>
            ) : (
              <div className="file-workbench__tree min-h-0 overflow-auto py-1 pb-2" data-testid="file-workbench-tree">
                {activeTree.map((node) => (
                  <FileTreeRow
                    key={node.path || node.name}
                    node={node}
                    depth={0}
                    selectedFile={selectedFile}
                    activeWorkspaceId={activeContext?.workspace.id ?? workspaceId}
                    onSelect={(path) => {
                      const nextWorkspaceId = activeContext?.workspace.id ?? workspaceId;
                      setViewerMode("preview");
                      setSelectedFile({ workspaceId: nextWorkspaceId, path });
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="file-workbench__section file-workbench__section--changes grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden" aria-label="已变更文件">
            <div className="file-workbench__section-header flex min-h-[30px] items-center justify-between gap-2 px-3 text-[11px] font-bold text-muted-soft uppercase">
              <span>已变更文件</span>
              <span>{changedFilesSummary}</span>
            </div>
            {changedRows.length === 0 && unavailableChangedGroupCount === 0 ? (
              <div className="diff-panel__empty px-4 py-10 text-center text-[13px] text-muted-soft">
                {pendingChangedGroupCount > 0 ? "正在加载变更……" : "没有变更"}
              </div>
            ) : (
              <div className="diff-panel__file-list min-h-0 overflow-y-auto" ref={fileListRef}>
                {changedGroups.map((group) =>
                  group.files.length === 0 && !group.error ? null : (
                    <div className="file-workbench__change-group grid" key={group.context.workspace.id}>
                      {showContextStrip ? (
                        <div className="file-workbench__section-header file-workbench__change-heading flex min-h-[26px] items-center justify-between gap-2 bg-surface-muted px-3 text-[11px] font-bold text-muted-soft uppercase">
                          <span>{contextLabel(group.context)}</span>
                          <span>{group.error ? "不可用" : group.files.length}</span>
                        </div>
                      ) : null}
                      {group.error ? (
                        <div
                          className="diff-panel__empty diff-panel__unavailable px-4 py-10 text-center text-[13px] text-error-ink"
                          data-testid="changed-files-unavailable"
                          role="status"
                        >
                          {group.error.message}
                        </div>
                      ) : group.files.map((file) => {
                        const isReviewed = reviewed.has(reviewedFileKey(file.workspaceId, file.path));
                        const isSelected =
                          viewerMode === "diff" &&
                          selectedFile?.workspaceId === file.workspaceId &&
                          selectedFile.path === file.path;
                        const className = [
                          "diff-panel__file flex items-center gap-1.5 p-0",
                          isSelected ? "diff-panel__file--selected bg-surface-muted" : "",
                          isReviewed ? "diff-panel__file--reviewed" : "",
                        ]
                          .filter(Boolean)
                          .join(" ");
                        return (
                          <div className={className} key={`${file.workspaceId}:${file.path}`} data-file-path={file.path}>
                            <input
                              aria-label={`标记 ${file.path} 为已审阅`}
                              className="diff-panel__reviewed-checkbox m-0 ml-3 flex-none cursor-pointer"
                              data-testid={`diff-panel-reviewed-${file.path}`}
                              type="checkbox"
                              checked={isReviewed}
                              onChange={() => toggleReviewed(file)}
                            />
                            <button
                              className={[
                                "diff-panel__file-name flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-0 bg-transparent px-3 py-1.5 text-left text-[13px] font-mono hover:bg-surface-muted",
                                isReviewed ? "text-muted-soft line-through" : "text-foreground",
                              ].filter(Boolean).join(" ")}
                              type="button"
                              onClick={() => {
                                setViewerMode("diff");
                                setSelectedFile(
                                  isSelected ? null : { workspaceId: file.workspaceId, path: file.path },
                                );
                              }}
                            >
                              <span
                                className={`diff-panel__status-dot inline-block size-2 flex-none rounded-full ${statusDotClass(file.status)}`}
                              />
                              <span className="diff-panel__file-path min-w-0 whitespace-pre-wrap wrap-anywhere">{formatPathForDisplay(file.path)}</span>
                              <span className="file-workbench__status-label ml-auto font-sans text-[11px] text-muted-soft">{statusLabel(file)}</span>
                            </button>
                            <button
                              className="diff-panel__stage-btn mr-2 cursor-pointer rounded-[var(--radius-xs)] border border-border bg-transparent px-2 py-0.5 text-[11px] text-muted-strong hover:enabled:bg-surface-muted disabled:cursor-default disabled:opacity-[0.55] disabled:text-muted-soft"
                              type="button"
                              onClick={() => handleStage(file)}
                              disabled={file.staged}
                            >
                              {file.staged ? "已暂存" : "暂存"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ),
                )}
              </div>
            )}
          </section>
        )}
      </div>

      <div
        className={[
          "diff-panel__viewer file-workbench__viewer flex-1 overflow-y-auto border-t-0",
          panelMode === "changes" ? "min-h-[260px]" : "min-h-[220px]",
        ].join(" ")}
      >
        <div className="diff-panel__viewer-header file-workbench__viewer-header flex items-center justify-between gap-2.5 border-b border-border bg-surface-muted px-3 py-2 font-mono text-xs font-semibold text-foreground">
          <span className="file-workbench__viewer-path diff-panel__file-path min-w-0 whitespace-pre-wrap wrap-anywhere">
            {selectedFile ? formatPathForDisplay(selectedFile.path) : "选择文件"}
          </span>
          {selectedFile && panelMode === "changes" ? (
            <span className="file-workbench__viewer-modes flex flex-wrap justify-end gap-1" role="group" aria-label="查看模式">
              <button
                className={viewerMode === "preview"
                  ? "file-workbench__mode file-workbench__mode--active h-6 cursor-pointer rounded-sm border border-[var(--accent)] bg-accent-tint px-2 text-xs font-[650] text-[var(--accent)]"
                  : "file-workbench__mode h-6 cursor-pointer rounded-sm border border-border bg-surface-muted px-2 text-xs font-[650] text-muted-strong"}
                type="button"
                onClick={() => setViewerMode("preview")}
              >
                文件
              </button>
              <button
                className={viewerMode === "diff"
                  ? "file-workbench__mode file-workbench__mode--active h-6 cursor-pointer rounded-sm border border-[var(--accent)] bg-accent-tint px-2 text-xs font-[650] text-[var(--accent)]"
                  : "file-workbench__mode h-6 cursor-pointer rounded-sm border border-border bg-surface-muted px-2 text-xs font-[650] text-muted-strong"}
                type="button"
                onClick={() => setViewerMode("diff")}
              >
                差异
              </button>
            </span>
          ) : null}
        </div>
        {renderViewer({
          selectedFile,
          viewerMode,
          viewerLoading,
          viewerError,
          preview,
          diffText,
        })}
      </div>
    </section>
  );
}

function FileTreeRow({
  node,
  depth,
  selectedFile,
  activeWorkspaceId,
  onSelect,
}: {
  readonly node: FileTreeNode;
  readonly depth: number;
  readonly selectedFile: FileSelection | null;
  readonly activeWorkspaceId: string;
  readonly onSelect: (path: string) => void;
}) {
  if (node.kind === "directory") {
    return (
      <div>
        <div
          className="file-workbench__tree-row file-workbench__tree-row--dir flex min-h-7 w-full items-center gap-1.5 py-1 pr-2.5 pl-[calc(10px+var(--depth)*14px)] text-left text-xs font-[650] text-muted-strong"
          style={{ "--depth": depth } as CSSProperties}
        >
          <span className="file-workbench__tree-icon size-[15px] flex-none [&_svg]:size-[15px]"><FolderIcon /></span>
          <span>{node.name}</span>
        </div>
        {node.children.map((child) => (
          <FileTreeRow
            key={child.path || child.name}
            node={child}
            depth={depth + 1}
            selectedFile={selectedFile}
            activeWorkspaceId={activeWorkspaceId}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }

  const isSelected = selectedFile?.workspaceId === activeWorkspaceId && selectedFile.path === node.path;
  return (
    <button
      className={`file-workbench__tree-row file-workbench__tree-row--file flex min-h-7 w-full cursor-pointer items-center gap-1.5 border-0 bg-transparent py-1 pr-2.5 pl-[calc(10px+var(--depth)*14px)] text-left text-xs text-foreground hover:bg-surface-muted ${isSelected ? "file-workbench__tree-row--selected bg-surface-muted" : ""}`}
      data-file-path={node.path}
      style={{ "--depth": depth } as CSSProperties}
      type="button"
      onClick={() => onSelect(node.path)}
    >
      <span className="file-workbench__tree-icon size-[15px] flex-none [&_svg]:size-[15px]"><FileIcon /></span>
      <span>{node.name}</span>
    </button>
  );
}

function renderViewer({
  selectedFile,
  viewerMode,
  viewerLoading,
  viewerError,
  preview,
  diffText,
}: {
  readonly selectedFile: FileSelection | null;
  readonly viewerMode: "preview" | "diff";
  readonly viewerLoading: boolean;
  readonly viewerError: string | null;
  readonly preview: WorkspaceFilePreview | null;
  readonly diffText: string;
}) {
  if (!selectedFile) {
    return <div className="diff-panel__empty px-4 py-10 text-center text-[13px] text-muted-soft">从文件树或已变更文件中选择文件。</div>;
  }
  if (viewerLoading) {
    return <div className="diff-panel__empty px-4 py-10 text-center text-[13px] text-muted-soft">{viewerMode === "diff" ? "正在加载差异……" : "正在加载预览……"}</div>;
  }
  if (viewerError) {
    return <div className="diff-panel__empty px-4 py-10 text-center text-[13px] text-muted-soft">{viewerError}</div>;
  }
  if (viewerMode === "diff") {
    return diffText ? (
      <InlineDiff diff={diffText} language={extensionToLanguage(selectedFile.path)} />
    ) : (
      <div className="diff-panel__empty px-4 py-10 text-center text-[13px] text-muted-soft">该文件没有可用的差异。</div>
    );
  }
  if (!preview) {
    return <div className="diff-panel__empty px-4 py-10 text-center text-[13px] text-muted-soft">没有可用的预览。</div>;
  }
  if (preview.binary) {
    return <div className="diff-panel__empty px-4 py-10 text-center text-[13px] text-muted-soft">无法预览二进制文件或目录。</div>;
  }
  return (
    <pre className="file-workbench__preview m-0 p-3 whitespace-pre-wrap font-mono text-xs text-foreground" data-testid="file-workbench-preview">
      {preview.content}
      {preview.truncated ? "\n\n[预览已截断]" : ""}
    </pre>
  );
}

function statusDotClass(status: string): string {
  switch (status) {
    case "modified":
    case "renamed":
      return "bg-[var(--diff-modified-ink)]";
    case "added":
    case "copied":
      return "bg-[var(--diff-added-ink)]";
    case "deleted":
      return "bg-[var(--diff-removed-ink)]";
    case "untracked":
      return "bg-[var(--diff-untracked-ink)]";
    default:
      return "bg-muted-soft";
  }
}

function buildFileTree(files: readonly string[]): readonly FileTreeNode[] {
  const root: MutableFileTreeNode = { name: "", path: "", kind: "directory", children: [], childrenByKey: new Map() };
  for (const filePath of files) {
    const parts = filePath.split("/").filter(Boolean);
    let cursor = root;
    let nodePath = "";
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index]!;
      const isFile = index === parts.length - 1;
      nodePath = nodePath ? `${nodePath}/${part}` : part;
      const kind = isFile ? "file" : "directory";
      const childKey = `${kind}:${part}`;
      let next = cursor.childrenByKey.get(childKey);
      if (!next) {
        next = {
          name: part,
          path: nodePath,
          kind,
          children: [],
          childrenByKey: new Map(),
        };
        cursor.children.push(next);
        cursor.childrenByKey.set(childKey, next);
      }
      if (!isFile) {
        cursor = next;
      }
    }
  }
  return sortTree(root.children);
}

interface MutableFileTreeNode {
  readonly name: string;
  readonly path: string;
  readonly kind: "directory" | "file";
  readonly children: MutableFileTreeNode[];
  readonly childrenByKey: Map<string, MutableFileTreeNode>;
}

function sortTree(nodes: readonly MutableFileTreeNode[]): readonly FileTreeNode[] {
  return [...nodes]
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "directory" ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    })
    .map((node) => ({
      name: node.name,
      path: node.path,
      kind: node.kind,
      children: sortTree(node.children),
    }));
}

function toWorkbenchChangedFile(context: FileWorkbenchContext, file: ChangedFileEntry): WorkbenchChangedFile {
  return {
    ...file,
    workspaceId: context.workspace.id,
    workspaceName: context.workspace.name,
    branchName: context.worktree?.branchName ?? context.workspace.branchName,
  };
}

function reviewedFileKey(workspaceId: string, filePath: string): string {
  return JSON.stringify([workspaceId, filePath]);
}

function workspaceIdFromReviewedFileKey(key: string): string | undefined {
  try {
    const value: unknown = JSON.parse(key);
    return Array.isArray(value) && value.length === 2 && typeof value[0] === "string"
      ? value[0]
      : undefined;
  } catch {
    return undefined;
  }
}

function formatPathForDisplay(path: string): string {
  return JSON.stringify(path);
}

function contextLabel(context: FileWorkbenchContext): string {
  if (context.role === "thread") {
    return "当前对话";
  }
  if (context.role === "worktree") {
    return context.worktree?.branchName ?? context.workspace.branchName ?? context.workspace.name;
  }
  return context.workspace.name;
}

function buildSubtitle(context: FileWorkbenchContext | undefined): string {
  if (!context) {
    return "未选择工作区";
  }
  if (context.role === "worktree") {
    return `工作树 ${context.worktree?.branchName ?? context.workspace.name}`;
  }
  return context.workspace.path;
}

function statusLabel(file: WorkbenchChangedFile): string {
  const labels: Record<string, string> = {
    added: "已添加",
    copied: "已复制",
    deleted: "已删除",
    modified: "已修改",
    renamed: "已重命名",
    untracked: "未跟踪",
  };
  const branch = file.branchName ? ` · ${file.branchName}` : "";
  return `${labels[file.status] ?? file.status}${branch}`;
}

function buildChangedFilesSummary(
  changedCount: number,
  unavailableCount: number,
  pendingCount: number,
): string {
  const parts = [
    changedCount > 0 ? String(changedCount) : "",
    unavailableCount > 0 ? `${unavailableCount} 个不可用` : "",
    pendingCount > 0 ? `${pendingCount} 个加载中` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "0";
}
