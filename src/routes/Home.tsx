import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";

export function Home() {
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.viewer);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border p-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hot or Prompt
        </h1>
        {user ? (
          <>
            <p className="text-sm text-muted-foreground">
              Signed in as{" "}
              <span className="font-medium text-foreground">
                {user.email ?? user.name ?? "Unknown user"}
              </span>
            </p>
            <button
              onClick={() => signOut()}
              className="rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-secondary"
            >
              Sign out
            </button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Loading user info...</p>
        )}
      </div>
    </div>
  );
}
