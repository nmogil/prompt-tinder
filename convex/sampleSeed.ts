import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/auth";
import { genMessageId } from "./lib/messages";
import {
  SAMPLE_ANNOTATIONS,
  SAMPLE_OPTIMIZER_MODEL,
  SAMPLE_OPTIMIZER_PROMPT_VERSION,
  SAMPLE_OPTIMIZER_REASONING,
  SAMPLE_OPTIMIZER_SUMMARY,
  SAMPLE_OPTIMIZER_SYSTEM,
  SAMPLE_OPTIMIZER_USER_TEMPLATE,
  SAMPLE_OUTPUTS,
  SAMPLE_PROJECT_DESCRIPTION,
  SAMPLE_PROJECT_NAME,
  SAMPLE_REVIEWER_EMAIL,
  SAMPLE_REVIEWER_NAME,
  SAMPLE_SYSTEM_MESSAGE,
  SAMPLE_TEST_CASE_DRAFT,
  SAMPLE_TEST_CASE_NAME,
  SAMPLE_USER_TEMPLATE,
  SAMPLE_VARIABLE_NAME,
} from "./fixtures/sampleProject";

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/;

function defaultPersonalOrgName(user: Doc<"users"> | null): string {
  const name = user?.name?.trim();
  if (name) return `${name.split(" ")[0]}'s workspace`;
  return "My workspace";
}

function slugCandidate(base: string, suffix: string): string {
  const cleaned = base
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const root = cleaned.length >= 3 ? cleaned : "workspace";
  const candidate = `${root}-${suffix}`.slice(0, 48);
  if (SLUG_REGEX.test(candidate)) return candidate;
  return `workspace-${suffix}`.slice(0, 48);
}

/**
 * Ensure the current user has a sample project seeded.
 *
 * Idempotent — returns the slug of the user's first org without creating
 * anything if they already belong to any org. Otherwise creates a personal
 * org + a fully-populated sample project (`isSample: true` on every row) and
 * returns its slug.
 *
 * Returns `{ orgSlug, sampleProjectId, alreadySeeded }`.
 */
export const ensureFirstRunSeed = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const existingMembership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingMembership) {
      const org = await ctx.db.get(existingMembership.organizationId);
      const sample = await findSampleProjectInOrg(
        ctx,
        existingMembership.organizationId,
      );
      return {
        orgSlug: org?.slug ?? null,
        sampleProjectId: sample?._id ?? null,
        alreadySeeded: true,
      };
    }

    const user = await ctx.db.get(userId);
    const orgName = defaultPersonalOrgName(user);

    let slug = slugCandidate(orgName, userId.slice(-6));
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      if (!clash) break;
      slug = slugCandidate(orgName, `${userId.slice(-6)}-${attempt + 2}`);
    }

    const orgId = await ctx.db.insert("organizations", {
      name: orgName,
      slug,
      createdById: userId,
    });
    await ctx.db.insert("organizationMembers", {
      organizationId: orgId,
      userId,
      role: "owner",
    });

    const sampleProjectId = await materializeSampleProject(ctx, orgId, userId);

    await ctx.scheduler.runAfter(0, internal.analyticsActions.track, {
      event: "sample project seeded",
      distinctId: userId as string,
      properties: {
        org_id: orgId as string,
        project_id: sampleProjectId as string,
      },
    });

    return {
      orgSlug: slug,
      sampleProjectId,
      alreadySeeded: false,
    };
  },
});

async function findSampleProjectInOrg(
  ctx: { db: import("./_generated/server").QueryCtx["db"] },
  orgId: Id<"organizations">,
): Promise<Doc<"projects"> | null> {
  const projects = await ctx.db
    .query("projects")
    .withIndex("by_org", (q) => q.eq("organizationId", orgId))
    .take(50);
  return projects.find((p) => p.isSample === true) ?? null;
}

async function getOrCreateSampleReviewer(
  ctx: { db: import("./_generated/server").MutationCtx["db"] },
): Promise<Id<"users">> {
  const existing = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", SAMPLE_REVIEWER_EMAIL))
    .unique();
  if (existing) return existing._id;
  return await ctx.db.insert("users", {
    name: SAMPLE_REVIEWER_NAME,
    email: SAMPLE_REVIEWER_EMAIL,
  });
}

async function materializeSampleProject(
  ctx: { db: import("./_generated/server").MutationCtx["db"] },
  orgId: Id<"organizations">,
  userId: Id<"users">,
): Promise<Id<"projects">> {
  const projectId = await ctx.db.insert("projects", {
    organizationId: orgId,
    name: SAMPLE_PROJECT_NAME,
    description: SAMPLE_PROJECT_DESCRIPTION,
    createdById: userId,
    isSample: true,
  });

  await ctx.db.insert("projectCollaborators", {
    projectId,
    userId,
    role: "owner",
    invitedById: userId,
    invitedAt: Date.now(),
    acceptedAt: Date.now(),
  });

  await ctx.db.insert("projectVariables", {
    projectId,
    name: SAMPLE_VARIABLE_NAME,
    description: "The customer reply that should be rewritten warmer.",
    required: true,
    order: 0,
    type: "text",
  });

  const testCaseId = await ctx.db.insert("testCases", {
    projectId,
    name: SAMPLE_TEST_CASE_NAME,
    variableValues: { [SAMPLE_VARIABLE_NAME]: SAMPLE_TEST_CASE_DRAFT },
    attachmentIds: [],
    order: 0,
    createdById: userId,
  });

  const systemId = genMessageId();
  const userMsgId = genMessageId();
  const versionId = await ctx.db.insert("promptVersions", {
    projectId,
    versionNumber: 1,
    systemMessage: SAMPLE_SYSTEM_MESSAGE,
    userMessageTemplate: SAMPLE_USER_TEMPLATE,
    systemMessageFormat: "plain",
    userMessageTemplateFormat: "plain",
    messages: [
      {
        id: systemId,
        role: "system",
        content: SAMPLE_SYSTEM_MESSAGE,
        format: "plain",
      },
      {
        id: userMsgId,
        role: "user",
        content: SAMPLE_USER_TEMPLATE,
        format: "plain",
      },
    ],
    status: "current",
    createdById: userId,
    isSample: true,
  });

  const now = Date.now();
  const runId = await ctx.db.insert("promptRuns", {
    projectId,
    promptVersionId: versionId,
    testCaseId,
    model: SAMPLE_OUTPUTS[0]!.model,
    temperature: 0.7,
    mode: "mix",
    slotConfigs: SAMPLE_OUTPUTS.map((o) => ({
      label: o.blindLabel,
      model: o.model,
      temperature: 0.7,
    })),
    status: "completed",
    startedAt: now - 4000,
    completedAt: now - 1000,
    triggeredById: userId,
    isSample: true,
  });

  const outputIds: Id<"runOutputs">[] = [];
  for (const out of SAMPLE_OUTPUTS) {
    const outputId = await ctx.db.insert("runOutputs", {
      runId,
      blindLabel: out.blindLabel,
      outputContent: out.content,
      model: out.model,
      temperature: 0.7,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      latencyMs: 1200,
      isSample: true,
    });
    outputIds.push(outputId);
  }

  const reviewerId = await getOrCreateSampleReviewer(ctx);
  for (const annotation of SAMPLE_ANNOTATIONS) {
    const outputId = outputIds[annotation.outputIndex];
    if (!outputId) continue;
    await ctx.db.insert("outputFeedback", {
      outputId,
      userId: reviewerId,
      annotationData: {
        from: annotation.from,
        to: annotation.to,
        highlightedText: annotation.highlightedText,
        comment: annotation.comment,
      },
      label: annotation.label,
      targetKind: "inline",
      isSample: true,
    });
  }

  await ctx.db.insert("optimizationRequests", {
    projectId,
    promptVersionId: versionId,
    status: "completed",
    generatedSystemMessage: SAMPLE_OPTIMIZER_SYSTEM,
    generatedUserTemplate: SAMPLE_OPTIMIZER_USER_TEMPLATE,
    generatedMessages: [
      {
        id: genMessageId(),
        role: "system",
        content: SAMPLE_OPTIMIZER_SYSTEM,
        format: "plain",
      },
      {
        id: genMessageId(),
        role: "user",
        content: SAMPLE_OPTIMIZER_USER_TEMPLATE,
        format: "plain",
      },
    ],
    changesSummary: SAMPLE_OPTIMIZER_SUMMARY,
    changesReasoning: SAMPLE_OPTIMIZER_REASONING,
    optimizerModel: SAMPLE_OPTIMIZER_MODEL,
    optimizerPromptVersion: SAMPLE_OPTIMIZER_PROMPT_VERSION,
    reviewStatus: "pending",
    requestedById: userId,
    isSample: true,
  });

  return projectId;
}

/**
 * Surface the current user's sample project id (if any), the org slug it
 * lives under, the seeded version id, and whether the user has graduated to
 * any non-sample projects. UI surfaces use this to route first-run users into
 * the seeded version (M28.2) and to render "this is a sample" affordances.
 */
export const getMySampleProject = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(50);

    let sample: Doc<"projects"> | null = null;
    let sampleOrgSlug: string | null = null;
    let hasNonSampleProject = false;

    for (const m of memberships) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_org", (q) => q.eq("organizationId", m.organizationId))
        .take(200);

      for (const project of projects) {
        const collab = await ctx.db
          .query("projectCollaborators")
          .withIndex("by_project_and_user", (q) =>
            q.eq("projectId", project._id).eq("userId", userId),
          )
          .unique();
        if (!collab) continue;

        if (project.isSample === true) {
          if (!sample) {
            sample = project;
            const org = await ctx.db.get(m.organizationId);
            sampleOrgSlug = org?.slug ?? null;
          }
        } else {
          hasNonSampleProject = true;
        }
      }
    }

    if (!sample) {
      return { sample: null, hasNonSampleProject };
    }

    const versions = await ctx.db
      .query("promptVersions")
      .withIndex("by_project", (q) => q.eq("projectId", sample._id))
      .take(50);
    const firstVersion = versions
      .slice()
      .sort((a, b) => a.versionNumber - b.versionNumber)[0];

    return {
      sample: {
        projectId: sample._id,
        orgSlug: sampleOrgSlug,
        versionId: firstVersion?._id ?? null,
      },
      hasNonSampleProject,
    };
  },
});
