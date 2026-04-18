import { useState } from "react";
import { useQuery } from "convex/react";
import { useParams, Link, Navigate } from "react-router-dom";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useProject } from "@/contexts/ProjectContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CycleStatusPill } from "@/components/CycleStatusPill";
import { BlindLabelBadge } from "@/components/BlindLabelBadge";
import { FeedbackItem } from "@/components/FeedbackItem";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  CheckCircle,
  Play,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Legacy `/versions/:id/dashboard` route — redirects to the Feedback tab so
 * bookmarks keep working after the tabbed-layout refactor.
 */
export function VersionDashboard() {
  const { versionId } = useParams<{ versionId: string }>();
  const { projectId } = useProject();
  const { orgSlug } = useParams<{ orgSlug: string }>();

  if (!versionId) return null;

  return (
    <Navigate
      to={`/orgs/${orgSlug}/projects/${projectId}/versions/${versionId}?tab=feedback`}
      replace
    />
  );
}

/**
 * Body-only view of the version feedback dashboard. Rendered inside the
 * Feedback tab of the tabbed version page — no back-link or page title; the
 * parent page header owns those.
 */
export function VersionFeedbackContent({
  versionId,
  orgSlug,
  projectId,
}: {
  versionId: Id<"promptVersions">;
  orgSlug: string | undefined;
  projectId: Id<"projects">;
}) {
  const dashboard = useQuery(api.reviewCycles.getVersionDashboard, {
    versionId,
  });
  const trail = useQuery(api.reviewCycles.getFeedbackTrail, { versionId });
  const evaluatorComments = useQuery(
    api.reviewCycles.listCycleFeedbackForVersion,
    { versionId },
  );

  if (dashboard === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <p className="text-sm text-muted-foreground">Version not found.</p>
    );
  }

  const { cycles, overallRatings, overallRatingsBySource, topThemes } =
    dashboard;

  const totalRatings = overallRatings.total;

  return (
    <div className="max-w-4xl">
      {cycles.length > 0 && (
        <p className="text-sm text-muted-foreground mb-4">
          Aggregated feedback across {cycles.length} review cycle
          {cycles.length !== 1 ? "s" : ""}
        </p>
      )}

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
          color="text-sky-700 dark:text-sky-300"
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
            className="bg-sky-500 transition-all"
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
                    <span className="text-sky-700 dark:text-sky-300">
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
                      <span className="text-sky-700 dark:text-sky-300 font-medium">
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

      {/* Section 5: Evaluator Comments */}
      <EvaluatorCommentsSection
        comments={evaluatorComments}
        orgSlug={orgSlug}
        projectId={projectId}
      />

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
          <span className="text-base font-medium text-foreground/70 ml-1">
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
        <span className="flex items-center gap-1 text-xs text-sky-700 dark:text-sky-300">
          <TrendingDown className="h-3 w-3" />
          decreasing
        </span>
      );
    case "resolved":
      return (
        <span className="flex items-center gap-1 text-xs text-sky-700 dark:text-sky-300">
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

type VersionComments = {
  totalCount: number;
  cycles: Array<{
    cycleId: string;
    name: string;
    status: "draft" | "open" | "closed";
    controlVersionNumber: number | null;
    openedAt: number | null;
    closedAt: number | null;
    totalComments: number;
    outputs: Array<{
      cycleOutputId: string;
      cycleBlindLabel: string;
      isPrimaryVersion: boolean;
      comments: Array<{
        _id: string;
        authorLabel: string;
        source: "evaluator" | "anonymous" | "invited" | "solo" | "author";
        rating: "best" | "acceptable" | "weak" | null;
        highlightedText: string;
        comment: string;
        tags: string[];
        createdAt: number;
      }>;
    }>;
  }>;
};

function EvaluatorCommentsSection({
  comments,
  orgSlug,
  projectId,
}: {
  comments: VersionComments | undefined;
  orgSlug: string | undefined;
  projectId: Id<"projects">;
}) {
  if (comments === undefined) {
    return (
      <div className="mt-8">
        <h3 className="text-sm font-semibold mb-3">Evaluator Comments</h3>
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (comments.totalCount === 0) {
    return (
      <div className="mt-8">
        <h3 className="text-sm font-semibold mb-3">Evaluator Comments</h3>
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No written comments yet across this version's cycles.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">
          Evaluator Comments{" "}
          <span className="font-normal text-muted-foreground">
            — {comments.totalCount} across {comments.cycles.length} cycle
            {comments.cycles.length !== 1 ? "s" : ""}
          </span>
        </h3>
      </div>
      <div className="space-y-3">
        {comments.cycles.map((cycle, i) => (
          <CycleCommentGroup
            key={cycle.cycleId}
            cycle={cycle}
            orgSlug={orgSlug}
            projectId={projectId}
            defaultOpen={i === 0}
          />
        ))}
      </div>
    </div>
  );
}

function CycleCommentGroup({
  cycle,
  orgSlug,
  projectId,
  defaultOpen,
}: {
  cycle: VersionComments["cycles"][number];
  orgSlug: string | undefined;
  projectId: Id<"projects">;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 min-w-0 text-left hover:text-foreground/80 transition-colors"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm font-medium truncate">{cycle.name}</span>
          <CycleStatusPill status={cycle.status} />
        </button>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted-foreground">
            {cycle.totalComments} comment
            {cycle.totalComments !== 1 ? "s" : ""}
          </span>
          <Link
            to={`/orgs/${orgSlug}/projects/${projectId}/cycles/${cycle.cycleId}#reviewer-comments`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Open cycle →
          </Link>
        </div>
      </div>
      {open && (
        <div className="border-t divide-y">
          {cycle.outputs.map((output) => (
            <div key={output.cycleOutputId} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <BlindLabelBadge label={output.cycleBlindLabel} />
                <span className="text-xs text-muted-foreground">
                  {output.comments.length} comment
                  {output.comments.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-2">
                {output.comments.map((c) => (
                  <FeedbackItem
                    key={c._id}
                    authorLabel={c.authorLabel}
                    highlightedText={c.highlightedText}
                    comment={c.comment}
                    createdAt={c.createdAt}
                    rating={c.rating}
                    tags={c.tags}
                    sourceHint={sourceHintFor(c.source)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function sourceHintFor(
  source: "evaluator" | "anonymous" | "invited" | "solo" | "author",
): string | null {
  switch (source) {
    case "anonymous":
      return "via shareable link";
    case "invited":
      return "via email invite";
    case "solo":
      return "solo eval";
    case "author":
      return "author";
    default:
      return null;
  }
}
