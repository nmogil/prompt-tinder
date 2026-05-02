import { useQuery } from "convex/react";
import { Navigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Post-auth landing logic.
 *
 * - First-run user with the starter project → deep-link into the editor so
 *   they resume where they left off.
 * - Returning org member → org home.
 * - Project-invite-only user (has projectCollaborators rows but no org
 *   membership under the M29.2 three-rings model) → land directly in the
 *   project they have access to, not /welcome.
 * - Truly empty user (no orgs, no project access) → /welcome.
 */
export function RootRedirect() {
  const orgs = useQuery(api.organizations.listMyOrgs);
  const sampleInfo = useQuery(api.sampleSeed.getMySampleProject);

  if (orgs === undefined || sampleInfo === undefined) {
    return <Loading />;
  }

  // First-run user with exactly one project — drop them straight into the
  // editor; once they branch out we land them on org home so they can pick.
  if (
    sampleInfo.sample &&
    !sampleInfo.hasNonSampleProject &&
    sampleInfo.sample.orgSlug
  ) {
    const target = firstRunTarget(sampleInfo.sample, sampleInfo.sample.orgSlug);
    if (target) return <Navigate to={target} replace />;
  }

  const first = orgs[0];
  if (first) return <Navigate to={`/orgs/${first.org.slug}`} replace />;

  // No org membership but project access (typically a project-invite acceptor
  // who signed back in fresh) — route to the project, not /welcome.
  if (sampleInfo.sample?.orgSlug) {
    return (
      <Navigate
        to={`/orgs/${sampleInfo.sample.orgSlug}/projects/${sampleInfo.sample.projectId}`}
        replace
      />
    );
  }

  return <Navigate to="/welcome" replace />;
}

function firstRunTarget(
  sample: { projectId: string; versionId: string | null } | null,
  orgSlug: string | null,
): string | null {
  if (!sample || !sample.versionId || !orgSlug) return null;
  return `/orgs/${orgSlug}/projects/${sample.projectId}/versions/${sample.versionId}`;
}

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Skeleton className="h-8 w-48" />
    </div>
  );
}
