import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const roleStyles: Record<string, string> = {
  owner: "bg-purple-100 text-purple-800 border-purple-200",
  admin: "bg-blue-100 text-blue-800 border-blue-200",
  member: "bg-slate-100 text-slate-700 border-slate-200",
  editor: "bg-blue-100 text-blue-800 border-blue-200",
  // M26: blind evaluator (amber = "review surface, no context") vs open
  // reviewer (sky = "stakeholder with full context"). Visually distinct so
  // members glancing at the collaborator list can tell the two apart.
  evaluator: "bg-amber-100 text-amber-800 border-amber-200",
  reviewer: "bg-sky-100 text-sky-800 border-sky-200",
};

type RoleBadgeProps = {
  role: string;
  // M26: when a collaborator has role="evaluator" but blindMode=false, render
  // them as "Reviewer" — the same internal role, the open variant.
  blindMode?: boolean | null;
};

export function RoleBadge({ role, blindMode }: RoleBadgeProps) {
  const effectiveRole =
    role === "evaluator" && blindMode === false ? "reviewer" : role;
  return (
    <Badge
      variant="outline"
      className={cn("text-xs capitalize", roleStyles[effectiveRole])}
    >
      {effectiveRole}
    </Badge>
  );
}
