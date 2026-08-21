import { SidebarToggleIcon } from "./icons";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarToggleButtonProps {
  readonly collapsed: boolean;
  readonly shortcutLabel: string;
  readonly onToggle: () => void;
}

export function SidebarToggleButton({ collapsed, shortcutLabel, onToggle }: SidebarToggleButtonProps) {
  return (
    <div className="sidebar-toggle">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            aria-label="切换侧边栏"
            aria-pressed={!collapsed}
            className="sidebar-toggle__button size-[30px] rounded-lg bg-[var(--surface-overlay-muted)] text-muted-soft hover:bg-[var(--surface-overlay-hover)] hover:text-foreground-strong"
            data-testid="sidebar-toggle"
            type="button"
            onClick={onToggle}
          >
            <SidebarToggleIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8} className="gap-2 bg-card text-muted-strong">
          <span>切换侧边栏</span>
          <Kbd className="h-[18px] min-w-[28px] border border-border bg-muted px-[5px] pt-px text-[11px] font-semibold text-muted-strong">
            {shortcutLabel}
          </Kbd>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
