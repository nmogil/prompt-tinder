import { useQuery } from "convex/react";
import { Navigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Post-auth landing logic.
 *
 * - Zero-project users → `/welcome` (paste a prompt or load the example).
 *   M29.4 replaced the silent auto-seed-and-redirect with the welcome
 *   screen so the first action is always something the user picked.
 * - Returning users with a starter project but nothing else → deep-link
 *   into the starter editor so they can resume right where they left off.
 * - Everyone else → org home.
 */
export function RootRedirect() {
  const orgs = useQuery(api.organizations.listMyOrgs);
  const sampleInfo = useQuery(api.sampleSeed.getMySampleProject);

  if (orgs === undefined || sampleInfo === undefined) {
    return <Loading />;
  }

  if (orgs.length === 0 || !sampleInfo.sample) {
    return <Navigate to="/welcome" replace />;
  }

  const first = orgs[0];
  if (!first) return <Navigate to="/welcome" replace />;

  // Single-project users (just the starter) get deep-linked back into the
  // editor; once they branch out we drop them on org home so they can pick.
  const isFirstRun = !sampleInfo.hasNonSampleProject;
  if (isFirstRun && sampleInfo.sample.orgSlug) {
    const target = firstRunTarget(sampleInfo.sample, sampleInfo.sample.orgSlug);
    if (target) return <Navigate to={target} replace />;
  }

  return <Navigate to={`/orgs/${first.org.slug}`} replace />;
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
