import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireProjectRole } from "./lib/auth";
import { fisherYatesShuffle } from "./lib/shuffle";
import { Id } from "./_generated/dataModel";

const MAX_QUEUE_SIZE = 200;
const MIN_OUTPUTS = 6;

const ratingValidator = v.union(
  v.literal("best"),
  v.literal("acceptable"),
  v.literal("weak"),
);

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Returns completed runs triggered by the current user that have unrated outputs. */
export const getAvailableRuns = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { userId } = await requireProjectRole(ctx, args.projectId, [
      "owner",
      "editor",
    ]);

    const runs = await ctx.db
      .query("promptRuns")
      .withIndex("by_project_and_status", (q) =>
        q.eq("projectId", args.projectId).eq("status", "completed"),
      )
      .take(200);

    // Filter to runs triggered by the current user
    const myRuns = runs.filter((r) => r.triggeredById === userId);

    const results = [];
    for (const run of myRuns) {
      const outputs = await ctx.db
        .query("runOutputs")
        .withIndex("by_run", (q) => q.eq("runId", run._id))
        .take(10);

      // Check how many outputs this user has NOT yet rated
      const myPrefs = await ctx.db
        .query("outputPreferences")
        .withIndex("by_run_user", (q) =>
          q.eq("runId", run._id).eq("userId", userId),
        )
        .take(10);

      const ratedOutputIds = new Set(myPrefs.map((p) => p.outputId as string));
      const unratedCount = outputs.filter(
        (o) => !ratedOutputIds.has(o._id as string),
      ).length;

      if (unratedCount === 0) continue;

      // Look up version number and test case name
      const version = await ctx.db.get(run.promptVersionId);
      const testCase = run.testCaseId
        ? await ctx.db.get(run.testCaseId)
        : null;

      results.push({
        runId: run._id,
        versionNumber: version?.versionNumber ?? 0,
        testCaseName: testCase?.name ?? "Inline",
        model: run.model,
        outputCount: outputs.length,
        unratedCount,
        completedAt: run.completedAt ?? run._creationTime,
      });
    }

    return results;
  },
});

/** Returns the current output to evaluate — blinding boundary. */
export const getSession = query({
  args: { sessionId: v.id("soloEvalSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    await requireProjectRole(ctx, session.projectId, ["owner", "editor"]);

    if (session.status !== "active") {
      return {
        status: session.status as "completed" | "abandoned",
        outputContent: null,
        soloLabel: null,
        totalCount: session.totalCount,
        currentIndex: session.currentIndex,
        ratedCount: session.ratedCount,
        skippedCount: session.skippedCount,
        projectId: session.projectId,
      };
    }

    // Get the current output — return ONLY content + label (blinding boundary)
    const currentItem = session.queue[session.currentIndex];
    if (!currentItem) {
      return {
        status: "completed" as const,
        outputContent: null,
        soloLabel: null,
        totalCount: session.totalCount,
        currentIndex: session.currentIndex,
        ratedCount: session.ratedCount,
        skippedCount: session.skippedCount,
        projectId: session.projectId,
      };
    }

    const output = await ctx.db.get(currentItem.outputId);

    return {
      status: "active" as const,
      outputContent: output?.outputContent ?? "",
      soloLabel: currentItem.soloLabel,
      totalCount: session.totalCount,
      currentIndex: session.currentIndex,
      ratedCount: session.ratedCount,
      skippedCount: session.skippedCount,
      projectId: session.projectId,
    };
  },
});

/** Full reveal after session completion: ratings mapped to versions + bias insights. */
export const getResults = query({
  args: { sessionId: v.id("soloEvalSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    const { userId } = await requireProjectRole(ctx, session.projectId, [
      "owner",
      "editor",
    ]);

    if (session.status !== "completed") {
      throw new Error("Session is not completed yet");
    }

    // Build full reveal for each queue item
    const items: {
      soloLabel: number;
      outputContent: string;
      rating: string | null;
      versionNumber: number;
      model: string;
      testCaseName: string;
      blindLabel: string;
      versionCreationTime: number;
    }[] = [];

    for (const queueItem of session.queue) {
      const output = await ctx.db.get(queueItem.outputId);
      if (!output) continue;

      const run = await ctx.db.get(queueItem.runId);
      if (!run) continue;

      const version = await ctx.db.get(run.promptVersionId);
      const testCase = run.testCaseId
        ? await ctx.db.get(run.testCaseId)
        : null;

      // Find user's rating for this output
      const pref = await ctx.db
        .query("outputPreferences")
        .withIndex("by_output", (q) => q.eq("outputId", queueItem.outputId))
        .filter((q) => q.eq(q.field("userId"), userId))
        .unique();

      items.push({
        soloLabel: queueItem.soloLabel,
        outputContent: output.outputContent,
        rating: pref?.rating ?? null,
        versionNumber: version?.versionNumber ?? 0,
        model: output.model ?? run.model,
        testCaseName: testCase?.name ?? "Inline",
        blindLabel: output.blindLabel,
        versionCreationTime: version?._creationTime ?? 0,
      });
    }

    // Compute bias insights (only if >= 8 rated outputs)
    const ratedItems = items.filter((i) => i.rating !== null);
    const insights: {
      type: "recency_bias" | "version_preference";
      message: string;
      severity: "info" | "warning";
    }[] = [];

    if (ratedItems.length >= 8) {
      // Recency bias: do "best" ratings cluster on newer versions?
      const ratingScore = (r: string) =>
        r === "best" ? 1 : r === "acceptable" ? 0.5 : 0;

      // Group by version number and compute average scores
      const versionScores: Record<
        number,
        { total: number; count: number; creationTime: number }
      > = {};
      for (const item of ratedItems) {
        if (!versionScores[item.versionNumber]) {
          versionScores[item.versionNumber] = {
            total: 0,
            count: 0,
            creationTime: item.versionCreationTime,
          };
        }
        versionScores[item.versionNumber]!.total += ratingScore(item.rating!);
        versionScores[item.versionNumber]!.count++;
      }

      const versions = Object.entries(versionScores)
        .map(([num, data]) => ({
          versionNumber: Number(num),
          avgScore: data.total / data.count,
          creationTime: data.creationTime,
        }))
        .sort((a, b) => a.creationTime - b.creationTime);

      if (versions.length >= 2) {
        const newest = versions[versions.length - 1]!;
        const others = versions.slice(0, -1);
        const othersAvg =
          others.reduce((sum, v) => sum + v.avgScore, 0) / others.length;

        if (newest.avgScore > othersAvg + 0.3) {
          const pct = Math.round(
            (ratedItems.filter(
              (i) =>
                i.versionNumber === newest.versionNumber &&
                i.rating === "best",
            ).length /
              ratedItems.filter((i) => i.rating === "best").length) *
              100,
          );
          insights.push({
            type: "recency_bias",
            message: `${pct}% of your "best" ratings went to v${newest.versionNumber} (your newest version). Consider whether the outputs were genuinely better or if familiarity played a role.`,
            severity: pct >= 70 ? "warning" : "info",
          });
        }
      }

      // Version preference: show average score per version
      if (versions.length >= 2) {
        const best = versions.reduce((a, b) =>
          a.avgScore > b.avgScore ? a : b,
        );
        const worst = versions.reduce((a, b) =>
          a.avgScore < b.avgScore ? a : b,
        );
        if (best.avgScore - worst.avgScore >= 0.3) {
          insights.push({
            type: "version_preference",
            message: `v${best.versionNumber} scored highest (avg ${best.avgScore.toFixed(2)}) while v${worst.versionNumber} scored lowest (avg ${worst.avgScore.toFixed(2)}).`,
            severity: "info",
          });
        }
      }
    }

    // Per-version summary
    const versionSummary: Record<
      number,
      { bestCount: number; acceptableCount: number; weakCount: number }
    > = {};
    for (const item of ratedItems) {
      if (!versionSummary[item.versionNumber]) {
        versionSummary[item.versionNumber] = {
          bestCount: 0,
          acceptableCount: 0,
          weakCount: 0,
        };
      }
      const s = versionSummary[item.versionNumber]!;
      if (item.rating === "best") s.bestCount++;
      else if (item.rating === "acceptable") s.acceptableCount++;
      else if (item.rating === "weak") s.weakCount++;
    }

    return {
      items,
      insights,
      versionSummary: Object.entries(versionSummary).map(([num, counts]) => ({
        versionNumber: Number(num),
        ...counts,
      })),
      totalRated: session.ratedCount,
      totalSkipped: session.skippedCount,
      totalCount: session.totalCount,
    };
  },
});

/** List user's solo eval sessions for a project. */
export const listSessions = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { userId } = await requireProjectRole(ctx, args.projectId, [
      "owner",
      "editor",
    ]);

    const sessions = await ctx.db
      .query("soloEvalSessions")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", userId),
      )
      .order("desc")
      .take(50);

    return sessions.map((s) => ({
      sessionId: s._id,
      status: s.status,
      totalCount: s.totalCount,
      ratedCount: s.ratedCount,
      skippedCount: s.skippedCount,
      createdAt: s._creationTime,
      completedAt: s.completedAt ?? null,
    }));
  },
});

/** Lightweight check for ProjectHome CTA. */
export const hasAvailableOutputs = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { userId } = await requireProjectRole(ctx, args.projectId, [
      "owner",
      "editor",
    ]);

    const runs = await ctx.db
      .query("promptRuns")
      .withIndex("by_project_and_status", (q) =>
        q.eq("projectId", args.projectId).eq("status", "completed"),
      )
      .take(50);

    const myRuns = runs.filter((r) => r.triggeredById === userId);

    let unratedTotal = 0;
    for (const run of myRuns) {
      const outputs = await ctx.db
        .query("runOutputs")
        .withIndex("by_run", (q) => q.eq("runId", run._id))
        .take(10);

      const myPrefs = await ctx.db
        .query("outputPreferences")
        .withIndex("by_run_user", (q) =>
          q.eq("runId", run._id).eq("userId", userId),
        )
        .take(10);

      const ratedOutputIds = new Set(myPrefs.map((p) => p.outputId as string));
      unratedTotal += outputs.filter(
        (o) => !ratedOutputIds.has(o._id as string),
      ).length;

      // Early exit once we know there are enough
      if (unratedTotal >= MIN_OUTPUTS) return true;
    }

    return false;
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Create a new solo eval session with shuffled outputs. */
export const createSession = mutation({
  args: {
    projectId: v.id("projects"),
    runIds: v.optional(v.array(v.id("promptRuns"))),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireProjectRole(ctx, args.projectId, [
      "owner",
      "editor",
    ]);

    // Check no active session exists for this user/project
    const existingActive = await ctx.db
      .query("soloEvalSessions")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", userId),
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (existingActive) {
      throw new Error(
        "You already have an active solo eval session. Complete or abandon it first.",
      );
    }

    // Gather completed runs
    let targetRuns: Id<"promptRuns">[];
    if (args.runIds && args.runIds.length > 0) {
      // Verify all runs belong to this project and are completed
      for (const runId of args.runIds) {
        const run = await ctx.db.get(runId);
        if (!run) throw new Error(`Run not found: ${runId}`);
        if (run.projectId !== args.projectId)
          throw new Error("Run does not belong to this project");
        if (run.status !== "completed")
          throw new Error("Only completed runs can be used");
      }
      targetRuns = args.runIds;
    } else {
      // Auto-select all completed runs triggered by this user
      const runs = await ctx.db
        .query("promptRuns")
        .withIndex("by_project_and_status", (q) =>
          q.eq("projectId", args.projectId).eq("status", "completed"),
        )
        .take(200);
      targetRuns = runs
        .filter((r) => r.triggeredById === userId)
        .map((r) => r._id);
    }

    // Collect all unrated outputs from these runs
    const outputItems: { outputId: Id<"runOutputs">; runId: Id<"promptRuns"> }[] = [];
    for (const runId of targetRuns) {
      const outputs = await ctx.db
        .query("runOutputs")
        .withIndex("by_run", (q) => q.eq("runId", runId))
        .take(10);

      const myPrefs = await ctx.db
        .query("outputPreferences")
        .withIndex("by_run_user", (q) =>
          q.eq("runId", runId).eq("userId", userId),
        )
        .take(10);

      const ratedOutputIds = new Set(myPrefs.map((p) => p.outputId as string));

      for (const output of outputs) {
        if (!ratedOutputIds.has(output._id as string)) {
          outputItems.push({ outputId: output._id, runId });
        }
      }
    }

    if (outputItems.length < MIN_OUTPUTS) {
      throw new Error(
        `Need at least ${MIN_OUTPUTS} unrated outputs for effective blind evaluation. You have ${outputItems.length}. Run more test cases first.`,
      );
    }

    if (outputItems.length > MAX_QUEUE_SIZE) {
      // Take a random subset
      const shuffled = fisherYatesShuffle(outputItems);
      outputItems.length = MAX_QUEUE_SIZE;
      outputItems.splice(0, outputItems.length, ...shuffled.slice(0, MAX_QUEUE_SIZE));
    }

    // Shuffle and assign sequential labels
    const shuffledItems = fisherYatesShuffle(outputItems);
    const queue = shuffledItems.map((item, index) => ({
      outputId: item.outputId,
      runId: item.runId,
      soloLabel: index + 1,
    }));

    const uniqueRunIds = [...new Set(targetRuns.map((r) => r as string))].map(
      (id) => id as Id<"promptRuns">,
    );

    const sessionId = await ctx.db.insert("soloEvalSessions", {
      projectId: args.projectId,
      userId,
      status: "active",
      queue,
      currentIndex: 0,
      totalCount: queue.length,
      ratedCount: 0,
      skippedCount: 0,
      sourceRunIds: uniqueRunIds,
    });

    await ctx.scheduler.runAfter(0, internal.analyticsActions.track, {
      event: "solo eval session created",
      distinctId: userId as string,
      properties: {
        project_id: args.projectId as string,
        session_id: sessionId as string,
        output_count: queue.length,
        run_count: uniqueRunIds.length,
      },
    });

    return sessionId;
  },
});

/** Rate the current output and advance to the next. */
export const rateCurrentOutput = mutation({
  args: {
    sessionId: v.id("soloEvalSessions"),
    rating: ratingValidator,
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.status !== "active") throw new Error("Session is not active");

    const { userId } = await requireProjectRole(ctx, session.projectId, [
      "owner",
      "editor",
    ]);
    if (session.userId !== userId) throw new Error("Permission denied");

    const currentItem = session.queue[session.currentIndex];
    if (!currentItem) throw new Error("No more outputs to rate");

    // Store rating in outputPreferences (same table as team eval)
    const existing = await ctx.db
      .query("outputPreferences")
      .withIndex("by_output", (q) => q.eq("outputId", currentItem.outputId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { rating: args.rating });
    } else {
      await ctx.db.insert("outputPreferences", {
        runId: currentItem.runId,
        outputId: currentItem.outputId,
        userId,
        rating: args.rating,
      });
    }

    // Store optional comment as output feedback
    if (args.comment && args.comment.trim()) {
      await ctx.db.insert("outputFeedback", {
        outputId: currentItem.outputId,
        userId,
        annotationData: {
          from: 0,
          to: 0,
          highlightedText: "",
          comment: args.comment.trim(),
        },
      });
    }

    const nextIndex = session.currentIndex + 1;
    const isComplete = nextIndex >= session.totalCount;

    await ctx.db.patch(args.sessionId, {
      currentIndex: nextIndex,
      ratedCount: session.ratedCount + 1,
      ...(isComplete
        ? { status: "completed" as const, completedAt: Date.now() }
        : {}),
    });

    return { nextIndex, isComplete };
  },
});

/** Skip the current output without rating. */
export const skipCurrentOutput = mutation({
  args: { sessionId: v.id("soloEvalSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.status !== "active") throw new Error("Session is not active");

    const { userId } = await requireProjectRole(ctx, session.projectId, [
      "owner",
      "editor",
    ]);
    if (session.userId !== userId) throw new Error("Permission denied");

    const nextIndex = session.currentIndex + 1;
    const isComplete = nextIndex >= session.totalCount;

    await ctx.db.patch(args.sessionId, {
      currentIndex: nextIndex,
      skippedCount: session.skippedCount + 1,
      ...(isComplete
        ? { status: "completed" as const, completedAt: Date.now() }
        : {}),
    });

    return { nextIndex, isComplete };
  },
});

/** Explicitly mark session as complete (for "finish early" button). */
export const completeSession = mutation({
  args: { sessionId: v.id("soloEvalSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.status !== "active") throw new Error("Session is not active");

    const { userId } = await requireProjectRole(ctx, session.projectId, [
      "owner",
      "editor",
    ]);
    if (session.userId !== userId) throw new Error("Permission denied");

    await ctx.db.patch(args.sessionId, {
      status: "completed",
      completedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.analyticsActions.track, {
      event: "solo eval session completed",
      distinctId: userId as string,
      properties: {
        project_id: session.projectId as string,
        session_id: args.sessionId as string,
        rated_count: session.ratedCount,
        skipped_count: session.skippedCount,
        total_count: session.totalCount,
        completion_type: "early_finish",
      },
    });
  },
});

/** Abandon an incomplete session. */
export const abandonSession = mutation({
  args: { sessionId: v.id("soloEvalSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.status !== "active") throw new Error("Session is not active");

    const { userId } = await requireProjectRole(ctx, session.projectId, [
      "owner",
      "editor",
    ]);
    if (session.userId !== userId) throw new Error("Permission denied");

    await ctx.db.patch(args.sessionId, { status: "abandoned" });
  },
});
