import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BlindLabelBadge } from "@/components/BlindLabelBadge";
import { RatingButtons, type Rating } from "@/components/RatingButtons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function getSessionId(): string {
  const key = "blind-bench-session-id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

export function ShareableEvalView() {
  const { token } = useParams<{ token: string }>();
  const resolved = useQuery(
    api.shareableLinks.resolveShareableLink,
    token ? { token } : "skip",
  );

  const submitPreferences = useMutation(
    api.shareableLinks.submitAnonymousPreferences,
  );

  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const sessionId = useMemo(() => getSessionId(), []);

  if (resolved === undefined) {
    return (
      <PageShell>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (resolved === null) {
    return (
      <PageShell>
        <div className="py-16 text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            Link expired or unavailable
          </h1>
          <p className="mt-2 text-muted-foreground">
            This blind comparison link is no longer active. Ask the person who
            shared it to generate a new one.
          </p>
          <Link
            to="/"
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            Go to Blind Bench
          </Link>
        </div>
      </PageShell>
    );
  }

  const allRated = resolved.outputs.every(
    (o) => ratings[o.blindLabel] !== undefined,
  );

  async function handleSubmit() {
    if (!token || !allRated) return;
    setSubmitting(true);
    try {
      await submitPreferences({
        token,
        sessionId,
        ratings: Object.entries(ratings).map(([blindLabel, rating]) => ({
          blindLabel,
          rating,
        })),
      });
      setSubmitted(true);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to submit. You may have already voted.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <PageShell>
        <div className="py-16 text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            Thanks for your evaluation
          </h1>
          <p className="mt-2 text-muted-foreground">
            Your preferences have been recorded. The prompt engineer who shared
            this will see your feedback.
          </p>
          <div className="mt-6 rounded-lg border border-border bg-muted/30 p-6">
            <p className="text-sm font-medium">
              Want blind evaluation for your whole team?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Run real LLM outputs through blind evaluation, collect
              annotations, and optimize prompts with AI.
            </p>
            <Link
              to="/auth/sign-in"
              className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Sign up for Blind Bench
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Blind Comparison
          </h1>
          <p className="mt-1 text-muted-foreground">
            Rate each output. You won't know which is which until the owner
            reveals the results.
          </p>
        </div>

        <div
          className={cn(
            "grid gap-4",
            resolved.outputs.length === 2
              ? "sm:grid-cols-2"
              : "sm:grid-cols-2 lg:grid-cols-3",
          )}
        >
          {resolved.outputs.map(({ blindLabel, outputContent }) => (
            <div
              key={blindLabel}
              className="flex flex-col gap-3 rounded-lg border border-border p-4"
            >
              <div className="flex items-center justify-between">
                <BlindLabelBadge label={blindLabel} />
                <RatingButtons
                  currentRating={ratings[blindLabel] ?? null}
                  onRate={(rating) =>
                    setRatings((prev) => {
                      if (prev[blindLabel] === rating) {
                        const next = { ...prev };
                        delete next[blindLabel];
                        return next;
                      }
                      return { ...prev, [blindLabel]: rating };
                    })
                  }
                />
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {outputContent}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allRated || submitting}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium",
            allRated && !submitting
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
        >
          {submitting ? "Submitting..." : "Submit Preferences"}
        </button>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-4xl items-center px-4">
          <Link to="/" className="font-semibold tracking-tight">
            Blind Bench
          </Link>
          <span className="ml-2 text-sm text-muted-foreground">
            Blind Comparison
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        Evaluated with{" "}
        <a
          href="https://blindbench.dev"
          className="underline hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          Blind Bench
        </a>
      </footer>
    </div>
  );
}
