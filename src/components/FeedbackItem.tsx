import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Rating = "best" | "acceptable" | "weak";

export interface FeedbackItemProps {
  authorLabel: string;
  highlightedText: string;
  comment: string;
  createdAt: number;
  rating?: Rating | null;
  tags?: readonly string[];
  sourceHint?: string | null;
}

export function FeedbackItem({
  authorLabel,
  highlightedText,
  comment,
  createdAt,
  rating,
  tags,
  sourceHint,
}: FeedbackItemProps) {
  return (
    <div className="rounded-md border p-2.5 text-sm space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-medium truncate">{authorLabel}</span>
          {sourceHint && (
            <span className="text-[10px] text-muted-foreground">
              · {sourceHint}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {rating && <RatingBadge rating={rating} />}
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(createdAt)}
          </span>
        </div>
      </div>
      {highlightedText.trim().length > 0 && (
        <blockquote className="border-l-2 border-blue-400 pl-2 text-xs text-muted-foreground italic line-clamp-2">
          {highlightedText}
        </blockquote>
      )}
      <p className="text-sm whitespace-pre-wrap">{comment}</p>
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function RatingBadge({ rating }: { rating: Rating }) {
  const label =
    rating === "best" ? "best" : rating === "acceptable" ? "ok" : "weak";
  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-[10px]",
        rating === "best" &&
          "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
        rating === "weak" &&
          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      )}
    >
      rated {label}
    </Badge>
  );
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
