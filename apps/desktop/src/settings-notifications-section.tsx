import type { DesktopNotificationPermissionStatus } from "./ipc";
import type { NotificationPreferences } from "./desktop-state";
import { settingsButtonClass, SettingsGroup, SettingsRow } from "./settings-utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface SettingsNotificationsSectionProps {
  readonly notificationPreferences: NotificationPreferences;
  readonly notificationPermissionStatus: DesktopNotificationPermissionStatus;
  readonly notificationPermissionPending: boolean;
  readonly onSetNotificationPreferences: (preferences: Partial<NotificationPreferences>) => void;
  readonly onRequestNotificationPermission: () => void;
  readonly onOpenSystemNotificationSettings: () => void;
}

export function SettingsNotificationsSection({
  notificationPreferences,
  notificationPermissionStatus,
  notificationPermissionPending,
  onSetNotificationPreferences,
  onRequestNotificationPermission,
  onOpenSystemNotificationSettings,
}: SettingsNotificationsSectionProps) {
  const statusLabel = labelForPermissionStatus(notificationPermissionStatus);
  const statusDescription = descriptionForPermissionStatus(notificationPermissionStatus);
  const showAskMacOs = notificationPermissionStatus === "default";
  const showOpenSystemSettings = notificationPermissionStatus === "denied";
  const showRecoveryActions = showAskMacOs || showOpenSystemSettings;

  return (
    <>
      <SettingsGroup title="系统" description="macOS 决定 pi-gui 能否显示桌面通知。">
        <SettingsRow title="macOS 通知权限" description={statusDescription}>
          <span className="settings-row__value text-[13px] text-muted-soft break-anywhere">{statusLabel}</span>
        </SettingsRow>
        {showRecoveryActions ? (
          <SettingsRow
            title="开启通知"
            description={
              showAskMacOs
                ? "当任务首次进入后台时，pi-gui 会请求 macOS 授权。也可以立即请求。"
                : "pi-gui 的 macOS 通知已关闭。请打开系统设置重新开启。"
            }
          >
            <div className="settings-row__actions flex flex-wrap justify-end gap-2 max-[700px]:justify-start">
              {showAskMacOs ? (
                <Button
                  variant="secondary"
                  className={settingsButtonClass}
                  disabled={notificationPermissionPending}
                  type="button"
                  onClick={onRequestNotificationPermission}
                >
                  请求 macOS
                </Button>
              ) : null}
              {showOpenSystemSettings ? (
                <Button
                  variant="secondary"
                  className={settingsButtonClass}
                  disabled={notificationPermissionPending}
                  type="button"
                  onClick={onOpenSystemNotificationSettings}
                >
                  打开系统设置
                </Button>
              ) : null}
            </div>
          </SettingsRow>
        ) : null}
      </SettingsGroup>

      <SettingsGroup title="应用内提醒" description="开启 macOS 权限后，选择哪些后台事件触发提醒。">
        <SettingsRow title="后台完成" description="后台会话完成时通知。">
          <Checkbox
            aria-label="后台完成"
            checked={notificationPreferences.backgroundCompletion}
            onCheckedChange={(checked) => onSetNotificationPreferences({ backgroundCompletion: checked === true })}
          />
        </SettingsRow>
        <SettingsRow title="后台失败" description="后台会话失败时通知。">
          <Checkbox
            aria-label="后台失败"
            checked={notificationPreferences.backgroundFailure}
            onCheckedChange={(checked) => onSetNotificationPreferences({ backgroundFailure: checked === true })}
          />
        </SettingsRow>
        <SettingsRow title="需要输入或批准" description="需要输入才能继续时通知。">
          <Checkbox
            aria-label="需要输入或批准"
            checked={notificationPreferences.attentionNeeded}
            onCheckedChange={(checked) => onSetNotificationPreferences({ attentionNeeded: checked === true })}
          />
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}

function labelForPermissionStatus(status: DesktopNotificationPermissionStatus): string {
  switch (status) {
    case "granted":
      return "已开启";
    case "denied":
      return "已关闭";
    case "default":
      return "尚未开启";
    case "unsupported":
      return "不可用";
    default:
      return "检查中……";
  }
}

function descriptionForPermissionStatus(status: DesktopNotificationPermissionStatus): string {
  switch (status) {
    case "granted":
      return "macOS 已允许 pi-gui 为后台对话更新显示桌面通知。";
    case "denied":
      return "pi-gui 的 macOS 通知已关闭。请在系统设置中开启，以接收后台完成提醒。";
    case "default":
      return "pi-gui 尚未向 macOS 请求桌面通知权限。";
    case "unsupported":
      return "本系统不支持桌面通知。";
    default:
      return "正在检查 pi-gui 是否可用 macOS 通知。";
  }
}
