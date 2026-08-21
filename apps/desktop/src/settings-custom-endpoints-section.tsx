import { useCallback, useEffect, useMemo, useState } from "react";
import { CUSTOM_PROVIDER_ID_PATTERN, isValidHttpBaseUrl } from "@pi-gui/pi-sdk-driver/custom-provider-types";
import type { CustomProviderConfig, CustomProviderModelConfig } from "./ipc";
import {
  settingsButtonClass,
  settingsFieldControlClass,
  settingsWarningClass,
  SettingsGroup,
} from "./settings-utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface SettingsCustomEndpointsSectionProps {
  readonly existingProviderIds: readonly string[];
  readonly onSaveCustomProvider: (config: CustomProviderConfig) => Promise<string | undefined>;
  readonly onDeleteCustomProvider: (providerId: string) => Promise<string | undefined>;
}

type DialogMode = { kind: "closed" } | { kind: "create" } | { kind: "edit"; original: CustomProviderConfig };

const settingsRowClass = "settings-row flex items-center justify-between gap-6 px-[18px] py-3.5";
const settingsRowSeparatorClass = "border-t border-border first:border-t-0";
const settingsRowLabelClass = "settings-row__label min-w-0 flex-1";
const settingsRowTitleClass = "settings-row__title text-[14px] font-[590] text-foreground-strong";
const settingsRowDescriptionClass = "settings-row__description text-[13px] leading-[1.4] text-muted-soft break-anywhere";
const settingsRowControlClass = "settings-row__control shrink-0";
const settingsFieldClass = "settings-field grid gap-1.5 text-[13px] font-[560] text-muted-soft";
const settingsFieldHeaderClass = "settings-field__header flex items-center justify-between gap-3 max-[700px]:flex-col max-[700px]:items-stretch max-[700px]:gap-2";
const settingsDisclosureBodyClass = "settings-disclosure__body mt-3 grid gap-3";
const settingsListClass = "settings-list grid gap-2.5";

export function SettingsCustomEndpointsSection({
  existingProviderIds,
  onSaveCustomProvider,
  onDeleteCustomProvider,
}: SettingsCustomEndpointsSectionProps) {
  const [entries, setEntries] = useState<readonly CustomProviderConfig[]>([]);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [dialog, setDialog] = useState<DialogMode>({ kind: "closed" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const api = window.piApp;
    if (!api) {
      return;
    }
    let cancelled = false;
    void api
      .listCustomProviders()
      .then((list) => {
        if (!cancelled) {
          setEntries(list);
          setLoadError(undefined);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const handleSave = useCallback(
    async (config: CustomProviderConfig): Promise<string | undefined> => {
      const error = await onSaveCustomProvider(config);
      if (!error) {
        reload();
      }
      return error;
    },
    [onSaveCustomProvider, reload],
  );

  const handleDelete = useCallback(
    async (providerId: string) => {
      const error = await onDeleteCustomProvider(providerId);
      if (error) {
        setLoadError(error);
        return;
      }
      reload();
    },
    [onDeleteCustomProvider, reload],
  );

  return (
    <>
      <SettingsGroup
        title="自定义端点"
        description="添加 OpenAI 兼容端点（Ollama、vLLM 或自建服务器）。配置保存在 ~/.pi/agent/models.json。"
      >
        {loadError ? (
          <div className={`${settingsRowClass} ${settingsRowSeparatorClass}`}>
            <span className={`${settingsRowDescriptionClass} ${settingsWarningClass}`}>{loadError}</span>
          </div>
        ) : null}
        {entries.length === 0 ? (
          <div className={`${settingsRowClass} ${settingsRowSeparatorClass}`}>
            <span className={settingsRowDescriptionClass}>还没有自定义端点。</span>
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.providerId} className={`${settingsRowClass} ${settingsRowSeparatorClass}`}>
              <div className={settingsRowLabelClass}>
                <div className={settingsRowTitleClass}>{entry.providerId}</div>
                <div className={settingsRowDescriptionClass}>
                  {entry.baseUrl} · {entry.models.length} 个模型
                </div>
              </div>
              <div className={settingsRowControlClass}>
                <Button variant="secondary" className={settingsButtonClass} type="button" onClick={() => setDialog({ kind: "edit", original: entry })}>
                  编辑
                </Button>
                <Button variant="secondary" className={settingsButtonClass} type="button" onClick={() => void handleDelete(entry.providerId)}>
                  移除
                </Button>
              </div>
            </div>
          ))
        )}
        <div className={`${settingsRowClass} ${settingsRowSeparatorClass}`}>
          <div className={settingsRowLabelClass}>
            <div className={settingsRowTitleClass}>添加端点</div>
            <div className={settingsRowDescriptionClass}>
              注册本地或自定义的 OpenAI 兼容服务器。
            </div>
          </div>
          <div className={settingsRowControlClass}>
            <Button variant="default" className={settingsButtonClass} type="button" onClick={() => setDialog({ kind: "create" })}>
              添加端点
            </Button>
          </div>
        </div>
      </SettingsGroup>

      <Dialog
        open={dialog.kind !== "closed"}
        onOpenChange={(open) => {
          if (!open) {
            setDialog({ kind: "closed" });
          }
        }}
      >
        {dialog.kind !== "closed" ? (
          <CustomEndpointDialog
            mode={dialog}
            existingProviderIds={existingProviderIds}
            onClose={() => setDialog({ kind: "closed" })}
            onSave={handleSave}
          />
        ) : null}
      </Dialog>
    </>
  );
}

interface CustomEndpointDialogProps {
  readonly mode: Exclude<DialogMode, { kind: "closed" }>;
  readonly existingProviderIds: readonly string[];
  readonly onClose: () => void;
  readonly onSave: (config: CustomProviderConfig) => Promise<string | undefined>;
}

function CustomEndpointDialog({ mode, existingProviderIds, onClose, onSave }: CustomEndpointDialogProps) {
  const initial = mode.kind === "edit" ? mode.original : undefined;
  const [providerId, setProviderId] = useState(initial?.providerId ?? "");
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? "");
  const [models, setModels] = useState<CustomProviderModelConfig[]>(
    initial ? [...initial.models] : [],
  );
  const [probeCandidates, setProbeCandidates] = useState<readonly string[]>([]);
  const [probeError, setProbeError] = useState<string | undefined>();
  const [probePending, setProbePending] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();
  const [savePending, setSavePending] = useState(false);

  const selectedModelIds = useMemo(() => new Set(models.map((model) => model.id)), [models]);
  const isEdit = mode.kind === "edit";

  const idValidationError = useMemo(() => validateProviderId(providerId, existingProviderIds, initial?.providerId), [
    providerId,
    existingProviderIds,
    initial?.providerId,
  ]);

  const handleProbe = async () => {
    const api = window.piApp;
    if (!api) {
      setProbeError("桌面桥接不可用。");
      return;
    }
    if (!isValidHttpBaseUrl(baseUrl)) {
      setProbeError("基础 URL 必须以 http:// 或 https:// 开头");
      return;
    }
    setProbePending(true);
    setProbeError(undefined);
    const result = await api.probeCustomProviderModels({
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim() ? apiKey.trim() : undefined,
    });
    setProbePending(false);
    if (!result.ok) {
      setProbeError(result.error);
      setProbeCandidates([]);
      return;
    }
    setProbeCandidates(result.models);
  };

  const toggleModel = (id: string, contextWindow?: number) => {
    setModels((current) => {
      const existing = current.find((model) => model.id === id);
      if (existing) {
        return current.filter((model) => model.id !== id);
      }
      return [...current, contextWindow !== undefined ? { id, contextWindow } : { id }];
    });
  };

  const handleManualAdd = (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) {
      return;
    }
    if (selectedModelIds.has(trimmed)) {
      return;
    }
    setModels((current) => [...current, { id: trimmed }]);
  };

  const handleSave = async () => {
    if (idValidationError) {
      setFormError(idValidationError);
      return;
    }
    if (!isValidHttpBaseUrl(baseUrl)) {
      setFormError("基础 URL 必须以 http:// 或 https:// 开头");
      return;
    }
    if (models.length === 0) {
      setFormError("请至少选择一个模型。");
      return;
    }
    setSavePending(true);
    setFormError(undefined);
    const error = await onSave({
      providerId: providerId.trim(),
      baseUrl: baseUrl.trim(),
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      models,
    });
    if (error) {
      setSavePending(false);
      setFormError(error);
      return;
    }
    onClose();
  };

  return (
    <DialogContent
      className="max-w-[560px]! gap-3.5! rounded-[22px]! border-border! bg-surface! p-[22px]! text-foreground-strong! shadow-xl!"
      data-testid="custom-endpoint-dialog"
      onEscapeKeyDown={(event) => {
        if (savePending) {
          event.preventDefault();
        }
      }}
      onPointerDownOutside={(event) => {
        if (savePending) {
          event.preventDefault();
        }
      }}
    >
      <DialogHeader className="gap-2.5! text-left!">
        <DialogTitle className="text-[20px]! font-[630]! tracking-tight">
          {isEdit ? "编辑自定义端点" : "添加自定义端点"}
        </DialogTitle>
        <DialogDescription className="text-[14px]! leading-[1.65]! text-muted-strong!">
          配置一个 OpenAI 兼容服务器。端点与 API 密钥将以明文保存在
          <code> ~/.pi/agent/models.json</code>。
        </DialogDescription>
      </DialogHeader>
      <div className={settingsFieldClass}>
        <span>供应商 ID</span>
        <Input
          aria-label="供应商 ID"
          autoFocus={!isEdit}
          className={settingsFieldControlClass}
          disabled={isEdit || savePending}
          placeholder="ollama-local"
          value={providerId}
          onChange={(event) => setProviderId(event.target.value.trim().toLowerCase())}
        />
        {idValidationError ? (
          <span className={`${settingsRowDescriptionClass} ${settingsWarningClass}`}>{idValidationError}</span>
        ) : (
          <span className={settingsRowDescriptionClass}>
            仅限小写字母、数字和连字符，之后无法更改。
          </span>
        )}
      </div>
      <div className={settingsFieldClass}>
        <span>基础 URL</span>
        <Input
          aria-label="基础 URL"
          className={settingsFieldControlClass}
          disabled={savePending}
          placeholder="http://localhost:11434/v1"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
        />
        <span className={settingsRowDescriptionClass}>
          需包含 <code>/v1</code> 后缀。Ollama：<code>http://localhost:11434/v1</code>。vLLM:{" "}
          <code>http://localhost:8000/v1</code>。
        </span>
      </div>
      <div className={settingsFieldClass}>
        <span>API 密钥</span>
        <Input
          aria-label="API 密钥"
          className={settingsFieldControlClass}
          disabled={savePending}
          placeholder="vLLM：请输入 --api-key 的密钥；Ollama：留空"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
        <span className={settingsRowDescriptionClass}>
          存储格式要求此项。对于以 <code>--api-key</code> 启动的 vLLM，请输入该密钥；Ollama
          或其他无认证服务器请留空，将保存占位值。
        </span>
      </div>

      <div className={settingsFieldClass}>
        <div className={settingsFieldHeaderClass}>
          <span>模型</span>
          <Button
            variant="secondary"
            className={settingsButtonClass}
            disabled={probePending || savePending}
            type="button"
            onClick={() => void handleProbe()}
          >
            {probePending ? "正在检测……" : "检测模型"}
          </Button>
        </div>
        {probeError ? (
          <p className={`m-0 ${settingsRowDescriptionClass} ${settingsWarningClass}`}>{probeError}</p>
        ) : null}
        <ModelChecklist
          probed={probeCandidates}
          selected={models}
          onToggle={toggleModel}
          onManualAdd={handleManualAdd}
          disabled={savePending}
        />
        <p className={`m-0 ${settingsRowDescriptionClass}`}>
          需要支持工具调用。较小的模型（&lt; 7B）通常无法稳定输出 OpenAI 风格的函数调用。
        </p>
      </div>

      {formError ? <p className={`m-0 ${settingsWarningClass}`}>{formError}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" className={settingsButtonClass} disabled={savePending} type="button" onClick={onClose}>
          取消
        </Button>
        <Button
          variant="default"
          className={settingsButtonClass}
          disabled={savePending || Boolean(idValidationError) || models.length === 0 || !baseUrl.trim()}
          type="button"
          onClick={() => void handleSave()}
        >
          {isEdit ? "保存修改" : "添加端点"}
        </Button>
      </div>
    </DialogContent>
  );
}

interface ModelChecklistProps {
  readonly probed: readonly string[];
  readonly selected: readonly CustomProviderModelConfig[];
  readonly onToggle: (id: string, contextWindow?: number) => void;
  readonly onManualAdd: (id: string) => void;
  readonly disabled: boolean;
}

function ModelChecklist({ probed, selected, onToggle, onManualAdd, disabled }: ModelChecklistProps) {
  const [manualDraft, setManualDraft] = useState("");
  const selectedIds = useMemo(() => new Set(selected.map((model) => model.id)), [selected]);
  const knownIds = useMemo(() => new Set([...probed, ...selected.map((model) => model.id)]), [probed, selected]);

  const submitManual = () => {
    onManualAdd(manualDraft);
    setManualDraft("");
  };

  return (
    <div className={settingsDisclosureBodyClass}>
      {knownIds.size === 0 ? (
        <p className={`m-0 ${settingsRowDescriptionClass}`}>
          点击“检测模型”或在下方输入模型 ID 手动添加。
        </p>
      ) : (
        <ul className={settingsListClass}>
          {[...knownIds].sort((a, b) => a.localeCompare(b)).map((id) => (
            <li key={id} className={settingsRowClass}>
              <label className={`${settingsRowLabelClass} flex cursor-pointer items-center gap-2.5`}>
                <Checkbox
                  aria-label={`启用 ${id}`}
                  checked={selectedIds.has(id)}
                  disabled={disabled}
                  onCheckedChange={() => onToggle(id)}
                />
                <span className={settingsRowTitleClass}>{id}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className={`${settingsRowClass} items-center`}>
        <Input
          aria-label="手动添加模型 ID"
          className={`settings-search min-w-0 flex-1 ${settingsFieldControlClass}`}
          disabled={disabled}
          placeholder="手动添加模型 ID"
          value={manualDraft}
          onChange={(event) => setManualDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitManual();
            }
          }}
        />
        <Button
          variant="secondary"
          className={settingsButtonClass}
          disabled={disabled || manualDraft.trim().length === 0}
          type="button"
          onClick={submitManual}
        >
          添加
        </Button>
      </div>
    </div>
  );
}

function validateProviderId(
  candidate: string,
  existing: readonly string[],
  editing?: string,
): string | undefined {
  const trimmed = candidate.trim();
  if (!trimmed) {
    return "供应商 ID 为必填项。";
  }
  if (!CUSTOM_PROVIDER_ID_PATTERN.test(trimmed)) {
    return "请使用小写字母、数字和连字符（最多 64 个字符）。";
  }
  if (trimmed !== editing && existing.includes(trimmed)) {
    return `供应商 ID “${trimmed}” 已被占用。`;
  }
  return undefined;
}
