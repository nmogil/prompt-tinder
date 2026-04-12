import Google from "@auth/core/providers/google";
import { Resend } from "resend";
import { convexAuth } from "@convex-dev/auth/server";
import { Email } from "@convex-dev/auth/providers/Email";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Google,
    Email({
      id: "resend",
      async sendVerificationRequest({ identifier, url, token }) {
        if (!process.env.RESEND_API_KEY) {
          // In dev without Resend, log the OTP code so you can still sign in
          console.log(`[DEV] Magic link code for ${identifier}: ${token}`);
          return;
        }
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "Hot or Prompt <noreply@hotorprompt.com>",
          to: identifier,
          subject: "Sign in to Hot or Prompt",
          html: `
            <h2>Sign in to Hot or Prompt</h2>
            <p>Click the link below to sign in:</p>
            <p><a href="${url}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Sign in</a></p>
            <p style="color:#666;font-size:14px;">This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
          `,
        });
      },
    }),
  ],
});
