import type { ReactNode } from "react";

export interface SecondarySurfaceNavItem {
  readonly id: string;
  readonly label: string;
}

interface SecondarySurfaceProps {
  readonly title: string;
  readonly onBack: () => void;
  readonly navItems?: readonly SecondarySurfaceNavItem[];
  readonly activeNavId?: string;
  readonly onSelectNav?: (id: string) => void;
  readonly testId?: string;
  readonly children: ReactNode;
}

export function SecondarySurface({
  title,
  onBack,
  navItems = [],
  activeNavId,
  onSelectNav,
  testId,
  children,
}: SecondarySurfaceProps) {
  return (
    <div className="secondary-surface grid h-screen min-h-0 grid-cols-[232px_minmax(0,1fr)] bg-window" data-testid={testId}>
      <aside className="secondary-surface__sidebar grid content-start gap-4 border-r border-[var(--border-default,transparent)] bg-sidebar px-3 pt-8 pb-4">
        <button
          className="secondary-surface__back inline-flex w-fit items-center gap-2 rounded-md px-2 py-1 -ml-2 text-[12px] font-[500] text-muted-strong transition-colors duration-[0.15s] ease-out hover:bg-overlay-hover hover:text-foreground-strong"
          type="button"
          onClick={onBack}
        >
          <span aria-hidden="true">←</span>
          <span>返回应用</span>
        </button>
        <div className="secondary-surface__title px-2 text-[11px] font-semibold tracking-[0.08em] text-muted-soft uppercase">
          {title}
        </div>
        {navItems.length > 0 ? (
          <nav className="secondary-surface__nav grid gap-0.5" aria-label={`${title} 分区`}>
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`secondary-surface__nav-item rounded-md px-3 py-2 text-left text-[14px] font-[500] text-muted-strong transition-colors duration-[0.12s] ease-out hover:bg-overlay-hover hover:text-foreground-strong ${
                  activeNavId === item.id
                    ? "secondary-surface__nav-item--active bg-accent-tint text-foreground-strong"
                    : ""
                }`}
                type="button"
                onClick={() => onSelectNav?.(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        ) : null}
      </aside>
      <main className="secondary-surface__content min-w-0 overflow-auto px-7 pt-8 pb-6">{children}</main>
    </div>
  );
}
