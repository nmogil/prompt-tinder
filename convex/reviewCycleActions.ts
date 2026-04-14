"use node";

import { Resend } from "resend";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";

const SITE_URL =
  process.env.SITE_URL ?? "https://blindbench.dev";

export const sendCycleAssignmentEmail = internalAction({
  args: {
    evaluatorEmail: v.string(),
    evaluatorName: v.optional(v.string()),
    cycleName: v.string(),
    projectName: v.string(),
    cycleEvalToken: v.string(),
  },
  handler: async (_ctx, args) => {
    if (!process.env.RESEND_API_KEY) {
      console.log(
        `[DEV] Cycle assignment email for ${args.evaluatorEmail}: ${SITE_URL}/eval/cycle/${args.cycleEvalToken}`,
      );
      return;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const evalUrl = `${SITE_URL}/eval/cycle/${args.cycleEvalToken}`;

    await resend.emails.send({
      from: "Blind Bench <noreply@blindbench.dev>",
      to: args.evaluatorEmail,
      subject: `Review cycle: ${args.cycleName}`,
      html: `
        <h2>You've been invited to evaluate</h2>
        <p>Hi${args.evaluatorName ? ` ${args.evaluatorName}` : ""},</p>
        <p>You've been assigned to review <strong>${args.cycleName}</strong> for the project <strong>${args.projectName}</strong>.</p>
        <p>Outputs have been shuffled and labeled to remove bias. Rate each output and leave feedback.</p>
        <p><a href="${evalUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Start Evaluation</a></p>
        <p style="color:#666;font-size:14px;">This link expires in 24 hours.</p>
      `,
    });
  },
});

export const sendCycleReminderEmail = internalAction({
  args: {
    evaluatorEmail: v.string(),
    evaluatorName: v.optional(v.string()),
    cycleName: v.string(),
    projectName: v.string(),
    cycleEvalToken: v.string(),
    ratedCount: v.number(),
    totalCount: v.number(),
  },
  handler: async (_ctx, args) => {
    if (!process.env.RESEND_API_KEY) {
      console.log(
        `[DEV] Cycle reminder email for ${args.evaluatorEmail}: ${args.ratedCount}/${args.totalCount} rated`,
      );
      return;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const evalUrl = `${SITE_URL}/eval/cycle/${args.cycleEvalToken}`;

    await resend.emails.send({
      from: "Blind Bench <noreply@blindbench.dev>",
      to: args.evaluatorEmail,
      subject: `Reminder: ${args.cycleName} is waiting for your review`,
      html: `
        <h2>Review cycle reminder</h2>
        <p>Hi${args.evaluatorName ? ` ${args.evaluatorName}` : ""},</p>
        <p><strong>${args.cycleName}</strong> for <strong>${args.projectName}</strong> is waiting for your evaluation.</p>
        <p>You've rated ${args.ratedCount} of ${args.totalCount} outputs so far.</p>
        <p><a href="${evalUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Continue Evaluation</a></p>
      `,
    });
  },
});
