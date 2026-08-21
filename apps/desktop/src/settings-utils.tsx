import type { ReactNode } from "react";
import type { RuntimeSettingsSnapshot, RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";

export type SettingsSection = "appearance" | "general" | "providers" | "models" | "notifications";

export const THINKING_LEVELS: NonNullable<RuntimeSettingsSnapshot["defaultThinkingLevel"]>[] = [
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

export function settingsPill(active: boolean): string {
  return `settings-pill${active ? " settings-pill--active" : ""}`;
}

export function labelForThinking(level: NonNullable<RuntimeSettingsSnapshot["defaultThinkingLevel"]>): string {
  switch (level) {
    case "low":
      return "低";
    case "medium":
      return "中";
    case "high":
      return "高";
    case "xhigh":
      return "超高";
    case "max":
      return "最大";
    default:
      return level;
  }
}

export function sectionTitle(section: SettingsSection): string {
  switch (section) {
    case "appearance":
      return "外观";
    case "providers":
      return "供应商";
    case "models":
      return "模型";
    case "notifications":
      return "通知";
    default:
      return "通用";
  }
}

export function sectionDescription(section: SettingsSection, workspaceName: string): string {
  switch (section) {
    case "appearance":
      return "选择预设配色以及浅色、深色或跟随系统的模式。";
    case "providers":
      return `为 ${workspaceName} 连接供应商并管理认证。`;
    case "models":
      return "选择默认模型，以及在各选取器中显示哪些模型。";
    case "notifications":
      return "管理 macOS 通知权限，以及哪些后台事件需要你提醒。";
    default:
      return "把常用的应用与运行时控制放在手边。";
  }
}

export function filterProviders(
  providers: readonly RuntimeSnapshot["providers"][number][],
  query: string,
): readonly RuntimeSnapshot["providers"][number][] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return providers;
  }
  return providers.filter((provider) =>
    [provider.id, provider.name, provider.authType].some((value) => value.toLowerCase().includes(normalized)),
  );
}

export function filterModels(
  models: readonly RuntimeSnapshot["models"][number][],
  query: string,
): readonly RuntimeSnapshot["models"][number][] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return models;
  }
  return models.filter((model) =>
    [model.providerId, model.providerName, model.modelId, model.label].some((value) =>
      value.toLowerCase().includes(normalized),
    ),
  );
}

/* ── Layout components ────────────────────────────────── */

export function SettingsGroup({
  title,
  description,
  children,
}: {
  readonly title?: string;
  readonly description?: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="settings-section">
      {title ? <h3 className="settings-section__title">{title}</h3> : null}
      {description ? <p className="settings-section__description">{description}</p> : null}
      <div className="settings-group">{children}</div>
    </div>
  );
}

export function SettingsRow({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children?: ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row__label">
        <div className="settings-row__title">{title}</div>
        {description ? <div className="settings-row__description">{description}</div> : null}
      </div>
      {children ? <div className="settings-row__control">{children}</div> : null}
    </div>
  );
}

export function SettingsInfoRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="settings-row">
      <div className="settings-row__label">
        <div className="settings-row__title">{label}</div>
      </div>
      <div className="settings-row__control">
        <span className="settings-row__value">{value}</span>
      </div>
    </div>
  );
}

export function ProviderRow({
  provider,
  onLoginProvider,
  onLogoutProvider,
  onConfigureApiKey,
}: {
  readonly provider: RuntimeSnapshot["providers"][number];
  readonly onLoginProvider: (providerId: string) => void;
  readonly onLogoutProvider: (providerId: string) => void;
  readonly onConfigureApiKey: (provider: RuntimeSnapshot["providers"][number]) => void;
}) {
  const action = resolveProviderAction(provider, onLoginProvider, onLogoutProvider, onConfigureApiKey);
  return (
    <div className="settings-row">
      <div className="settings-row__label">
        <div className="settings-row__title">{provider.name}</div>
        <div className="settings-row__description">{describeProviderStatus(provider)}</div>
      </div>
      {action ? (
        <div className="settings-row__control">
          <button
            className="button button--secondary"
            disabled={action.disabled}
            type="button"
            onClick={action.onClick}
          >
            {action.label}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function describeProviderStatus(provider: RuntimeSnapshot["providers"][number]): string {
  switch (provider.authSource) {
    case "oauth":
      return "OAuth · 已连接";
    case "auth_file":
      return "API 密钥 · 已连接";
    case "env":
      return "环境变量 · 已连接";
    case "external":
      return provider.hasAuth ? "外部配置 · 已连接" : "需外部配置";
    default:
      if (provider.oauthSupported) {
        return "OAuth";
      }
      if (provider.apiKeySetupSupported) {
        return "API 密钥";
      }
      return provider.authType === "api_key" ? "API 密钥" : "内置";
  }
}

function resolveProviderAction(
  provider: RuntimeSnapshot["providers"][number],
  onLoginProvider: (providerId: string) => void,
  onLogoutProvider: (providerId: string) => void,
  onConfigureApiKey: (provider: RuntimeSnapshot["providers"][number]) => void,
):
  | {
      readonly disabled: boolean;
      readonly label: string;
      readonly onClick?: () => void;
    }
  | undefined {
  if (provider.authSource === "oauth") {
    return {
      disabled: false,
      label: "登出",
      onClick: () => onLogoutProvider(provider.id),
    };
  }

  if (provider.oauthSupported && provider.authSource === "none") {
    return {
      disabled: false,
      label: "登录",
      onClick: () => onLoginProvider(provider.id),
    };
  }

  if (provider.apiKeySetupSupported && (provider.authSource === "none" || provider.authSource === "auth_file")) {
    return {
      disabled: false,
      label: provider.authSource === "auth_file" ? "管理" : "设置 API 密钥",
      onClick: () => onConfigureApiKey(provider),
    };
  }

  if (provider.authSource === "env" || provider.authSource === "external") {
    return undefined;
  }

  return {
    disabled: true,
    label: "需外部配置",
  };
}
