import { useState } from "react";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

interface OptimizerMarkerProps {
  /** One-paragraph rationale for this specific change. */
  rationale: string;
  /** Opaque change index — used in DOM only as data-change-idx (no real IDs). */
  changeIdx: number;
  /** True while the optimizer run that produced this change is still streaming. */
  isPending?: boolean;
  /** Optional href to the full optimizer-run detail page. */
  detailHref?: string;
  className?: string;
}

/**
 * Inline sparkle marker rendered next to optimizer-touched lines (M27.5).
 *
 * Click reveals a popover with the per-change rationale (and optionally a
 * link to the full optimizer run). Pulses while the optimizer is still
 * generating, static when settled. prefers-reduced-motion disables the pulse.
 *
 * Blind-eval rule audit: only `data-change-idx` is exposed in the DOM. No
 * version, run, or optimizer request IDs. The component is hidden entirely
 * from the evaluator surface — its container is gated upstream.
 */
export function OptimizerMarker({
  rationale,
  changeIdx,
  isPending = false,
  detailHref,
  className,
}: OptimizerMarkerProps) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className={cn("relative inline-flex", className)}
      data-change-idx={changeIdx}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Optimizer change ${changeIdx + 1} — view rationale`}
        aria-expanded={open}
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center rounded text-primary",
          "hover:bg-[var(--bg-primary-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isPending && "motion-safe:animate-pulse",
        )}
      >
        <Sparkles className="h-3 w-3" aria-hidden />
      </button>
      {open && (
        <div
          role="dialog"
          className={cn(
            "absolute left-5 top-0 z-30 w-64 rounded-md border bg-popover p-2 shadow-lg",
            "text-xs text-popover-foreground",
          )}
        >
          <p className="mb-2 leading-relaxed">{rationale}</p>
          {detailHref && (
            <a
              href={detailHref}
              className="text-primary underline-offset-2 hover:underline"
            >
              View full optimization run →
            </a>
          )}
        </div>
      )}
    </span>
  );
}
