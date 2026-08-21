import { useMemo, useState } from "react";
import type { RuntimeSkillRecord, RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import type { WorkspaceRecord } from "./desktop-state";
import { RefreshIcon } from "./icons";
import { titleCase } from "./string-utils";

interface SkillsViewProps {
  readonly workspace?: WorkspaceRecord;
  readonly runtime?: RuntimeSnapshot;
  readonly onRefresh: () => void;
  readonly onOpenSkillFolder: (filePath: string) => void;
  readonly onToggleSkill: (filePath: string, enabled: boolean) => void;
  readonly onTrySkill: (skill: RuntimeSkillRecord) => void;
}

export function SkillsView({
  workspace,
  runtime,
  onRefresh,
  onOpenSkillFolder,
  onToggleSkill,
  onTrySkill,
}: SkillsViewProps) {
  const [query, setQuery] = useState("");
  const [selectedSkillPath, setSelectedSkillPath] = useState<string | undefined>();
  const skills = runtime?.skills ?? [];
  const filteredSkills = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return skills;
    }

    return skills.filter((skill) =>
      [skill.name, skill.description, skill.source, skill.slashCommand].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    );
  }, [query, skills]);
  const selectedSkill =
    filteredSkills.find((skill) => skill.filePath === selectedSkillPath) ?? filteredSkills[0];

  if (!workspace) {
    return (
      <section className="canvas canvas--empty">
        <div className="empty-panel">
          <div className="session-header__eyebrow">技能</div>
          <h1>选择工作区</h1>
          <p>技能来自所选工作区及用户级技能目录。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="canvas">
      <div className="conversation skills-view mx-auto w-[min(1120px,100%)] pb-6">
        <header className="view-header">
          <div>
            <h1 className="view-header__title">技能</h1>
            <p className="view-header__body">
              为 pi 提供工作区专属能力与可复用工作流。
            </p>
          </div>
          <div className="view-header__actions">
            <button className="button button--secondary" type="button" onClick={onRefresh}>
              <RefreshIcon />
              <span>刷新</span>
            </button>
            <button
              className="button button--primary"
              type="button"
              onClick={() =>
                onTrySkill({
                  name: "new-skill",
                  description: "为这个工作区创建新技能",
                  filePath: "",
                  baseDir: workspace.path,
                  source: "project",
                  enabled: true,
                  disableModelInvocation: false,
                  slashCommand: "/skill:new-skill",
                })
              }
            >
              新建技能
            </button>
          </div>
        </header>

        <div className="skills-toolbar mb-4">
          <input
            aria-label="搜索技能"
            className="skills-search w-[min(360px,100%)] rounded-lg border border-[var(--border-default)] bg-surface px-3 py-2 text-sm text-foreground-strong placeholder:text-muted-soft focus-visible:border-[var(--focus-ring-border)]"
            placeholder="搜索技能"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </div>

        <div className="skills-layout grid grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] items-start gap-4">
          <div className="skills-grid grid grid-cols-2 items-start gap-3" data-testid="skills-list">
            {filteredSkills.length === 0 ? (
              <SkillsEmptyState message="刷新发现结果，或为这个工作区创建新技能。" />
            ) : (
              filteredSkills.map((skill) => {
                const isActive = selectedSkill?.filePath === skill.filePath;
                return (
                  <button
                    className={[
                      "skill-card grid cursor-pointer content-start gap-2.5 rounded-xl border p-4 text-left",
                      isActive
                        ? "skill-card--active border-line-strong bg-overlay-hover"
                        : "border-[var(--border-default)] bg-surface hover:border-line-strong hover:bg-overlay-hover",
                    ].join(" ")}
                    key={skill.filePath}
                    type="button"
                    onClick={() => {
                      setSelectedSkillPath(skill.filePath);
                    }}
                  >
                    <span className="skill-card__title-row flex items-center justify-between gap-2">
                      <span className="skill-card__title text-[15px] font-[620] text-foreground-strong">{titleCase(skill.name)}</span>
                      <span
                        className={`skill-card__badge rounded-full px-2 py-[5px] text-[11px] font-semibold ${skill.enabled ? "skill-card__badge--enabled bg-[var(--success-tint-bg)] text-success-ink" : "bg-surface-muted text-muted-soft"}`}
                      >
                        {skill.enabled ? "已启用" : "已禁用"}
                      </span>
                    </span>
                    <span className="skill-card__description line-clamp-3 text-xs leading-normal text-muted-strong">{skill.description}</span>
                    <span className="skill-card__meta flex flex-wrap gap-2 text-xs text-muted-soft">
                      <span>{skill.source}</span>
                      <span>{skill.slashCommand}</span>
                      {skill.disableModelInvocation ? <span>仅限斜杠</span> : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="skill-detail sticky top-0 grid gap-3.5 rounded-xl border border-[var(--border-default)] bg-surface p-4">
            {selectedSkill ? (
              <>
                <div className="skill-detail__header flex items-start justify-between gap-3">
                  <div>
                    <h2 className="m-0 text-[22px] font-[630] text-foreground-strong">{titleCase(selectedSkill.name)}</h2>
                    <div className="skill-detail__slash mt-1.5 text-[13px] text-muted-soft">{selectedSkill.slashCommand}</div>
                  </div>
                  <span
                    className={`skill-detail__status rounded-full px-2 py-[5px] text-[11px] font-semibold ${selectedSkill.enabled ? "skill-detail__status--enabled bg-[var(--success-tint-bg)] text-success-ink" : "bg-surface-muted text-muted-soft"}`}
                  >
                    {selectedSkill.enabled ? "已启用" : "已禁用"}
                  </span>
                </div>
                <p className="skill-detail__description break-words text-sm leading-[1.6] text-muted-strong">{selectedSkill.description}</p>
                <div className="skill-detail__meta-list grid gap-2.5">
                  <div className="grid gap-1">
                    <div className="skill-detail__meta-label text-xs font-[560] tracking-[0.05em] text-muted-soft uppercase">来源</div>
                    <div className="skill-detail__description break-words text-sm leading-[1.6] text-muted-strong">{selectedSkill.source}</div>
                  </div>
                  <div className="grid gap-1">
                    <div className="skill-detail__meta-label text-xs font-[560] tracking-[0.05em] text-muted-soft uppercase">路径</div>
                    <div className="skill-detail__path break-words text-sm leading-[1.6] text-muted-strong">{selectedSkill.filePath}</div>
                  </div>
                </div>
                <div className="skill-detail__actions flex flex-wrap gap-2">
                  <button className="button button--secondary" type="button" onClick={() => onOpenSkillFolder(selectedSkill.filePath)}>
                    打开文件夹
                  </button>
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => onToggleSkill(selectedSkill.filePath, !selectedSkill.enabled)}
                  >
                    {selectedSkill.enabled ? "禁用" : "启用"}
                  </button>
                  <button className="button button--primary" type="button" onClick={() => onTrySkill(selectedSkill)}>
                    试用
                  </button>
                </div>
              </>
            ) : (
              <SkillsEmptyState message="刷新运行时发现，以加载工作区与用户级技能。" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SkillsEmptyState({ message }: { readonly message: string }) {
  return (
    <div className="empty-state">
      <h2>未找到技能</h2>
      <p>{message}</p>
    </div>
  );
}
