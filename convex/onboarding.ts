import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireOrgRole } from "./lib/auth";
import { Id } from "./_generated/dataModel";

/**
 * Compute onboarding progress for the current user in an org.
 * All steps are derived from real data — no separate completion tracking.
 */
export const getProgress = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { membership } = await requireOrgRole(ctx, args.orgId, [
      "owner",
      "admin",
      "member",
    ]);

    const [key, allProjects] = await Promise.all([
      ctx.db
        .query("openRouterKeys")
        .withIndex("by_org", (q) => q.eq("organizationId", args.orgId))
        .unique(),
      ctx.db
        .query("projects")
        .withIndex("by_org", (q) => q.eq("organizationId", args.orgId))
        .collect(),
    ]);

    // M28.1: sample projects don't count for activation — the user hasn't
    // actually done any of the work, just inspected pre-seeded data.
    const projects = allProjects.filter((p) => !p.isSample);

    const hasKey = key !== null;
    const hasProject = projects.length > 0;
    const firstProjectId: Id<"projects"> | null =
      projects[0]?._id ?? null;

    let hasTestCase = false;
    let hasRun = false;
    let hasCycle = false;
    let hasAcceptedOptimization = false;

    for (const project of projects) {
      if (!hasTestCase) {
        const tc = await ctx.db
          .query("testCases")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .first();
        if (tc) hasTestCase = true;
      }

      if (!hasRun) {
        const run = await ctx.db
          .query("promptRuns")
          .withIndex("by_project_and_status", (q) =>
            q.eq("projectId", project._id),
          )
          .first();
        if (run) hasRun = true;
      }

      if (!hasCycle) {
        const cycle = await ctx.db
          .query("reviewCycles")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .first();
        if (cycle) hasCycle = true;
      }

      if (!hasAcceptedOptimization) {
        const optimizations = await ctx.db
          .query("optimizationRequests")
          .withIndex("by_project_and_status", (q) =>
            q.eq("projectId", project._id),
          )
          .collect();
        if (optimizations.some((o) => o.reviewStatus === "accepted")) {
          hasAcceptedOptimization = true;
        }
      }

      if (
        hasTestCase &&
        hasRun &&
        hasCycle &&
        hasAcceptedOptimization
      ) {
        break;
      }
    }

    return {
      role: membership.role,
      hasKey,
      hasProject,
      hasTestCase,
      hasRun,
      hasCycle,
      hasAcceptedOptimization,
      firstProjectId,
    };
  },
});
