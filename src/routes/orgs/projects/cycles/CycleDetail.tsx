import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useProject } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CycleStatusPill } from "@/components/CycleStatusPill";
import { BlindLabelBadge } from "@/components/BlindLabelBadge";
import {
  ArrowLeft,
  Copy,
  Check,
  StopCircle,
  Play,
  Wand2,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/errors";
import { toast } from "sonner";

export function CycleDetail() {
  const { orgSlug, cycleId } = useParams<{
    orgSlug: string;
    cycleId: string;
  }>();
  const { projectId } = useProject();
  const navigate = useNavigate();

  const cycle = useQuery(
    api.reviewCycles.get,
    cycleId ? { cycleId: cycleId as Id<"reviewCycles"> } : "skip",
  );
  const evaluatorProgress = useQuery(
    api.reviewCycles.getEvaluatorProgress,
    cycleId ? { cycleId: cycleId as Id<"reviewCycles"> } : "skip",
  );

  const closeCycle = useMutation(api.reviewCycles.close);
  const setClosedAction = useMutation(api.reviewCycles.setClosedAction);
  const startCycle = useMutation(api.reviewCycles.start);

  const [closing, setClosing] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (cycle === undefined || evaluatorProgress === undefined) {
    return (
      <div className="p-6 max-w-4xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (cycle === null) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Cycle not found.</p>
        <Link
          to={`/orgs/${orgSlug}/projects/${projectId}/cycles`}
          className="text-sm text-primary hover:underline mt-2 block"
        >
          Back to cycles
        </Link>
      </div>
    );
  }

  async function handleClose() {
    setClosing(true);
    setError(null);
    try {
      await closeCycle({ cycleId: cycleId as Id<"reviewCycles"> });
      toast.success("Cycle closed");
    } catch (e) {
      setError(friendlyError(e, "Failed to close cycle."));
    } finally {
      setClosing(false);
    }
  }

  async function handleStart() {
    setError(null);
    try {
      await startCycle({ cycleId: cycleId as Id<"reviewCycles"> });
      toast.success("Cycle started");
    } catch (e) {
      setError(friendlyError(e, "Failed to start cycle."));
    }
  }

  async function handleClosedAction(
    action: "new_version_manual" | "optimizer_requested" | "no_action",
  ) {
    try {
      await setClosedAction({
        cycleId: cycleId as Id<"reviewCycles">,
        action,
      });
      if (action === "new_version_manual") {
        navigate(
          `/orgs/${orgSlug}/projects/${projectId}/versions?parentVersionId=${cycle!.primaryVersionId}`,
        );
      } else if (action === "optimizer_requested") {
        toast.success("Optimizer triggered from cycle feedback");
      } else {
        toast.info("No action taken");
      }
    } catch (e) {
      toast.error(friendlyError(e, "Failed to set action."));
    }
  }

  function copyEvalLink() {
    if (!cycle?.evalToken) return;
    const url = `${window.location.origin}/eval/cycle/${cycle.evalToken}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(true);
    toast.success("Evaluation link copied");
    setTimeout(() => setCopiedToken(false), 2000);
  }

  const completedCount =
    evaluatorProgress?.filter((e) => e.status === "completed").length ?? 0;
  const totalEvaluators = evaluatorProgress?.length ?? 0;

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <Link
        to={`/orgs/${orgSlug}/projects/${projectId}/cycles`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to cycles
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">{cycle.name}</h2>
          <CycleStatusPill status={cycle.status} />
        </div>
        <div className="flex items-center gap-2">
          {cycle.status === "draft" && (
            <Button size="sm" onClick={handleStart}>
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Start Cycle
            </Button>
          )}
          {cycle.status === "open" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={copyEvalLink}
              >
                {copiedToken ? (
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                )}
                Copy eval link
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleClose}
                disabled={closing}
              >
                <StopCircle className="h-3.5 w-3.5 mr-1.5" />
                {closing ? "Closing..." : "Close Cycle"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
        <span>
          v{cycle.primaryVersionNumber}
          {cycle.controlVersionNumber
            ? ` vs v${cycle.controlVersionNumber}`
            : ""}
        </span>
        <span>{cycle.outputs.length} outputs</span>
        {cycle.openedAt && (
          <span>
            Opened {new Date(cycle.openedAt).toLocaleDateString()}
          </span>
        )}
        {cycle.closedAt && (
          <span>
            Closed {new Date(cycle.closedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {error && (
        <div className="mt-3 text-sm text-destructive">{error}</div>
      )}

      {/* Section 1: Evaluator Progress */}
      {(cycle.status === "open" || cycle.status === "closed") &&
        evaluatorProgress &&
        evaluatorProgress.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold mb-3">
              Evaluator Progress{" "}
              <span className="font-normal text-muted-foreground">
                — {completedCount} of {totalEvaluators} complete
              </span>
            </h3>
            <div className="rounded-lg border divide-y">
              {evaluatorProgress.map((evaluator) => (
                <div
                  key={evaluator.userId}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {evaluator.userName ?? "Unknown"}
                      </p>
                      {evaluator.userEmail && (
                        <p className="text-xs text-muted-foreground truncate">
                          {evaluator.userEmail}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Progress bar */}
                    <div className="w-24 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{
                            width: `${evaluator.totalCount > 0 ? (evaluator.ratedCount / evaluator.totalCount) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {evaluator.ratedCount}/{evaluator.totalCount}
                      </span>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px]",
                        evaluator.status === "completed" &&
                          "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
                        evaluator.status === "in_progress" &&
                          "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
                      )}
                    >
                      {evaluator.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Section 2: Output Results (version reveal for author) */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold mb-3">Output Results</h3>
        <div className="rounded-lg border divide-y">
          {cycle.outputs.map((output) => (
            <div
              key={output._id}
              className="px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BlindLabelBadge label={output.cycleBlindLabel} />
                  <Badge
                    variant="outline"
                    className="text-[10px]"
                  >
                    v{output.sourceVersionNumber}
                    {output.isPrimaryVersion
                      ? " (primary)"
                      : " (control)"}
                  </Badge>
                  {output.sourceModel && (
                    <span className="text-xs text-muted-foreground">
                      {output.sourceModel}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-green-600 dark:text-green-400">
                    {output.ratings.best} best
                  </span>
                  <span className="text-muted-foreground">
                    {output.ratings.acceptable} ok
                  </span>
                  <span className="text-amber-600 dark:text-amber-400">
                    {output.ratings.weak} weak
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                {output.outputContentSnapshot.slice(0, 200)}
                {output.outputContentSnapshot.length > 200 ? "..." : ""}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: End-of-Cycle Actions */}
      {cycle.status === "closed" && !cycle.closedAction && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold mb-3">
            What would you like to do next?
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleClosedAction("new_version_manual")}
              className="rounded-lg border p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <Plus className="h-5 w-5 text-primary mb-2" />
              <p className="text-sm font-medium">Create New Version</p>
              <p className="text-xs text-muted-foreground mt-1">
                Manually iterate based on feedback
              </p>
            </button>
            <button
              type="button"
              onClick={() => handleClosedAction("optimizer_requested")}
              className="rounded-lg border p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <Wand2 className="h-5 w-5 text-primary mb-2" />
              <p className="text-sm font-medium">Run Optimizer</p>
              <p className="text-xs text-muted-foreground mt-1">
                AI-generate improvements from feedback
              </p>
            </button>
            <button
              type="button"
              onClick={() => handleClosedAction("no_action")}
              className="rounded-lg border p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No Action</p>
              <p className="text-xs text-muted-foreground mt-1">
                Close without further steps
              </p>
            </button>
          </div>
        </div>
      )}

      {cycle.status === "closed" && cycle.closedAction && (
        <div className="mt-8 rounded-lg border p-4 bg-muted/30">
          <p className="text-sm text-muted-foreground">
            Action taken:{" "}
            <span className="font-medium text-foreground">
              {cycle.closedAction === "optimizer_requested"
                ? "Optimizer requested"
                : cycle.closedAction === "new_version_manual"
                  ? "New version created"
                  : "No action"}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
