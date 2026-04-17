import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireProjectRole } from "./lib/auth";
import { generateToken } from "./lib/crypto";

const SHAREABLE_LINK_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

export const createCycleShareableLink = mutation({
  args: {
    cycleId: v.id("reviewCycles"),
    maxResponses: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle) throw new Error("Cycle not found");
    if (cycle.status !== "open") {
      throw new Error("Can only create shareable links for open cycles");
    }

    await requireProjectRole(ctx, cycle.projectId, ["owner", "editor"]);

    // Check for existing active general link (exclude per-email invitation links)
    const existing = await ctx.db
      .query("cycleShareableLinks")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .take(100);
    const activeLink = existing.find(
      (l) => l.active && l.purpose !== "invitation",
    );
    if (activeLink) {
      throw new Error(
        "An active shareable link already exists for this cycle",
      );
    }

    const token = generateToken();
    await ctx.db.insert("cycleShareableLinks", {
      token,
      cycleId: args.cycleId,
      projectId: cycle.projectId,
      createdById: (
        await requireProjectRole(ctx, cycle.projectId, ["owner", "editor"])
      ).userId,
      expiresAt: Date.now() + SHAREABLE_LINK_TTL_MS,
      maxResponses: args.maxResponses,
      responseCount: 0,
      active: true,
    });

    return { token };
  },
});

/** Public query — NO AUTH. Returns blind outputs for anonymous evaluation. */
export const resolveCycleShareableLink = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("cycleShareableLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!link || !link.active || link.expiresAt < Date.now()) {
      return null;
    }

    const ratingsExhausted =
      !!link.maxResponses && link.responseCount >= link.maxResponses;

    // Invitation links stay resolvable even after ratings are submitted,
    // so invitees can still add comments/annotations. General anonymous
    // links close out once maxResponses is hit.
    if (ratingsExhausted && link.purpose !== "invitation") {
      return null;
    }

    const cycle = await ctx.db.get(link.cycleId);
    if (!cycle) return null;

    const project = await ctx.db.get(link.projectId);

    const outputs = await ctx.db
      .query("cycleOutputs")
      .withIndex("by_cycle", (q) => q.eq("cycleId", link.cycleId))
      .take(26);

    // For invitation links, surface the invitee's own annotations so the
    // editor can render them. SECURITY: never include other invitees' or
    // evaluators' annotations — they could bias the viewer.
    let invitationAnnotationsByLabel: Record<
      string,
      Array<{
        from: number;
        to: number;
        highlightedText: string;
        comment: string;
      }>
    > = {};

    if (link.purpose === "invitation") {
      const invitation = await ctx.db
        .query("evalInvitations")
        .withIndex("by_shareable_link", (q) =>
          q.eq("shareableLinkId", link.token),
        )
        .first();
      if (invitation) {
        const myFeedback = await ctx.db
          .query("cycleFeedback")
          .withIndex("by_invitation", (q) =>
            q.eq("invitationId", invitation._id),
          )
          .take(200);
        for (const fb of myFeedback) {
          const output = await ctx.db.get(fb.cycleOutputId);
          if (!output) continue;
          const label = output.cycleBlindLabel;
          if (!invitationAnnotationsByLabel[label]) {
            invitationAnnotationsByLabel[label] = [];
          }
          invitationAnnotationsByLabel[label]!.push({
            from: fb.annotationData.from,
            to: fb.annotationData.to,
            highlightedText: fb.annotationData.highlightedText,
            comment: fb.annotationData.comment,
          });
        }
      }
    }

    // SECURITY: Return ONLY blind labels and content, no source info
    return {
      projectName: project?.name ?? "Unknown",
      cycleName: cycle.name,
      purpose: link.purpose ?? null,
      ratingsSubmitted: ratingsExhausted,
      outputs: outputs
        .map((o) => ({
          cycleBlindLabel: o.cycleBlindLabel,
          outputContentSnapshot: o.outputContentSnapshot,
          annotations: invitationAnnotationsByLabel[o.cycleBlindLabel] ?? [],
        }))
        .sort((a, b) =>
          a.cycleBlindLabel.localeCompare(b.cycleBlindLabel),
        ),
    };
  },
});

/** Public mutation — NO AUTH. Submit anonymous preferences. */
export const submitAnonymousCyclePreferences = mutation({
  args: {
    token: v.string(),
    sessionId: v.string(),
    ratings: v.array(
      v.object({
        cycleBlindLabel: v.string(),
        rating: v.union(
          v.literal("best"),
          v.literal("acceptable"),
          v.literal("weak"),
        ),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("cycleShareableLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!link || !link.active || link.expiresAt < Date.now()) {
      throw new Error("This link has expired or is no longer active");
    }

    if (link.maxResponses && link.responseCount >= link.maxResponses) {
      throw new Error("Maximum responses reached for this link");
    }

    // Deduplicate by sessionId
    const existing = await ctx.db
      .query("cyclePreferences")
      .withIndex("by_cycle_and_source", (q) =>
        q.eq("cycleId", link.cycleId).eq("source", "anonymous"),
      )
      .take(500);
    const alreadySubmitted = existing.some(
      (p) => p.sessionId === args.sessionId,
    );
    if (alreadySubmitted) {
      throw new Error("You have already submitted preferences");
    }

    // Insert preferences
    for (const rating of args.ratings) {
      const output = await ctx.db
        .query("cycleOutputs")
        .withIndex("by_cycle_and_label", (q) =>
          q
            .eq("cycleId", link.cycleId)
            .eq("cycleBlindLabel", rating.cycleBlindLabel),
        )
        .unique();

      if (output) {
        await ctx.db.insert("cyclePreferences", {
          cycleId: link.cycleId,
          cycleOutputId: output._id,
          rating: rating.rating,
          source: "anonymous",
          sessionId: args.sessionId,
        });
      }
    }

    // Increment response count
    await ctx.db.patch(link._id, {
      responseCount: link.responseCount + 1,
    });

    // Mark email invitation as responded if this is a per-email link
    if (link.purpose === "invitation") {
      const invitation = await ctx.db
        .query("evalInvitations")
        .withIndex("by_shareable_link", (q) =>
          q.eq("shareableLinkId", link.token),
        )
        .first();
      if (invitation && invitation.status === "pending") {
        await ctx.db.patch(invitation._id, {
          status: "responded",
          respondedAt: Date.now(),
        });
      }
    }
  },
});

/**
 * Public mutation — NO AUTH. Invited reviewers leave annotated comments.
 * Identity comes from the invitation record (email-scoped shareable link).
 */
export const addInvitedCycleFeedback = mutation({
  args: {
    token: v.string(),
    cycleBlindLabel: v.string(),
    annotationData: v.object({
      from: v.number(),
      to: v.number(),
      highlightedText: v.string(),
      comment: v.string(),
    }),
    tags: v.optional(
      v.array(
        v.union(
          v.literal("accuracy"),
          v.literal("tone"),
          v.literal("length"),
          v.literal("relevance"),
          v.literal("safety"),
          v.literal("format"),
          v.literal("clarity"),
          v.literal("other"),
        ),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("cycleShareableLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!link || !link.active || link.expiresAt < Date.now()) {
      throw new Error("This link has expired or is no longer active");
    }
    if (link.purpose !== "invitation") {
      throw new Error("This link does not support comments");
    }

    const cycle = await ctx.db.get(link.cycleId);
    if (!cycle || cycle.status !== "open") {
      throw new Error("Cycle is not open for evaluation");
    }

    const invitation = await ctx.db
      .query("evalInvitations")
      .withIndex("by_shareable_link", (q) =>
        q.eq("shareableLinkId", link.token),
      )
      .first();
    if (!invitation) throw new Error("Invitation not found");

    const output = await ctx.db
      .query("cycleOutputs")
      .withIndex("by_cycle_and_label", (q) =>
        q
          .eq("cycleId", link.cycleId)
          .eq("cycleBlindLabel", args.cycleBlindLabel),
      )
      .unique();
    if (!output) throw new Error("Output not found");

    await ctx.db.insert("cycleFeedback", {
      cycleId: link.cycleId,
      cycleOutputId: output._id,
      invitationId: invitation._id,
      annotationData: args.annotationData,
      tags: args.tags,
      source: "invited",
    });
  },
});

/** Get anonymous results for a cycle. Owner/editor only. */
export const getCycleAnonymousResults = query({
  args: { cycleId: v.id("reviewCycles") },
  handler: async (ctx, args) => {
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle) throw new Error("Cycle not found");

    await requireProjectRole(ctx, cycle.projectId, ["owner", "editor"]);

    const anonPreferences = await ctx.db
      .query("cyclePreferences")
      .withIndex("by_cycle_and_source", (q) =>
        q.eq("cycleId", args.cycleId).eq("source", "anonymous"),
      )
      .take(500);

    // Aggregate per output
    const aggregated: Record<
      string,
      { best: number; acceptable: number; weak: number }
    > = {};

    for (const pref of anonPreferences) {
      const output = await ctx.db.get(pref.cycleOutputId);
      if (!output) continue;
      const label = output.cycleBlindLabel;
      if (!aggregated[label]) {
        aggregated[label] = { best: 0, acceptable: 0, weak: 0 };
      }
      aggregated[label][pref.rating]++;
    }

    // Count unique sessions
    const sessionIds = new Set(
      anonPreferences.map((p) => p.sessionId).filter(Boolean),
    );

    return {
      totalResponses: sessionIds.size,
      aggregated,
    };
  },
});

/** Deactivate a shareable link. */
export const deactivateCycleShareableLink = mutation({
  args: { cycleId: v.id("reviewCycles") },
  handler: async (ctx, args) => {
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle) throw new Error("Cycle not found");

    await requireProjectRole(ctx, cycle.projectId, ["owner", "editor"]);

    const links = await ctx.db
      .query("cycleShareableLinks")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .take(10);

    for (const link of links) {
      if (link.active) {
        await ctx.db.patch(link._id, { active: false });
      }
    }
  },
});
