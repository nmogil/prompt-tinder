---
title: "Hot or Prompt - Architecture"
created: 2026-04-11
modified: 2026-04-11
type: architecture
status: planning
tags:
  - hot-or-prompt
  - architecture
  - spec
---

# Hot or Prompt — Technical Architecture

> Part of [[MOC - Hot or Prompt]]

> "Git meets Google Docs" for collaborative prompt engineering

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Flow: Prompt Optimization Cycle](#data-flow-prompt-optimization-cycle)
4. [Data Model (Convex Schema)](#data-model-convex-schema)
5. [Template Syntax](#template-syntax)
6. [Authorization Model](#authorization-model)
7. [BYOK Key Handling](#byok-key-handling)
8. [Cost Controls](#cost-controls)
9. [File Storage & DB Size](#file-storage--db-size)
10. [Convex Function Index](#convex-function-index)
11. [Optimizer Meta-Prompt](#optimizer-meta-prompt)
12. [Key Design Decisions](#key-design-decisions)
13. [v1 Scope & Deferred](#v1-scope--deferred)
14. [Next Steps](#next-steps)

---

## Overview

**Hot or Prompt** is a collaborative prompt engineering platform that enables teams to iteratively refine prompts through structured human evaluation and LLM-assisted improvements.

### Core Workflow

```
1. CREATE        2. RUN            3. EVALUATE         4. OPTIMIZE
──────────       ────────          ──────────          ──────────
User creates     Prompt runs       Collaborators       System generates
prompt with      3x against        review outputs      new prompt from
variables        a test case       blind, leave        all feedback
                                   feedback

                        ◄────────── REPEAT ──────────►
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite + Tiptap (Vercel) |
| Backend | Convex (queries / mutations / actions) |
| Database | Convex DB |
| Auth | Convex Auth |
| File Storage | Convex file storage |
| LLM Provider | OpenRouter (BYOK per org) |
| Observability | TODO — action-layer seam preserved |

---

## Architecture

### High-Level

```
┌───────────────────────────────────────────────────────────────┐
│                           CLIENTS                              │
│                                                                │
│     Landing Page (Vercel)            Web App (Vercel)          │
│                                      React + Vite + Tiptap     │
└──────────────────────────┬─────────────────────────────────────┘
                           │ Convex client (reactive queries,
                           │  mutations, action calls)
                           ▼
┌───────────────────────────────────────────────────────────────┐
│                            CONVEX                              │
│                                                                │
│   queries             reads, reactive subscriptions            │
│   mutations           transactional writes, can schedule       │
│                       actions                                  │
│   actions             Node.js runtime, OpenRouter HTTP calls,  │
│                       streaming, can call internal mutations   │
│   scheduled           retries, cleanup, cron                   │
│   file storage        attachments, raw LLM responses           │
│   Convex Auth         sessions, OAuth, magic links             │
└──────────────────────────┬─────────────────────────────────────┘
                           │ HTTPS
                           ▼
┌───────────────────────────────────────────────────────────────┐
│                         OpenRouter                             │
│       Claude  │  GPT-4  │  Gemini  │  Llama  │  etc.           │
└───────────────────────────────────────────────────────────────┘
```

### Authentication

Convex Auth owns the session end-to-end: OAuth providers, magic links, session tokens in cookies. On every query, mutation, and action, the first lines of code are:

```ts
const identity = await ctx.auth.getUserIdentity();
if (!identity) throw new Error('Not authenticated');
await requireRole(ctx, projectId, ['owner', 'editor']); // or similar
```

`requireRole` is a shared helper that looks up the caller in `projectCollaborators` and throws if they're not in the allowed role set. See the Authorization Model section below.

---

## Data Flow: Prompt Optimization Cycle

```
  Owner creates prompt
           │
           ▼
  PROMPT VERSION 1 ◄───────────────────────────┐
           │                                    │
           │ Owner picks a test case, clicks Run│
           ▼                                    │
  EXECUTE 3 RUNS                                │
  Run 1 → Output A                              │
  Run 2 → Output B                              │
  Run 3 → Output C                              │
           │                                    │
           │ Collaborators invited               │
           ▼                                    │
  BLIND EVALUATION                              │
  Evaluators see outputs labeled A/B/C,         │
  not which version produced them.              │
  Highlight + comment via Tiptap.               │
           │                                    │
           ▼                                    │
  FEEDBACK COLLECTED                            │
  Output feedback + prompt feedback +           │
  project meta context                          │
           │                                    │
           │ Owner clicks Optimize              │
           ▼                                    │
  OPTIMIZER ACTION                              │
  Meta-prompt takes all feedback →              │
  new prompt + changes summary                  │
           │                                    │
           │ Owner reviews                      │
           ▼                                    │
  HUMAN REVIEW (accept / edit / reject)         │
           │                                    │
           │ Accept                             │
           ▼                                    │
  PROMPT VERSION 2 ──────────────────────────────┘
  (parent: v1)

  Rollback: v4 = copy of v2 with parent=v3, sourceVersion=v2
```

### How a run actually executes in Convex

1. Client calls `runs.execute` mutation with `{ versionId, testCaseId, model, temperature, maxTokens, runCount: 3 }`.
2. The mutation writes one `promptRuns` row with `status: 'pending'`, writes three `runOutputs` rows with empty `outputContent` and blind labels A/B/C, then schedules `runsActions.executeRunAction`.
3. The action loads the test case, substitutes variables into the user message template, decrypts the org's OpenRouter key, and fires three parallel streaming calls to OpenRouter.
4. On each streamed chunk, the action calls the internal mutation `runs.appendOutputChunk`, which appends text to the corresponding `runOutputs.outputContent`.
5. The client is already subscribed to a `runs.get(runId)` reactive query and sees the outputs fill in live.
6. On completion the action writes final token counts, latency, and sets `status: 'completed'`. On failure it sets `status: 'failed'` with an error message.

### How optimization executes

1. Client calls `optimize.requestOptimization` mutation with `{ versionId }`.
2. Mutation writes an `optimizationRequests` row with `status: 'pending'` and schedules `optimizeActions.runOptimizerAction`.
3. Action reads the current prompt version, all output feedback for runs of that version, all prompt feedback, and the project's meta context.
4. Action runs the fixed optimizer meta-prompt against OpenRouter.
5. Action writes `generatedSystemMessage`, `generatedUserTemplate`, `changesSummary`, `changesReasoning`, sets `status: 'completed'` and `reviewStatus: 'pending'`.
6. Client is subscribed to `optimize.getOptimization(id)` and sees the result appear.
7. Owner reviews and calls `accept` / `reject` / `editAndAccept`. Accept creates a new `promptVersions` row linked back via `optimizationRequests.resultingVersionId`.

---

## Data Model (Convex Schema)

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // ============================================================
  // ORGS & MEMBERSHIP
  // (users / sessions / accounts are handled by Convex Auth)
  // ============================================================

  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    logoStorageId: v.optional(v.id('_storage')),
  }).index('by_slug', ['slug']),

  organizationMembers: defineTable({
    organizationId: v.id('organizations'),
    userId: v.id('users'),
    role: v.union(
      v.literal('owner'),
      v.literal('admin'),
      v.literal('member'),
    ),
  })
    .index('by_org', ['organizationId'])
    .index('by_user', ['userId'])
    .index('by_org_user', ['organizationId', 'userId']),

  // ============================================================
  // BYOK: OpenRouter keys per org
  // ============================================================

  openRouterKeys: defineTable({
    organizationId: v.id('organizations'),
    // AES-GCM encrypted with a key derived from the Convex env var
    // OPENROUTER_KEY_ENCRYPTION_SECRET. Nonce stored with ciphertext.
    encryptedKey: v.string(),
    lastRotatedAt: v.number(),
    createdById: v.id('users'),
  }).index('by_org', ['organizationId']),

  // ============================================================
  // PROJECTS
  // ============================================================

  projects: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    description: v.optional(v.string()),
    createdById: v.id('users'),
    // Meta-prompting context questions the owner fills in once per
    // project. Feeds the optimizer. Typical questions: "What domain?",
    // "What tone?", "Who's the end user?"
    metaContext: v.optional(
      v.array(
        v.object({
          id: v.string(),
          question: v.string(),
          answer: v.string(),
        }),
      ),
    ),
  }).index('by_org', ['organizationId']),

  projectCollaborators: defineTable({
    projectId: v.id('projects'),
    userId: v.id('users'),
    role: v.union(
      v.literal('owner'),
      v.literal('editor'),
      v.literal('evaluator'),
    ),
    invitedById: v.id('users'),
    invitedAt: v.number(),
    acceptedAt: v.optional(v.number()),
  })
    .index('by_project', ['projectId'])
    .index('by_user', ['userId'])
    .index('by_project_user', ['projectId', 'userId']),

  // ============================================================
  // PROJECT-LEVEL VARIABLES
  // Shared across all versions of a project. Referenced by name
  // in prompt templates.
  // ============================================================

  projectVariables: defineTable({
    projectId: v.id('projects'),
    name: v.string(), // e.g., "customer_name"
    description: v.optional(v.string()),
    defaultValue: v.optional(v.string()),
    required: v.boolean(),
    order: v.number(),
  }).index('by_project', ['projectId']),

  // ============================================================
  // TEST CASES (first-class, reusable across versions)
  // Running the same test case against v1, v2, v3 is the primitive
  // for cross-version comparison.
  // ============================================================

  testCases: defineTable({
    projectId: v.id('projects'),
    name: v.string(),
    // Values for the project's variables for this test case.
    variableValues: v.record(v.string(), v.string()),
    // Images to include in the run (for vision models).
    attachmentIds: v.array(v.id('_storage')),
    order: v.number(),
    createdById: v.id('users'),
  }).index('by_project', ['projectId']),

  // ============================================================
  // PROMPT VERSIONS
  // ============================================================

  promptVersions: defineTable({
    projectId: v.id('projects'),
    versionNumber: v.number(),
    systemMessage: v.optional(v.string()),
    userMessageTemplate: v.string(),
    // Parent is always the previous version in the sequence.
    parentVersionId: v.optional(v.id('promptVersions')),
    // For rollbacks: if v4 was rolled back from v2, sourceVersionId = v2.
    sourceVersionId: v.optional(v.id('promptVersions')),
    status: v.union(
      v.literal('draft'),
      v.literal('active'),
      v.literal('archived'),
    ),
    createdById: v.id('users'),
  }).index('by_project', ['projectId']),

  // ============================================================
  // PROMPT-LEVEL ATTACHMENTS
  // Images attached to the prompt itself (not a specific test case).
  // Included in every run regardless of which test case is used.
  // ============================================================

  promptAttachments: defineTable({
    promptVersionId: v.id('promptVersions'),
    storageId: v.id('_storage'),
    filename: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    order: v.number(),
  }).index('by_version', ['promptVersionId']),

  // ============================================================
  // RUNS & OUTPUTS
  // ============================================================

  promptRuns: defineTable({
    promptVersionId: v.id('promptVersions'),
    testCaseId: v.id('testCases'),
    model: v.string(), // OpenRouter model id
    temperature: v.number(),
    maxTokens: v.optional(v.number()),
    status: v.union(
      v.literal('pending'),
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed'),
    ),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    triggeredById: v.id('users'),
  })
    .index('by_version', ['promptVersionId'])
    .index('by_version_testcase', ['promptVersionId', 'testCaseId']),

  runOutputs: defineTable({
    runId: v.id('promptRuns'),
    // Blind label shown to evaluators instead of version info.
    blindLabel: v.string(), // "A", "B", "C"
    // Accumulated via chunk-append during streaming.
    outputContent: v.string(),
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
    // Raw response is only kept in file storage if needed for
    // debugging. Never a JSON blob in the DB row.
    rawResponseStorageId: v.optional(v.id('_storage')),
  }).index('by_run', ['runId']),

  // ============================================================
  // FEEDBACK (Tiptap annotations)
  // ============================================================

  outputFeedback: defineTable({
    outputId: v.id('runOutputs'),
    userId: v.id('users'),
    // Tiptap / ProseMirror position data.
    annotationData: v.object({
      from: v.number(),
      to: v.number(),
      highlightedText: v.string(),
      comment: v.string(),
    }),
  })
    .index('by_output', ['outputId'])
    .index('by_user', ['userId']),

  promptFeedback: defineTable({
    promptVersionId: v.id('promptVersions'),
    userId: v.id('users'),
    targetField: v.union(
      v.literal('system_message'),
      v.literal('user_message_template'),
    ),
    annotationData: v.object({
      from: v.number(),
      to: v.number(),
      highlightedText: v.string(),
      comment: v.string(),
    }),
  })
    .index('by_version', ['promptVersionId'])
    .index('by_user', ['userId']),

  // ============================================================
  // OPTIMIZATION REQUESTS
  // ============================================================

  optimizationRequests: defineTable({
    promptVersionId: v.id('promptVersions'),
    status: v.union(
      v.literal('pending'),
      v.literal('processing'),
      v.literal('completed'),
      v.literal('failed'),
    ),
    // The generated new prompt (before human review).
    generatedSystemMessage: v.optional(v.string()),
    generatedUserTemplate: v.optional(v.string()),
    // Optimizer's explanation.
    changesSummary: v.optional(v.string()),
    changesReasoning: v.optional(v.string()),
    optimizerModel: v.string(),
    // Human review.
    reviewStatus: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('accepted'),
        v.literal('rejected'),
        v.literal('edited'),
      ),
    ),
    reviewedById: v.optional(v.id('users')),
    reviewedAt: v.optional(v.number()),
    reviewNotes: v.optional(v.string()),
    // If accepted, the new version created from this optimization.
    resultingVersionId: v.optional(v.id('promptVersions')),
    requestedById: v.id('users'),
    errorMessage: v.optional(v.string()),
  }).index('by_version', ['promptVersionId']),
});
```

---

## Template Syntax

> Terms referenced below are defined in [[Hot or Prompt - Glossary]].

Templates use a minimal subset of Mustache. Keep it boring on purpose.

- `{{variable}}` is replaced with the test case's value for `variable`. Must reference a variable defined on the project.
- Escape with `\{{literal}}` if you need a literal `{{` in the output.
- **No logic, no conditionals, no partials, no helpers.** If we add any of those later, it's a deliberate upgrade.
- Missing variables throw at execute time. Test cases may include values for variables that don't exist in the current template — that's fine (ignored).
- **Validation on version save.** Every `{{name}}` appearing in `systemMessage` or `userMessageTemplate` must correspond to an existing `projectVariables.name` row. Unreferenced project variables are allowed.

---

## Authorization Model

All authorization is enforced inside Convex functions, not in the UI. Every query, mutation, and action starts with `ctx.auth.getUserIdentity()` and `requireRole(ctx, projectId, allowedRoles)`.

| Action | Owner | Editor | Evaluator |
|---|:-:|:-:|:-:|
| View project, versions, variables, test cases | ✓ | ✓ | — |
| Create / edit versions | ✓ | ✓ | — |
| Create / edit test cases | ✓ | ✓ | — |
| Upload attachments | ✓ | ✓ | — |
| Execute runs | ✓ | ✓ | — |
| View outputs (blinded, A/B/C, no version info) | ✓ | ✓ | ✓ |
| View which version produced an output | ✓ | ✓ | — |
| Leave output feedback | ✓ | ✓ | ✓ |
| Leave prompt feedback | ✓ | ✓ | — |
| Request optimization | ✓ | ✓ | — |
| Accept / reject / edit optimization | ✓ | ✓ | — |
| Invite collaborators, change roles | ✓ | — | — |
| Delete project | ✓ | — | — |
| Set OpenRouter key (org-level) | ✓ | — | — |

**Blind-eval enforcement.** The only runs-related function an evaluator can call is `runs.getOutputsForEvaluator(runId)`, which returns `{ blindLabel, outputContent }[]` and nothing else — no `versionId`, no `runId` metadata, no model, no temperature, no latency. Evaluator calls to `runs.get`, `runs.list`, `runs.compareAcrossVersions`, `versions.get`, or `versions.list` all throw. An evaluator holding a raw `outputId` cannot traverse `outputs → runs → versions` because every function in that chain checks role first. Blind eval is enforced at the function boundary, not in the client.

The function-level rules above close the data layer. The browser-side surfaces (URL, page title, breadcrumb, tooltip, tab, favicon, network response, clipboard, view-source, EXIF) are closed separately by the 13 rules in [[Hot or Prompt - UX Spec#10 Blind eval security rules]]. Both layers are load-bearing.

---

## BYOK Key Handling

Each organization stores its own OpenRouter key. No platform key in v1.

- **Storage.** `openRouterKeys.encryptedKey` is AES-GCM ciphertext. The encryption key is derived (HKDF) from the Convex env var `OPENROUTER_KEY_ENCRYPTION_SECRET`. The nonce is stored with the ciphertext.
- **Write path.** `openRouterKeys.setKey` mutation (owner only) takes plaintext, encrypts, writes the row. Overwrites any existing row and bumps `lastRotatedAt`.
- **Read path.** Never exposed to the client. `openRouterKeys.hasKey` query returns `boolean` so the UI can prompt for a key when one isn't set. Decryption happens only inside actions that call OpenRouter, via an internal helper `getDecryptedKey(ctx, orgId)`.
- **Risk.** A compromised `OPENROUTER_KEY_ENCRYPTION_SECRET` compromises every stored key. Treat it accordingly — Convex env var, never committed, rotated on compromise.

---

## Cost Controls

Because each org uses its own OpenRouter key (BYOK), users eat their own costs and v1 does not need a billing or budget system. One safeguard ships anyway:

- **Concurrent run cap per project.** A soft cap (default: 10 in-flight runs per project) enforced in the `runs.execute` mutation. Implementation: count `promptRuns` where `status in ('pending','running')` and `projectId = X` before scheduling; throw if over cap. This exists to prevent a runaway loop (bad optimizer, accidental infinite automation) from firing thousands of streaming calls against the org's key in a single minute.

No dollar budgets, no per-user rate limits, no usage dashboards in v1.

---

## File Storage & DB Size

- **Uploads.** Client calls `attachments.generateUploadUrl` (mutation) → PUTs the file directly to Convex storage → calls `attachments.registerUploaded` with the returned `storageId`.
- **Reads.** Always via `ctx.storage.getUrl(storageId)` on every read. No cached URLs stored in the DB.
- **Vision payloads.** When an action executes a run, it loads attachment files via `ctx.storage.get(storageId)` and attaches them to the OpenRouter message payload (base64 or signed URL, depending on the model's expected format).
- **Raw LLM responses.** Not stored as JSON in DB rows. If a future debugging need arises, dump to file storage and keep only a `rawResponseStorageId` on `runOutputs`. Prevents row bloat.
- **DB size.** Convex has no practical row-count limit for this workload.

---

## Convex Function Index

Every function starts with auth + `requireRole`. The index below groups functions by file.

### `convex/auth.ts`
Handled by Convex Auth. No custom code beyond provider config (Google, GitHub, magic link).

### `convex/organizations.ts`
- `createOrg` mutation — creates org + owner membership in one transaction.
- `listMyOrgs` query — orgs the caller is a member of.
- `getOrg` query — org details.
- `updateOrg` mutation — name, slug, logo.
- `inviteMember` mutation — add org member.
- `updateMemberRole` mutation.
- `removeMember` mutation.

### `convex/openRouterKeys.ts`
- `setKey` mutation (owner only) — encrypt + store.
- `hasKey` query — returns `boolean`, never the key itself.

### `convex/projects.ts`
- `create`, `list`, `get`, `update`, `delete` — standard CRUD.
- `setMetaContext`, `getMetaContext` — owner only.
- `inviteCollaborator`, `updateCollaboratorRole`, `removeCollaborator`, `acceptInvitation`.

### `convex/variables.ts` (project-scoped)
- `list`, `add`, `update`, `delete`, `reorder`.

### `convex/testCases.ts`
- `list`, `create`, `update`, `delete`, `reorder`.

### `convex/versions.ts`
- `list`, `get`, `getCurrent` — read.
- `create` — first version, or a new draft branching from the current head.
- `update`, `delete` — draft only.
- `rollback(versionId)` — copies the target version into a new version at the head. The new version has `parentVersionId = previous head` and `sourceVersionId = target`, preserving both the sequence and the rollback provenance.

### `convex/attachments.ts`
- `generateUploadUrl` mutation — returns a signed upload URL.
- `registerUploaded` mutation — writes the `promptAttachments` row after successful upload.
- `list`, `delete`, `reorder`.

### `convex/runs.ts`
- `execute` mutation — `{ versionId, testCaseId, model, temperature, maxTokens, runCount }`. Enforces the concurrent-run cap, writes the `promptRuns` + three empty `runOutputs`, and schedules `runsActions.executeRunAction`.
- `list` — list runs for a version.
- `get` — full run detail with outputs and version metadata. Editor/owner only.
- `getOutputsForEvaluator(runId)` — returns `{ blindLabel, outputContent }[]` only. The only runs-related function an evaluator can call.
- `compareAcrossVersions({ testCaseId, versionIds })` — for the cross-version comparison UI. Returns `{ versionId → outputs[] }`. Editor/owner only.
- `appendOutputChunk` internal mutation — called by the action on every streamed chunk.

### `convex/runsActions.ts`
- `executeRunAction` internal action — loads the test case, decrypts the org's OpenRouter key, fires three parallel streaming calls, appends chunks via `runs.appendOutputChunk`, finalizes status and token counts.

### `convex/feedback.ts`
- `addOutputFeedback`, `listOutputFeedback`, `updateOutputFeedback`, `deleteOutputFeedback`.
- `addPromptFeedback`, `listPromptFeedback`, `updatePromptFeedback`, `deletePromptFeedback`.

### `convex/optimize.ts`
- `requestOptimization` mutation — writes the `optimizationRequests` row, schedules the action.
- `getOptimization` query — reactive subscription target.
- `acceptOptimization` — creates a new `promptVersions` row and links it back via `resultingVersionId`.
- `rejectOptimization`.
- `editAndAcceptOptimization` — accept with user-supplied edits.

### `convex/optimizeActions.ts`
- `runOptimizerAction` internal action — reads the current prompt + all feedback + meta context, runs the meta-prompt through OpenRouter, writes `generatedSystemMessage`, `generatedUserTemplate`, `changesSummary`, `changesReasoning`.

---

## Optimizer Meta-Prompt

The scaffolding around this prompt — input/output TypeScript schemas, action-level validation, storage, versioning, evaluation approach, and worked examples — lives in its own doc: [[Hot or Prompt - Optimizer Meta-Prompt]]. The actual prompt text is a deliberate TODO the owner drafts. Short summary below for convenience; see that doc for everything load-bearing.

> **Inputs:** `currentSystemMessage`, `currentUserTemplate`, `projectVariables`, `outputFeedback[]` (blinded), `promptFeedback[]`, `metaContext[]`
>
> **Outputs (structured JSON):** `newSystemMessage`, `newUserTemplate`, `changesSummary` (markdown bullets), `changesReasoning` (prose, must cite specific feedback items)
>
> The meta-prompt is the core IP of the product. The rest of the system is designed around this input/output shape so the meta-prompt can be iterated on independently.

---

## Key Design Decisions

### 1. Blind Evaluation
Outputs are labeled A/B/C. Evaluators cannot see which version produced which output. Enforced at the Convex function boundary, not in the UI.

### 2. Human-in-the-Loop Optimization
The optimizer suggests, a human accepts / edits / rejects. New versions are never created automatically. This maintains an audit trail and prevents runaway automation.

### 3. Linear Versioning with Rollback Provenance
`v1 → v2 → v3` sequence tracked via `parentVersionId`. Rollback creates a new version (`v4 = copy of v2`) with `parentVersionId = v3` and `sourceVersionId = v2`, preserving both the sequence and the rollback origin. Branching can be added later without migrating existing data.

### 4. Functions-First
Every UI action is a Convex query, mutation, or action — no separate REST layer. The reactive client subscription model makes streaming LLM output and optimization progress essentially free.

### 5. LLM Abstraction Lives in Actions
OpenRouter is only touched inside `runsActions.ts` and `optimizeActions.ts`. A future `convex/lib/llm.ts` module can add Langfuse tracing, LiteLLM routing, or automatic retries without touching any caller.

### 6. Tiptap for Annotations
Tiptap's ProseMirror foundation gives precise text selection. The `from`/`to` positions stored in feedback map directly to the document model. Outputs are immutable once complete, so position stability is not a concern.

### 7. Test Cases Are First-Class
Test cases are project-scoped and reusable across versions. Running the same test case against v1, v2, v3 is the primitive that makes "is v2 actually better than v1?" answerable. Without this, every run is a one-off and comparison is impossible.

### 8. Evaluator Authorization in Functions, Not UI
Blind eval cannot be bypassed client-side. Evaluators literally cannot call any function that would reveal version metadata, because every such function checks role first.

### 9. BYOK Over Platform Key
Each org brings its own OpenRouter key. Ships v1 without billing infrastructure, per-user rate limits, or dollar budgets. Tradeoff: more onboarding friction. The concurrent-run cap is the only guardrail.

### 10. Convex Over Multi-Service Cloudflare
Convex replaces what would otherwise be Workers + D1 + Queues + Durable Objects + KV + R2. Async LLM flows map naturally onto mutation → action → reactive subscription. Real-time collab, when added later, gets document sync for free. Tradeoff: vendor lock-in, centralized regions instead of edge deployment.

---

## v1 Scope & Deferred

### In v1

- Orgs with owner/admin/member membership.
- Projects with owner/editor/evaluator collaborators.
- Project-level variables + first-class test cases.
- Prompt versions (draft / active / archived), rollback with provenance.
- Prompt-level and test-case-level image attachments (vision models).
- Runs with streaming output, 3x fan-out, OpenRouter via BYOK.
- Tiptap feedback on outputs and prompts.
- Optimization requests with human review flow.
- Cross-version comparison on a shared test case.
- Convex Auth (OAuth + magic links).
- Concurrent-run cap as a cost guardrail.

### Deferred (and why)

- **Real-time collaborative editing.** Reactive queries will give us document sync essentially for free when we want it; presence / CRDT cursors can wait. v1 is single-editor-at-a-time with last-write-wins.
- **Langfuse / LiteLLM.** The action-layer seam is preserved; wiring them in is a future PR that touches only `runsActions.ts` / `optimizeActions.ts`.
- **Multi-org admin flows.** Users can create and join orgs; deep admin UX (audit logs, SSO, SCIM) is v2.
- **Billing / pricing tiers.** BYOK sidesteps this entirely for v1.
- **Per-user rate limits and dollar budgets.** Only the concurrent-run cap ships.
- **CLI / CI-CD integrations.** Possible later because everything is a Convex function — a thin HTTP wrapper is all it'd take.
- **Branching versions.** Linear-only for v1; schema leaves room for branches later.

---

## Next Steps

See [[Hot or Prompt - Build Plan]] for the milestone-level breakdown with deliverables, acceptance criteria, and testable demos. The short form:

1. `npm create convex@latest` + Vite React template + Convex Auth bootstrap.
2. Write `convex/schema.ts` — orgs, members, projects, collaborators, variables, versions, attachments, testCases, runs, outputs, feedback, optimizationRequests, openRouterKeys.
3. BYOK flow — AES-GCM encrypt/decrypt helper, `setKey` + `hasKey` + internal `getDecryptedKey`.
4. Authorization helpers — `requireRole`, `requireOrgRole`, `requireOwner`.
5. CRUD for orgs / projects / variables / versions / test cases.
6. `runsActions.executeRunAction` — OpenRouter streaming + chunk-append pattern.
7. Tiptap editor + annotation feedback (output + prompt).
8. `optimizeActions.runOptimizerAction` + review flow (meta-prompt TBD).
9. Cross-version comparison UI on a shared test case.
10. Landing page on Vercel (separate deployment).

---

## Related

- [[Hot or Prompt - UX Spec]] — what every screen looks like and how blind eval is closed at the browser-surface layer
- [[Hot or Prompt - Optimizer Meta-Prompt]] — scaffolding around the optimize action
- [[Hot or Prompt - Glossary]] — locked vocabulary
- [[Hot or Prompt - Build Plan]] — milestone-level implementation plan
- [[MOC - Hot or Prompt]]

---

*Document version: 2.0*
*Last updated: 2026-04-11*
