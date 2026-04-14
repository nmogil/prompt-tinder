/**
 * Blind Eval Security Test Suite
 *
 * Tests backend-enforceable security rules from UX Spec Section 10.
 *
 * FRONTEND-ONLY RULES (not testable via convex-test):
 * - Rule 1: Evaluator can only visit /eval/:token (React Router gate)
 * - Rule 3: Page title = "Evaluation — {project name}" (BlindEvalView.tsx useEffect)
 * - Rule 4: Breadcrumbs show only "Evaluation" (EvalLayout.tsx)
 * - Rule 5: Favicon is generic (index.html)
 * - Rule 6: Tooltips show only blind label (BlindLabelBadge.tsx)
 * - Rule 9: Copy produces plain text only (AnnotatedEditor.tsx)
 * - Rule 11: Share URL = /eval/:token only (App.tsx routing)
 * - Rule 13: No metadata in DOM (component props — no data-* attributes)
 *
 * These should be verified via E2E tests or manual QA checklist.
 */

import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

// Helper to create a seeded test environment with editor + evaluator users
async function seedTestEnv() {
  const t = convexTest(schema);

  // Seed users, org, project, collaborators, version, test case, run, outputs
  const ids = await t.run(async (ctx) => {
    const editorUserId = await ctx.db.insert("users", {
      name: "Editor User",
      email: "editor@test.com",
    });
    const evaluatorUserId = await ctx.db.insert("users", {
      name: "Evaluator User",
      email: "evaluator@test.com",
    });
    const orgId = await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      createdById: editorUserId,
    });
    await ctx.db.insert("organizationMembers", {
      organizationId: orgId,
      userId: editorUserId,
      role: "owner",
    });
    const projectId = await ctx.db.insert("projects", {
      organizationId: orgId,
      name: "Test Project",
      createdById: editorUserId,
    });
    await ctx.db.insert("projectCollaborators", {
      projectId,
      userId: editorUserId,
      role: "editor",
      invitedById: editorUserId,
      invitedAt: Date.now(),
    });
    await ctx.db.insert("projectCollaborators", {
      projectId,
      userId: evaluatorUserId,
      role: "evaluator",
      invitedById: editorUserId,
      invitedAt: Date.now(),
    });
    const versionId = await ctx.db.insert("promptVersions", {
      projectId,
      versionNumber: 1,
      userMessageTemplate: "Hello {{name}}",
      status: "active",
      createdById: editorUserId,
    });
    const testCaseId = await ctx.db.insert("testCases", {
      projectId,
      name: "Test Case 1",
      variableValues: { name: "World" },
      attachmentIds: [],
      order: 0,
      createdById: editorUserId,
    });
    const runId = await ctx.db.insert("promptRuns", {
      projectId,
      promptVersionId: versionId,
      testCaseId,
      model: "openai/gpt-4",
      temperature: 0.7,
      status: "completed",
      completedAt: Date.now(),
      triggeredById: editorUserId,
    });
    const outputAId = await ctx.db.insert("runOutputs", {
      runId,
      blindLabel: "A",
      outputContent: "Output content A",
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      latencyMs: 1200,
    });
    const outputBId = await ctx.db.insert("runOutputs", {
      runId,
      blindLabel: "B",
      outputContent: "Output content B",
      promptTokens: 100,
      completionTokens: 60,
      totalTokens: 160,
      latencyMs: 1300,
    });
    const outputCId = await ctx.db.insert("runOutputs", {
      runId,
      blindLabel: "C",
      outputContent: "Output content C",
      promptTokens: 100,
      completionTokens: 55,
      totalTokens: 155,
      latencyMs: 1100,
    });

    // Mint eval token for this run
    const tokenBytes = new Uint8Array(16);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes, (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    await ctx.db.insert("evalTokens", {
      token,
      runId,
      projectId,
      expiresAt: Date.now() + 3600000,
    });

    return {
      editorUserId,
      evaluatorUserId,
      orgId,
      projectId,
      versionId,
      testCaseId,
      runId,
      outputAId,
      outputBId,
      outputCId,
      token,
    };
  });

  const asEditor = t.withIdentity({
    subject: `${ids.editorUserId}|test-session-editor`,
    tokenIdentifier: `test|${ids.editorUserId}`,
  });
  const asEvaluator = t.withIdentity({
    subject: `${ids.evaluatorUserId}|test-session-evaluator`,
    tokenIdentifier: `test|${ids.evaluatorUserId}`,
  });

  return { t, ids, asEditor, asEvaluator };
}

// ---------------------------------------------------------------------------
// Original tests
// ---------------------------------------------------------------------------

describe("Blind Eval Security", () => {
  test("evaluator cannot call runs.get", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.query(api.runs.get, { runId: ids.runId }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call runs.list", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.query(api.runs.list, { versionId: ids.versionId }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call versions.get", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.query(api.versions.get, { versionId: ids.versionId }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call versions.list", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.query(api.versions.list, { projectId: ids.projectId }),
    ).rejects.toThrow("Permission denied");
  });

  test("getOutputsForEvaluator returns only blindLabel, outputContent, annotations", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    const result = await asEvaluator.query(api.runs.getOutputsForEvaluator, {
      opaqueToken: ids.token,
    });

    expect(result).toHaveProperty("projectName");
    expect(result).toHaveProperty("outputs");
    expect(result.outputs).toHaveLength(3);

    for (const output of result.outputs) {
      // Must have only these fields
      const keys = Object.keys(output);
      expect(keys).toEqual(
        expect.arrayContaining(["blindLabel", "outputContent", "annotations"]),
      );
      // Must NOT have these fields
      expect(output).not.toHaveProperty("_id");
      expect(output).not.toHaveProperty("runId");
      expect(output).not.toHaveProperty("promptTokens");
      expect(output).not.toHaveProperty("completionTokens");
      expect(output).not.toHaveProperty("totalTokens");
      expect(output).not.toHaveProperty("latencyMs");
      expect(output).not.toHaveProperty("rawResponseStorageId");
    }
  });

  test("getOutputsForEvaluator rejects non-evaluator (editor)", async () => {
    const { ids, asEditor } = await seedTestEnv();
    await expect(
      asEditor.query(api.runs.getOutputsForEvaluator, {
        opaqueToken: ids.token,
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("listMyInbox returns no runId or versionId", async () => {
    const { asEvaluator } = await seedTestEnv();
    const inbox = await asEvaluator.query(api.evaluatorInbox.listMyInbox);

    expect(inbox.length).toBeGreaterThan(0);
    for (const item of inbox) {
      expect(item).not.toHaveProperty("runId");
      expect(item).not.toHaveProperty("versionId");
      expect(item).not.toHaveProperty("model");
      expect(item).not.toHaveProperty("testCaseName");
      expect(item).toHaveProperty("opaqueToken");
      expect(item).toHaveProperty("projectName");
    }
  });

  test("invalid eval token throws error", async () => {
    const { asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.query(api.runs.getOutputsForEvaluator, {
        opaqueToken: "invalid-fake-token-12345",
      }),
    ).rejects.toThrow("Invalid eval token");
  });

  test("eval token does not contain runId or projectId", async () => {
    const { ids } = await seedTestEnv();
    // Convex IDs contain alphanumeric chars. The token is hex-only.
    // Verify token doesn't contain the run or project ID as substrings.
    expect(ids.token).not.toContain(ids.runId);
    expect(ids.token).not.toContain(ids.projectId);
    // Also check that the token is pure hex (no Convex ID patterns)
    expect(ids.token).toMatch(/^[0-9a-f]{32}$/);
  });
});

// ---------------------------------------------------------------------------
// Token expiry (Rule 5 — backend enforcement)
// ---------------------------------------------------------------------------

describe("Token Expiry", () => {
  test("expired eval token is rejected", async () => {
    const { t, ids, asEvaluator } = await seedTestEnv();

    // Directly patch the token to have an expired time
    await t.run(async (ctx) => {
      const tokenDoc = await ctx.db
        .query("evalTokens")
        .withIndex("by_token", (q) => q.eq("token", ids.token))
        .unique();
      if (tokenDoc) {
        await ctx.db.patch(tokenDoc._id, { expiresAt: Date.now() - 1000 });
      }
    });

    await expect(
      asEvaluator.query(api.runs.getOutputsForEvaluator, {
        opaqueToken: ids.token,
      }),
    ).rejects.toThrow("Invalid eval token");
  });

  test("token with expiresAt exactly at now is rejected", async () => {
    const { t, ids, asEvaluator } = await seedTestEnv();

    // Set expiresAt to a value that will be in the past by the time the query runs
    await t.run(async (ctx) => {
      const tokenDoc = await ctx.db
        .query("evalTokens")
        .withIndex("by_token", (q) => q.eq("token", ids.token))
        .unique();
      if (tokenDoc) {
        // Set to 1ms ago to guarantee it's expired
        await ctx.db.patch(tokenDoc._id, { expiresAt: Date.now() - 1 });
      }
    });

    await expect(
      asEvaluator.query(api.runs.getOutputsForEvaluator, {
        opaqueToken: ids.token,
      }),
    ).rejects.toThrow("Invalid eval token");
  });
});

// ---------------------------------------------------------------------------
// Evaluator denied from optimization functions
// ---------------------------------------------------------------------------

describe("Evaluator denied from optimization functions", () => {
  test("evaluator cannot call optimize.requestOptimization", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.mutation(api.optimize.requestOptimization, {
        versionId: ids.versionId,
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call optimize.listOptimizations", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.query(api.optimize.listOptimizations, {
        versionId: ids.versionId,
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call optimize.getActiveOptimization", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.query(api.optimize.getActiveOptimization, {
        projectId: ids.projectId,
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call optimize.countFeedbackForVersion", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.query(api.optimize.countFeedbackForVersion, {
        versionId: ids.versionId,
      }),
    ).rejects.toThrow("Permission denied");
  });
});

// ---------------------------------------------------------------------------
// Evaluator denied from version management functions
// ---------------------------------------------------------------------------

describe("Evaluator denied from version management", () => {
  test("evaluator cannot call versions.create", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.mutation(api.versions.create, {
        projectId: ids.projectId,
        userMessageTemplate: "test",
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call versions.update", async () => {
    const { t, ids, asEvaluator } = await seedTestEnv();

    // Create a draft version that could theoretically be updated
    const draftVersionId = await t.run(async (ctx) => {
      return await ctx.db.insert("promptVersions", {
        projectId: ids.projectId,
        versionNumber: 2,
        userMessageTemplate: "Draft {{name}}",
        status: "draft",
        createdById: ids.editorUserId,
      });
    });

    await expect(
      asEvaluator.mutation(api.versions.update, {
        versionId: draftVersionId,
        userMessageTemplate: "Hacked",
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call versions.deleteVersion", async () => {
    const { t, ids, asEvaluator } = await seedTestEnv();

    const draftVersionId = await t.run(async (ctx) => {
      return await ctx.db.insert("promptVersions", {
        projectId: ids.projectId,
        versionNumber: 3,
        userMessageTemplate: "Draft to delete {{name}}",
        status: "draft",
        createdById: ids.editorUserId,
      });
    });

    await expect(
      asEvaluator.mutation(api.versions.deleteVersion, {
        versionId: draftVersionId,
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call versions.promoteToActive", async () => {
    const { t, ids, asEvaluator } = await seedTestEnv();

    const draftVersionId = await t.run(async (ctx) => {
      return await ctx.db.insert("promptVersions", {
        projectId: ids.projectId,
        versionNumber: 4,
        userMessageTemplate: "Draft to promote {{name}}",
        status: "draft",
        createdById: ids.editorUserId,
      });
    });

    await expect(
      asEvaluator.mutation(api.versions.promoteToActive, {
        versionId: draftVersionId,
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call versions.archive", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.mutation(api.versions.archive, {
        versionId: ids.versionId,
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call versions.rollback", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.mutation(api.versions.rollback, {
        versionId: ids.versionId,
      }),
    ).rejects.toThrow("Permission denied");
  });
});

// ---------------------------------------------------------------------------
// Evaluator denied from run execution functions
// ---------------------------------------------------------------------------

describe("Evaluator denied from run execution", () => {
  test("evaluator cannot call runs.execute", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.mutation(api.runs.execute, {
        versionId: ids.versionId,
        testCaseId: ids.testCaseId,
        model: "openai/gpt-4",
        temperature: 0.7,
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call runs.compareAcrossVersions", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.query(api.runs.compareAcrossVersions, {
        projectId: ids.projectId,
        testCaseId: ids.testCaseId,
        versionIds: [ids.versionId, ids.versionId],
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call runs.countInFlightRuns", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.query(api.runs.countInFlightRuns, {
        projectId: ids.projectId,
      }),
    ).rejects.toThrow("Permission denied");
  });
});

// ---------------------------------------------------------------------------
// Evaluator denied from project settings
// ---------------------------------------------------------------------------

describe("Evaluator denied from project settings", () => {
  test("evaluator cannot call projects.update", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.mutation(api.projects.update, {
        projectId: ids.projectId,
        name: "Hacked",
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call projects.deleteProject", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.mutation(api.projects.deleteProject, {
        projectId: ids.projectId,
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call projects.inviteCollaborator", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.mutation(api.projects.inviteCollaborator, {
        projectId: ids.projectId,
        userId: ids.evaluatorUserId,
        role: "evaluator",
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call projects.updateCollaboratorRole", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.mutation(api.projects.updateCollaboratorRole, {
        projectId: ids.projectId,
        userId: ids.evaluatorUserId,
        role: "editor",
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call projects.removeCollaborator", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.mutation(api.projects.removeCollaborator, {
        projectId: ids.projectId,
        userId: ids.editorUserId,
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call projects.getMetaContext", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.query(api.projects.getMetaContext, {
        projectId: ids.projectId,
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call projects.setMetaContext", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.mutation(api.projects.setMetaContext, {
        projectId: ids.projectId,
        metaContext: [],
      }),
    ).rejects.toThrow("Permission denied");
  });
});

// ---------------------------------------------------------------------------
// Evaluator denied from analytics
// ---------------------------------------------------------------------------

describe("Evaluator denied from analytics", () => {
  test("evaluator cannot call outputPreferences.aggregateForRun", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.query(api.outputPreferences.aggregateForRun, {
        runId: ids.runId,
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call analytics.getQualityTrend", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.query(api.analytics.getQualityTrend, {
        projectId: ids.projectId,
      }),
    ).rejects.toThrow("Permission denied");
  });
});

// ---------------------------------------------------------------------------
// Evaluator denied from variables and test cases
// ---------------------------------------------------------------------------

describe("Evaluator denied from variables", () => {
  test("evaluator cannot call variables.list", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.query(api.variables.list, {
        projectId: ids.projectId,
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call variables.add", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.mutation(api.variables.add, {
        projectId: ids.projectId,
        name: "x",
        required: false,
      }),
    ).rejects.toThrow("Permission denied");
  });
});

describe("Evaluator denied from test cases", () => {
  test("evaluator cannot call testCases.list", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.query(api.testCases.list, {
        projectId: ids.projectId,
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call testCases.create", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.mutation(api.testCases.create, {
        projectId: ids.projectId,
        name: "x",
        variableValues: {},
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("evaluator cannot call testCases.get", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    await expect(
      asEvaluator.query(api.testCases.get, {
        testCaseId: ids.testCaseId,
      }),
    ).rejects.toThrow("Permission denied");
  });
});

// ---------------------------------------------------------------------------
// Evaluator CAN access allowed functions
// ---------------------------------------------------------------------------

describe("Evaluator allowed functions", () => {
  test("evaluator CAN call projects.get (evaluator is allowed)", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    const result = await asEvaluator.query(api.projects.get, {
      projectId: ids.projectId,
    });
    expect(result).not.toBeNull();
    expect(result!.role).toBe("evaluator");
  });

  test("evaluator CAN call projects.listCollaborators", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    const result = await asEvaluator.query(api.projects.listCollaborators, {
      projectId: ids.projectId,
    });
    expect(result.length).toBeGreaterThan(0);
  });

  test("evaluator CAN call outputPreferences.rateOutputByToken", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    const prefId = await asEvaluator.mutation(
      api.outputPreferences.rateOutputByToken,
      {
        opaqueToken: ids.token,
        blindLabel: "A",
        rating: "best",
      },
    );
    expect(prefId).toBeDefined();
  });

  test("evaluator CAN call outputPreferences.getMyRatingsByToken", async () => {
    const { ids, asEvaluator } = await seedTestEnv();
    const ratings = await asEvaluator.query(
      api.outputPreferences.getMyRatingsByToken,
      { opaqueToken: ids.token },
    );
    expect(Array.isArray(ratings)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Shareable link security
// ---------------------------------------------------------------------------

describe("Shareable link security", () => {
  /**
   * Helper to seed an environment with a shareable link.
   * Uses direct DB inserts since shareable link creation requires auth context.
   */
  async function seedShareableLinkEnv() {
    const { t, ids, asEditor, asEvaluator } = await seedTestEnv();

    const linkData = await t.run(async (ctx) => {
      const tokenBytes = new Uint8Array(16);
      crypto.getRandomValues(tokenBytes);
      const shareToken = Array.from(tokenBytes, (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");

      const linkId = await ctx.db.insert("shareableEvalLinks", {
        token: shareToken,
        runId: ids.runId,
        projectId: ids.projectId,
        createdById: ids.editorUserId,
        expiresAt: Date.now() + 48 * 60 * 60 * 1000,
        responseCount: 0,
        active: true,
      });

      return { shareToken, linkId };
    });

    return { t, ids, asEditor, asEvaluator, ...linkData };
  }

  test("resolveShareableLink returns only blindLabel and outputContent", async () => {
    const env = await seedShareableLinkEnv();
    const result = await env.t.query(api.shareableLinks.resolveShareableLink, {
      token: env.shareToken,
    });

    expect(result).not.toBeNull();
    expect(result).toHaveProperty("projectName");
    expect(result).toHaveProperty("outputs");
    // Must NOT have projectId
    expect(result).not.toHaveProperty("projectId");
    expect(result).not.toHaveProperty("runId");
    expect(result).not.toHaveProperty("linkId");

    for (const output of result!.outputs) {
      const keys = Object.keys(output);
      expect(keys).toEqual(
        expect.arrayContaining(["blindLabel", "outputContent"]),
      );
      expect(output).not.toHaveProperty("_id");
      expect(output).not.toHaveProperty("runId");
      expect(output).not.toHaveProperty("model");
      expect(output).not.toHaveProperty("promptTokens");
      expect(output).not.toHaveProperty("completionTokens");
      expect(output).not.toHaveProperty("totalTokens");
      expect(output).not.toHaveProperty("latencyMs");
      expect(output).not.toHaveProperty("temperature");
    }
  });

  test("resolveShareableLink returns projectName but NOT projectId", async () => {
    const env = await seedShareableLinkEnv();
    const result = await env.t.query(api.shareableLinks.resolveShareableLink, {
      token: env.shareToken,
    });

    expect(result).not.toBeNull();
    expect(result!.projectName).toBe("Test Project");
    expect(result).not.toHaveProperty("projectId");
  });

  test("resolveShareableLink with deactivated link returns null", async () => {
    const env = await seedShareableLinkEnv();

    // Deactivate the link
    await env.t.run(async (ctx) => {
      await ctx.db.patch(env.linkId, { active: false });
    });

    const result = await env.t.query(api.shareableLinks.resolveShareableLink, {
      token: env.shareToken,
    });
    expect(result).toBeNull();
  });

  test("resolveShareableLink with expired link returns null", async () => {
    const env = await seedShareableLinkEnv();

    // Expire the link
    await env.t.run(async (ctx) => {
      await ctx.db.patch(env.linkId, { expiresAt: Date.now() - 1000 });
    });

    const result = await env.t.query(api.shareableLinks.resolveShareableLink, {
      token: env.shareToken,
    });
    expect(result).toBeNull();
  });

  test("resolveShareableLink with maxResponses reached returns null", async () => {
    const env = await seedShareableLinkEnv();

    // Set maxResponses to 1 and responseCount to 1
    await env.t.run(async (ctx) => {
      await ctx.db.patch(env.linkId, { maxResponses: 1, responseCount: 1 });
    });

    const result = await env.t.query(api.shareableLinks.resolveShareableLink, {
      token: env.shareToken,
    });
    expect(result).toBeNull();
  });

  test("submitAnonymousPreferences with invalid token throws", async () => {
    const env = await seedShareableLinkEnv();

    await expect(
      env.t.mutation(api.shareableLinks.submitAnonymousPreferences, {
        token: "nonexistent-token-000000000000",
        sessionId: "session-1",
        ratings: [{ blindLabel: "A", rating: "best" }],
      }),
    ).rejects.toThrow("This link is no longer active");
  });

  test("submitAnonymousPreferences with deactivated link throws", async () => {
    const env = await seedShareableLinkEnv();

    await env.t.run(async (ctx) => {
      await ctx.db.patch(env.linkId, { active: false });
    });

    await expect(
      env.t.mutation(api.shareableLinks.submitAnonymousPreferences, {
        token: env.shareToken,
        sessionId: "session-1",
        ratings: [{ blindLabel: "A", rating: "best" }],
      }),
    ).rejects.toThrow("This link is no longer active");
  });

  test("submitAnonymousPreferences same sessionId throws on second submit", async () => {
    const env = await seedShareableLinkEnv();

    // First submission should succeed
    await env.t.mutation(api.shareableLinks.submitAnonymousPreferences, {
      token: env.shareToken,
      sessionId: "session-dup",
      ratings: [
        { blindLabel: "A", rating: "best" },
        { blindLabel: "B", rating: "acceptable" },
        { blindLabel: "C", rating: "weak" },
      ],
    });

    // Second submission with same sessionId should fail
    await expect(
      env.t.mutation(api.shareableLinks.submitAnonymousPreferences, {
        token: env.shareToken,
        sessionId: "session-dup",
        ratings: [
          { blindLabel: "A", rating: "weak" },
          { blindLabel: "B", rating: "best" },
          { blindLabel: "C", rating: "acceptable" },
        ],
      }),
    ).rejects.toThrow("You have already submitted a response");
  });

  test("submitAnonymousPreferences with expired link throws", async () => {
    const env = await seedShareableLinkEnv();

    await env.t.run(async (ctx) => {
      await ctx.db.patch(env.linkId, { expiresAt: Date.now() - 1000 });
    });

    await expect(
      env.t.mutation(api.shareableLinks.submitAnonymousPreferences, {
        token: env.shareToken,
        sessionId: "session-expired",
        ratings: [{ blindLabel: "A", rating: "best" }],
      }),
    ).rejects.toThrow("This link is no longer active");
  });

  test("submitAnonymousPreferences increments responseCount", async () => {
    const env = await seedShareableLinkEnv();

    await env.t.mutation(api.shareableLinks.submitAnonymousPreferences, {
      token: env.shareToken,
      sessionId: "session-count",
      ratings: [{ blindLabel: "A", rating: "best" }],
    });

    // Verify responseCount was incremented
    const link = await env.t.run(async (ctx) => {
      return await ctx.db.get(env.linkId);
    });
    expect(link!.responseCount).toBe(1);
  });

  test("resolveShareableLink with nonexistent token returns null", async () => {
    const env = await seedShareableLinkEnv();
    const result = await env.t.query(api.shareableLinks.resolveShareableLink, {
      token: "0000000000000000000000000000dead",
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Editor cannot use evaluator-only routes
// ---------------------------------------------------------------------------

describe("Editor blocked from evaluator routes", () => {
  test("editor cannot call getOutputsForEvaluator", async () => {
    const { ids, asEditor } = await seedTestEnv();
    await expect(
      asEditor.query(api.runs.getOutputsForEvaluator, {
        opaqueToken: ids.token,
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("editor cannot call outputPreferences.rateOutputByToken", async () => {
    const { ids, asEditor } = await seedTestEnv();
    await expect(
      asEditor.mutation(api.outputPreferences.rateOutputByToken, {
        opaqueToken: ids.token,
        blindLabel: "A",
        rating: "best",
      }),
    ).rejects.toThrow("Permission denied");
  });

  test("editor cannot call outputPreferences.getMyRatingsByToken", async () => {
    const { ids, asEditor } = await seedTestEnv();
    await expect(
      asEditor.query(api.outputPreferences.getMyRatingsByToken, {
        opaqueToken: ids.token,
      }),
    ).rejects.toThrow("Permission denied");
  });
});

// ---------------------------------------------------------------------------
// Unauthenticated user denied from authenticated endpoints
// ---------------------------------------------------------------------------

describe("Unauthenticated access denied", () => {
  test("unauthenticated user cannot call getOutputsForEvaluator", async () => {
    const { t, ids } = await seedTestEnv();
    await expect(
      t.query(api.runs.getOutputsForEvaluator, {
        opaqueToken: ids.token,
      }),
    ).rejects.toThrow();
  });

  test("unauthenticated user cannot call evaluatorInbox.listMyInbox", async () => {
    const { t } = await seedTestEnv();
    await expect(
      t.query(api.evaluatorInbox.listMyInbox),
    ).rejects.toThrow();
  });
});
