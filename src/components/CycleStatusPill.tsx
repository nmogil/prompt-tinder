import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  closed:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

export function CycleStatusPill({
  status,
  className,
}: {
  status: "draft" | "open" | "closed";
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-[10px] font-medium",
        STATUS_STYLES[status],
        className,
      )}
    >
      {status}
    </Badge>
  );
}
