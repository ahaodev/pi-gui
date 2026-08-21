import type { ModelOnboardingNotice } from "./model-onboarding";

interface ModelOnboardingNoticeBannerProps {
  readonly notice: ModelOnboardingNotice | undefined;
  readonly onOpenSettings: (section: ModelOnboardingNotice["actionSection"]) => void;
}

export function ModelOnboardingNoticeBanner({
  notice,
  onOpenSettings,
}: ModelOnboardingNoticeBannerProps) {
  if (!notice) {
    return null;
  }

  return (
    <div
      className="model-onboarding-notice flex min-h-6 items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--line)_82%,transparent_18%)] pb-0.5"
      data-testid="model-onboarding-notice"
    >
      <div className="model-onboarding-notice__body flex min-w-0 flex-wrap items-baseline gap-2">
        <span className="model-onboarding-notice__title whitespace-nowrap text-xs font-semibold text-foreground-strong">
          {notice.title}
        </span>
        <span className="model-onboarding-notice__description text-xs leading-[1.35] text-muted-foreground">
          {notice.description}
        </span>
      </div>
      <button
        className="model-onboarding-notice__action flex-shrink-0 cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-ring hover:underline"
        type="button"
        onClick={() => onOpenSettings(notice.actionSection)}
      >
        {notice.actionLabel}
      </button>
    </div>
  );
}
