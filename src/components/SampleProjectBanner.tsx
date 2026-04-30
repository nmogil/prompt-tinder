import { Sparkles } from "lucide-react";
import { useOrgLayout } from "@/components/layouts/OrgLayout";
import { Button } from "@/components/ui/button";

export function SampleProjectBanner() {
  const { openNewProjectDialog } = useOrgLayout();

  return (
    <div
      role="region"
      aria-label="Sample project notice"
      className="flex items-center justify-between gap-3 border-b bg-[var(--bg-info-tint)] px-6 py-2 text-sm text-info"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          This is a sample to show you the loop. Edits, runs, and the optimizer
          are disabled here.
        </span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-info hover:bg-info/10 hover:text-info"
        onClick={openNewProjectDialog}
      >
        Create your own project →
      </Button>
    </div>
  );
}
