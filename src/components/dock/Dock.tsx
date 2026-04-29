import { useEffect, useMemo, useState } from "react";
import {
  DockviewReact,
  type DockviewReadyEvent,
} from "dockview";
import "dockview/dist/styles/dockview.css";

import { cn } from "@/lib/utils";
import {
  buildRegistry,
  EVALUATOR_PANEL_TYPES,
  type PanelComponent,
  type PanelType,
} from "./panelRegistry";
import { useDockLayout } from "./useDockLayout";
import type { DockRoute } from "./defaultLayouts";

interface DockProps {
  route: DockRoute;
  userId: string | null;
  /**
   * Map of panel kind → React component. The host route owns the actual
   * components (editor, eval grid, etc.) — Dock only wires them in.
   */
  components: Partial<Record<PanelType, PanelComponent>>;
  /** When true, the registry is filtered to the evaluator-safe subset. */
  evaluatorMode?: boolean;
  /**
   * Optional render prop for the mobile (< 1024px) fallback. Receives the
   * filtered panel kinds in the order they should stack. Consumers that don't
   * provide this fall back to a placeholder explaining the dock is desktop-only.
   */
  renderMobile?: (panels: PanelType[]) => React.ReactNode;
  className?: string;
}

/**
 * The dockview-based multi-panel workspace (M27.7).
 *
 * Theme bridging: dockview reads CSS variables prefixed with `--dv-*`. We map
 * those to our OKLch tokens via the inline class `bb-dock-theme` so light/dark
 * mode switches automatically with the rest of the app.
 *
 * Mobile fallback: viewports below 1024px get a simple stacked layout that
 * renders all panels in a single column. Dockview is desktop-only.
 *
 * Blind-eval rule: when `evaluatorMode` is true, the registry passed to
 * dockview is a strict subset (EVAL_GRID + ANNOTATIONS only). Panels not in
 * that subset are simply not registered — calling api.addPanel with one of
 * the excluded types is a no-op (the panel kind is unknown to dockview).
 */
export function Dock({
  route,
  userId,
  components,
  evaluatorMode = false,
  renderMobile,
  className,
}: DockProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsMobile(window.innerWidth < 1024);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const filteredComponents = useMemo(() => {
    if (!evaluatorMode) return components;
    const safe: Partial<Record<PanelType, PanelComponent>> = {};
    for (const [key, value] of Object.entries(components) as Array<
      [PanelType, PanelComponent | undefined]
    >) {
      if (EVALUATOR_PANEL_TYPES.has(key) && value) safe[key] = value;
    }
    return safe;
  }, [components, evaluatorMode]);

  const registry = useMemo(
    () => buildRegistry(filteredComponents),
    [filteredComponents],
  );

  const { onReady } = useDockLayout({
    route,
    userId,
    disabled: evaluatorMode,
  });

  const handleReady = (event: DockviewReadyEvent) => {
    onReady(event.api);
  };

  if (isMobile) {
    const panels = Object.keys(filteredComponents) as PanelType[];
    if (renderMobile) {
      return (
        <div className={cn("flex flex-col gap-3 p-3", className)}>
          {renderMobile(panels)}
        </div>
      );
    }
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        The multi-panel workspace is desktop-only. Resize to ≥ 1024px to use it.
      </div>
    );
  }

  return (
    <div className={cn("bb-dock-theme h-full w-full", className)}>
      <DockviewReact
        components={registry}
        onReady={handleReady}
        className="dockview-theme-abyss"
      />
    </div>
  );
}
