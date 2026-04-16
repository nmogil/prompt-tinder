import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  RUN_STATUS_STYLES,
  type RunStatus,
} from "@/lib/status-styles";

function isRunStatus(value: string): value is RunStatus {
  return value in RUN_STATUS_STYLES;
}

export function RunStatusPill({ status }: { status: string }) {
  const key: RunStatus = isRunStatus(status) ? status : "pending";
  const config = RUN_STATUS_STYLES[key];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium capitalize gap-1", config.className)}
    >
      <Icon className={cn("h-3 w-3", config.animate && "animate-spin")} />
      {status}
    </Badge>
  );
}
