import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsPanel } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FeedbackItem } from "@/components/FeedbackItem";
import { MessageSquare } from "lucide-react";

interface FeedbackSheetProps {
  runId: Id<"promptRuns">;
  versionId: Id<"promptVersions">;
}

export function FeedbackSheet({ runId, versionId }: FeedbackSheetProps) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" />
        }
      >
        <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
        All feedback
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Feedback</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <Tabs defaultValue="output">
            <TabsList className="w-full">
              <TabsTrigger value="output">Output feedback</TabsTrigger>
              <TabsTrigger value="prompt">Prompt feedback</TabsTrigger>
            </TabsList>
            <TabsPanel value="output">
              <OutputFeedbackList runId={runId} />
            </TabsPanel>
            <TabsPanel value="prompt">
              <PromptFeedbackList versionId={versionId} />
            </TabsPanel>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function OutputFeedbackList({ runId }: { runId: Id<"promptRuns"> }) {
  const run = useQuery(api.runs.get, { runId });

  if (!run) return <FeedbackEmpty />;

  return (
    <div className="space-y-2 mt-3">
      {run.outputs.map((output) => (
        <OutputFeedbackSection
          key={output._id}
          outputId={output._id as Id<"runOutputs">}
          blindLabel={output.blindLabel}
        />
      ))}
    </div>
  );
}

function OutputFeedbackSection({
  outputId,
  blindLabel,
}: {
  outputId: Id<"runOutputs">;
  blindLabel: string;
}) {
  const feedback = useQuery(api.feedback.listOutputFeedback, { outputId });

  if (!feedback || feedback.length === 0) return null;

  const inline = feedback.filter((fb) => fb.targetKind !== "overall");
  const overall = feedback.filter((fb) => fb.targetKind === "overall");

  const headingId = `feedback-output-${blindLabel}`;
  return (
    <section aria-labelledby={headingId} className="space-y-1.5">
      <h4
        id={headingId}
        className="text-xs font-medium text-muted-foreground"
      >
        Output {blindLabel}
      </h4>
      {inline.map((fb) => (
        <FeedbackItem
          key={fb._id}
          authorLabel={fb.authorName ?? "Unknown"}
          highlightedText={fb.annotationData.highlightedText}
          comment={fb.annotationData.comment}
          createdAt={fb._creationTime}
          tags={fb.tags}
        />
      ))}
      {overall.map((fb) => (
        <FeedbackItem
          key={fb._id}
          authorLabel={fb.authorName ?? "Unknown"}
          highlightedText=""
          comment={fb.annotationData.comment}
          createdAt={fb._creationTime}
          tags={fb.tags}
          sourceHint="overall note"
        />
      ))}
    </section>
  );
}

function PromptFeedbackList({
  versionId,
}: {
  versionId: Id<"promptVersions">;
}) {
  const feedback = useQuery(api.feedback.listPromptFeedback, {
    promptVersionId: versionId,
  });

  if (!feedback || feedback.length === 0) return <FeedbackEmpty />;

  const systemFeedback = feedback.filter(
    (fb) => fb.targetField === "system_message",
  );
  const userFeedback = feedback.filter(
    (fb) => fb.targetField === "user_message_template",
  );

  return (
    <div className="space-y-3 mt-3">
      {systemFeedback.length > 0 && (
        <section
          aria-labelledby="feedback-system-message"
          className="space-y-1.5"
        >
          <h4
            id="feedback-system-message"
            className="text-xs font-medium text-muted-foreground"
          >
            System message
          </h4>
          {systemFeedback.map((fb) => (
            <FeedbackItem
              key={fb._id}
              authorLabel={fb.authorName ?? "Unknown"}
              highlightedText={fb.annotationData.highlightedText}
              comment={fb.annotationData.comment}
              createdAt={fb._creationTime}
              tags={fb.tags}
            />
          ))}
        </section>
      )}
      {userFeedback.length > 0 && (
        <section
          aria-labelledby="feedback-user-template"
          className="space-y-1.5"
        >
          <h4
            id="feedback-user-template"
            className="text-xs font-medium text-muted-foreground"
          >
            User template
          </h4>
          {userFeedback.map((fb) => (
            <FeedbackItem
              key={fb._id}
              authorLabel={fb.authorName ?? "Unknown"}
              highlightedText={fb.annotationData.highlightedText}
              comment={fb.annotationData.comment}
              createdAt={fb._creationTime}
              tags={fb.tags}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function FeedbackEmpty() {
  return (
    <p className="text-sm text-muted-foreground py-6 text-center">
      No feedback for this version yet.
    </p>
  );
}
