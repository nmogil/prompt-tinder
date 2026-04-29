/**
 * Conventional-comments-style annotation labels (M27.4).
 *
 * The taxonomy is fixed: six labels mapped to four tones. Tones drive the
 * tonal background via OKLch tint tokens defined in src/index.css.
 *
 * Reasoning: structured labels give the optimizer a meaningful weighting
 * signal beyond raw text — see convex/lib/optimizerPrompt.ts for how the
 * optimizer reads them.
 */

export type AnnotationLabel =
  | "suggestion"
  | "issue"
  | "praise"
  | "question"
  | "nitpick"
  | "thought";

export type AnnotationTone = "info" | "warning" | "success" | "muted";

export const ANNOTATION_LABELS: ReadonlyArray<{
  value: AnnotationLabel;
  label: string;
  description: string;
  tone: AnnotationTone;
  /** Whether this label can carry an additional `blocking` flag (reserved for future use). */
  supportsBlocking: boolean;
}> = [
  {
    value: "suggestion",
    label: "Suggestion",
    description: "Recommend a change",
    tone: "info",
    supportsBlocking: true,
  },
  {
    value: "issue",
    label: "Issue",
    description: "Something wrong",
    tone: "warning",
    supportsBlocking: true,
  },
  {
    value: "praise",
    label: "Praise",
    description: "Positive signal",
    tone: "success",
    supportsBlocking: false,
  },
  {
    value: "question",
    label: "Question",
    description: "Needs clarification",
    tone: "info",
    supportsBlocking: false,
  },
  {
    value: "nitpick",
    label: "Nitpick",
    description: "Minor, non-blocking",
    tone: "muted",
    supportsBlocking: false,
  },
  {
    value: "thought",
    label: "Thought",
    description: "Musing, not actionable",
    tone: "muted",
    supportsBlocking: false,
  },
];

export const DEFAULT_ANNOTATION_LABEL: AnnotationLabel = "thought";

/**
 * Tone → tonal background classnames. Uses OKLch tint tokens from M27.2 so
 * theming is consistent across light + dark mode and never hardcodes hex.
 *
 * Diff coloring continues to use blue/purple per UX Spec §8.4 — this map is
 * specifically for label semantic tone.
 */
export const TONE_BG: Record<AnnotationTone, string> = {
  info: "bg-[var(--bg-info-tint)] text-info",
  warning: "bg-[var(--bg-warning-tint)] text-warning-foreground dark:text-warning",
  success: "bg-[var(--bg-success-tint)] text-success",
  muted: "bg-muted text-muted-foreground",
};

export const TONE_RING: Record<AnnotationTone, string> = {
  info: "ring-info/40",
  warning: "ring-warning/40",
  success: "ring-success/40",
  muted: "ring-muted-foreground/30",
};

export function labelMeta(value: AnnotationLabel) {
  return ANNOTATION_LABELS.find((l) => l.value === value)!;
}
