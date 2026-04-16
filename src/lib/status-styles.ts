import {
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Circle,
  ThumbsUp,
  ThumbsDown,
  Check,
  type LucideIcon,
} from "lucide-react";

/**
 * Central status / severity token map.
 *
 * Palette (color-blind safe — no semantic red/green, per CLAUDE.md):
 *   sky    → positive / running / in-progress
 *   amber  → attention / warning / warm urgency
 *   purple → negative / failure / destructive outcome
 *   slate  → neutral / pending / archived / low-signal
 *
 * Every status pairs a color className with a Lucide icon so meaning
 * survives colorblind viewing and monochrome printing. Icons are the
 * primary carrier of intent; color reinforces.
 */

export type StatusStyle = {
  className: string;
  icon: LucideIcon;
  /** Whether the icon should animate (e.g. `animate-spin` on Loader2). */
  animate?: boolean;
};

// ---------- Run status ----------

export type RunStatus = "pending" | "running" | "completed" | "failed";

export const RUN_STATUS_STYLES: Record<RunStatus, StatusStyle> = {
  pending: {
    className:
      "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-600",
    icon: Clock,
  },
  running: {
    className:
      "bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700",
    icon: Loader2,
    animate: true,
  },
  completed: {
    className:
      "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700",
    icon: CheckCircle2,
  },
  failed: {
    className:
      "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700",
    icon: XCircle,
  },
};

// ---------- Version status ----------

export type VersionStatus = "draft" | "current" | "archived";

export const VERSION_STATUS_STYLES: Record<VersionStatus, StatusStyle> = {
  draft: {
    className:
      "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
    icon: Clock,
  },
  current: {
    className:
      "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700",
    icon: CheckCircle2,
  },
  archived: {
    className:
      "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-600",
    icon: Circle,
  },
};

// ---------- Cycle status ----------

export type CycleStatus = "draft" | "open" | "closed";

export const CYCLE_STATUS_STYLES: Record<CycleStatus, StatusStyle> = {
  draft: {
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    icon: Clock,
  },
  open: {
    className:
      "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    icon: Loader2,
    animate: true,
  },
  closed: {
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    icon: CheckCircle2,
  },
};

// ---------- Feedback severity ----------

export type FeedbackSeverity = "high" | "medium" | "low";

export const SEVERITY_STYLES: Record<FeedbackSeverity, StatusStyle> = {
  high: {
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    icon: AlertTriangle,
  },
  medium: {
    className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    icon: Info,
  },
  low: {
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    icon: Circle,
  },
};

// ---------- Rating (preference) ----------

export type Rating = "best" | "acceptable" | "weak";

export const RATING_STYLES: Record<Rating, StatusStyle> = {
  best: {
    className:
      "bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700",
    icon: ThumbsUp,
  },
  acceptable: {
    className:
      "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
    icon: Check,
  },
  weak: {
    className:
      "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
    icon: ThumbsDown,
  },
};

/** Inline color classes for rating aggregates (count spans, chart text). */
export const RATING_TEXT_COLORS: Record<Rating, string> = {
  best: "text-sky-700 dark:text-sky-300",
  acceptable: "text-slate-600 dark:text-slate-400",
  weak: "text-amber-700 dark:text-amber-300",
};

// ---------- Semantic success/info text (toasts, inline confirmations) ----------

/** Inline success-message text color — e.g. "Settings saved." */
export const SUCCESS_TEXT = "text-sky-700 dark:text-sky-300";

/** Inline success background for larger surfaces (banners, badges). */
export const SUCCESS_SURFACE =
  "bg-sky-50 text-sky-800 dark:bg-sky-950/30 dark:text-sky-300";

/** Inline destructive text — e.g. form validation errors. Uses the theme token. */
export const DESTRUCTIVE_TEXT = "text-destructive";
