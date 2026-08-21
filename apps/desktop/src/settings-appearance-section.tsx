import type { ThemeMode, ThemePresetId } from "./desktop-state";
import { SettingsGroup, SettingsRow } from "./settings-utils";
import { themePresets } from "./theme-presets";
import { Switch } from "@/components/ui/switch";

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

const themePresetCardClass =
  "theme-preset-card relative grid min-h-[86px] cursor-pointer grid-cols-[72px_minmax(0,1fr)] items-center gap-3 rounded-md border border-[var(--theme-control-border,var(--line))] bg-[var(--theme-control-bg,var(--surface-muted))] p-3 text-foreground hover:border-[var(--theme-selection-border,var(--accent))] hover:bg-[var(--theme-selection-bg,var(--surface-overlay-hover))] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--theme-selection-border,var(--accent))]";

const themePresetCardActiveClass =
  "theme-preset-card--active border-[var(--theme-selection-border,var(--accent))] bg-[var(--theme-selection-bg,var(--surface-overlay-hover))]";

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
        <div className="theme-preset-grid grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-2.5 px-[18px] py-3.5">
          {themePresets.map((preset) => (
            <label
              className={`${themePresetCardClass} ${themePresetId === preset.id ? themePresetCardActiveClass : ""}`}
              key={preset.id}
            >
              <input
                className="pointer-events-none absolute opacity-0"
                checked={themePresetId === preset.id}
                name="theme-preset"
                type="radio"
                onChange={() => onSetThemePresetId(preset.id)}
              />
              <span className="theme-preset-card__preview grid w-18 h-12 grid-cols-2 overflow-hidden rounded-md border border-border" aria-hidden="true">
                {preset.swatches.map((swatch) => (
                  <span
                    className="theme-preset-card__swatch min-w-0 min-h-0"
                    key={swatch}
                    style={{ background: swatch }}
                  />
                ))}
              </span>
              <span className="theme-preset-card__body grid min-w-0 gap-1">
                <span className="theme-preset-card__title text-[14px] font-[590] text-foreground-strong">{preset.name}</span>
                <span className="theme-preset-card__description text-[12px] leading-[1.35] text-muted-soft wrap-anywhere">
                  {preset.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </SettingsGroup>

      <SettingsGroup title="主题">
        {THEME_OPTIONS.map((option) => (
          <SettingsRow key={option.mode} title={option.label} description={option.description}>
            <input
              className="size-4 accent-(--accent)"
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
          <Switch
            aria-label="窗口透明"
            checked={enableTransparency}
            onCheckedChange={onSetEnableTransparency}
          />
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}
