import { Badge } from "@/components/ui/badge";

export function BlindLabelBadge({ label }: { label: string }) {
  return (
    <Badge
      variant="outline"
      className="text-xs font-mono font-medium bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/30 dark:text-slate-300 dark:border-slate-600"
      aria-label={`Output ${label}`}
    >
      {label}
    </Badge>
  );
}
