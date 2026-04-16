import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  VERSION_STATUS_STYLES,
  type VersionStatus,
} from "@/lib/status-styles";

function isVersionStatus(value: string): value is VersionStatus {
  return value in VERSION_STATUS_STYLES;
}

export function VersionStatusPill({ status }: { status: string }) {
  if (!isVersionStatus(status)) {
    return (
      <Badge variant="outline" className="text-xs font-medium capitalize">
        {status}
      </Badge>
    );
  }
  const config = VERSION_STATUS_STYLES[status];
  const Icon = config.icon;
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium capitalize gap-1",
        config.className,
      )}
    >
      <Icon className={cn("h-3 w-3", config.animate && "animate-spin")} />
      {status}
    </Badge>
  );
}
