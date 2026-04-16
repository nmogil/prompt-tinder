import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CYCLE_STATUS_STYLES } from "@/lib/status-styles";

export function CycleStatusPill({
  status,
  className,
}: {
  status: "draft" | "open" | "closed";
  className?: string;
}) {
  const config = CYCLE_STATUS_STYLES[status];
  const Icon = config.icon;
  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-[10px] font-medium gap-1",
        config.className,
        className,
      )}
    >
      <Icon className={cn("h-3 w-3", config.animate && "animate-spin")} />
      {status}
    </Badge>
  );
}
