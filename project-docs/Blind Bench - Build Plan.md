---
title: "Blind Bench - Build Plan"
created: 2026-04-11
modified: 2026-04-11
type: plan
status: planning
tags:
  - blind-bench
  - build-plan
  - milestones
---

# Blind Bench — Build Plan

> Part of [[MOC - Blind Bench]]

This doc expands the architecture doc's 10-bullet Next Steps into demoable milestones with explicit acceptance criteria. Every milestone is independently shippable to a preview URL and has a testable demo an AI agent or a human can self-verify.

The numbering starts at M0 to mirror "milestone zero = setup" conventions. Milestones are strictly sequential on the critical path except where the dependency graph below says otherwise.

See also:
- [[Blind Bench - Architecture#Next Steps]] — the short form of this doc
- [[Blind Bench - UX Spec]] — what each screen looks like (milestone deliverables reference screen IDs from this spec)
- [[Blind Bench - Optimizer Meta-Prompt]] — consumed by M5

---

## Context

The architecture doc's "Next Steps" section lists 10 bullets without acceptance criteria, without milestone boundaries, and without dependency notes. That's fine as a summary but not enough for an AI agent to work against: "build CRUD for projects" admits a thousand interpretations of "done". This doc grounds each milestone in:

1. **Concrete deliverables** — named schemas, functions, screens from the UX spec.
2. **Explicit acceptance criteria** — tests a human or agent can run to confirm the milestone is actually complete.
3. **A testable demo** — a short end-to-end story the user can walk through.
4. **Explicit out-of-scope** — what this milestone does NOT do, so the agent doesn't sneak forward into the next one.

If a milestone ships and the acceptance criteria pass, it is done. If acceptance criteria fail, it is not done regardless of how much code was written.

---

## Dependency graph

```
  M0 Scaffold
      │
      ▼
  M1 Orgs + Projects + Collaborators
      │
      ▼
  M2 Variables + Test Cases + Versions (no execution)
      │
      ▼
  M3 BYOK + Run Execution (streaming) ──┐
      │                                  │
      ▼                                  │
  M4 Tiptap + Blind Eval                 │
      │                                  │
      ▼                                  │
  M5 Optimization + Review               │
      │                                  │
      ▼                                  │
  M6 Cross-version compare + polish ◄────┘
      │
      ▼
  M7 Landing page (parallel, separate deploy)
```

M0 → M6 is strictly sequential on the critical path. M7 (landing page on a separate Vercel project) can start any time after M0 and ship whenever; it has no dependencies on the app itself beyond a sign-in URL.

---

## M0 — Scaffold

**Goal**: a deployed Vercel URL that lets you sign in and see your email. Nothing else.

### Deliverables
- `npm create convex@latest` with the Vite React template.
- Convex project created and linked.
- Convex Auth configured with Google OAuth and magic link providers. Env vars set in Convex dashboard: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_RESEND_KEY` (or equivalent magic link provider).
- Vite React app deployed to Vercel with `VITE_CONVEX_URL` pointing at the Convex deployment.
- A single protected route `/` that renders "Signed in as {email}" if authenticated and `/auth/sign-in` otherwise.
- A sign-in page at `/auth/sign-in` with the Google button + magic link form (see [[Blind Bench - UX Spec#4.2 Sign in]]).
- A magic link callback route.

### Acceptance criteria
1. Visiting the deployed Vercel URL while logged out redirects to `/auth/sign-in`.
2. Clicking Google sign-in completes the OAuth flow and lands back on `/` showing the user's email.
3. Requesting a magic link sends a real email; clicking the link signs the user in.
4. Directly calling a Convex query that does `ctx.auth.getUserIdentity()` returns `null` when unauthenticated and a valid identity when authenticated.
5. The preview URL is stable and accessible from outside Noah's machine.

### Testable demo
> Open the Vercel URL → click Google → complete OAuth → land on `/` → see "Signed in as noah@...". Sign out. Request a magic link → check email → click link → same landing.

### Out of scope
- Orgs, projects, anything beyond auth + an empty protected page.
- Styling beyond whatever Tailwind defaults look OK for a sign-in card.
- Role checks.

---

## M1 — Orgs, projects, collaborators

**Goal**: two users can each create an org, create a project, invite each other, and see the right things based on role.

### Deliverables

**Schema** (`convex/schema.ts`):
- `organizations` + `organizationMembers`
- `projects` + `projectCollaborators` with `role: 'owner' | 'editor' | 'evaluator'`
- (Defer `projectVariables`, `testCases`, `promptVersions`, `promptRuns`, etc. — those come in M2 and M3.)

**Helpers** (`convex/lib/auth.ts`):
- `requireAuth(ctx)` — returns `identity` or throws.
- `requireOrgRole(ctx, orgId, allowedRoles[])`.
- `requireProjectRole(ctx, projectId, allowedRoles[])`.

**Convex functions**:
- `convex/organizations.ts`: `createOrg`, `listMyOrgs`, `getOrg`, `updateOrg`, `inviteMember`, `updateMemberRole`, `removeMember`, `acceptInvitation`.
- `convex/projects.ts`: `create`, `list`, `get`, `update`, `delete`, `inviteCollaborator`, `updateCollaboratorRole`, `removeCollaborator`, `acceptInvitation`.

**Screens** (from [[Blind Bench - UX Spec]]):
- 4.4 First-run onboarding
- 4.5 Org home / project list
- 4.6 Org settings → general
- 4.7 Org settings → members
- 4.9 Project home (empty state only — no versions yet)
- 4.25 Project settings → general
- 4.26 Project settings → collaborators
- 4.30 Error screens (404, denied)

**Routing**:
- React Router with the routes from the UX spec's sitemap for everything under `/orgs/:orgSlug`.
- Role-aware shell from [[Blind Bench - UX Spec#3 Role-aware shell]] — Owner/Editor shell for Owners and Editors, evaluator shell stubbed out (just the top bar; the inbox is empty in M1 since runs don't exist yet).

### Acceptance criteria
1. User A signs up → creates "Org A" → sees themselves as Owner in org settings.
2. User A creates Project P1 → is automatically the Owner.
3. User A invites User B as an Editor on P1. User B accepts the invite and sees P1 in their org list.
4. User A invites User C as an Evaluator on P1. User C accepts → lands on `/eval` (empty inbox).
5. User C manually navigates to `/orgs/:orgSlug/projects/P1` → is redirected to `/eval` with no flash of project content.
6. User B cannot open org settings → redirected to a permission denied screen.
7. User A removes User B → User B no longer sees P1 in their project list.
8. All auth checks happen in Convex functions, not the UI. Disabling the UI redirect still fails the underlying query with "permission denied".

### Testable demo
> Two browser sessions. Session 1 creates an org, creates a project, invites session 2 as Editor and session 3 as Evaluator. Walk through each session's visible state. Confirm session 3 cannot access the project URL directly.

### Out of scope
- Variables, test cases, versions — none exist yet.
- Runs — impossible because versions don't exist.
- OpenRouter key UI — M3.
- Meta context editor — M2 or later.

---

## M2 — Variables, test cases, versions (no execution yet)

**Goal**: a user can define project variables, write a prompt version with `{{variable}}` placeholders, validate the template, manage test cases, and roll back.

### Deliverables

**Schema**:
- `projectVariables` (project-scoped)
- `testCases`
- `promptVersions` (with `parentVersionId`, `sourceVersionId`, `status`)
- `promptAttachments` (schema only; upload UI comes in M3 with run execution)

**Convex functions**:
- `convex/variables.ts`: `list`, `add`, `update`, `delete`, `reorder`.
- `convex/testCases.ts`: `list`, `create`, `update`, `delete`, `reorder`.
- `convex/versions.ts`: `list`, `get`, `getCurrent`, `create`, `update` (draft only), `delete` (draft only), `rollback`, `promoteToActive`, `archive`.
- `convex/lib/templateValidation.ts`: `validateTemplate(template: string, variables: string[])` — throws on unknown variable references or unsupported Mustache syntax. Used in `versions.create`/`update`.

**Screens**:
- 4.10 Version list / history
- 4.11 Version editor (with validation, but the Run button is disabled with "not yet" tooltip — execution comes in M3)
- 4.12 Variable manager
- 4.13 Test case manager
- 4.14 Test case editor
- 4.15 Meta context Q&A editor
- 4.24 Version rollback confirmation modal

### Acceptance criteria
1. Create a variable `customer_name` → appears in the variable manager and as a chip in the version editor's variable list.
2. Write a v1 system message `You are a helpful assistant.` and user template `Hello {{customer_name}}` → save → v1 exists in the version list as a draft.
3. Try to save `{{unknown_variable}}` → template validation throws with "Unknown variable `{{unknown_variable}}`" on the specific field.
4. Try to save `{{#if something}}` → template validation throws with "Unsupported template syntax".
5. Promote v1 to active → v1 becomes read-only in the editor.
6. Create v2 as a draft branching from v1 → v2 has `parentVersionId = v1`.
7. Roll back to v1 → creates v3 with `parentVersionId = v2`, `sourceVersionId = v1`, and the content of v1.
8. Create a test case "Happy path" with `customer_name = "Noah"` and one attached image → reads back correctly.
9. Set 3 meta context questions → reads back correctly.
10. Deleting a variable referenced in any version is blocked with "This variable is used in version 2. Remove the reference first."

### Testable demo
> Create a project, add 2 variables, write v1 prompt, validate syntax, promote to active, branch v2, roll back to v1. Create 2 test cases. Set meta context.

### Out of scope
- Running the prompt (M3).
- Feedback / annotations (M4).
- Optimization (M5).
- Attachment upload and vision wiring (M3).

---

## M3 — BYOK + run execution (streaming)

**Goal**: a user can set their OpenRouter key, click Run, and see 3 outputs stream in live via Convex reactive subscriptions. Vision attachments work.

### Deliverables

**Schema**:
- `openRouterKeys` with encrypted key storage.
- `promptRuns` with `status` lifecycle (`pending` → `running` → `completed` | `failed`).
- `runOutputs` with `outputContent` accumulated via chunk-append, `blindLabel`, token counts, latency.

**Helpers**:
- `convex/lib/crypto.ts`: AES-GCM encrypt/decrypt with HKDF-derived key from `OPENROUTER_KEY_ENCRYPTION_SECRET` env var. Used by `setKey` and `getDecryptedKey`.
- `convex/lib/openrouter.ts`: OpenRouter HTTP client with streaming response parsing.

**Convex functions**:
- `convex/openRouterKeys.ts`: `setKey` (mutation, encrypts), `hasKey` (query, returns boolean only — never returns the key), `getDecryptedKey` (internal helper).
- `convex/runs.ts`: `execute` (mutation: creates `promptRuns` + N empty `runOutputs`, enforces concurrent-run cap, schedules the action), `list`, `get`, `appendOutputChunk` (internal mutation, called by the action on each streamed chunk).
- `convex/runsActions.ts`: `executeRunAction` (Node action: loads test case, substitutes variables, decrypts key, fires N parallel streaming OpenRouter calls, calls `appendOutputChunk` on each chunk, finalizes status + token counts on completion).
- `convex/attachments.ts`: `generateUploadUrl` (mutation), `registerUploaded`, `list`, `delete`, `reorder`. EXIF strip happens on upload (see [[Blind Bench - UX Spec#10 Blind eval security rules]] rule 10).

**Screens**:
- 4.8 Org settings → OpenRouter key
- 4.11 Version editor with the Run button now enabled
- 4.16 Run execution view (streaming)
- 4.17 Run detail (editor/owner)
- `<StreamingOutputPanel>` component
- `<ConcurrentRunGauge>` component
- `<RunStatusPill>` component
- `<ModelPicker>` component with vision filter

### Acceptance criteria
1. Owner can set an OpenRouter key → `openRouterKeys` row exists with an encrypted payload. The key is never visible in any query response, log, or client console.
2. After setting the key, the UI shows "Key set · last rotated {timestamp}". No way to reveal it.
3. With a key set, a test case selected, and a valid model chosen, clicking Run creates a `promptRuns` row and three `runOutputs` rows with empty content and blind labels A/B/C.
4. The client, subscribed to `runs.get(runId)`, sees the three outputs fill in live as chunks arrive. No polling.
5. On completion: `promptRuns.status` flips to `completed`, token counts and latency are written to each `runOutputs` row, and the UI renders them.
6. If OpenRouter returns a 401, the run fails cleanly with a user-facing error ("OpenRouter rejected your API key") and `promptRuns.status = 'failed'`.
7. Vision: a test case with an attached image runs successfully against a vision-capable model (e.g. Gemini 2.0 Flash). The image is passed as either base64 or a signed URL per the model's expected format.
8. EXIF: uploading an image with GPS coordinates → re-downloading the stored version has zero EXIF metadata.
9. Concurrent run cap: after 10 in-flight runs on a project, the 11th throws "10 runs in flight. Wait for one to finish before starting another." The cap is enforced in `runs.execute`, not just in the UI.
10. An Evaluator (from M1) still sees nothing — attempting to call `runs.get` as an Evaluator throws permission denied.

### Testable demo
> Set OpenRouter key → go to version editor → pick a test case → click Run → watch the three columns fill in live → click into the run detail and confirm token counts + latency.

### Out of scope
- Tiptap annotations (M4).
- Blind evaluator view (M4).
- Optimization (M5).
- Cross-version comparison (M6).
- Retry-failed-output (polish in M6).

---

## M4 — Tiptap annotations + blind eval (security boundary)

**Goal**: Owners and Editors can annotate outputs and prompts. Evaluators can annotate outputs in a blind view that rigorously prevents version leakage.

### Deliverables

**Schema**:
- `outputFeedback`
- `promptFeedback` (with `targetField: 'system_message' | 'user_message_template'`)

**Convex functions**:
- `convex/feedback.ts`: `addOutputFeedback`, `listOutputFeedback`, `updateOutputFeedback`, `deleteOutputFeedback`, `addPromptFeedback`, `listPromptFeedback`, `updatePromptFeedback`, `deletePromptFeedback`.
- `convex/runs.ts` additions: `getOutputsForEvaluator(runId)` — returns **only** `{ blindLabel, outputContent, annotations }[]` with no version, run, project, model, temperature, token count, or latency fields. Uses `requireProjectRole(ctx, projectId, ['evaluator'])`.
- `convex/lib/evalTokens.ts`: `mintEvalToken(runId, evaluatorUserId)` returns a 1-hour HMAC'd opaque token; `resolveEvalToken(token)` returns `{ runId, evaluatorUserId }` or throws on expiry/tamper. Tokens do NOT contain `runId`, `versionId`, or `projectId` as substrings.
- `convex/evaluatorInbox.ts`: `listMyInbox` (returns only `{ projectName, runSummary, invitedAt, status }`, one row per pending run for the current evaluator).

**Screens**:
- 4.18 Output viewer with Tiptap annotations
- 4.19 Prompt feedback view (in version editor, review mode)
- 4.20 Feedback viewer side-sheet
- 4.27 Blind evaluator inbox
- 4.28 Blind evaluator view
- `<AnnotatedEditor>` component (the main deliverable of this milestone)
- `<BlindLabelBadge>` component

**Route-level auth**:
- The evaluator shell from [[Blind Bench - UX Spec#3 Role-aware shell]] is fully wired.
- `/eval/:opaqueRunToken` route exists, resolves the token server-side, and redirects to the inbox on failure.
- A user who is Editor or Owner on the underlying project is blocked at `/eval/:opaqueRunToken` per rule 7 in [[Blind Bench - UX Spec#10 Blind eval security rules]].

### Acceptance criteria

**Feedback mechanics (happy path)**:
1. Owner selects text in Output A → comment button appears → popover opens → types comment → submits → annotation persists as a highlight.
2. Owner can edit and delete their own annotation; cannot edit someone else's.
3. Prompt feedback on the system message and user template works the same way.
4. Feedback viewer side-sheet shows every annotation for a version grouped by target.

**Blind eval (security criteria — all must pass)**:
5. Evaluator in `/eval` sees only project name + run summary + timestamp. No version info, no model, no test case name.
6. Evaluator clicks a run → URL is `/eval/{opaqueToken}` with no IDs visible.
7. Page title on the evaluator view is exactly `Evaluation — {project name}`.
8. Devtools network tab: every response on the evaluator view is either a `listMyInbox` result or a `getOutputsForEvaluator` result. No field besides `blindLabel`, `outputContent`, `annotations` appears in any response. **Verified by inspecting the raw JSON payload.**
9. Evaluator manually calls `runs.get(runId)` via the Convex dashboard or devtools — throws permission denied.
10. Evaluator manually calls `versions.get(versionId)` — throws permission denied.
11. Evaluator manually tries to visit `/orgs/:orgSlug/projects/:projectId` — redirected to `/eval` with no flash of content.
12. A user assigned both Editor and Evaluator on the same project, visiting `/eval/:opaqueRunToken`, sees the block notice and cannot annotate in blind mode.
13. Uploading an image with GPS EXIF, then viewing it in the evaluator view → no EXIF in the served image.
14. `view-source` and devtools element inspector contain no `data-version-id`, `data-run-id`, `data-version`, `data-run` attributes anywhere in the DOM of the evaluator view.
15. Copy-to-clipboard from an output contains plain text only — no HTML `data-*` attributes carrying metadata.

**Each of the 13 rules in [[Blind Bench - UX Spec#10 Blind eval security rules]] is demonstrably enforced.**

### Testable demo

> **Part A (happy path)**: As Owner, run a prompt, annotate one output and one line of the prompt, see annotations in the feedback viewer.
>
> **Part B (adversarial security check)**: As Evaluator, sign in, confirm you can ONLY access `/eval` and `/eval/:token`. Open devtools on the evaluator view, check every Convex response, confirm no metadata fields present. Try to hit protected routes and functions directly. Confirm all blocked.

### Out of scope
- Optimization flow (M5).
- Cross-version comparison (M6).

---

## M5 — Optimization + human review

**Goal**: an Owner or Editor can request optimization, see the optimizer's proposed new prompt with reasoning, and accept / edit / reject it.

### Deliverables

**Schema**:
- `optimizationRequests` (with `status`, `generatedSystemMessage`, `generatedUserTemplate`, `changesSummary`, `changesReasoning`, `reviewStatus`, `resultingVersionId`, `optimizerPromptVersion`, `errorMessage`).

**Convex functions**:
- `convex/optimize.ts`: `requestOptimization` (mutation: creates row, schedules action), `getOptimization` (reactive), `cancelOptimization`, `acceptOptimization`, `rejectOptimization`, `editAndAcceptOptimization`, `listOptimizations`.
- `convex/optimizeActions.ts`: `runOptimizerAction` internal action that builds the `OptimizerInput` from [[Blind Bench - Optimizer Meta-Prompt#2 Input schema]], calls OpenRouter with the meta-prompt, validates the output per [[Blind Bench - Optimizer Meta-Prompt#5 Failure modes and action-level validation]], and writes the result.
- `convex/lib/optimizerPrompt.ts`: `OPTIMIZER_META_PROMPT_DEFAULT` constant (a clearly-marked placeholder TODO body for the owner to fill in), `OPTIMIZER_META_PROMPT_VERSION` constant (`v0.1-placeholder`). Env var `OPTIMIZER_META_PROMPT` overrides the constant when set.

**Screens**:
- 4.21 Optimization request (trigger + waiting)
- 4.22 Optimization review (diff + reasoning + accept/edit/reject)
- `<PromptDiff>` component
- `<ChangesPanel>` component

### Acceptance criteria
1. With an `OPENROUTER_KEY` set and feedback collected on v1, clicking "Request optimization" in the version editor creates an `optimizationRequests` row with `status: 'pending'` and schedules the action.
2. The optimization page (`/optimizations/:requestId`) shows the waiting screen with the input preview.
3. On completion, the review screen appears reactively — no refresh needed.
4. The `<PromptDiff>` renders the old vs new prompts side-by-side and toggles to unified.
5. `<ChangesPanel>` renders `changesSummary` (markdown bullets) and `changesReasoning` (prose).
6. Clicking **Accept** creates a new `promptVersions` row with `parentVersionId` = the source version, sets `optimizationRequests.reviewStatus = 'accepted'`, sets `optimizationRequests.resultingVersionId` to the new version, and redirects to the new version's editor.
7. Clicking **Reject** sets `reviewStatus = 'rejected'` and no new version is created.
8. Clicking **Edit and accept** opens an inline editor pre-populated with the proposed new prompt, lets the user tweak, then creates the new version with the edits + `reviewStatus = 'edited'`.
9. Validation failures from [[Blind Bench - Optimizer Meta-Prompt#5 Failure modes and action-level validation]] result in `status: 'failed'` with a user-facing error rendered on the review page (not a crash).
10. `optimizationRequests.optimizerPromptVersion` is set to the current `OPTIMIZER_META_PROMPT_VERSION` value.
11. With the placeholder meta-prompt, the action still completes successfully on a trivial input — the TODO body is just enough scaffolding to return valid JSON that passes validation. (The actual meta-prompt quality is the owner's iteration target post-M5.)
12. The concurrent-run cap does NOT apply to optimization actions — optimizations share a separate implicit cap (1 in-flight optimization per project) enforced by the optimize mutation.

### Testable demo
> Generate feedback on v1 → click Request optimization → watch the waiting screen → review screen appears → click Accept → new v2 exists with the proposed content and links back to the optimization request.

### Out of scope
- Cross-version comparison (M6).
- Meta-prompt iteration (owner's work, not part of the build).
- Showing optimization history on a version (polish in M6).

---

## M6 — Cross-version comparison + polish

**Goal**: the full feedback → optimize → compare → rollback loop works end-to-end on a sample project with good empty states, good error states, and the concurrent-run cap enforced.

### Deliverables

**Convex functions**:
- `convex/runs.ts` additions: `compareAcrossVersions({ testCaseId, versionIds })` — returns `{ versionId: Id<'promptVersions'>, run: promptRuns, outputs: runOutputs[] }[]`. Editor/Owner only.

**Screens**:
- 4.23 Cross-version comparison
- All empty states from [[Blind Bench - UX Spec#9 Empty / error / loading state catalog]]
- All error states from the same section
- First-run onboarding callouts (3 total, from [[Blind Bench - UX Spec#15 Onboarding]])
- Sample project seed checkbox in the "new project" modal
- `<ConcurrentRunGauge>` integrated into the version editor
- Keyboard shortcut cheat sheet modal (`?`)
- Command palette (`⌘K`) with project / version / test case / run fuzzy search

### Acceptance criteria
1. On the Compare screen, picking a test case and two or more versions runs any missing runs in parallel (reusing existing runs for matching test-case × version pairs) and renders a grid.
2. The concurrent-run cap throws on the 11th in-flight run and the client surfaces the message from the mutation.
3. Creating a new project with "Start with a sample project" checked pre-populates a variable, test case, v1, and meta context as described in [[Blind Bench - UX Spec#15 Onboarding]].
4. The three first-run callouts appear in order, dismissible, and never re-appear for the same user.
5. Every empty state and every error state from the UX spec is wired and matches the copy.
6. `⌘K` opens the command palette and can reach every screen.
7. `?` shows the shortcut cheat sheet with the shortcuts available on the current screen.
8. Rollback from v3 → v1 creates v4 with the content of v1 and provenance badge "rolled back from v1" visible in the version editor header.
9. End-to-end loop on a sample project: run v1 → annotate → optimize → accept → run v2 → annotate → compare v1/v2 on the same test case → roll back → run v3 — all without manual DB surgery or reading Convex logs to understand what happened.

### Testable demo
> Full end-to-end walkthrough on a freshly-seeded sample project, ending with a cross-version comparison and a rollback.

### Out of scope
- Landing page (M7).
- CLI / API access (explicitly deferred in [[Blind Bench - Architecture#v1 Scope & Deferred]]).
- Real-time collab / presence (deferred).

---

## M26 — Open Review (non-blind reviewer surface)

**Goal**: open the product to non-technical stakeholders (PM, legal, domain experts) by adding a second reviewer persona with full prompt context, gated by a per-invite `blindMode` flag. Today's blind reviewer (M4 / M10 path) is unchanged; M26 is the open-path counterpart.

> **Persona split.** M10 is the blind path — anonymous A/B/C ratings to keep feedback unbiased. M26 is the open path — informed feedback from someone who needs context. Same `evaluator` role literal in code; the `blindMode` flag selects the persona at invite time.

### Deliverables (issues #160 – #167, shipped as M26.1 – M26.7)

- **M26.1 — Schema substrate (#160).** Add `blindMode: v.optional(v.boolean())` to `projectCollaborators` and `invitations`. `invitations.create()` accepts the flag for `project_evaluator` / `cycle_reviewer` roles (defaults `true`); accept flow propagates to `projectCollaborators` for evaluator rows. Optional → no data wipe.
- **M26.2 — `isBlindReviewer` helper (#161).** New `convex/lib/auth.ts` helper returns `true` iff the principal is an evaluator collaborator with `blindMode ?? true`, or an unauthenticated guest. Rewires `runComments.listForRun` (peer-comment redaction + author-name blinding) and `reviewSessions.resolveScopeOrThrow` (session.role = "evaluator" vs "collaborator" decided by blindness, not role). Role-based mutation gates untouched.
- **M26.3 — Invite-time toggle (#162).** `InviteDialog` shows a "Blind review" checkbox (default ON) for reviewer roles; piped into `invitations.create`. `lookupByToken` returns `blindMode`; landing page header verb + callout vary by mode. Email subject/headline/body branch on `blindMode` for project-scoped reviewer invites.
- **M26.4 — Reviewer dashboard (#163).** New `convex/reviewerHome.getProjectReview` query + `/review/:projectId` route. Sections: project header, current-version preview (markdown), runs-waiting-for-feedback (reactive unread counts), drafts-waiting. `runs.get/list` and `versions.get/getCurrent` admit `evaluator + !blindMode`; blind evaluators stay denied. Invite-accept routes `blindMode === false` project invites here.
- **M26.5 — Read-only `VersionEditor` mode (#164).** `isNonBlindReviewer = role === "evaluator" && blindMode === false` drives a unified read-only path. Right pane hidden, Run/Save/Fork/Optimize buttons hidden, breadcrumb shows "{project} · Latest draft". `feedback.addPromptFeedback` / `listPromptFeedback` admit non-blind evaluators. `RoleBadge` gains a sky "reviewer" variant distinct from amber "evaluator" (blind).
- **M26.6 — Feedback acknowledgment + new-draft email (#165).** Toast confirmation after a non-blind reviewer submits a prompt annotation. New `reviewerNotifications` dedup ledger + `reviewerNotificationActions.sendNewDraftEmails` (Node + Resend) scheduled from `versions.update` after auto-promote to `current`. Rate-limited to one email per (reviewer, project) per 24h. Body includes optimizer's `changesSummary` if applicable.
- **M26.7 — Jargon sweep + Glossary (#166).** Reviewer surfaces relabel "Runs" → "Examples", "User/Assistant/System" → "Example question / Sample answer / Instructions", and the VersionEditor tab strip / editor onboarding callouts hide for non-blind reviewers. Glossary gains "Blind Mode" and "Reviewer" entries.
- **M26.8 — Doc updates (#167).** This entry, plus the Architecture authorization model + invite flow diagram + UX Spec Section 10 + Open Review subsection.

### Acceptance criteria

1. Inviting with `blindMode: false` produces a `projectCollaborators.blindMode === false` row on accept; that user lands on `/review/:projectId` after accepting.
2. The 13 blind-eval rules in UX Spec Section 10 still pass for `blindMode === true` reviewers (criterion #2 of #161).
3. A `blindMode === false` reviewer can read prompts, runs, and versions; cannot mutate any of them (verified by direct Convex calls in `evalSecurity.test.ts`).
4. Editor publishes a new version → each non-blind reviewer receives at most one email per 24h with subject `New draft of {projectName} ready for your review` and CTA to `/review/:projectId`.
5. Reviewer-facing surfaces render none of `v1/v2/vN`, `DRAFT`, `ACTIVE`, `ARCHIVED`, temperature values, or model names.
6. Glossary has a "Blind Mode" entry; UX Spec has the Open Review section; Architecture documents the role + blindMode split.

### Testable demo

> 1. As an owner, invite two collaborators to the same project: one with "Blind review" ON, one with it OFF. 2. Accept both invites in separate browsers. 3. The blind one lands on `/eval`; the open one lands on `/review/:projectId`. 4. The open reviewer leaves a prompt annotation → sees the ack toast. 5. The owner edits and saves the version → both reviewers see the resulting state correctly (open reviewer gets the email; blind reviewer's session reflects the new outputs without leaking version metadata).

### Out of scope

- Renaming the `evaluator` literal in code → `reviewer`. Deferred to a later rename milestone.
- In-app notification bell expansion for reviewers (already exists; reused as-is).
- SMS / Slack delivery of new-draft notifications.
- Project-wide Glossary rename of "Evaluator" → "Reviewer" (bundled with the code rename).

---

## M21 — Multimodal (Image Variables)

**Goal**: support image inputs as a typed [[Blind Bench - Glossary#Project variable]]. Test cases supply per-variable image uploads that splice into user messages as `image_url` content blocks at dispatch. Mirrors OpenRouter's OpenAI-compatible multimodal format (mime allowlist: jpeg/png/webp/gif; base64 data URLs; vision-capable models gated via `architecture.input_modalities`). LLM output remains text — images are input-only context.

> **Reactivation note.** M21 was originally scoped to in-prompt image paste/upload (extending `promptAttachments`). Reactivated 2026-04-29 with a redefined scope around image-as-variable, which is the surface users actually need. The original scope (issues #127, #128, #129) is closed as superseded; legacy `promptAttachments` behavior is unchanged and out of scope here.

### Deliverables (issues #177 – #187, shipped as M21.0 – M21.10)

- **M21.0 — Docs (#177).** This entry, plus Architecture (Data Model, Template Syntax §Image variables, File Storage, Function Index for `imageVariableAttachments.ts`), UX Spec (§4.12 Variable manager, §4.13 Test case manager, §4.14 Test case editor, §10 M21 surface addition), and Glossary (Image variable, updated Attachment / Project variable / Test case entries).
- **M21.1 — Schema (#178).** Add `type: "text" | "image"` to `projectVariables` (default text). Add `variableAttachments: record<string, _storage id>` to `testCases`. Reject `defaultValue` on image-typed variables. Lock type at creation (update mutations cannot change it).
- **M21.2 — Storage module (#179).** New `convex/imageVariableAttachments.ts` (mirrors `attachments.ts`): `generateUploadUrl`, `getUrl`, `delete`. Mime allowlist (jpeg/png/webp/gif), 5MB cap, zero-byte rejection. Owner/editor only on write paths.
- **M21.3 — Template validation (#180).** Extend `convex/lib/templateValidation.ts`: `{{varName}}` tokens for image-typed variables may only appear in messages with role `user`. Reject in system / developer / assistant with named error. Wired into `versions.create` and `versions.update`.
- **M21.4 — Variable definition UI (#181).** Type radio in `AddVariableDialog` (Text / Image, default Text). Hide `Default value` when Image is selected. Variables table column shows type with icon. Type radio disabled in edit mode (cannot change after creation).
- **M21.5 — Test case editor upload widget (#182).** Branch `TestCaseEditor` rendering on variable type. Image vars get a dropzone with empty / uploading / uploaded states, replace + remove buttons. Replace deletes the prior storage blob atomically; remove deletes the blob and clears the entry; cancelled uploads are cleaned up on cancel/unmount. Required-image-no-value blocks save.
- **M21.6 — Dispatch (#183).** Rewrite `buildDispatchMessages` to walk user messages for `{{imageVar}}` tokens and emit `[text, image_url, text]` content arrays. Image blocks are base64 data URLs (`data:<mime>;base64,...`) fetched fresh per run from Convex storage. Messages with no image tokens still emit `content: string`. `promptAttachments` (in-prompt images) continue to append to the last user message.
- **M21.7 — Vision capability gate (#184).** Extend `convex/modelCatalog.ts` to capture `architecture.input_modalities` from OpenRouter `/api/v1/models`. Pre-dispatch check in `runs.execute`: if test case has any non-empty `variableAttachments`, model must include `"image"` in `input_modalities`; otherwise fail run early with `"Model {modelId} doesn't support image inputs."`.
- **M21.8 — Optimizer guardrails (#185).** Update `OPTIMIZER_META_PROMPT` to declare image variable tokens as immutable scaffolding. Pass image variable names into the meta-prompt rendering. Post-process optimizer output: reject any rewrite that drops, renames, or relocates an image variable token out of a user message; retry once.
- **M21.9 — Blind eval visibility (#186).** Render image variable values as thumbnails in the test case context panel for all reviewer roles, including blind. Click → lightbox at full resolution. Audit against Section 10 — image is test input (allowed), not prompt content (forbidden). No `data-version-id` / `data-run-id` attributes on image elements; storage URLs stay opaque.
- **M21.10 — Cascade-delete (#187).** On test case delete, image-typed variable delete, or project delete: delete the referenced storage blobs (`ctx.storage.delete`). Idempotent. No orphans.

### Acceptance criteria

1. A project owner can create an image-typed variable (e.g., `image_attachment`) — `Default value` field is hidden in the dialog, type is locked after creation.
2. A test case for that project shows an upload widget for the image variable; uploading a JPG/PNG/WebP/GIF ≤ 5MB succeeds; uploading a TIFF, an SVG, or a 6MB file is rejected with a clear error.
3. Saving a version with `{{image_attachment}}` in the user template succeeds; saving with the same token in the system message is rejected with `"Image variable image_attachment cannot appear in system messages — image variables are user-message-only"`.
4. Running that version + test case against a vision-capable model (e.g., a GPT-4o or Claude Sonnet route) succeeds; the LLM's text response demonstrably uses information from the image. Running against a non-vision model fails before dispatch with `"Model {id} doesn't support image inputs."`.
5. Replacing the image on a test case deletes the prior storage blob (verified via `ctx.storage.list`); deleting a test case, an image variable, or a project deletes all referenced blobs.
6. The optimizer asked to rewrite a prompt containing `{{image_attachment}}` returns a rewrite that still contains exactly the same image variable token in a user message; an attempted rewrite that drops it triggers a single retry then surfaces an error to the requester.
7. A blind reviewer's session for a run on an image-bearing test case shows the image as a thumbnail in the test case context panel; the network response and rendered DOM contain no `versionId`, `runId`, `projectId`, model name, file size, or filename for the image (Rule 6, 8, 13 from [[Blind Bench - UX Spec#10 Blind eval security rules]]).
8. Glossary contains an `Image variable` entry; Architecture documents the schema, template syntax restriction, dispatch shape, and capability gate; UX Spec §4.12 / §4.13 / §4.14 reflect the type selector + upload widget; this Build Plan entry is present.

### Testable demo

> 1. Owner creates a project with one image variable (`image_attachment`, required) and one text variable (`task`). 2. Owner creates two test cases — each with a different uploaded image (PNG and JPEG) and a distinct `task` value. 3. Owner writes a version: system message `"You are a helpful assistant."`; user template contains both `{{task}}` and `{{image_attachment}}`. 4. Owner runs the version against test case A on a vision-capable Anthropic Claude model and a non-vision text model. 5. Vision run succeeds with three streaming outputs that reference image content; non-vision run fails before dispatch with the named error. 6. Owner replaces test case A's image, re-runs — old blob is gone from storage, new image is reflected in the dispatched payload. 7. Owner invites a blind reviewer; reviewer sees the image as a thumbnail in the test case context panel of `/eval/:token` with no leaked metadata. 8. Owner triggers optimization on the version — proposed rewrite preserves `{{image_attachment}}` in a user message verbatim.

### Out of scope

- **In-prompt image attachments on prompt versions** — existing `promptAttachments` behavior is unchanged. If the in-prompt-paste use case becomes a priority, file a follow-up milestone.
- **Audio / video / file inputs** — multimodal scope is images only in v1.
- **Image generation outputs** — LLM still returns text only; this milestone is input-side only.
- **Lists of images per variable** — exactly one image per variable per test case in v1.
- **Project-level default images** — image variables have no `defaultValue`. Each test case supplies its own.
- **Run history snapshotting** — runs reference live test cases; if an image is replaced after a run, looking back at the run shows the current image (same drift as text variables today). Filed as a separate forward-looking issue (#188).

---

## M7 — Landing page (separate Vercel deployment)

**Goal**: a public marketing URL that funnels to the app's sign-in.

### Deliverables
- A second Vercel project, separate codebase or subfolder, deploying from a `landing/` directory or a separate repo.
- A single static page with tagline, short explainer, and a "Sign in" button pointing at the app's `/auth/sign-in` URL.

### Acceptance criteria
1. The landing URL resolves publicly.
2. The "Sign in" button links to the app, preserving a redirect-back target if meaningful.
3. The landing is independently deployable without affecting the app.

### Testable demo
> Visit the landing URL anonymously, click Sign in, complete the flow, land on the app.

### Out of scope
- Marketing content beyond a tagline and a paragraph.
- SEO work.
- Analytics beyond the Vercel default.

---

## Out of scope for v1 (restated)

These carry forward from [[Blind Bench - Architecture#v1 Scope & Deferred]] so this doc is self-contained:

- **Real-time collaborative editing**. Single-editor-at-a-time with last-write-wins in v1.
- **Langfuse / LiteLLM observability**. The action-layer seam exists; wiring is a future PR.
- **Multi-org admin flows**. Basic create/invite works; audit logs, SSO, SCIM wait.
- **Billing / pricing / dollar budgets**. BYOK sidesteps this.
- **Per-user rate limits**. Only the concurrent-run cap.
- **CLI / CI-CD integrations**. Possible later because everything is a Convex function.
- **Branching versions**. Linear only in v1; schema leaves room.
- **External HTTP API**. Deferred — would be a thin `convex/http.ts` layer with `httpAction` wrappers.

---

## Testing strategy per milestone

**Manual smoke per milestone**: walk the testable demo end-to-end on the deployed Vercel URL. This is the primary verification mechanism.

**Convex function-level assertion tests**:
- M1: `requireProjectRole` behavior under each role.
- M3: `runs.execute` concurrent cap, encryption round-trip on `openRouterKeys`.
- **M4 (non-negotiable)**: every authorization check on the runs/versions/feedback functions must have a test proving an Evaluator is rejected and an Editor/Owner is allowed. Plus a test that `getOutputsForEvaluator` returns only the expected fields.
- M5: optimizer output validation — every failure mode from [[Blind Bench - Optimizer Meta-Prompt#5 Failure modes and action-level validation]] has a test that feeds in a crafted bad output and asserts the request fails with the right error message.

**No E2E framework in v1.** Playwright and similar are deferred.

**Adversarial check at M4**: sit down with devtools open and try to break blind eval. Check every rule in [[Blind Bench - UX Spec#10 Blind eval security rules]] manually. If you find a leak, the milestone is not done.

---

## Definition of done (per milestone)

A milestone is done when ALL of:

1. **Every acceptance criterion passes** on the deployed Vercel URL.
2. **The testable demo runs end-to-end** without manual intervention beyond the steps described.
3. **Architecture doc and UX spec are still accurate**. If the milestone required changes, update the docs in the same commit.
4. **A short demo clip or walkthrough is captured** (video or structured screenshots) so the user can verify without running it themselves.

A milestone is not done if:
- Acceptance criteria are "mostly passing".
- Tests exist but fail.
- The testable demo requires manual DB edits or console hacks to work.
- The agent claims success without walking the demo.

---

## Related
- [[Blind Bench - Architecture]]
- [[Blind Bench - UX Spec]]
- [[Blind Bench - Optimizer Meta-Prompt]]
- [[Blind Bench - Glossary]]
- [[MOC - Blind Bench]]
