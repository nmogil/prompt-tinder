/**
 * Static fixture data for the "Show me an example" starter project.
 *
 * This module returns plain values only — no DB access. The seeder in
 * `convex/sampleSeed.ts` reads these and writes them into Convex tables. The
 * resulting project is fully mutable from minute zero (M29.3) — these
 * fixtures are the *initial* content, not read-only seed data. Updating the
 * fixtures here does NOT retroactively change projects already cloned by
 * existing users; cloneStarter is one-shot per invocation.
 */

export const SAMPLE_REVIEWER_NAME = "Reviewer A";
export const SAMPLE_REVIEWER_EMAIL = "reviewer-a@blindbench.example";

export const SAMPLE_PROJECT_NAME = "Example: Tone rewrite";
export const SAMPLE_PROJECT_DESCRIPTION =
  "A guided sample showing the full Blind Bench loop — prompt → outputs → feedback → optimizer suggestion.";

export const SAMPLE_VARIABLE_NAME = "draft";

export const SAMPLE_TEST_CASE_NAME = "Refund-denial reply";
export const SAMPLE_TEST_CASE_DRAFT =
  "Hi, we got your refund request. Per our policy returns are not accepted after 30 days, and your purchase was 47 days ago, so we cannot process this. Sorry for the inconvenience.";

export const SAMPLE_SYSTEM_MESSAGE =
  "You rewrite customer service replies in a warmer, more empathetic tone. Keep the original meaning and any factual constraints intact. Do not add new policies, dates, or commitments. Reply with only the rewritten message — no preamble.";

export const SAMPLE_USER_TEMPLATE =
  "Rewrite this reply in a warmer tone:\n\n{{draft}}";

export const SAMPLE_OUTPUTS: { blindLabel: string; model: string; content: string }[] = [
  {
    blindLabel: "A",
    model: "openai/gpt-4o-mini",
    content:
      "Hi there — thank you so much for reaching out, and I'm really sorry for the frustration here. I took a careful look at your order, and unfortunately our return policy only covers requests made within 30 days of purchase. Since your order was placed 47 days ago, I'm not able to process a refund on this one. I completely understand this isn't the answer you were hoping for, and I appreciate your patience as I looked into it.",
  },
  {
    blindLabel: "B",
    model: "anthropic/claude-3-5-haiku",
    content:
      "Thanks for getting in touch about your refund request. I really wish I had better news. Our return window is 30 days from the purchase date, and your order falls just outside that at 47 days, so I'm not able to issue a refund this time. I know that's disappointing — please don't hesitate to reach out if there's anything else we can help with.",
  },
  {
    blindLabel: "C",
    model: "google/gemini-2.0-flash",
    content:
      "Hello! Thanks for writing in. I'm sorry — I wanted to help with your refund, but I'm seeing this purchase was 47 days ago, and our policy only allows returns within 30 days. That puts this one outside what I'm able to approve. I really appreciate you giving us a chance to take another look, and I hope we can make it up to you on a future order.",
  },
];

// Two structured annotations from "Reviewer A" — one positive, one critique.
// from/to indices reference offsets in SAMPLE_OUTPUTS[i].content.
export const SAMPLE_ANNOTATIONS: {
  outputIndex: number;
  from: number;
  to: number;
  highlightedText: string;
  comment: string;
  label: "praise" | "suggestion" | "issue" | "thought";
}[] = [
  {
    outputIndex: 0,
    from: 0,
    to: 64,
    highlightedText:
      "Hi there — thank you so much for reaching out, and I'm really sorry",
    comment:
      "Strong empathetic opener. Acknowledges the customer's feeling before delivering bad news.",
    label: "praise",
  },
  {
    outputIndex: 2,
    from: 0,
    to: 9,
    highlightedText: "Hello! T",
    comment:
      "\"Hello!\" feels too cheerful for a refund denial — consider matching the warmth without the exclamation point.",
    label: "suggestion",
  },
];

export const SAMPLE_OPTIMIZER_SYSTEM =
  "You rewrite customer service replies in a warmer, more empathetic tone. Open by acknowledging the customer's frustration before delivering any constraint or denial. Keep the original meaning and any factual constraints intact. Do not add new policies, dates, or commitments. Avoid cheerful punctuation (e.g. exclamation points) when the message contains a denial. Reply with only the rewritten message — no preamble.";

export const SAMPLE_OPTIMIZER_USER_TEMPLATE = SAMPLE_USER_TEMPLATE;

export const SAMPLE_OPTIMIZER_SUMMARY =
  "Lead with empathy before the constraint; suppress cheerful punctuation in denials.";

export const SAMPLE_OPTIMIZER_REASONING =
  "Reviewer A praised opener empathy in output A and flagged output C's exclamation point as off-tone. The new system message bakes both signals into explicit instructions so future generations follow them by default.";

export const SAMPLE_OPTIMIZER_MODEL = "anthropic/claude-3-5-sonnet";
export const SAMPLE_OPTIMIZER_PROMPT_VERSION = "sample-v1";
