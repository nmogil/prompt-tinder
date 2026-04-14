import { useQuery, useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "lucide-react";

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

export function EvalInbox() {
  const inbox = useQuery(api.evaluatorInbox.listMyInbox);
  const cycleInbox = useQuery(api.reviewCycles.listMyCyclesToEvaluate);
  const refreshToken = useMutation(api.evaluatorInbox.refreshEvalToken);
  const navigate = useNavigate();

  if (inbox === undefined || cycleInbox === undefined) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const hasCycles = cycleInbox.length > 0;
  const hasRuns = inbox.length > 0;

  if (!hasCycles && !hasRuns) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={Inbox}
          heading="You're all caught up"
          description="Waiting for new evaluations."
        />
      </div>
    );
  }

  async function handleNavigate(opaqueToken: string, expiresAt: number) {
    // Refresh token if expired or about to expire (within 5 minutes)
    if (expiresAt < Date.now() + 5 * 60 * 1000) {
      try {
        const newToken = await refreshToken({ opaqueToken });
        navigate(`/eval/${newToken}`);
        return;
      } catch {
        // If refresh fails, try with existing token
      }
    }
    navigate(`/eval/${opaqueToken}`);
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-lg font-medium">Pending evaluations</h1>

      {/* Review Cycles section */}
      {hasCycles && (
        <div className="space-y-2">
          {(hasRuns) && (
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Review Cycles
            </h2>
          )}
          {cycleInbox.map((item) => (
            <button
              key={item.cycleId}
              onClick={() =>
                navigate(`/eval/cycle/${item.cycleEvalToken}`)
              }
              className="w-full text-left rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {item.cycleName}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    cycle
                  </Badge>
                </div>
                <Badge variant="outline" className="text-xs">
                  {item.ratedCount}/{item.outputCount} rated
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {item.projectName} · Assigned{" "}
                {formatRelativeTime(item.assignedAt)}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Individual Runs section */}
      {hasRuns && (
        <div className="space-y-2">
          {hasCycles && (
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-4">
              Individual Runs
            </h2>
          )}
          {inbox.map((item) => (
            <button
              key={item.opaqueToken}
              onClick={() =>
                handleNavigate(item.opaqueToken, item.expiresAt)
              }
              className="w-full text-left rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">
                  {item.projectName}
                </span>
                <Badge variant="outline" className="text-xs">
                  {item.outputCount} output
                  {item.outputCount !== 1 ? "s" : ""}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Completed {formatRelativeTime(item.completedAt)}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
