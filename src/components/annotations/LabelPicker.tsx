import { useId } from "react";

import { cn } from "@/lib/utils";
import {
  ANNOTATION_LABELS,
  TONE_BG,
  TONE_RING,
  type AnnotationLabel,
} from "./labels";

interface LabelPickerProps {
  value: AnnotationLabel;
  onChange: (value: AnnotationLabel) => void;
  /** Optional set of allowed labels — defaults to all six. */
  allowed?: AnnotationLabel[];
  className?: string;
  /** Layout variant. `pills` is the default inline pill row; `compact` reduces padding for cramped surfaces. */
  variant?: "pills" | "compact";
}

/**
 * Conventional-comments-style label picker (M27.4).
 *
 * Inline pill row instead of a dropdown — keeps the choice visible at all times
 * and removes a click. Active label uses an OKLch tonal background; inactive
 * pills are border-only so the active state reads at a glance.
 *
 * Keyboard: tab focuses each pill, arrow-left/right cycles through them, Enter
 * or Space selects.
 */
export function LabelPicker({
  value,
  onChange,
  allowed,
  className,
  variant = "pills",
}: LabelPickerProps) {
  const groupId = useId();
  const labels = allowed
    ? ANNOTATION_LABELS.filter((l) => allowed.includes(l.value))
    : ANNOTATION_LABELS;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const idx = labels.findIndex((l) => l.value === value);
    if (idx === -1) return;
    const nextIdx =
      e.key === "ArrowRight"
        ? (idx + 1) % labels.length
        : (idx - 1 + labels.length) % labels.length;
    const next = labels[nextIdx];
    if (next) onChange(next.value);
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={`${groupId}-label`}
      className={cn(
        "flex flex-wrap gap-1",
        variant === "compact" && "gap-0.5",
        className,
      )}
    >
      <span id={`${groupId}-label`} className="sr-only">
        Annotation label
      </span>
      {labels.map((meta) => {
        const isActive = meta.value === value;
        return (
          <button
            key={meta.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`${meta.label} — ${meta.description}`}
            onClick={() => onChange(meta.value)}
            onKeyDown={handleKeyDown}
            tabIndex={isActive ? 0 : -1}
            className={cn(
              "inline-flex items-center rounded-full border text-[11px] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              variant === "compact" ? "px-1.5 py-0.5" : "px-2 py-0.5",
              isActive
                ? cn(
                    TONE_BG[meta.tone],
                    "border-transparent ring-1 ring-inset",
                    TONE_RING[meta.tone],
                  )
                : "border-border text-muted-foreground hover:bg-muted/50",
            )}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
