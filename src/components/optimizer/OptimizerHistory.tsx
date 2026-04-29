import { useState } from "react";

import { ScrollFade } from "@/components/ui/scroll-fade";
import { CountBadge } from "@/components/ui/count-badge";
import { cn } from "@/lib/utils";

export interface OptimizerHistoryEntry {
  /** Opaque entry id — used as the React key only, never rendered. */
  id: string;
  /** Unix ms. */
  timestamp: number;
  /** Optimizer model identifier (e.g., "anthropic/claude-3.5-sonnet"). */
  model: string;
  /** Truncated diff preview. */
  preview: string;
  /** Full reasoning prose (shown when expanded). */
  reasoning?: string;
  /** Optional href to the full run detail. */
  detailHref?: string;
  /** Status flag for visual state. */
  status?: "pending" | "completed" | "failed";
}

interface OptimizerHistoryProps {
  entries: OptimizerHistoryEntry[];
  className?: string;
}

function formatRelative(ms: number) {
  const diff = Date.now() - ms;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  return `${days}d ago`;
}

/**
 * Sidebar/dock panel listing all optimizer runs for the current version (M27.5).
 *
 * Newest first. Each entry shows timestamp, model, and a truncated preview;
 * clicking expands to reveal the full reasoning prose. Long histories are
 * wrapped in <ScrollFade> so the list reads cleanly when content overflows.
 *
 * Hidden entirely from evaluator sessions — the dock registry excludes
 * OPTIMIZER_HISTORY for that role.
 */
export function OptimizerHistory({
  entries,
  className,
}: OptimizerHistoryProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col rounded-lg border bg-card overflow-hidden",
          className,
        )}
      >
        <div className="flex items-center px-3 border-b h-[var(--panel-header-h)]">
          <span className="text-sm font-medium">Optimizer history</span>
        </div>
        <div className="flex-1 px-3 py-6 text-xs text-muted-foreground">
          No optimization runs for this version yet. Run the optimizer from the
          version editor to populate this list.
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-card overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center justify-between px-3 border-b h-[var(--panel-header-h)]">
        <span className="text-sm font-medium">Optimizer history</span>
        <CountBadge count={entries.length} variant="subtle" />
      </div>
      <ScrollFade className="flex-1">
        <ul className="divide-y">
          {entries.map((entry) => {
            const isOpen = expanded === entry.id;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  className={cn(
                    "w-full text-left px-3 py-2",
                    "hover:bg-muted/50 focus-visible:outline-none focus-visible:bg-muted/60",
                    isOpen && "bg-muted/30",
                  )}
                  onClick={() =>
                    setExpanded((cur) => (cur === entry.id ? null : entry.id))
                  }
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-0.5">
                    <span>{formatRelative(entry.timestamp)}</span>
                    <span className="truncate ml-2 max-w-[60%]" title={entry.model}>
                      {entry.model}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-xs leading-snug",
                      isOpen ? "" : "line-clamp-2",
                    )}
                  >
                    {entry.preview}
                  </p>
                  {isOpen && entry.reasoning && (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                      {entry.reasoning}
                    </p>
                  )}
                  {isOpen && entry.detailHref && (
                    <a
                      href={entry.detailHref}
                      className="mt-2 inline-block text-xs text-primary underline-offset-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open full run →
                    </a>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </ScrollFade>
    </div>
  );
}
