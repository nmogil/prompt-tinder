/**
 * Lightweight PostHog analytics reporter for Convex actions.
 *
 * Convex actions run in a sandboxed V8 environment where posthog-node
 * cannot be used directly. This module posts events to PostHog's HTTP
 * capture endpoint via fetch().
 *
 * SAFETY: Never send API keys, user emails, or sensitive prompt content.
 * Only include: user IDs, resource IDs, and event-relevant metadata.
 */

export async function captureEvent(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const apiKey = process.env.POSTHOG_API_KEY;
  const host = process.env.POSTHOG_HOST;
  if (!apiKey || !host) return;

  try {
    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: distinctId,
        properties: {
          ...properties,
          $lib: "posthog-node",
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Swallow — analytics should never break the action
  }
}

export async function captureException(
  error: Error,
  distinctId?: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const apiKey = process.env.POSTHOG_API_KEY;
  const host = process.env.POSTHOG_HOST;
  if (!apiKey || !host) return;

  try {
    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event: "$exception",
        distinct_id: distinctId ?? "server",
        properties: {
          ...properties,
          $exception_message: error.message,
          $exception_type: error.name,
          $exception_stack_trace_raw: error.stack,
          $lib: "posthog-node",
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Swallow — error tracking should never break the action
  }
}
