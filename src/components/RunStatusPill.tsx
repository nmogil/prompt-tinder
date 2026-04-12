import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

const statusConfig: Record<
  string,
  { style: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pending: {
    style: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-600",
    icon: Clock,
  },
  running: {
    style: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700",
    icon: Loader2,
  },
  completed: {
    style: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700",
    icon: CheckCircle2,
  },
  failed: {
    style: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700",
    icon: XCircle,
  },
};

export function RunStatusPill({ status }: { status: string }) {
  const config = statusConfig[status] ?? statusConfig.pending!;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium capitalize gap-1", config.style)}
    >
      <Icon
        className={cn(
          "h-3 w-3",
          status === "running" && "animate-spin",
        )}
      />
      {status}
    </Badge>
  );
}
