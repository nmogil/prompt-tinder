<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Blind Bench Convex backend. Because Convex mutations run in a transactional V8 isolate that cannot make HTTP requests directly, the integration uses two patterns:

1. **Direct capture** in Convex `internalAction` files (`runsActions.ts`, `optimizeActions.ts`) via a lightweight fetch-based helper (`convex/lib/posthog.ts`) — mirrors the existing Sentry reporter pattern.
2. **Scheduled capture** from mutations via a new `convex/analyticsActions.ts` internal action, scheduled with `ctx.scheduler.runAfter(0, ...)` — the standard Convex pattern for side-effects that need HTTP.

Environment variables `POSTHOG_API_KEY` and `POSTHOG_HOST` were added to `.env`. The `posthog-node` package was installed. The generated `convex/_generated/api.d.ts` was updated to include the new `analyticsActions` module so TypeScript resolves correctly before the next `npx convex dev` type regeneration.

## Events instrumented

| Event | Description | File |
|---|---|---|
| `org created` | User creates a new organization — top of conversion funnel | `convex/organizations.ts` |
| `project created` | User creates a new prompt project | `convex/projects.ts` |
| `project created with prompt` | User creates a project via prompt paste (accelerated onboarding) | `convex/projects.ts` |
| `run executed` | User submits a prompt run to compare LLM outputs | `convex/runs.ts` |
| `run completed` | Prompt run finishes successfully — all LLM slots produced output | `convex/runsActions.ts` |
| `run failed` | Prompt run fails due to API or configuration error | `convex/runsActions.ts` |
| `optimization requested` | User triggers an AI optimization pass on a prompt version | `convex/optimize.ts` |
| `optimization completed` | AI optimizer produces a new suggestion ready for review | `convex/optimizeActions.ts` |
| `optimization accepted` | User accepts the AI-suggested optimization — new version created | `convex/optimize.ts` |
| `optimization rejected` | User rejects the AI-suggested optimization | `convex/optimize.ts` |
| `api key configured` | Org owner saves or rotates their OpenRouter API key (activation milestone) | `convex/openRouterKeys.ts` |
| `output rated` | Evaluator rates an LLM output (best / acceptable / weak) | `convex/outputPreferences.ts` |
| `shareable link created` | User generates a shareable evaluation link for external ratings | `convex/shareableLinks.ts` |

Exception tracking (`$exception`) was also added alongside the existing Sentry reporter in `convex/runsActions.ts` and `convex/optimizeActions.ts`.

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/35998/dashboard/1464844
- **User Activation Funnel** (org → project → API key → first run): https://us.posthog.com/project/35998/insights/h7Pce4Fw
- **Daily Run Volume** (runs executed / completed / failed): https://us.posthog.com/project/35998/insights/CeWNOphD
- **Optimization Funnel** (requested → completed → accepted): https://us.posthog.com/project/35998/insights/8rHDVUCp
- **Output Rating Breakdown** (best / acceptable / weak over time): https://us.posthog.com/project/35998/insights/zbfuir0v
- **New Orgs and Projects** (weekly top-of-funnel growth): https://us.posthog.com/project/35998/insights/ie1SRveY

> **Note:** Run `npx convex dev` once to regenerate `convex/_generated/api.d.ts` with the full type-safe signature for `internal.analyticsActions.track`. Also add `POSTHOG_API_KEY` and `POSTHOG_HOST` to your Convex dashboard environment variables so the backend actions can reach PostHog in production.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
