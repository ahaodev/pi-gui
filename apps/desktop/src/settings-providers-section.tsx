import { useEffect, useMemo, useState } from "react";
import type { RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import type { CustomProviderConfig } from "./ipc";
import { SettingsCustomEndpointsSection } from "./settings-custom-endpoints-section";
import {
  filterProviders,
  ProviderRow,
  settingsButtonClass,
  settingsFieldControlClass,
  settingsWarningClass,
  SettingsGroup,
} from "./settings-utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface SettingsProvidersSectionProps {
  readonly runtime?: RuntimeSnapshot;
  readonly onLoginProvider: (providerId: string) => void;
  readonly onLogoutProvider: (providerId: string) => void;
  readonly onSetProviderApiKey: (providerId: string, apiKey: string) => Promise<string | undefined>;
  readonly onRemoveProviderApiKey: (providerId: string) => Promise<string | undefined>;
  readonly onSaveCustomProvider: (config: CustomProviderConfig) => Promise<string | undefined>;
  readonly onDeleteCustomProvider: (providerId: string) => Promise<string | undefined>;
}

const settingsDisclosureClass = "settings-disclosure px-[18px] py-3.5";
const settingsDisclosureSummaryClass =
  "settings-disclosure__summary flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-semibold text-foreground-strong [&::-webkit-details-marker]:hidden";
const settingsDisclosureBodyClass = "settings-disclosure__body mt-3 grid gap-3";
const settingsListClass = "settings-list grid gap-2.5";

export function SettingsProvidersSection({
  runtime,
  onLoginProvider,
  onLogoutProvider,
  onSetProviderApiKey,
  onRemoveProviderApiKey,
  onSaveCustomProvider,
  onDeleteCustomProvider,
}: SettingsProvidersSectionProps) {
  const [providerQuery, setProviderQuery] = useState("");
  const [apiKeyProviderId, setApiKeyProviderId] = useState<string | undefined>();
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [apiKeyError, setApiKeyError] = useState<string | undefined>();
  const [apiKeyPending, setApiKeyPending] = useState(false);

  const providers = runtime?.providers ?? [];
  const connectedProviders = providers.filter((p) => p.hasAuth);
  const oauthProviders = providers.filter((p) => p.oauthSupported);
  const filteredProviders = filterProviders(providers, providerQuery);
  const apiKeyProvider = apiKeyProviderId ? providers.find((provider) => provider.id === apiKeyProviderId) : undefined;
  const existingProviderIds = useMemo(() => providers.map((provider) => provider.id), [providers]);

  useEffect(() => {
    setApiKeyDraft("");
    setApiKeyError(undefined);
    setApiKeyPending(false);
  }, [apiKeyProviderId]);

  const closeApiKeyDialog = () => {
    if (apiKeyPending) {
      return;
    }
    setApiKeyProviderId(undefined);
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyProvider) {
      return;
    }
    setApiKeyPending(true);
    setApiKeyError(undefined);
    const nextError = await onSetProviderApiKey(apiKeyProvider.id, apiKeyDraft.trim());
    if (nextError) {
      setApiKeyPending(false);
      setApiKeyError(nextError);
      return;
    }
    setApiKeyProviderId(undefined);
  };

  const handleRemoveApiKey = async () => {
    if (!apiKeyProvider) {
      return;
    }
    setApiKeyPending(true);
    setApiKeyError(undefined);
    const nextError = await onRemoveProviderApiKey(apiKeyProvider.id);
    if (nextError) {
      setApiKeyPending(false);
      setApiKeyError(nextError);
      return;
    }
    setApiKeyProviderId(undefined);
  };

  return (
    <>
      <SettingsGroup title="已连接" description="选择模型时优先使用已连接的供应商。">
        {connectedProviders.length > 0 ? (
          connectedProviders.map((provider) => (
            <ProviderRow
              key={provider.id}
              provider={provider}
              onLoginProvider={onLoginProvider}
              onLogoutProvider={onLogoutProvider}
              onConfigureApiKey={(entry) => setApiKeyProviderId(entry.id)}
            />
          ))
        ) : (
          <div className="settings-row flex items-center justify-between gap-6 px-[18px] py-3.5 border-t border-border first:border-t-0">
            <span className="settings-row__description text-[13px] leading-[1.4] text-muted-soft break-anywhere">
              尚未连接任何供应商。
            </span>
          </div>
        )}
      </SettingsGroup>

      <SettingsGroup title="登录" description="支持 OAuth 的供应商可直接在桌面应用中登录。">
        {oauthProviders.map((provider) => (
          <ProviderRow
            key={provider.id}
            provider={provider}
            onLoginProvider={onLoginProvider}
            onLogoutProvider={onLogoutProvider}
            onConfigureApiKey={(entry) => setApiKeyProviderId(entry.id)}
          />
        ))}
      </SettingsGroup>

      <SettingsCustomEndpointsSection
        existingProviderIds={existingProviderIds}
        onSaveCustomProvider={onSaveCustomProvider}
        onDeleteCustomProvider={onDeleteCustomProvider}
      />

      <SettingsGroup title="全部供应商" description="浏览完整供应商列表。">
        <details className={settingsDisclosureClass}>
          <summary className={settingsDisclosureSummaryClass}>
            <span>浏览全部供应商</span>
            <span>{filteredProviders.length}</span>
          </summary>
          <div className={settingsDisclosureBodyClass}>
            <Input
              aria-label="搜索供应商"
              className={`settings-search ${settingsFieldControlClass}`}
              placeholder="搜索供应商"
              value={providerQuery}
              onChange={(event) => setProviderQuery(event.target.value)}
            />
            <div className={settingsListClass}>
              {filteredProviders.map((provider) => (
                <ProviderRow
                  key={provider.id}
                  provider={provider}
                  separator={false}
                  onLoginProvider={onLoginProvider}
                  onLogoutProvider={onLogoutProvider}
                  onConfigureApiKey={(entry) => setApiKeyProviderId(entry.id)}
                />
              ))}
            </div>
          </div>
        </details>
      </SettingsGroup>

      <Dialog
        open={Boolean(apiKeyProvider)}
        onOpenChange={(open) => {
          if (!open) {
            closeApiKeyDialog();
          }
        }}
      >
        {apiKeyProvider ? (
          <DialogContent
            className="max-w-[560px]! gap-3.5! rounded-[22px]! border-border! bg-surface! p-[22px]! text-foreground-strong! shadow-xl!"
            data-testid="provider-api-key-dialog"
            onEscapeKeyDown={(event) => {
              if (apiKeyPending) {
                event.preventDefault();
              }
            }}
            onPointerDownOutside={(event) => {
              if (apiKeyPending) {
                event.preventDefault();
              }
            }}
          >
            <DialogHeader className="gap-2.5! text-left!">
              <DialogTitle className="text-[20px]! font-[630]! tracking-tight">
                {apiKeyProvider.authSource === "auth_file" ? "管理 API 密钥" : "设置 API 密钥"}
              </DialogTitle>
              <DialogDescription className="text-[14px]! leading-[1.65]! text-muted-strong!">
                {apiKeyProvider.authSource === "auth_file"
                  ? `替换或删除 ${apiKeyProvider.name} 已保存的 API 密钥。`
                  : `为 ${apiKeyProvider.name} 在本地保存一个 API 密钥。`}
              </DialogDescription>
            </DialogHeader>
            <Input
              aria-label={`${apiKeyProvider.name} 的 API 密钥`}
              autoFocus
              className={settingsFieldControlClass}
              disabled={apiKeyPending}
              placeholder="输入 API 密钥"
              type="password"
              value={apiKeyDraft}
              onChange={(event) => setApiKeyDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeApiKeyDialog();
                  return;
                }
                if (event.key === "Enter" && apiKeyDraft.trim()) {
                  event.preventDefault();
                  void handleSaveApiKey();
                }
              }}
            />
            {apiKeyError ? <p className={`m-0 ${settingsWarningClass}`}>{apiKeyError}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                className={settingsButtonClass}
                disabled={apiKeyPending}
                type="button"
                onClick={closeApiKeyDialog}
              >
                取消
              </Button>
              {apiKeyProvider.authSource === "auth_file" ? (
                <Button
                  variant="secondary"
                  className={settingsButtonClass}
                  disabled={apiKeyPending}
                  type="button"
                  onClick={() => void handleRemoveApiKey()}
                >
                  移除已保存的密钥
                </Button>
              ) : null}
              <Button
                variant="default"
                className={settingsButtonClass}
                disabled={apiKeyPending || apiKeyDraft.trim().length === 0}
                type="button"
                onClick={() => void handleSaveApiKey()}
              >
                {apiKeyProvider.authSource === "auth_file" ? "保存密钥" : "设置 API 密钥"}
              </Button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
