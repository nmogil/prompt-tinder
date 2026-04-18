import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { RunStatusPill } from "@/components/RunStatusPill";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Play } from "lucide-react";

/**
 * Lists every run for a single version. Rendered inside the Runs tab on the
 * version page.
 */
export function VersionRunsTab({
  versionId,
  orgSlug,
  projectId,
}: {
  versionId: Id<"promptVersions">;
  orgSlug: string | undefined;
  projectId: Id<"projects">;
}) {
  const runs = useQuery(api.runs.list, { versionId });

  if (runs === undefined) {
    return (
      <div className="space-y-2 max-w-4xl">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="max-w-4xl rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No runs for this version yet.
        </p>
        <Link
          to={`/orgs/${orgSlug}/projects/${projectId}/run?versionId=${versionId}`}
          className={buttonVariants({ size: "sm", className: "mt-3" })}
        >
          <Play className="mr-1.5 h-3.5 w-3.5" />
          Run this version
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">
          {runs.length} run{runs.length !== 1 ? "s" : ""} for this version
        </p>
        <Link
          to={`/orgs/${orgSlug}/projects/${projectId}/run?versionId=${versionId}`}
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          <Play className="mr-1.5 h-3.5 w-3.5" />
          New Run
        </Link>
      </div>
      <div className="space-y-2">
        {runs.map((run) => (
          <Link
            key={run._id}
            to={`/orgs/${orgSlug}/projects/${projectId}/runs/${run._id}`}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              {run.mode === "mix" ? (
                <span className="inline-flex items-center rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 text-[10px] font-medium">
                  Mix & Match ({run.slotConfigs?.length ?? 3})
                </span>
              ) : (
                <>
                  <span className="font-mono text-xs text-muted-foreground">
                    {run.model.split("/").pop()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    T={run.temperature}
                  </span>
                </>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(run._creationTime).toLocaleString()}
              </span>
            </div>
            <RunStatusPill status={run.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}
