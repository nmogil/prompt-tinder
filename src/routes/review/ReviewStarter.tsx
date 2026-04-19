import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { friendlyError } from "@/lib/errors";

const EVAL_ROLE_ABOVE_EVALUATOR = "EVAL_ROLE_ABOVE_EVALUATOR";

type Scope = "run" | "cycle";

function useStartSession(scope: Scope) {
  const params = useParams<{ runId?: string; cycleId?: string }>();
  const navigate = useNavigate();
  const start = useMutation(api.reviewSessions.start);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    const runId = scope === "run" ? params.runId : undefined;
    const cycleId = scope === "cycle" ? params.cycleId : undefined;
    if (!runId && !cycleId) return;
    started.current = true;
    void start({
      runId: runId as Id<"promptRuns"> | undefined,
      cycleId: cycleId as Id<"reviewCycles"> | undefined,
    })
      .then((sessionId) => {
        navigate(`/review/session/${sessionId}`, { replace: true });
      })
      .catch((err) => {
        started.current = false;
        toast.error(friendlyError(err, "Failed to start review."));
        navigate(-1);
      });
  }, [scope, params.runId, params.cycleId, navigate, start]);
}

export function ReviewRunStarter() {
  useStartSession("run");
  return <StarterFallback />;
}

export function ReviewCycleStarter() {
  useStartSession("cycle");
  return <StarterFallback />;
}

export function TokenReviewCycleStarter() {
  const { cycleEvalToken } = useParams<{ cycleEvalToken: string }>();
  const navigate = useNavigate();
  const startFromToken = useMutation(api.reviewSessions.startFromCycleToken);
  const started = useRef(false);
  const [blockedAboveEvaluator, setBlockedAboveEvaluator] = useState(false);

  useEffect(() => {
    if (started.current) return;
    if (!cycleEvalToken) return;
    started.current = true;
    void startFromToken({ cycleEvalToken })
      .then((sessionId) => {
        navigate(`/review/session/${sessionId}`, { replace: true });
      })
      .catch((err) => {
        const raw: string =
          (err && typeof err === "object" && "data" in err && typeof err.data === "string"
            ? err.data
            : err?.message) ?? "";
        if (raw.includes(EVAL_ROLE_ABOVE_EVALUATOR)) {
          setBlockedAboveEvaluator(true);
          return;
        }
        started.current = false;
        toast.error(friendlyError(err, "Failed to start review."));
        navigate("/eval", { replace: true });
      });
  }, [cycleEvalToken, navigate, startFromToken]);

  if (blockedAboveEvaluator) {
    return <EvaluatorRoleBlockedNotice />;
  }
  return <StarterFallback />;
}

function EvaluatorRoleBlockedNotice() {
  return (
    <div className="flex h-dvh items-center justify-center p-6">
      <div className="max-w-md space-y-3 text-center">
        <p className="text-lg font-medium">
          You're an editor on this project.
        </p>
        <p className="text-sm text-muted-foreground">
          You cannot participate in blind evaluation here — you already have
          access to version details this view is designed to hide.
        </p>
        <Link to="/eval" className="text-sm text-primary hover:underline">
          Back to your reviews
        </Link>
      </div>
    </div>
  );
}

function StarterFallback() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <Skeleton className="h-8 w-48" />
    </div>
  );
}
