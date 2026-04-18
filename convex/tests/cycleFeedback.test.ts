import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

async function seedCycleEnv() {
  const t = convexTest(schema);

  const ids = await t.run(async (ctx) => {
    const ownerUserId = await ctx.db.insert("users", {
      name: "Owner User",
      email: "owner@test.com",
    });
    const evaluatorUserId = await ctx.db.insert("users", {
      name: "Evaluator User",
      email: "evaluator@test.com",
    });
    const outsiderUserId = await ctx.db.insert("users", {
      name: "Outsider",
      email: "outsider@test.com",
    });

    const orgId = await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      createdById: ownerUserId,
    });
    const projectId = await ctx.db.insert("projects", {
      organizationId: orgId,
      name: "Test Project",
      createdById: ownerUserId,
    });
    await ctx.db.insert("projectCollaborators", {
      projectId,
      userId: ownerUserId,
      role: "owner",
      invitedById: ownerUserId,
      invitedAt: Date.now(),
    });
    await ctx.db.insert("projectCollaborators", {
      projectId,
      userId: evaluatorUserId,
      role: "evaluator",
      invitedById: ownerUserId,
      invitedAt: Date.now(),
    });

    const versionId = await ctx.db.insert("promptVersions", {
      projectId,
      versionNumber: 1,
      userMessageTemplate: "Hello {{name}}",
      status: "current",
      createdById: ownerUserId,
    });
    const testCaseId = await ctx.db.insert("testCases", {
      projectId,
      name: "TC1",
      variableValues: {},
      attachmentIds: [],
      order: 0,
      createdById: ownerUserId,
    });
    const runId = await ctx.db.insert("promptRuns", {
      projectId,
      promptVersionId: versionId,
      testCaseId,
      model: "openai/gpt-4",
      temperature: 0.7,
      status: "completed",
      completedAt: Date.now(),
      triggeredById: ownerUserId,
    });
    const sourceOutputId = await ctx.db.insert("runOutputs", {
      runId,
      blindLabel: "A",
      outputContent: "Source output text",
    });

    const cycleId = await ctx.db.insert("reviewCycles", {
      projectId,
      primaryVersionId: versionId,
      name: "Cycle 1",
      status: "open",
      includeSoloEval: false,
      createdById: ownerUserId,
      openedAt: Date.now(),
    });

    const cycleOutputId = await ctx.db.insert("cycleOutputs", {
      cycleId,
      sourceOutputId,
      sourceRunId: runId,
      sourceVersionId: versionId,
      cycleBlindLabel: "A",
      outputContentSnapshot: "Source output text",
    });

    return {
      ownerUserId,
      evaluatorUserId,
      outsiderUserId,
      projectId,
      versionId,
      cycleId,
      cycleOutputId,
    };
  });

  const asOwner = t.withIdentity({
    subject: `${ids.ownerUserId}|test-session-owner`,
    tokenIdentifier: `test|${ids.ownerUserId}`,
  });
  const asEvaluator = t.withIdentity({
    subject: `${ids.evaluatorUserId}|test-session-evaluator`,
    tokenIdentifier: `test|${ids.evaluatorUserId}`,
  });
  const asOutsider = t.withIdentity({
    subject: `${ids.outsiderUserId}|test-session-outsider`,
    tokenIdentifier: `test|${ids.outsiderUserId}`,
  });

  return { t, ids, asOwner, asEvaluator, asOutsider };
}

describe("listCycleFeedback", () => {
  test("owner sees comments grouped by output with author names", async () => {
    const { t, ids, asOwner } = await seedCycleEnv();

    await t.run(async (ctx) => {
      await ctx.db.insert("cycleFeedback", {
        cycleId: ids.cycleId,
        cycleOutputId: ids.cycleOutputId,
        userId: ids.evaluatorUserId,
        annotationData: {
          from: 0,
          to: 6,
          highlightedText: "Source",
          comment: "Needs more detail here",
        },
        tags: ["clarity"],
        source: "evaluator",
      });
    });

    const result = await asOwner.query(
      api.reviewCycles.listCycleFeedback,
      { cycleId: ids.cycleId },
    );

    expect(result.totalCount).toBe(1);
    expect(result.outputCount).toBe(1);
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.comments).toHaveLength(1);
    expect(result.outputs[0]!.comments[0]!.authorLabel).toBe("Evaluator User");
    expect(result.outputs[0]!.comments[0]!.comment).toBe(
      "Needs more detail here",
    );
    expect(result.outputs[0]!.comments[0]!.tags).toEqual(["clarity"]);
  });

  test("matches commenter's rating on the same output", async () => {
    const { t, ids, asOwner } = await seedCycleEnv();

    await t.run(async (ctx) => {
      await ctx.db.insert("cyclePreferences", {
        cycleId: ids.cycleId,
        cycleOutputId: ids.cycleOutputId,
        userId: ids.evaluatorUserId,
        rating: "weak",
        source: "evaluator",
      });
      await ctx.db.insert("cycleFeedback", {
        cycleId: ids.cycleId,
        cycleOutputId: ids.cycleOutputId,
        userId: ids.evaluatorUserId,
        annotationData: {
          from: 0,
          to: 6,
          highlightedText: "Source",
          comment: "Weak because tone is off",
        },
        source: "evaluator",
      });
    });

    const result = await asOwner.query(
      api.reviewCycles.listCycleFeedback,
      { cycleId: ids.cycleId },
    );

    expect(result.outputs[0]!.comments[0]!.rating).toBe("weak");
  });

  test("anonymous commenter shows 'Anonymous reviewer' label", async () => {
    const { t, ids, asOwner } = await seedCycleEnv();

    await t.run(async (ctx) => {
      await ctx.db.insert("cycleFeedback", {
        cycleId: ids.cycleId,
        cycleOutputId: ids.cycleOutputId,
        annotationData: {
          from: 0,
          to: 6,
          highlightedText: "Source",
          comment: "Great output",
        },
        source: "anonymous",
        sessionId: "sess-1",
      });
    });

    const result = await asOwner.query(
      api.reviewCycles.listCycleFeedback,
      { cycleId: ids.cycleId },
    );

    expect(result.outputs[0]!.comments[0]!.authorLabel).toBe(
      "Anonymous reviewer",
    );
    expect(result.outputs[0]!.comments[0]!.source).toBe("anonymous");
  });

  test("non-member is denied access", async () => {
    const { ids, asOutsider } = await seedCycleEnv();

    await expect(
      asOutsider.query(api.reviewCycles.listCycleFeedback, {
        cycleId: ids.cycleId,
      }),
    ).rejects.toThrow();
  });

  test("evaluator role is denied (owner/editor only)", async () => {
    const { ids, asEvaluator } = await seedCycleEnv();

    await expect(
      asEvaluator.query(api.reviewCycles.listCycleFeedback, {
        cycleId: ids.cycleId,
      }),
    ).rejects.toThrow();
  });

  test("empty cycle returns zero counts", async () => {
    const { ids, asOwner } = await seedCycleEnv();

    const result = await asOwner.query(
      api.reviewCycles.listCycleFeedback,
      { cycleId: ids.cycleId },
    );

    expect(result.totalCount).toBe(0);
    expect(result.outputCount).toBe(0);
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.comments).toHaveLength(0);
  });
});

describe("listCycleFeedbackForVersion", () => {
  test("aggregates comments across multiple cycles for a version", async () => {
    const { t, ids, asOwner } = await seedCycleEnv();

    // Create a second cycle on the same primary version with its own output +
    // comment.
    const { secondCycleId, secondOutputId } = await t.run(async (ctx) => {
      const secondCycleId = await ctx.db.insert("reviewCycles", {
        projectId: ids.projectId,
        primaryVersionId: ids.versionId,
        name: "Cycle 2",
        status: "closed",
        includeSoloEval: false,
        createdById: ids.ownerUserId,
        openedAt: Date.now() - 10_000,
        closedAt: Date.now() - 5_000,
      });

      // Need a run/source output for the second cycle.
      const testCaseId = await ctx.db.insert("testCases", {
        projectId: ids.projectId,
        name: "TC2",
        variableValues: {},
        attachmentIds: [],
        order: 1,
        createdById: ids.ownerUserId,
      });
      const runId = await ctx.db.insert("promptRuns", {
        projectId: ids.projectId,
        promptVersionId: ids.versionId,
        testCaseId,
        model: "openai/gpt-4",
        temperature: 0.7,
        status: "completed",
        completedAt: Date.now(),
        triggeredById: ids.ownerUserId,
      });
      const sourceOutputId = await ctx.db.insert("runOutputs", {
        runId,
        blindLabel: "A",
        outputContent: "Output 2",
      });
      const secondOutputId = await ctx.db.insert("cycleOutputs", {
        cycleId: secondCycleId,
        sourceOutputId,
        sourceRunId: runId,
        sourceVersionId: ids.versionId,
        cycleBlindLabel: "A",
        outputContentSnapshot: "Output 2",
      });

      return { secondCycleId, secondOutputId };
    });

    // Add one comment per cycle.
    await t.run(async (ctx) => {
      await ctx.db.insert("cycleFeedback", {
        cycleId: ids.cycleId,
        cycleOutputId: ids.cycleOutputId,
        userId: ids.evaluatorUserId,
        annotationData: {
          from: 0,
          to: 6,
          highlightedText: "Source",
          comment: "Comment on cycle 1",
        },
        source: "evaluator",
      });
      await ctx.db.insert("cycleFeedback", {
        cycleId: secondCycleId,
        cycleOutputId: secondOutputId,
        userId: ids.evaluatorUserId,
        annotationData: {
          from: 0,
          to: 6,
          highlightedText: "Output",
          comment: "Comment on cycle 2",
        },
        source: "evaluator",
      });
    });

    const result = await asOwner.query(
      api.reviewCycles.listCycleFeedbackForVersion,
      { versionId: ids.versionId },
    );

    expect(result.totalCount).toBe(2);
    expect(result.cycles).toHaveLength(2);
    // Newest cycle first (Cycle 1 opened at Date.now(), Cycle 2 at Date.now() - 10_000)
    expect(result.cycles[0]!.name).toBe("Cycle 1");
    expect(result.cycles[1]!.name).toBe("Cycle 2");
  });

  test("omits cycles that have zero comments on this version's outputs", async () => {
    const { ids, asOwner } = await seedCycleEnv();

    const result = await asOwner.query(
      api.reviewCycles.listCycleFeedbackForVersion,
      { versionId: ids.versionId },
    );

    expect(result.totalCount).toBe(0);
    expect(result.cycles).toEqual([]);
  });

  test("non-member is denied access", async () => {
    const { ids, asOutsider } = await seedCycleEnv();

    await expect(
      asOutsider.query(api.reviewCycles.listCycleFeedbackForVersion, {
        versionId: ids.versionId,
      }),
    ).rejects.toThrow();
  });
});
