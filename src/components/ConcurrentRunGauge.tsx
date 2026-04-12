import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";

export function ConcurrentRunGauge({
  projectId,
}: {
  projectId: Id<"projects">;
}) {
  const data = useQuery(api.runs.countInFlightRuns, { projectId });

  if (!data || data.inFlight === 0) return null;

  const atCap = data.inFlight >= data.cap;
  const nearCap = data.inFlight >= data.cap - 2;

  return (
    <p
      className={cn(
        "text-xs",
        atCap
          ? "text-destructive font-medium"
          : nearCap
            ? "text-amber-600 dark:text-amber-400"
            : "text-muted-foreground",
      )}
    >
      {data.inFlight} / {data.cap} in flight
    </p>
  );
}
