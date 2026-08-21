import type { ReactNode } from "react";
import type { RuntimeSettingsSnapshot, RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import { Button } from "@/components/ui/button";

export type SettingsSection = "appearance" | "general" | "providers" | "models" | "notifications";

export const THINKING_LEVELS: NonNullable<RuntimeSettingsSnapshot["defaultThinkingLevel"]>[] = [
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

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

/* ── Layout components ──────────────────────────────────
 * The settings surface is a list of bordered groups whose rows are
 * separated by hairlines. `separator` marks rows that sit directly inside
 * a group (rows rendered in loose lists, e.g. model checklists, opt out).
 */

const settingsGroupClass = "settings-group rounded-[18px] border border-border bg-surface";
const settingsRowClass = "settings-row flex items-center justify-between gap-6 px-[18px] py-3.5";
export const settingsRowSeparatorClass = "border-t border-border first:border-t-0";
const settingsRowLabel = "settings-row__label min-w-0 flex-1";
const settingsRowTitle = "settings-row__title text-[14px] font-[590] text-foreground-strong";
const settingsRowDescription = "settings-row__description text-[13px] leading-[1.4] text-muted-soft break-anywhere";
const settingsRowControl = "settings-row__control shrink-0";
const settingsRowValue = "settings-row__value text-[13px] text-muted-soft break-anywhere";
export const settingsHintClass = "settings-hint text-[13px] text-muted-soft italic";
export const settingsWarningClass = "settings-warning text-[13px] text-warning";

/**
 * Faithful translation of base.css `.button` (the look settings surfaces used
 * before the shadcn migration) expressed as utilities for shadcn `Button`.
 */
export const settingsButtonClass =
  "h-9 rounded-[10px] border border-transparent bg-surface px-[13px] text-[14px] font-semibold text-foreground-strong shadow-none transition-all duration-[0.15s] ease-out hover:border-[var(--surface-overlay-border,transparent)] hover:bg-accent hover:text-foreground-strong";

/** Faithful translation of base.css `.settings-select` / `.settings-search` / `.settings-text-input`. */
export const settingsFieldControlClass =
  "w-full max-w-[420px] min-h-10 rounded-[12px] border border-border bg-surface px-3 py-2.5 text-[14px] text-foreground-strong";

/**
 * Faithful translation of base.css `.settings-pill` (off) / `.settings-pill--active` (on)
 * for shadcn `ToggleGroupItem` and static pill spans.
 */
export const settingsPillItemClass =
  "settings-pill h-auto min-w-0 rounded-full border border-[var(--theme-control-border,var(--line))] bg-[var(--theme-control-bg,var(--surface-muted))] px-3 py-2 text-[13px] font-[560] text-muted-strong shadow-none data-[state=on]:border-[var(--theme-selection-border,var(--accent-tint-border))] data-[state=on]:bg-[var(--theme-selection-bg,var(--accent-tint-bg))] data-[state=on]:text-[var(--theme-selection-ink,var(--text-strong))]";
export const settingsPillActiveClass =
  "settings-pill settings-pill--active rounded-full border border-[var(--theme-selection-border,var(--accent-tint-border))] bg-[var(--theme-selection-bg,var(--accent-tint-bg))] px-3 py-2 text-[13px] font-[560] text-[var(--theme-selection-ink,var(--text-strong))]";

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
    <div className="settings-section grid gap-2">
      {title ? <h3 className={`settings-section__title text-[16px] font-semibold`}>{title}</h3> : null}
      {description ? <p className={`settings-section__description text-[13px] text-muted-soft`}>{description}</p> : null}
      <div className={settingsGroupClass}>{children}</div>
    </div>
  );
}

export function SettingsRow({
  title,
  description,
  children,
  separator = true,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children?: ReactNode;
  readonly separator?: boolean;
}) {
  return (
    <div className={`${settingsRowClass} ${separator ? settingsRowSeparatorClass : ""}`}>
      <div className={settingsRowLabel}>
        <div className={settingsRowTitle}>{title}</div>
        {description ? <div className={settingsRowDescription}>{description}</div> : null}
      </div>
      {children ? <div className={settingsRowControl}>{children}</div> : null}
    </div>
  );
}

export function SettingsInfoRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className={`${settingsRowClass} ${settingsRowSeparatorClass}`}>
      <div className={settingsRowLabel}>
        <div className={settingsRowTitle}>{label}</div>
      </div>
      <div className={settingsRowControl}>
        <span className={settingsRowValue}>{value}</span>
      </div>
    </div>
  );
}

export function ProviderRow({
  provider,
  onLoginProvider,
  onLogoutProvider,
  onConfigureApiKey,
  separator = true,
}: {
  readonly provider: RuntimeSnapshot["providers"][number];
  readonly onLoginProvider: (providerId: string) => void;
  readonly onLogoutProvider: (providerId: string) => void;
  readonly onConfigureApiKey: (provider: RuntimeSnapshot["providers"][number]) => void;
  readonly separator?: boolean;
}) {
  const action = resolveProviderAction(provider, onLoginProvider, onLogoutProvider, onConfigureApiKey);
  return (
    <div className={`${settingsRowClass} ${separator ? settingsRowSeparatorClass : ""}`}>
      <div className={settingsRowLabel}>
        <div className={settingsRowTitle}>{provider.name}</div>
        <div className={settingsRowDescription}>{describeProviderStatus(provider)}</div>
      </div>
      {action ? (
        <div className={settingsRowControl}>
          <Button
            variant="secondary"
            className={settingsButtonClass}
            disabled={action.disabled}
            type="button"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
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
