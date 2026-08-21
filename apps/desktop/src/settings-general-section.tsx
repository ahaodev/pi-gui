import { useEffect, useState } from "react";
import type { RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import type { ModelSettingsScopeMode } from "./desktop-state";
import {
  settingsFieldControlClass,
  settingsPillItemClass,
  SettingsGroup,
  SettingsInfoRow,
  SettingsRow,
} from "./settings-utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";

interface SettingsGeneralSectionProps {
  readonly runtime?: RuntimeSnapshot;
  readonly modelSettingsScopeMode: ModelSettingsScopeMode;
  readonly integratedTerminalShell: string;
  readonly onSetModelSettingsScopeMode: (mode: ModelSettingsScopeMode) => void;
  readonly onSetIntegratedTerminalShell: (shellPath: string) => void;
  readonly onToggleSkillCommands: (enabled: boolean) => void;
}

export function SettingsGeneralSection({
  runtime,
  modelSettingsScopeMode,
  integratedTerminalShell,
  onSetModelSettingsScopeMode,
  onSetIntegratedTerminalShell,
  onToggleSkillCommands,
}: SettingsGeneralSectionProps) {
  const connectedCount = runtime?.providers.filter((p) => p.hasAuth).length ?? 0;
  const [terminalShellDraft, setTerminalShellDraft] = useState(integratedTerminalShell);

  useEffect(() => {
    setTerminalShellDraft(integratedTerminalShell);
  }, [integratedTerminalShell]);

  const commitTerminalShellDraft = () => {
    if (terminalShellDraft !== integratedTerminalShell) {
      onSetIntegratedTerminalShell(terminalShellDraft);
    }
  };

  return (
    <>
      <SettingsGroup title="通用">
        <SettingsInfoRow
          label="已连接的供应商"
          value={connectedCount > 0 ? String(connectedCount) : "无"}
        />
        <SettingsInfoRow label="已发现的技能" value={String(runtime?.skills.length ?? 0)} />
        <SettingsRow title="模型设置范围" description="选择模型默认值应用于全局还是按仓库。">
          <div className="settings-pill-row flex flex-wrap gap-2">
            <Toggle
              className={settingsPillItemClass}
              pressed={modelSettingsScopeMode === "app-global"}
              onPressedChange={() => onSetModelSettingsScopeMode("app-global")}
            >
              应用全局
            </Toggle>
            <Toggle
              className={settingsPillItemClass}
              pressed={modelSettingsScopeMode === "per-repo"}
              onPressedChange={() => onSetModelSettingsScopeMode("per-repo")}
            >
              按仓库
            </Toggle>
          </div>
        </SettingsRow>
        <SettingsRow title="启用技能斜杠命令" description="在输入框中保持技能斜杠命令可用。">
          <Checkbox
            aria-label="启用技能斜杠命令"
            checked={runtime?.settings.enableSkillCommands ?? true}
            onCheckedChange={(checked) => onToggleSkillCommands(checked === true)}
          />
        </SettingsRow>
        <SettingsRow title="集成终端的 Shell" description="留空则使用默认登录 Shell。">
          <Input
            aria-label="集成终端的 Shell"
            className={`settings-text-input ${settingsFieldControlClass}`}
            placeholder="/bin/zsh"
            spellCheck={false}
            type="text"
            value={terminalShellDraft}
            onBlur={commitTerminalShellDraft}
            onChange={(event) => setTerminalShellDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="快捷键">
        <SettingsInfoRow label="新建对话" value="Cmd+Shift+O" />
        <SettingsInfoRow label="打开设置" value="Cmd+," />
        <SettingsInfoRow label="切换终端" value="Cmd+J" />
        <SettingsInfoRow label="新建终端标签" value="Cmd+T" />
        <SettingsInfoRow label="发送消息" value="Enter" />
        <SettingsInfoRow label="换行" value="Shift+Enter" />
      </SettingsGroup>
    </>
  );
}
