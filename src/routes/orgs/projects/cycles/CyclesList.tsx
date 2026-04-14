import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../../../convex/_generated/api";
import { useProject } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CycleStatusPill } from "@/components/CycleStatusPill";
import { Plus, ArrowRight, Layers, Download } from "lucide-react";
import { friendlyError } from "@/lib/errors";
import { toast } from "sonner";

export function CyclesList() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { projectId, role } = useProject();

  const cycles = useQuery(api.reviewCycles.list, { projectId });
  const migratableCount = useQuery(
    api.reviewCycles.countMigratableRuns,
    role === "owner" ? { projectId } : "skip",
  );
  const startMigration = useMutation(api.reviewCycles.startMigrateAllRuns);

  const [confirmImport, setConfirmImport] = useState(false);
  const [migrating, setMigrating] = useState(false);

  if (cycles === undefined) {
    return (
      <div className="p-6 max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Review Cycles</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Structured evaluation rounds for comparing prompt versions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {role === "owner" &&
            migratableCount &&
            migratableCount.count > 0 && (
              <>
                {confirmImport ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Import {migratableCount.count} run
                      {migratableCount.count !== 1 ? "s" : ""} as closed
                      cycles?
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={migrating}
                      onClick={async () => {
                        setMigrating(true);
                        try {
                          const result = await startMigration({ projectId });
                          toast.success(
                            `Migration started for ${result.eligibleCount} runs`,
                          );
                          setConfirmImport(false);
                        } catch (e) {
                          toast.error(
                            friendlyError(e, "Failed to start migration."),
                          );
                        } finally {
                          setMigrating(false);
                        }
                      }}
                    >
                      {migrating ? "Migrating..." : "Confirm"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmImport(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmImport(true)}
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Import Historical Runs
                  </Button>
                )}
              </>
            )}
          <Link to={`/orgs/${orgSlug}/projects/${projectId}/cycles/new`}>
            <Button size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Cycle
            </Button>
          </Link>
        </div>
      </div>

      {cycles.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <Layers className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            No review cycles yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            Start a review cycle to pool outputs from multiple versions,
            assign evaluators, and collect structured blind feedback.
          </p>
          <Link
            to={`/orgs/${orgSlug}/projects/${projectId}/cycles/new`}
          >
            <Button size="sm" className="mt-4">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create Cycle
            </Button>
          </Link>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border divide-y">
          {cycles.map((cycle) => (
            <Link
              key={cycle._id}
              to={`/orgs/${orgSlug}/projects/${projectId}/cycles/${cycle._id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {cycle.name}
                  </span>
                  <CycleStatusPill status={cycle.status} />
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>
                    v{cycle.primaryVersionNumber}
                    {cycle.controlVersionNumber
                      ? ` vs v${cycle.controlVersionNumber}`
                      : ""}
                  </span>
                  <span>{cycle.outputCount} outputs</span>
                  <span>
                    {cycle.evaluatorProgress.completed}/
                    {cycle.evaluatorProgress.total} evaluators done
                  </span>
                  {cycle.closedAction && (
                    <span className="text-primary">
                      {cycle.closedAction === "optimizer_requested"
                        ? "Optimized"
                        : cycle.closedAction === "new_version_manual"
                          ? "New version"
                          : "No action"}
                    </span>
                  )}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
