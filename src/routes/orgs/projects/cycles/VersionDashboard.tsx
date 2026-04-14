import { useQuery } from "convex/react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useProject } from "@/contexts/ProjectContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CycleStatusPill } from "@/components/CycleStatusPill";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  CheckCircle,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function VersionDashboard() {
  const { orgSlug, versionId } = useParams<{
    orgSlug: string;
    versionId: string;
  }>();
  const { projectId } = useProject();

  const dashboard = useQuery(
    api.reviewCycles.getVersionDashboard,
    versionId
      ? { versionId: versionId as Id<"promptVersions"> }
      : "skip",
  );

  const trail = useQuery(
    api.reviewCycles.getFeedbackTrail,
    versionId
      ? { versionId: versionId as Id<"promptVersions"> }
      : "skip",
  );

  if (dashboard === undefined) {
    return (
      <div className="p-6 max-w-4xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Version not found.</p>
      </div>
    );
  }

  const { version, cycles, overallRatings, overallRatingsBySource, topThemes } =
    dashboard;

  const totalRatings = overallRatings.total;

  return (
    <div className="p-6 max-w-4xl">
      <Link
        to={`/orgs/${orgSlug}/projects/${projectId}/versions/${versionId}`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to version
      </Link>

      <h2 className="text-xl font-bold">
        Version {version.versionNumber} — Feedback Dashboard
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Aggregated feedback across {cycles.length} review cycle
        {cycles.length !== 1 ? "s" : ""}
      </p>

      {/* Section 1: Overview */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Ratings"
          value={totalRatings}
        />
        <StatCard
          label="Best"
          value={overallRatings.best}
          percentage={
            totalRatings > 0
              ? Math.round((overallRatings.best / totalRatings) * 100)
              : 0
          }
          color="text-green-600 dark:text-green-400"
        />
        <StatCard
          label="Acceptable"
          value={overallRatings.acceptable}
          percentage={
            totalRatings > 0
              ? Math.round(
                  (overallRatings.acceptable / totalRatings) * 100,
                )
              : 0
          }
        />
        <StatCard
          label="Weak"
          value={overallRatings.weak}
          percentage={
            totalRatings > 0
              ? Math.round((overallRatings.weak / totalRatings) * 100)
              : 0
          }
          color="text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Rating bar */}
      {totalRatings > 0 && (
        <div className="mt-4 h-3 rounded-full overflow-hidden flex bg-muted">
          <div
            className="bg-green-500 transition-all"
            style={{
              width: `${(overallRatings.best / totalRatings) * 100}%`,
            }}
          />
          <div
            className="bg-gray-400 transition-all"
            style={{
              width: `${(overallRatings.acceptable / totalRatings) * 100}%`,
            }}
          />
          <div
            className="bg-amber-500 transition-all"
            style={{
              width: `${(overallRatings.weak / totalRatings) * 100}%`,
            }}
          />
        </div>
      )}

      {/* Source breakdown */}
      <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
        {Object.entries(overallRatingsBySource).map(([source, counts]) => {
          const total = counts.best + counts.acceptable + counts.weak;
          if (total === 0) return null;
          return (
            <span key={source}>
              {source}: {total} rating{total !== 1 ? "s" : ""}
            </span>
          );
        })}
      </div>

      {/* Section 2: Per-Cycle Breakdown */}
      {cycles.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold mb-3">
            Per-Cycle Breakdown
          </h3>
          <div className="rounded-lg border divide-y">
            {cycles.map((cycle) => (
              <Link
                key={cycle.cycleId}
                to={`/orgs/${orgSlug}/projects/${projectId}/cycles/${cycle.cycleId}`}
                className="block px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {cycle.name}
                    </span>
                    <CycleStatusPill status={cycle.status} />
                    {cycle.controlVersionNumber && (
                      <span className="text-xs text-muted-foreground">
                        vs v{cycle.controlVersionNumber}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-green-600 dark:text-green-400">
                      {cycle.aggregatedRatings.best} best
                    </span>
                    <span className="text-muted-foreground">
                      {cycle.aggregatedRatings.acceptable} ok
                    </span>
                    <span className="text-amber-600 dark:text-amber-400">
                      {cycle.aggregatedRatings.weak} weak
                    </span>
                    <span className="text-muted-foreground">
                      {cycle.completedEvaluatorCount}/{cycle.evaluatorCount}{" "}
                      eval
                    </span>
                  </div>
                </div>
                {cycle.themes.length > 0 && (
                  <div className="mt-1.5 flex gap-1.5 flex-wrap">
                    {cycle.themes.slice(0, 5).map((theme) => (
                      <Badge
                        key={theme.tag}
                        variant="secondary"
                        className="text-[10px]"
                      >
                        {theme.tag} ({theme.count})
                      </Badge>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Feedback Trail */}
      {trail && trail.trail.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold mb-3">
            Feedback Trail
          </h3>
          <div className="space-y-4">
            {trail.trail.map((transition, i) => (
              <div key={i} className="rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm">
                  <Link
                    to={`/orgs/${orgSlug}/projects/${projectId}/cycles/${transition.fromCycle.cycleId}`}
                    className="font-medium hover:underline"
                  >
                    {transition.fromCycle.name}
                  </Link>
                  <span className="text-muted-foreground">→</span>
                  <Link
                    to={`/orgs/${orgSlug}/projects/${projectId}/cycles/${transition.toCycle.cycleId}`}
                    className="font-medium hover:underline"
                  >
                    {transition.toCycle.name}
                  </Link>
                </div>
                {transition.actionTaken && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Action:{" "}
                    {transition.actionTaken === "optimizer_requested"
                      ? "Optimizer"
                      : transition.actionTaken === "new_version_manual"
                        ? "Manual edit"
                        : "No action"}
                    {transition.resultingVersionNumber &&
                      ` → v${transition.resultingVersionNumber}`}
                  </p>
                )}
                <div className="mt-2 flex gap-4 text-xs">
                  {transition.resolved.length > 0 && (
                    <div>
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        Resolved:
                      </span>{" "}
                      {transition.resolved
                        .map((t) => t.tag)
                        .join(", ")}
                    </div>
                  )}
                  {transition.persistent.length > 0 && (
                    <div>
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        Persistent:
                      </span>{" "}
                      {transition.persistent
                        .map((t) => t.tag)
                        .join(", ")}
                    </div>
                  )}
                  {transition.new.length > 0 && (
                    <div>
                      <span className="text-muted-foreground font-medium">
                        New:
                      </span>{" "}
                      {transition.new
                        .map((t) => t.tag)
                        .join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 4: Actionable Summary */}
      {topThemes.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold mb-3">
            Top Themes — What to Fix
          </h3>
          <div className="rounded-lg border divide-y">
            {topThemes.slice(0, 8).map((theme) => (
              <div
                key={theme.tag}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {theme.tag}
                  </Badge>
                  <span className="text-sm">
                    {theme.count} mention{theme.count !== 1 ? "s" : ""}
                  </span>
                </div>
                <TrendIndicator trend={theme.trend} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-8 flex gap-3">
        <Link
          to={`/orgs/${orgSlug}/projects/${projectId}/cycles/new?primaryVersionId=${versionId}`}
        >
          <Button size="sm" variant="outline">
            <Play className="h-3.5 w-3.5 mr-1.5" />
            Start New Cycle
          </Button>
        </Link>
      </div>

      {/* Empty state */}
      {cycles.length === 0 && (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No review cycles yet for this version.
          </p>
          <Link
            to={`/orgs/${orgSlug}/projects/${projectId}/cycles/new?primaryVersionId=${versionId}`}
          >
            <Button size="sm" className="mt-3">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create First Cycle
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  percentage,
  color,
}: {
  label: string;
  value: number;
  percentage?: number;
  color?: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold mt-1", color)}>
        {value}
        {percentage !== undefined && (
          <span className="text-sm font-normal text-muted-foreground ml-1">
            ({percentage}%)
          </span>
        )}
      </p>
    </div>
  );
}

function TrendIndicator({
  trend,
}: {
  trend: "up" | "down" | "stable" | "new" | "resolved";
}) {
  switch (trend) {
    case "up":
      return (
        <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <TrendingUp className="h-3 w-3" />
          increasing
        </span>
      );
    case "down":
      return (
        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
          <TrendingDown className="h-3 w-3" />
          decreasing
        </span>
      );
    case "resolved":
      return (
        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
          <CheckCircle className="h-3 w-3" />
          resolved
        </span>
      );
    case "new":
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          new
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Minus className="h-3 w-3" />
          stable
        </span>
      );
  }
}
