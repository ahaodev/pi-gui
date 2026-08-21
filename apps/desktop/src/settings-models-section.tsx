import { useState } from "react";
import type { RuntimeSettingsSnapshot, RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import {
  filterModels,
  labelForThinking,
  settingsPill,
  SettingsGroup,
  SettingsRow,
  THINKING_LEVELS,
} from "./settings-utils";

interface SettingsModelsSectionProps {
  readonly runtime?: RuntimeSnapshot;
  readonly onSetDefaultModel: (provider: string, modelId: string) => void;
  readonly onSetThinkingLevel: (thinkingLevel: RuntimeSettingsSnapshot["defaultThinkingLevel"]) => void;
  readonly onSetScopedModelPatterns: (patterns: readonly string[]) => void;
}

export function SettingsModelsSection({
  runtime,
  onSetDefaultModel,
  onSetThinkingLevel,
  onSetScopedModelPatterns,
}: SettingsModelsSectionProps) {
  const [modelQuery, setModelQuery] = useState("");
  const [scopedQuery, setScopedQuery] = useState("");

  const models = runtime?.models ?? [];
  const availableModels = models.filter((m) => m.available);

  const enabledPatterns = runtime?.settings.enabledModelPatterns ?? [];
  const allImplicitlyEnabled = enabledPatterns.length === 0;

  const activeScopedPatterns = allImplicitlyEnabled
    ? availableModels.map((model) => `${model.providerId}/${model.modelId}`)
    : enabledPatterns;
  const activeScopedSet = new Set(activeScopedPatterns);

  const enabledAvailableModels = availableModels.filter((model) => {
    if (allImplicitlyEnabled) return true;
    return activeScopedSet.has(`${model.providerId}/${model.modelId}`);
  });
  const enabledAvailablePatterns = enabledAvailableModels.map((model) => `${model.providerId}/${model.modelId}`);

  const defaultProvider = runtime?.settings.defaultProvider;
  const defaultModelId = runtime?.settings.defaultModelId;
  const defaultIsEnabled =
    defaultProvider && defaultModelId
      ? enabledAvailableModels.some((m) => m.providerId === defaultProvider && m.modelId === defaultModelId)
      : false;

  const filteredModels = filterModels(models, modelQuery);
  const filteredScopedModels = filterModels(availableModels, scopedQuery);

  const togglePattern = (pattern: string, checked: boolean) => {
    const newPatterns = checked
      ? [...activeScopedPatterns, pattern]
      : activeScopedPatterns.filter((entry) => entry !== pattern);
    if (newPatterns.length === 0) return;
    onSetScopedModelPatterns(newPatterns);
  };

  return (
    <>
      <SettingsGroup>
        <SettingsRow title="默认模型" description="选择新会话的默认模型。">
          <select
            className="settings-select"
            value={
              defaultProvider && defaultModelId && defaultIsEnabled
                ? `${defaultProvider}:${defaultModelId}`
                : ""
            }
            onChange={(event) => {
              const [provider, ...modelParts] = event.target.value.split(":");
              const modelId = modelParts.join(":");
              if (provider && modelId) {
                onSetDefaultModel(provider, modelId);
              }
            }}
          >
            <option value="">选择模型</option>
            {enabledAvailableModels.map((model) => (
              <option key={`${model.providerId}:${model.modelId}`} value={`${model.providerId}:${model.modelId}`}>
                {model.providerName} · {model.label}
              </option>
            ))}
          </select>
        </SettingsRow>
        <SettingsRow title="推理" description="设置新会话的默认推理等级。">
          <div className="settings-pill-row">
            {THINKING_LEVELS.map((level) => (
              <button
                className={settingsPill(runtime?.settings.defaultThinkingLevel === level)}
                key={level}
                type="button"
                onClick={() => onSetThinkingLevel(level)}
              >
                {labelForThinking(level)}
              </button>
            ))}
          </div>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="已启用模型" description="选择在应用各处选取器中显示哪些模型。">
        <div className="settings-row">
          {enabledAvailablePatterns.length > 0 ? (
            <div className="settings-pill-row">
              {enabledAvailablePatterns.map((pattern) => (
                <span className={settingsPill(true)} key={pattern}>
                  {pattern}
                </span>
              ))}
            </div>
          ) : (
            <span className="settings-hint">
              {availableModels.length === 0
                ? "暂无已连接的可用模型。"
                : "当前没有已启用的可用模型。"}
            </span>
          )}
        </div>
        {allImplicitlyEnabled && availableModels.length > 0 ? (
          <div className="settings-row">
            <span className="settings-hint">默认启用所有可用模型。</span>
          </div>
        ) : null}
        {!defaultIsEnabled && defaultProvider && defaultModelId ? (
          <div className="settings-row">
            <span className="settings-warning">
              你的默认模型（{defaultProvider}:{defaultModelId}）未启用。请在上方选择新的默认模型。
            </span>
          </div>
        ) : null}
        <details className="settings-disclosure">
          <summary className="settings-disclosure__summary">
            <span>编辑已启用模型</span>
            <span>{filteredScopedModels.length}</span>
          </summary>
          <div className="settings-disclosure__body">
            <input
              aria-label="搜索已启用模型"
              className="settings-search"
              placeholder="搜索已启用模型"
              value={scopedQuery}
              onChange={(event) => setScopedQuery(event.target.value)}
            />
            <div className="settings-list">
              {filteredScopedModels.map((model) => {
                const pattern = `${model.providerId}/${model.modelId}`;
                const enabled = activeScopedSet.has(pattern);
                const isLast = enabled && activeScopedPatterns.length <= 1;
                return (
                  <label className="settings-toggle settings-toggle--row" key={pattern}>
                    <input
                      checked={enabled}
                      disabled={isLast}
                      title={isLast ? "至少需要启用一个模型" : undefined}
                      type="checkbox"
                      onChange={(event) => togglePattern(pattern, event.target.checked)}
                    />
                    <span>
                      <strong>{model.providerName}</strong> · {model.label}
                      <span className="settings-list__meta"> · {pattern}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </details>
      </SettingsGroup>

      <SettingsGroup title="全部模型" description="浏览完整模型目录。在上方启用模型后即可使用。">
        <details className="settings-disclosure">
          <summary className="settings-disclosure__summary">
            <span>浏览完整模型列表</span>
            <span>{filteredModels.length}</span>
          </summary>
          <div className="settings-disclosure__body">
            <input
              aria-label="搜索模型"
              className="settings-search"
              placeholder="搜索模型"
              value={modelQuery}
              onChange={(event) => setModelQuery(event.target.value)}
            />
            <div className="settings-list">
              {filteredModels.map((model) => {
                const pattern = `${model.providerId}/${model.modelId}`;
                const enabled = activeScopedSet.has(pattern);
                const isLast = enabled && activeScopedPatterns.length <= 1;
                return (
                  <div
                    className="settings-option"
                    key={`${model.providerId}:${model.modelId}`}
                  >
                    <span className="settings-option__title">{model.providerName} · {model.label}</span>
                    <span className="settings-option__meta">
                      {model.providerId}:{model.modelId}
                      {model.reasoning ? " · 支持推理" : ""}
                      {model.supportsImages ? " · 支持图像" : ""}
                      {!model.available ? " · 未登录" : ""}
                    </span>
                    {model.available ? (
                      <label className="settings-toggle settings-toggle--inline">
                        <input
                          checked={enabled}
                          disabled={isLast}
                          title={isLast ? "至少需要启用一个模型" : undefined}
                          type="checkbox"
                          onChange={(event) => togglePattern(pattern, event.target.checked)}
                        />
                        <span className="sr-only">启用</span>
                      </label>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </details>
      </SettingsGroup>
    </>
  );
}
