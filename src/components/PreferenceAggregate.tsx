import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ThumbsUp, Check, ThumbsDown } from "lucide-react";
import { RATING_TEXT_COLORS } from "@/lib/status-styles";

interface PreferenceAggregateProps {
  runId: Id<"promptRuns">;
  outputId: string;
}

export function PreferenceAggregate({ runId, outputId }: PreferenceAggregateProps) {
  const aggregate = useQuery(api.outputPreferences.aggregateForRun, { runId });

  const data = aggregate?.find((a) => a.outputId === outputId);
  if (!data) return null;

  const total = data.bestCount + data.acceptableCount + data.weakCount;
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {data.bestCount > 0 && (
        <span className={`inline-flex items-center gap-0.5 ${RATING_TEXT_COLORS.best}`}>
          <ThumbsUp className="h-3 w-3" />
          {data.bestCount}
        </span>
      )}
      {data.acceptableCount > 0 && (
        <span className={`inline-flex items-center gap-0.5 ${RATING_TEXT_COLORS.acceptable}`}>
          <Check className="h-3 w-3" />
          {data.acceptableCount}
        </span>
      )}
      {data.weakCount > 0 && (
        <span className={`inline-flex items-center gap-0.5 ${RATING_TEXT_COLORS.weak}`}>
          <ThumbsDown className="h-3 w-3" />
          {data.weakCount}
        </span>
      )}
      <span className="text-muted-foreground/60">
        ({total} rating{total !== 1 ? "s" : ""})
      </span>
    </div>
  );
}
