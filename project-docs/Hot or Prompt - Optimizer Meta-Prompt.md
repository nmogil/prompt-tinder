---
title: "Hot or Prompt - Optimizer Meta-Prompt"
created: 2026-04-11
modified: 2026-04-11
type: spec
status: scaffolding
tags:
  - hot-or-prompt
  - optimizer
  - meta-prompt
  - spec
---

# Hot or Prompt — Optimizer Meta-Prompt

> Part of [[MOC - Hot or Prompt]]

This doc specifies the **scaffolding** around the optimizer meta-prompt — the fixed system prompt the optimize loop runs to turn feedback into a proposed new prompt. The actual prompt text is a deliberate TODO the owner drafts separately, because it's the core IP of the product and iterating on it is the product. Everything here locks the input/output shape, validation, storage, versioning, and evaluation approach so the rest of the system can be built around a stable contract.

See also:
- [[Hot or Prompt - Architecture#How optimization executes]] — the Convex action flow that wraps this prompt
- [[Hot or Prompt - Architecture#Data Model (Convex Schema)]] → `optimizationRequests` table — where the output is written
- [[Hot or Prompt - UX Spec]] → Optimization review screen — where a human accepts / edits / rejects the output

---

## 1. Purpose

The optimizer meta-prompt closes the loop between human feedback and prompt iteration. Given the current [[Hot or Prompt - Glossary#Version]], the [[Hot or Prompt - Glossary#Meta context]], and every piece of [[Hot or Prompt - Glossary#Output feedback]] and [[Hot or Prompt - Glossary#Prompt feedback]] collected against that version, it produces a proposed new system message, a new user template, a summary of changes, and reasoning grounded in specific feedback items. A human then reviews and accepts / edits / rejects via the [[Hot or Prompt - UX Spec]]'s optimization review screen.

**Why it's a placeholder here.** The architecture and UX spec are designed around a stable input/output contract so the optimizer can be iterated independently. The owner drafts and iterates the prompt text; the system around it (schema, validation, storage, review flow) does not change.

---

## 2. Input schema

Exactly what `optimizeActions.runOptimizerAction` reads out of Convex and passes in as context. All fields are required unless marked optional.

```ts
interface OptimizerInput {
  // The prompt being optimized
  currentSystemMessage: string | null;
  currentUserTemplate: string;

  // Every variable defined on the project — the new template MUST only reference these
  projectVariables: Array<{
    name: string;
    description?: string;
    required: boolean;
  }>;

  // Annotations left on specific outputs
  outputFeedback: Array<{
    blindLabel: string;       // "A" | "B" | "C" — which output this feedback is on
    highlightedText: string;  // the span the commenter selected
    comment: string;          // their comment
    authorName?: string;      // optional, for author-aware reasoning
  }>;

  // Annotations left on the prompt itself (not on outputs)
  promptFeedback: Array<{
    targetField: 'system_message' | 'user_message_template';
    highlightedText: string;
    comment: string;
    authorName?: string;
  }>;

  // Project-level Q&A the owner filled in once — "What domain? What tone? Who's the end user?"
  metaContext: Array<{ question: string; answer: string }>;
}
```

**Notes:**
- `outputFeedback` is already blinded at read time — the action loads it via an internal query that strips `runId`/`versionId`/`outputId` from the payload. The prompt never sees which output is A/B/C in terms of version, just the letter.
- `promptFeedback` is the only place that distinguishes system message vs user template.
- `projectVariables` is the authoritative list for variable validation on the output side (see Section 5).
- If a project has no meta context set yet, `metaContext` is an empty array — the prompt should handle this gracefully.

---

## 3. Output schema

Strict JSON. The action parses this and validates every field before writing an `optimizationRequests` row. Any failure transitions the request to `status: 'failed'` with a user-facing error message and does not create a new version.

```ts
interface OptimizerOutput {
  // The proposed new prompt
  newSystemMessage: string | null;
  newUserTemplate: string;

  // Markdown bullet list — what changed, at a glance
  changesSummary: string;

  // Prose — why, grounded in specific feedback items
  // Must cite feedback by blindLabel (for output feedback) or by targetField (for prompt feedback)
  changesReasoning: string;
}
```

**Why a fixed JSON shape:** the review UI renders `changesSummary` and `changesReasoning` in distinct panels, and the diff view between old and new needs the two new prompt fields as plain strings. Anything more creative (tool use, function calling, multi-turn) would require changing the action — so start here and widen deliberately.

---

## 4. Constraints the meta-prompt must enforce

The prompt text itself must make the model comply with all of these. Section 5 then double-checks at the action level so a non-compliant output fails cleanly instead of corrupting data.

1. **Variables are a closed set.** `newUserTemplate` may reference only variables whose names appear in `projectVariables`. Inventing a new variable is forbidden. Remove a variable only if zero feedback items justify keeping it AND the variable is not marked `required: true`.
2. **Changes must be grounded.** Every change implied by `changesSummary` must correspond to at least one feedback item cited in `changesReasoning`. No changes "for style" unless a feedback item says so. No re-phrasing for rephrasing's sake.
3. **Citations are explicit.** `changesReasoning` must cite specific feedback by `blindLabel` ("Feedback on Output B") or by `targetField` ("Feedback on the system message") and quote the commenter's language where useful. "Vague improvements" don't count.
4. **Required variables are load-bearing.** If `projectVariables[i].required === true`, the new template must still reference `{{name}}` at least once. The owner marked it required for a reason.
5. **Template syntax is minimal Mustache.** Only `{{name}}` substitution and `\{{literal}}` escape. No `{{#if}}`, no `{{#each}}`, no `{{> partial}}`, no helpers. See [[Hot or Prompt - Architecture#Template Syntax]].
6. **Meta context constrains tone and voice.** If the owner said "formal, legal domain, audience is insurance underwriters", the new prompt should not drift toward casual chat-assistant prose unless a feedback item specifically asks for that.
7. **Preserve intent, not wording.** The goal is a better prompt that accomplishes the same task, not a minimally-edited diff. Rewriting is allowed when feedback justifies it.
8. **One iteration, not a lecture.** `changesReasoning` is targeted commentary on the diff, not a general essay on prompt engineering.

The prompt text should spell these out in the order above and include 1–2 worked examples that demonstrate grounding citations.

---

## 5. Failure modes and action-level validation

The action (`optimizeActions.runOptimizerAction`) runs every output through these checks. Any failure sets `optimizationRequests.status = 'failed'`, `errorMessage`, and surfaces the reason to the user in the review screen.

| Check | Condition | Error message (user-facing) |
|---|---|---|
| JSON parse | LLM output is not valid JSON matching `OptimizerOutput` | "The optimizer returned malformed output. Try again or adjust the meta-prompt." |
| Missing required fields | Any of `newUserTemplate`, `changesSummary`, `changesReasoning` missing or empty | "The optimizer returned an incomplete response." |
| Unknown variable | `newUserTemplate` references `{{x}}` where `x` is not in `projectVariables` | "The optimizer referenced unknown variable `{{x}}`." |
| Template syntax | `newUserTemplate` contains `{{#...}}`, `{{> ...}}`, `{{&...}}`, or other Mustache features outside the minimal subset | "The optimizer used unsupported template syntax." |
| Dropped required variable | A variable marked `required: true` is missing from `newUserTemplate` | "The optimizer dropped a required variable (`{{x}}`)." |
| No-op change | `newUserTemplate === currentUserTemplate` AND `newSystemMessage === currentSystemMessage` | "The optimizer returned the same prompt — nothing to review." |
| Reasoning without citation | `changesReasoning` does not contain at least one blind label reference (A/B/C) or "system message" / "user template" | "The optimizer's reasoning was not grounded in specific feedback." |

Validation is mechanical — no LLM judge in v1. The prompt is responsible for compliance; the action is responsible for catching non-compliance cheaply.

---

## 6. Where the prompt text lives

- **Primary**: a Convex env var `OPTIMIZER_META_PROMPT`, read at action execution time. Changes deploy by updating the env var in the Convex dashboard — no code deploy needed.
- **Fallback**: a constant `OPTIMIZER_META_PROMPT_DEFAULT` in `convex/lib/optimizerPrompt.ts`, used in local dev when the env var is unset. The fallback is the canonical checked-in version of the prompt.
- **The prompt is NOT stored per-organization or per-project in v1.** All projects use the same meta-prompt. A future iteration might allow per-project overrides but that's out of scope now.

---

## 7. Versioning the meta-prompt

Store `optimizerPromptVersion: string` on every `optimizationRequests` row so we can analyze which meta-prompt version produced which result. Version strings are monotonic tags like:

```
v0.1-placeholder    # initial TODO stub
v0.2-draft          # first real draft
v0.3-cites-required # added citation requirement
...
```

When the env var changes, the action reads the new `optimizerPromptVersion` from either a second env var (`OPTIMIZER_META_PROMPT_VERSION`) or a header/comment in the prompt text (`# version: v0.3-cites-required` on the first line). Pick one mechanism in implementation and document it here.

This enables two analyses later:
1. **Acceptance rate by version** — what percentage of optimizations using meta-prompt vN were accepted vs rejected?
2. **Regression hunting** — if accepts drop after a meta-prompt change, we know exactly which version introduced it.

---

## 8. Evaluation approach

How do we know a new meta-prompt version is better than the previous one?

### 8a. Golden fixture set (offline)

Maintain a frozen set of ~10 `OptimizerInput` fixtures representing the product's real-world distribution — customer support, translation, classification, summarization, extraction, code generation, etc. Each fixture has:
- The input (serialized `OptimizerInput` JSON)
- A reference `OptimizerOutput` produced by the previous meta-prompt version, captured at the time
- Human notes on what the ideal output would look like

Before releasing a new meta-prompt version, run it against all 10 fixtures and manually review the outputs. Don't automate the judge — prompt engineering is a craft and automated evals for prompt-of-prompts are unreliable. Ten manual reviews is cheap.

Fixtures live in `convex/lib/optimizerFixtures.ts` or a sibling file. They're not seeded into the production DB — they're a test artifact.

### 8b. Acceptance rate (online)

Once in production, track `accepted / total` optimization requests per `optimizerPromptVersion`. This is a weak signal but a real one — if users reject 80% of a new version's outputs, something regressed. Surface this in a simple admin view later.

### 8c. What not to do in v1

- **No LLM-as-judge.** Brittle, hallucinatory, expensive.
- **No automated diff quality scoring.** "Fewer words changed = better" is a terrible metric and gives the optimizer an incentive to no-op.
- **No A/B testing on real users.** Not enough volume in v1 to reach significance.

---

## 9. Example inputs and outputs (placeholder)

Deliberately mundane examples. The real meta-prompt is the owner's to draft — these exist to make the shape concrete for an agent implementing the scaffolding.

### Example A — tone adjustment

**Input fragment:**
```json
{
  "currentSystemMessage": "You are a helpful customer support agent. Answer the user's question.",
  "currentUserTemplate": "Customer message: {{message}}",
  "projectVariables": [
    { "name": "message", "required": true }
  ],
  "outputFeedback": [
    {
      "blindLabel": "A",
      "highlightedText": "Dear valued customer, I appreciate your inquiry.",
      "comment": "Too formal. Our brand is casual and direct."
    },
    {
      "blindLabel": "B",
      "highlightedText": "I understand your concern.",
      "comment": "Still sounds like a form letter."
    }
  ],
  "promptFeedback": [],
  "metaContext": [
    { "question": "Brand voice?", "answer": "Casual, direct, friendly but not chatty. Think a competent friend, not a butler." }
  ]
}
```

**Output fragment (shape only — do not treat as a reference):**
```json
{
  "newSystemMessage": "You're a customer support agent for a brand that speaks casually and directly. Help the user like a competent friend, not a butler. No form-letter openers. Get to the answer.",
  "newUserTemplate": "Customer message: {{message}}",
  "changesSummary": "- Rewrote system message to lock in casual, direct tone\n- Removed any implication of formal openings\n- Added 'get to the answer' as an explicit instruction",
  "changesReasoning": "Feedback on Output A (\"Too formal\") and Output B (\"still sounds like a form letter\") both point at tone drift. The meta context explicitly says 'casual, direct, friendly but not chatty — competent friend, not butler', which the current system message doesn't enforce. The rewrite operationalizes the meta context into concrete instructions the model can follow."
}
```

### Example B — rule addition

**Input fragment:**
```json
{
  "currentSystemMessage": null,
  "currentUserTemplate": "Translate the following text from English to French: {{text}}",
  "projectVariables": [
    { "name": "text", "required": true }
  ],
  "outputFeedback": [
    {
      "blindLabel": "C",
      "highlightedText": "Casser sa pipe",
      "comment": "Translated 'kick the bucket' literally. Should recognize idioms and translate them to the French equivalent, not word-for-word."
    }
  ],
  "promptFeedback": [],
  "metaContext": [
    { "question": "Intended audience?", "answer": "Native French speakers reading casual prose." }
  ]
}
```

**Output fragment (shape only):**
```json
{
  "newSystemMessage": "You are a translator. Render English text into natural, idiomatic French suitable for native speakers. When the source contains idioms, translate the idiom to its closest French equivalent — do not translate literally.",
  "newUserTemplate": "Translate the following text from English to French: {{text}}",
  "changesSummary": "- Added a system message that requires idiomatic translation\n- Left the user template unchanged since the feedback is about behavior, not phrasing",
  "changesReasoning": "Feedback on Output C specifically calls out a literal translation of an idiom ('kick the bucket' → 'casser sa pipe') where the commenter expected the French equivalent. The meta context confirms the audience is native French speakers, so idiomatic rendering is the correct target. The fix is a system message rule, not a user template change, because the issue is a class of behavior not a phrasing problem."
}
```

---

## 10. The actual prompt text

> **TODO (owner).**
>
> Draft a system prompt that:
> 1. Takes an `OptimizerInput` (serialized as the model's context — format TBD but probably a clearly-delimited JSON block or structured sections).
> 2. Returns exactly one JSON object matching `OptimizerOutput`.
> 3. Enforces all 8 constraints in Section 4.
> 4. Includes 1–2 worked examples of grounded reasoning.
>
> The rest of the system — schema, validation, action flow, review UI — is designed around this contract and does not need to change as the prompt iterates.
>
> Store the draft in `convex/lib/optimizerPrompt.ts` as `OPTIMIZER_META_PROMPT_DEFAULT`, and copy it into the `OPTIMIZER_META_PROMPT` Convex env var for deployment. Tag the first real draft as `v0.2-draft` in `OPTIMIZER_META_PROMPT_VERSION`.

---

## Related
- [[Hot or Prompt - Architecture]] — especially [[Hot or Prompt - Architecture#How optimization executes]] and the `optimizationRequests` schema
- [[Hot or Prompt - UX Spec]] — the optimization review screen consumes this output
- [[Hot or Prompt - Build Plan]] — milestone M5 integrates this scaffolding
- [[Hot or Prompt - Glossary#Optimizer meta-prompt]]
- [[MOC - Hot or Prompt]]
