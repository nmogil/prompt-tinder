import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Equal, SkipForward } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  type Matchup,
  type ReasonTag,
  type ReviewOutput,
  REASON_TAGS,
} from "./types";

const SPRING = { type: "spring" as const, stiffness: 260, damping: 30 };
const AUTO_ADVANCE_MS = 1100;

type BattlePhaseProps = {
  outputs: ReviewOutput[];
  matchups: Matchup[];
  recordMatchup: (
    matchupId: string,
    winner: Matchup["winner"],
    tags: ReasonTag[],
  ) => void;
  onFinish: () => void;
};

export function BattlePhase({
  outputs,
  matchups,
  recordMatchup,
  onFinish,
}: BattlePhaseProps) {
  const outputMap = useMemo(
    () => Object.fromEntries(outputs.map((o) => [o.id, o])) as Record<string, ReviewOutput>,
    [outputs],
  );

  // Find first undecided matchup to start on
  const initialIdx = useMemo(() => {
    const i = matchups.findIndex((m) => m.winner === null);
    return i === -1 ? 0 : i;
  }, [matchups]);
  const [currentIdx, setCurrentIdx] = useState(initialIdx);

  const current = matchups[currentIdx];
  const isDecided = current?.winner !== null && current?.winner !== undefined;

  const goNext = useCallback(() => {
    setCurrentIdx((i) => Math.min(i + 1, matchups.length - 1));
  }, [matchups.length]);
  const goPrev = useCallback(() => {
    setCurrentIdx((i) => Math.max(i - 1, 0));
  }, []);

  const decide = useCallback(
    (winner: Matchup["winner"]) => {
      if (!current) return;
      const prevWinner = current.winner;
      const tags = current.reasonTags as ReasonTag[];
      recordMatchup(current.id, winner, tags);
      toast(`Matchup ${currentIdx + 1} recorded`, {
        action: {
          label: "Undo",
          onClick: () =>
            recordMatchup(
              current.id,
              prevWinner,
              prevWinner === null ? [] : tags,
            ),
        },
      });
    },
    [current, currentIdx, recordMatchup],
  );

  const toggleReason = useCallback(
    (tag: ReasonTag) => {
      if (!current) return;
      const next = current.reasonTags.includes(tag)
        ? current.reasonTags.filter((t) => t !== tag)
        : [...current.reasonTags, tag];
      recordMatchup(current.id, current.winner, next as ReasonTag[]);
    },
    [current, recordMatchup],
  );

  // Auto-advance after decision
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isDecided && currentIdx < matchups.length - 1) {
      advanceTimer.current = setTimeout(() => {
        goNext();
      }, AUTO_ADVANCE_MS);
    }
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, [isDecided, currentIdx, matchups.length, goNext]);

  // Pause advance on user interaction
  const pauseAdvance = useCallback(() => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  }, []);

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const editableFocused =
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA";
      if (editableFocused) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "1" || e.key.toLowerCase() === "a") {
        e.preventDefault();
        decide("left");
      } else if (e.key === "2" || e.key.toLowerCase() === "b") {
        e.preventDefault();
        decide("right");
      } else if (e.key === "=" || e.key.toLowerCase() === "t") {
        e.preventDefault();
        decide("tie");
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        decide("skip");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, goNext, goPrev]);

  if (!current) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
        No matchups.
      </div>
    );
  }

  const left = outputMap[current.leftId];
  const right = outputMap[current.rightId];
  if (!left || !right) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
        Matchup references missing output.
      </div>
    );
  }
  const totalDecided = matchups.filter(
    (m) => m.winner !== null && m.winner !== undefined,
  ).length;

  return (
    <div className="flex h-full flex-col">
      {/* Matchup progress */}
      <div className="shrink-0 border-b px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between text-xs">
          <span className="font-medium">
            Matchup {currentIdx + 1} / {matchups.length}
          </span>
          <span className="text-muted-foreground">
            {totalDecided} decided
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-5xl">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}
              className="grid gap-3 md:grid-cols-2 md:gap-6"
            >
              <BattleCard
                side="left"
                label="A"
                output={left}
                winner={current.winner}
                onPick={() => {
                  pauseAdvance();
                  decide("left");
                }}
              />
              <BattleCard
                side="right"
                label="B"
                output={right}
                winner={current.winner}
                onPick={() => {
                  pauseAdvance();
                  decide("right");
                }}
              />
            </motion.div>
          </AnimatePresence>

          {/* Action row */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                pauseAdvance();
                decide("tie");
              }}
              className={cn(current.winner === "tie" && "border-primary bg-primary/10")}
            >
              <Equal className="size-3.5" />
              Tie
              <kbd className="ml-1 rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground">
                =
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                pauseAdvance();
                decide("skip");
              }}
              className={cn(current.winner === "skip" && "border-primary bg-primary/10 border")}
            >
              <SkipForward className="size-3.5" />
              Skip
              <kbd className="ml-1 rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground">
                S
              </kbd>
            </Button>
          </div>

          {/* Reason chips (shown after a decision) */}
          <AnimatePresence>
            {isDecided && (
              <motion.div
                initial={{ opacity: 0, y: 8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-4 overflow-hidden"
                onPointerEnter={pauseAdvance}
              >
                <div className="mx-auto max-w-xl rounded-lg border bg-muted/30 p-3">
                  <div className="mb-2 text-xs text-muted-foreground">
                    Why? (optional)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {REASON_TAGS.map((t, i) => {
                      const active = current.reasonTags.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            pauseAdvance();
                            toggleReason(t);
                          }}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                            active
                              ? "border-sky-400 bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                              : "border-border text-muted-foreground hover:bg-background",
                          )}
                        >
                          {active && <Check className="size-3" />}
                          {t}
                          <kbd className="ml-1 hidden rounded bg-muted px-1 font-mono text-[10px] sm:inline">
                            {i + 1}
                          </kbd>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Nav row */}
      <div className="shrink-0 border-t bg-background/60 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={goPrev}
            disabled={currentIdx === 0}
          >
            <ArrowLeft className="size-3.5" />
            Prev
          </Button>

          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            tap A or B · 1 / 2 / = / S · ← → to navigate
          </span>

          {currentIdx === matchups.length - 1 && totalDecided >= matchups.length ? (
            <Button variant="default" size="sm" onClick={onFinish}>
              Finish
              <CheckCircle2 className="size-3.5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={goNext}
              disabled={currentIdx === matchups.length - 1}
            >
              Next
              <ArrowRight className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------

function BattleCard({
  side,
  label,
  output,
  winner,
  onPick,
}: {
  side: "left" | "right";
  label: string;
  output: ReviewOutput;
  winner: Matchup["winner"];
  onPick: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const isWinner = winner === side;
  const isLoser = winner !== null && winner !== side && winner !== "tie" && winner !== "skip";
  const isTie = winner === "tie";

  return (
    <motion.button
      type="button"
      onClick={onPick}
      animate={
        reducedMotion
          ? {}
          : isWinner
            ? { scale: [1, 1.03, 1], opacity: 1 }
            : isLoser
              ? { scale: 0.96, opacity: 0.45 }
              : isTie
                ? { opacity: 0.85 }
                : { scale: 1, opacity: 1 }
      }
      transition={reducedMotion ? { duration: 0.14 } : SPRING}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-card p-0 text-left text-card-foreground shadow-sm transition-all",
        "hover:border-primary/60 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isWinner &&
          "border-sky-400 ring-2 ring-sky-300 dark:border-sky-500 dark:ring-sky-700",
        isLoser && "border-muted",
      )}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-full font-heading text-xs font-semibold",
              isWinner
                ? "bg-sky-500 text-white"
                : "bg-muted text-muted-foreground",
            )}
          >
            {label}
          </span>
          <span className="text-xs text-muted-foreground">
            {output.blindLabel}
          </span>
        </div>
        {isWinner && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
          >
            <Check className="size-3" />
            Picked
          </motion.span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed">
        {output.content}
      </div>

      {/* Footer hint */}
      <div className="shrink-0 border-t bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
        Tap to pick
        <kbd className="ml-1.5 rounded bg-background px-1 font-mono text-[10px]">
          {side === "left" ? "1" : "2"}
        </kbd>
      </div>
    </motion.button>
  );
}
