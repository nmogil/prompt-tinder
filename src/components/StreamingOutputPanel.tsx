import { Doc } from "../../convex/_generated/dataModel";
import { BlindLabelBadge } from "./BlindLabelBadge";
import { RunStatusPill } from "./RunStatusPill";
import { cn } from "@/lib/utils";

interface StreamingOutputPanelProps {
  output: Doc<"runOutputs">;
  runStatus: string;
}

function formatTokens(n: number | undefined): string {
  if (n === undefined) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatLatency(ms: number | undefined): string {
  if (ms === undefined) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

export function StreamingOutputPanel({
  output,
  runStatus,
}: StreamingOutputPanelProps) {
  const isStreaming = runStatus === "running";
  const isFailed = runStatus === "failed";
  const isCompleted = runStatus === "completed";

  return (
    <div className="flex flex-col rounded-lg border bg-card h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <BlindLabelBadge label={output.blindLabel} />
        <RunStatusPill status={runStatus} />
      </div>

      {/* Output body */}
      <div
        className={cn(
          "flex-1 overflow-y-auto p-3 text-sm whitespace-pre-wrap font-mono leading-relaxed min-h-[200px]",
          !output.outputContent && "text-muted-foreground italic",
        )}
        aria-live="polite"
      >
        {output.outputContent || (isStreaming ? "" : "Waiting...")}
        {isStreaming && (
          <span className="inline-block w-[2px] h-[1em] bg-foreground align-text-bottom animate-pulse ml-0.5">
            &#x258b;
          </span>
        )}
      </div>

      {/* Footer — token counts + latency */}
      {isCompleted && (output.totalTokens !== undefined || output.latencyMs !== undefined) && (
        <div className="flex items-center gap-3 px-3 py-2 border-t text-xs text-muted-foreground">
          {output.promptTokens !== undefined && (
            <span>Prompt: {formatTokens(output.promptTokens)}</span>
          )}
          {output.completionTokens !== undefined && (
            <span>Completion: {formatTokens(output.completionTokens)}</span>
          )}
          {output.latencyMs !== undefined && (
            <span>{formatLatency(output.latencyMs)}</span>
          )}
        </div>
      )}

      {/* Error state */}
      {isFailed && (
        <div className="px-3 py-2 border-t">
          <p className="text-xs text-destructive">
            Output failed. See run details for error.
          </p>
        </div>
      )}
    </div>
  );
}
