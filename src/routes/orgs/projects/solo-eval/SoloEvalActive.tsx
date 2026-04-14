import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useProject } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { RatingButtons, type Rating } from "@/components/RatingButtons";
import { OnboardingCallout } from "@/components/OnboardingCallout";
import { SkipForward, CheckCircle2, X } from "lucide-react";

export function SoloEvalActive() {
  const { orgSlug, sessionId: sessionIdParam } = useParams<{
    orgSlug: string;
    sessionId: string;
  }>();
  const { projectId } = useProject();
  const navigate = useNavigate();

  const sessionId = sessionIdParam as Id<"soloEvalSessions">;
  const session = useQuery(api.soloEval.getSession, { sessionId });

  const rateOutput = useMutation(api.soloEval.rateCurrentOutput);
  const skipOutput = useMutation(api.soloEval.skipCurrentOutput);
  const completeSessionMut = useMutation(api.soloEval.completeSession);
  const abandonSessionMut = useMutation(api.soloEval.abandonSession);

  const [selectedRating, setSelectedRating] = useState<Rating | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Redirect to results if session is completed
  useEffect(() => {
    if (session?.status === "completed") {
      navigate(
        `/orgs/${orgSlug}/projects/${projectId}/solo-eval/${sessionIdParam}/results`,
        { replace: true },
      );
    }
  }, [session?.status, navigate, orgSlug, projectId, sessionIdParam]);

  // Reset state when current output changes
  useEffect(() => {
    setSelectedRating(null);
    setComment("");
  }, [session?.currentIndex]);

  const handleSubmit = useCallback(async () => {
    if (!selectedRating || submitting) return;
    setSubmitting(true);
    try {
      const result = await rateOutput({
        sessionId,
        rating: selectedRating,
        comment: comment.trim() || undefined,
      });
      if (result.isComplete) {
        navigate(
          `/orgs/${orgSlug}/projects/${projectId}/solo-eval/${sessionIdParam}/results`,
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedRating,
    submitting,
    comment,
    sessionId,
    rateOutput,
    navigate,
    orgSlug,
    projectId,
    sessionIdParam,
  ]);

  const handleSkip = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await skipOutput({ sessionId });
      if (result.isComplete) {
        navigate(
          `/orgs/${orgSlug}/projects/${projectId}/solo-eval/${sessionIdParam}/results`,
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [submitting, sessionId, skipOutput, navigate, orgSlug, projectId, sessionIdParam]);

  const handleFinishEarly = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await completeSessionMut({ sessionId });
      navigate(
        `/orgs/${orgSlug}/projects/${projectId}/solo-eval/${sessionIdParam}/results`,
      );
    } finally {
      setSubmitting(false);
    }
  }, [submitting, sessionId, completeSessionMut, navigate, orgSlug, projectId, sessionIdParam]);

  const handleAbandon = useCallback(async () => {
    await abandonSessionMut({ sessionId });
    navigate(`/orgs/${orgSlug}/projects/${projectId}/solo-eval`);
  }, [sessionId, abandonSessionMut, navigate, orgSlug, projectId]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture when typing in textarea
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      )
        return;

      if (e.key === "1") {
        e.preventDefault();
        setSelectedRating("best");
      } else if (e.key === "2") {
        e.preventDefault();
        setSelectedRating("acceptable");
      } else if (e.key === "3") {
        e.preventDefault();
        setSelectedRating("weak");
      } else if (e.key === "Enter" && selectedRating) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        handleSkip();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRating, handleSubmit, handleSkip]);

  if (session === undefined) {
    return (
      <div className="flex justify-center p-6">
        <div className="max-w-2xl w-full space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (session.status === "abandoned") {
    navigate(`/orgs/${orgSlug}/projects/${projectId}/solo-eval`, {
      replace: true,
    });
    return null;
  }

  const progressPct =
    session.totalCount > 0
      ? Math.round((session.currentIndex / session.totalCount) * 100)
      : 0;

  return (
    <div className="flex justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Bias reminder */}
        <OnboardingCallout calloutKey="solo_eval_bias_reminder">
          Focus on output quality alone, not which version you think produced
          this. Outputs are shuffled across all your runs.
        </OnboardingCallout>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              Output #{session.soloLabel} of {session.totalCount}
            </span>
            <span className="text-muted-foreground text-xs">
              {session.ratedCount} rated
              {session.skippedCount > 0 &&
                ` · ${session.skippedCount} skipped`}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Output card */}
        <div className="mt-6 rounded-lg border bg-card p-6">
          <div className="whitespace-pre-wrap text-sm leading-relaxed font-mono">
            {session.outputContent}
          </div>
        </div>

        {/* Rating section */}
        <div className="mt-6 space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Rate this output</p>
            <RatingButtons
              currentRating={selectedRating}
              onRate={setSelectedRating}
            />
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Keyboard: 1 = Best, 2 = Acceptable, 3 = Weak
            </p>
          </div>

          <div>
            <Textarea
              placeholder="Any specific feedback on this output? (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="resize-none text-sm"
              rows={2}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSubmit}
              disabled={!selectedRating || submitting}
              className="flex-1"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {submitting ? "Submitting..." : "Submit Rating"}
            </Button>
            <Button
              variant="ghost"
              onClick={handleSkip}
              disabled={submitting}
            >
              <SkipForward className="h-4 w-4 mr-1" />
              Skip
            </Button>
          </div>

          {/* Finish early / abandon */}
          <div className="flex items-center justify-between pt-2 border-t">
            {session.ratedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleFinishEarly}
                disabled={submitting}
              >
                Finish early ({session.ratedCount} rated)
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground ml-auto"
              onClick={handleAbandon}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Abandon
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
