import { useMemo, useState } from "react";
import type { RuntimeExtensionRecord, RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import type { ExtensionCommandCompatibilityRecord, WorkspaceRecord } from "./desktop-state";
import { extensionScopeLabel, extensionSourceSummary } from "./extension-display";
import { RefreshIcon } from "./icons";

interface ExtensionsViewProps {
  readonly workspace?: WorkspaceRecord;
  readonly runtime?: RuntimeSnapshot;
  readonly commandCompatibility?: readonly ExtensionCommandCompatibilityRecord[];
  readonly onRefresh: () => void;
  readonly onOpenExtensionFolder: (filePath: string) => void;
  readonly onToggleExtension: (filePath: string, enabled: boolean) => void;
}

export function ExtensionsView({
  workspace,
  runtime,
  commandCompatibility = [],
  onRefresh,
  onOpenExtensionFolder,
  onToggleExtension,
}: ExtensionsViewProps) {
  const [query, setQuery] = useState("");
  const [selectedExtensionPath, setSelectedExtensionPath] = useState<string | undefined>();
  const extensions = runtime?.extensions ?? [];
  const filteredExtensions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return extensions;
    }

    return extensions.filter((extension) =>
      [
        extension.displayName,
        extension.path,
        extension.sourceInfo.source,
        extensionScopeLabel(extension),
        extensionSourceSummary(extension),
        extension.sourceInfo.origin,
        ...extension.commands,
        ...extension.tools,
        ...extension.flags,
        ...extension.shortcuts,
        ...extension.diagnostics.map((diagnostic) => diagnostic.message),
      ].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [extensions, query]);
  const selectedExtension =
    filteredExtensions.find((extension) => extension.path === selectedExtensionPath) ?? filteredExtensions[0];
  const selectedExtensionCanBeManaged = selectedExtension ? isManageableExtension(selectedExtension) : false;
  const selectedCompatibilityRecords = useMemo(
    () =>
      selectedExtension
        ? commandCompatibility
            .filter((record) => record.extensionPath === selectedExtension.path)
            .sort((left, right) => left.commandName.localeCompare(right.commandName))
        : [],
    [commandCompatibility, selectedExtension],
  );

  if (!workspace) {
    return (
      <section className="canvas canvas--empty grid content-center overflow-auto px-7 pt-5 pb-0 max-[980px]:px-[18px]">
        <div className="empty-panel mx-auto grid w-[min(760px,100%)] gap-2">
          <div className="session-header__eyebrow">扩展</div>
          <h1>选择工作区</h1>
          <p>扩展来自所选工作区及用户级扩展目录。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="canvas overflow-auto px-7 pt-5 pb-0 max-[980px]:px-[18px]">
      <div className="conversation skills-view mx-auto w-[min(1120px,100%)] pb-6">
        <header className="view-header flex items-start justify-between gap-4 mb-5 max-[980px]:flex-col max-[980px]:items-stretch">
          <div>
            <h1 className="view-header__title m-0 text-xl font-semibold tracking-[-0.03em] text-foreground-strong">扩展</h1>
            <p className="view-header__body mt-1.5 mb-0 max-w-[640px] text-sm leading-[1.5] text-muted-strong">
              查看并管理这个工作区的一等运行时扩展。
            </p>
          </div>
          <div className="view-header__actions flex items-center gap-2">
            <button className="button button--secondary" type="button" onClick={onRefresh}>
              <RefreshIcon />
              <span>刷新</span>
            </button>
          </div>
        </header>

        <div className="skills-toolbar mb-4">
          <input
            aria-label="搜索扩展"
            className="skills-search w-[min(360px,100%)] rounded-lg border border-[var(--border-default)] bg-surface px-3 py-2 text-sm text-foreground-strong placeholder:text-muted-soft focus-visible:border-[var(--focus-ring-border)]"
            placeholder="搜索扩展"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </div>

        <div className="skills-layout grid grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] items-start gap-4 max-[980px]:grid-cols-1">
          <div className="skills-grid grid grid-cols-2 items-start gap-3 max-[980px]:grid-cols-1" data-testid="extensions-list">
            {filteredExtensions.length === 0 ? (
              <ExtensionsEmptyState message="刷新运行时发现，以加载工作区与用户级扩展。" />
            ) : (
              filteredExtensions.map((extension) => {
                const isActive = selectedExtension?.path === extension.path;
                return (
                  <button
                    className={[
                      "skill-card grid cursor-pointer content-start gap-2.5 rounded-xl border p-4 text-left",
                      isActive
                        ? "skill-card--active border-line-strong bg-overlay-hover"
                        : "border-[var(--border-default)] bg-surface hover:border-line-strong hover:bg-overlay-hover",
                    ].join(" ")}
                    key={extension.path}
                    type="button"
                    onClick={() => {
                      setSelectedExtensionPath(extension.path);
                    }}
                  >
                    <span className="skill-card__title-row flex items-center justify-between gap-2">
                      <span className="skill-card__title text-[15px] font-[620] text-foreground-strong">{extension.displayName}</span>
                      <span
                        className={`skill-card__badge rounded-full px-2 py-[5px] text-[11px] font-semibold ${extension.enabled ? "skill-card__badge--enabled bg-[var(--success-tint-bg)] text-success-ink" : "bg-surface-muted text-muted-soft"}`}
                      >
                        {extension.enabled ? "已启用" : "已禁用"}
                      </span>
                    </span>
                    <span className="skill-card__description line-clamp-3 text-xs leading-normal text-muted-strong">
                      {extensionSourceSummary(extension)}
                    </span>
                    <span className="skill-card__meta flex flex-wrap gap-2 text-xs text-muted-soft">
                      <span>{extension.sourceInfo.source}</span>
                      {extension.commands.length > 0 ? <span>{extension.commands.length} 个命令</span> : null}
                      {extension.tools.length > 0 ? <span>{extension.tools.length} 个工具</span> : null}
                      {extension.diagnostics.length > 0 ? <span>{extension.diagnostics.length} 个问题</span> : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="skill-detail sticky top-0 grid gap-3.5 rounded-xl border border-[var(--border-default)] bg-surface p-4">
            {selectedExtension ? (
              <>
                <div className="skill-detail__header flex items-start justify-between gap-3 max-[700px]:flex-col max-[700px]:items-stretch max-[700px]:gap-2">
                  <div>
                    <h2 className="m-0 text-[22px] font-[630] text-foreground-strong">{selectedExtension.displayName}</h2>
                    <div className="skill-detail__slash mt-1.5 text-[13px] text-muted-soft">{selectedExtension.sourceInfo.source}</div>
                  </div>
                  <span
                    className={`skill-detail__status rounded-full px-2 py-[5px] text-[11px] font-semibold ${selectedExtension.enabled ? "skill-detail__status--enabled bg-[var(--success-tint-bg)] text-success-ink" : "bg-surface-muted text-muted-soft"}`}
                  >
                    {selectedExtension.enabled ? "已启用" : "已禁用"}
                  </span>
                </div>
                <div className="skill-detail__meta-list grid gap-2.5">
                  <DetailItem label="作用域" value={extensionScopeLabel(selectedExtension)} />
                  <DetailItem label="来源" value={selectedExtension.sourceInfo.origin} />
                  <DetailItem label="路径" value={selectedExtension.path} mono />
                  {selectedExtension.sourceInfo.baseDir ? (
                    <DetailItem label="基础目录" value={selectedExtension.sourceInfo.baseDir} mono />
                  ) : null}
                </div>
                {selectedExtensionCanBeManaged ? (
                  <div className="skill-detail__actions flex flex-wrap gap-2">
                    <button className="button button--secondary" type="button" onClick={() => onOpenExtensionFolder(selectedExtension.path)}>
                      打开文件夹
                    </button>
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => onToggleExtension(selectedExtension.path, !selectedExtension.enabled)}
                    >
                      {selectedExtension.enabled ? "禁用" : "启用"}
                    </button>
                  </div>
                ) : null}

                <ExtensionContributionSection title="命令" items={selectedExtension.commands} emptyLabel="未提供命令。" />
                <ExtensionCompatibilitySection
                  commands={selectedExtension.commands}
                  compatibilityRecords={selectedCompatibilityRecords}
                />
                <ExtensionContributionSection title="工具" items={selectedExtension.tools} emptyLabel="未提供工具。" />
                <ExtensionContributionSection title="标志" items={selectedExtension.flags} emptyLabel="未提供标志。" />
                <ExtensionContributionSection title="快捷键" items={selectedExtension.shortcuts} emptyLabel="未提供快捷键。" />
                <ExtensionDiagnostics diagnostics={selectedExtension.diagnostics} />
              </>
            ) : (
              <ExtensionsEmptyState message="刷新运行时发现，以查看扩展元数据与诊断信息。" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function isManageableExtension(extension: RuntimeExtensionRecord): boolean {
  return extension.sourceInfo.scope === "project" || extension.sourceInfo.scope === "user";
}

function DetailItem({
  label,
  value,
  mono,
}: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}) {
  return (
    <div className="grid gap-1">
      <div className="skill-detail__meta-label text-xs font-[560] tracking-[0.05em] text-muted-soft uppercase">{label}</div>
      <div className={mono ? "skill-detail__path break-words text-sm leading-[1.6] text-muted-strong" : "skill-detail__description break-words text-sm leading-[1.6] text-muted-strong"}>{value}</div>
    </div>
  );
}

function ExtensionContributionSection({
  title,
  items,
  emptyLabel,
}: {
  readonly title: string;
  readonly items: readonly string[];
  readonly emptyLabel: string;
}) {
  return (
    <div className="skill-detail__meta-list grid gap-2.5">
      <div className="grid gap-1">
        <div className="skill-detail__meta-label text-xs font-[560] tracking-[0.05em] text-muted-soft uppercase">{title}</div>
        {items.length > 0 ? (
          <div className="extension-detail__tokens flex flex-wrap gap-2">
            {items.map((item) => (
              <span className="slash-menu__skill-badge ml-auto text-[10px] font-semibold tracking-[0.08em] text-muted uppercase" key={item}>
                {item}
              </span>
            ))}
          </div>
        ) : (
          <div className="skill-detail__description break-words text-sm leading-[1.6] text-muted-strong">{emptyLabel}</div>
        )}
      </div>
    </div>
  );
}

function ExtensionDiagnostics({
  diagnostics,
}: {
  readonly diagnostics: RuntimeExtensionRecord["diagnostics"];
}) {
  return (
    <div className="skill-detail__meta-list grid gap-2.5">
      <div className="grid gap-1">
        <div className="skill-detail__meta-label text-xs font-[560] tracking-[0.05em] text-muted-soft uppercase">诊断</div>
        {diagnostics.length > 0 ? (
          <div className="extension-detail__diagnostics grid gap-2">
            {diagnostics.map((diagnostic, index) => (
              <div className={`activity-item activity-item--${diagnostic.type === "error" ? "error" : "info"}`} key={`${diagnostic.message}:${index}`}>
                <div className="activity-item__text">{diagnostic.message}</div>
                {diagnostic.path ? <div className="activity-item__meta">{diagnostic.path}</div> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="skill-detail__description break-words text-sm leading-[1.6] text-muted-strong">无诊断信息。</div>
        )}
      </div>
    </div>
  );
}

function ExtensionCompatibilitySection({
  commands,
  compatibilityRecords,
}: {
  readonly commands: readonly string[];
  readonly compatibilityRecords: readonly ExtensionCommandCompatibilityRecord[];
}) {
  const supported = compatibilityRecords.filter((record) => record.status === "supported");
  const terminalOnly = compatibilityRecords.filter((record) => record.status === "terminal-only");
  const unknown = commands.filter((commandName) =>
    compatibilityRecords.every(
      (record) => record.commandName !== commandName && !record.commandName.startsWith(`${commandName}:`),
    ),
  );

  return (
    <div className="skill-detail__meta-list grid gap-2.5">
      <div className="grid gap-1">
        <div className="skill-detail__meta-label text-xs font-[560] tracking-[0.05em] text-muted-soft uppercase">命令兼容性</div>
        <div className="skill-detail__description break-words text-sm leading-[1.6] text-muted-strong">
          来自真实 GUI 运行学习。未列出的命令在被执行前保持未知。
        </div>
        <div className="extension-detail__tokens flex flex-wrap gap-2">
          {supported.map((record) => (
            <span className="slash-menu__skill-badge ml-auto text-[10px] font-semibold tracking-[0.08em] text-muted uppercase" key={`supported:${record.commandName}`}>
              {record.commandName} · GUI 兼容
            </span>
          ))}
          {terminalOnly.map((record) => (
            <span className="slash-menu__skill-badge slash-menu__skill-badge--warning ml-auto text-[10px] font-semibold tracking-[0.08em] text-warning-ink uppercase" key={`terminal:${record.commandName}`}>
              {record.commandName} · 仅限终端
            </span>
          ))}
          {unknown.map((commandName) => (
            <span className="slash-menu__skill-badge ml-auto text-[10px] font-semibold tracking-[0.08em] text-muted uppercase" key={`unknown:${commandName}`}>
              {commandName} · 未知
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExtensionsEmptyState({ message }: { readonly message: string }) {
  return (
    <div className="empty-state">
      <h2>未找到扩展</h2>
      <p>{message}</p>
    </div>
  );
}
