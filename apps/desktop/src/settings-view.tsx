import type { RuntimeSettingsSnapshot, RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import type { ModelSettingsScopeMode, NotificationPreferences, ThemePresetId, WorkspaceRecord } from "./desktop-state";
import type { CustomProviderConfig, DesktopNotificationPermissionStatus } from "./ipc";
import { SettingsAppearanceSection } from "./settings-appearance-section";
import { SettingsGeneralSection } from "./settings-general-section";
import { SettingsModelsSection } from "./settings-models-section";
import { SettingsNotificationsSection } from "./settings-notifications-section";
import { SettingsProvidersSection } from "./settings-providers-section";
import { type SettingsSection, sectionTitle, sectionDescription } from "./settings-utils";

export type { SettingsSection } from "./settings-utils";

interface SettingsViewProps {
  readonly workspace?: WorkspaceRecord;
  readonly runtime?: RuntimeSnapshot;
  readonly section: SettingsSection;
  readonly notificationPreferences: NotificationPreferences;
  readonly notificationPermissionStatus: DesktopNotificationPermissionStatus;
  readonly notificationPermissionPending: boolean;
  readonly modelSettingsScopeMode: ModelSettingsScopeMode;
  readonly integratedTerminalShell: string;
  readonly themeMode: "system" | "light" | "dark";
  readonly themePresetId: ThemePresetId;
  readonly enableTransparency: boolean;
  readonly onSetModelSettingsScopeMode: (mode: ModelSettingsScopeMode) => void;
  readonly onSetDefaultModel: (provider: string, modelId: string) => void;
  readonly onSetThinkingLevel: (thinkingLevel: RuntimeSettingsSnapshot["defaultThinkingLevel"]) => void;
  readonly onToggleSkillCommands: (enabled: boolean) => void;
  readonly onSetScopedModelPatterns: (patterns: readonly string[]) => void;
  readonly onLoginProvider: (providerId: string) => void;
  readonly onLogoutProvider: (providerId: string) => void;
  readonly onSetProviderApiKey: (providerId: string, apiKey: string) => Promise<string | undefined>;
  readonly onRemoveProviderApiKey: (providerId: string) => Promise<string | undefined>;
  readonly onSaveCustomProvider: (config: CustomProviderConfig) => Promise<string | undefined>;
  readonly onDeleteCustomProvider: (providerId: string) => Promise<string | undefined>;
  readonly onSetNotificationPreferences: (preferences: Partial<NotificationPreferences>) => void;
  readonly onSetIntegratedTerminalShell: (shellPath: string) => void;
  readonly onRequestNotificationPermission: () => void;
  readonly onOpenSystemNotificationSettings: () => void;
  readonly onSetThemeMode: (mode: "system" | "light" | "dark") => void;
  readonly onSetThemePresetId: (presetId: ThemePresetId) => void;
  readonly onSetEnableTransparency: (enabled: boolean) => void;
}

export function SettingsView({
  workspace,
  runtime,
  section,
  notificationPreferences,
  notificationPermissionStatus,
  notificationPermissionPending,
  modelSettingsScopeMode,
  integratedTerminalShell,
  themeMode,
  themePresetId,
  enableTransparency,
  onSetModelSettingsScopeMode,
  onSetDefaultModel,
  onSetThinkingLevel,
  onToggleSkillCommands,
  onSetScopedModelPatterns,
  onLoginProvider,
  onLogoutProvider,
  onSetProviderApiKey,
  onRemoveProviderApiKey,
  onSaveCustomProvider,
  onDeleteCustomProvider,
  onSetNotificationPreferences,
  onSetIntegratedTerminalShell,
  onRequestNotificationPermission,
  onOpenSystemNotificationSettings,
  onSetThemeMode,
  onSetThemePresetId,
  onSetEnableTransparency,
}: SettingsViewProps) {
  if (
    !workspace &&
    section !== "general" &&
    section !== "notifications" &&
    section !== "appearance"
  ) {
    return (
      <section className="canvas canvas--empty grid content-center overflow-auto px-7 pt-5 pb-0 max-[980px]:px-[18px]">
        <div className="empty-panel">
          <div className="session-header__eyebrow">设置</div>
          <h1>选择工作区</h1>
          <p>供应商与技能设置需要选择工作区。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="canvas overflow-auto px-7 pt-5 pb-0 max-[980px]:px-[18px]">
      <div className="settings-view mx-auto w-full max-w-[1120px] pb-6">
        <header className="view-header mb-5 flex items-start justify-between gap-4 max-[980px]:flex-col max-[980px]:items-stretch">
          <div>
            <h1 className="view-header__title m-0 text-[20px] font-semibold tracking-[-0.03em] text-foreground-strong">
              {sectionTitle(section)}
            </h1>
            <p className="view-header__body mt-1.5 mb-0 max-w-[640px] text-[14px] leading-[1.5] text-muted-strong">
              {sectionDescription(section, workspace?.name ?? "此工作区")}
            </p>
          </div>
        </header>

        <div className="settings-grid grid gap-6">
          {section === "appearance" ? (
            <SettingsAppearanceSection
              themeMode={themeMode}
              themePresetId={themePresetId}
              onSetThemeMode={onSetThemeMode}
              onSetThemePresetId={onSetThemePresetId}
              enableTransparency={enableTransparency}
              onSetEnableTransparency={onSetEnableTransparency}
            />
          ) : null}

          {section === "general" ? (
            <SettingsGeneralSection
              runtime={runtime}
              modelSettingsScopeMode={modelSettingsScopeMode}
              integratedTerminalShell={integratedTerminalShell}
              onSetModelSettingsScopeMode={onSetModelSettingsScopeMode}
              onSetIntegratedTerminalShell={onSetIntegratedTerminalShell}
              onToggleSkillCommands={onToggleSkillCommands}
            />
          ) : null}

          {section === "providers" ? (
            <SettingsProvidersSection
              runtime={runtime}
              onLoginProvider={onLoginProvider}
              onLogoutProvider={onLogoutProvider}
              onSetProviderApiKey={onSetProviderApiKey}
              onRemoveProviderApiKey={onRemoveProviderApiKey}
              onSaveCustomProvider={onSaveCustomProvider}
              onDeleteCustomProvider={onDeleteCustomProvider}
            />
          ) : null}

          {section === "models" ? (
            <SettingsModelsSection
              runtime={runtime}
              onSetDefaultModel={onSetDefaultModel}
              onSetScopedModelPatterns={onSetScopedModelPatterns}
              onSetThinkingLevel={onSetThinkingLevel}
            />
          ) : null}

          {section === "notifications" ? (
            <SettingsNotificationsSection
              notificationPreferences={notificationPreferences}
              notificationPermissionStatus={notificationPermissionStatus}
              notificationPermissionPending={notificationPermissionPending}
              onSetNotificationPreferences={onSetNotificationPreferences}
              onRequestNotificationPermission={onRequestNotificationPermission}
              onOpenSystemNotificationSettings={onOpenSystemNotificationSettings}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
