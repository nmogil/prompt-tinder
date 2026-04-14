import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { captureEvent } from "./lib/posthog";

/**
 * Internal action for scheduling PostHog analytics from mutations.
 * Mutations cannot make HTTP requests in Convex, so they schedule this
 * action to fire analytics asynchronously.
 */
export const track = internalAction({
  args: {
    event: v.string(),
    distinctId: v.string(),
    properties: v.optional(v.any()),
  },
  handler: async (_ctx, args) => {
    await captureEvent(args.event, args.distinctId, args.properties);
  },
});
