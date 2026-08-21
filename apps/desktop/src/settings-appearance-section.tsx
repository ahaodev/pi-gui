import type { ThemeMode, ThemePresetId } from "./desktop-state";
import { SettingsGroup, SettingsRow } from "./settings-utils";
import { themePresets } from "./theme-presets";

interface SettingsAppearanceSectionProps {
  readonly themeMode: ThemeMode;
  readonly themePresetId: ThemePresetId;
  readonly onSetThemeMode: (mode: ThemeMode) => void;
  readonly onSetThemePresetId: (presetId: ThemePresetId) => void;
  readonly enableTransparency: boolean;
  readonly onSetEnableTransparency: (enabled: boolean) => void;
}

const THEME_OPTIONS: { mode: ThemeMode; label: string; description: string }[] = [
  { mode: "system", label: "系统", description: "跟随操作系统外观设置" },
  { mode: "light", label: "浅色", description: "始终使用浅色主题" },
  { mode: "dark", label: "深色", description: "始终使用深色主题" },
];

export function SettingsAppearanceSection({
  themeMode,
  themePresetId,
  onSetThemeMode,
  onSetThemePresetId,
  enableTransparency,
  onSetEnableTransparency,
}: SettingsAppearanceSectionProps) {
  return (
    <>
      <SettingsGroup title="主题预设">
        <div className="theme-preset-grid">
          {themePresets.map((preset) => (
            <label
              className={`theme-preset-card${themePresetId === preset.id ? " theme-preset-card--active" : ""}`}
              key={preset.id}
            >
              <input
                checked={themePresetId === preset.id}
                name="theme-preset"
                type="radio"
                onChange={() => onSetThemePresetId(preset.id)}
              />
              <span className="theme-preset-card__preview" aria-hidden="true">
                {preset.swatches.map((swatch) => (
                  <span
                    className="theme-preset-card__swatch"
                    key={swatch}
                    style={{ background: swatch }}
                  />
                ))}
              </span>
              <span className="theme-preset-card__body">
                <span className="theme-preset-card__title">{preset.name}</span>
                <span className="theme-preset-card__description">{preset.description}</span>
              </span>
            </label>
          ))}
        </div>
      </SettingsGroup>

      <SettingsGroup title="主题">
        {THEME_OPTIONS.map((option) => (
          <SettingsRow key={option.mode} title={option.label} description={option.description}>
            <input
              checked={themeMode === option.mode}
              name="theme"
              type="radio"
              onChange={() => onSetThemeMode(option.mode)}
            />
          </SettingsRow>
        ))}
      </SettingsGroup>

      <SettingsGroup title="视觉效果">
        <SettingsRow
          title="窗口透明"
          description="让桌面颜色在支持的界面上透出。"
        >
          <input
            aria-label="窗口透明"
            type="checkbox"
            checked={enableTransparency}
            onChange={(event) => onSetEnableTransparency(event.currentTarget.checked)}
          />
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}
