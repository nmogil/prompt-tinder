import { Orientation, type SerializedDockview } from "dockview";

import { PANEL_TYPES, type PanelType } from "./panelRegistry";

/**
 * Default per-route dock layouts (M27.7).
 *
 * The structure mirrors dockview's serialized format. We hand-craft it so
 * each route has a sensible starting layout — once the user rearranges,
 * the result is persisted via useDockLayout.
 */

export type DockRoute =
  | "project-detail"
  | "run-detail"
  | "evaluator-session";

function buildLayout(panels: PanelType[]): SerializedDockview {
  // Minimal layout: a single group with all panels stacked as tabs. The host
  // route can override with a more nuanced split-pane structure if needed.
  const panelDefs = Object.fromEntries(
    panels.map((id) => [
      id,
      { id, contentComponent: id, title: titleFor(id) },
    ]),
  );

  return {
    grid: {
      root: {
        type: "branch",
        data: [
          {
            type: "leaf",
            data: {
              views: panels,
              activeView: panels[0],
              id: "main-group",
            },
            size: 1000,
          },
        ],
        size: 1000,
      },
      width: 1000,
      height: 800,
      orientation: Orientation.HORIZONTAL,
    },
    panels: panelDefs,
    activeGroup: "main-group",
  };
}

export function titleFor(panelType: PanelType): string {
  switch (panelType) {
    case PANEL_TYPES.EDITOR:
      return "Editor";
    case PANEL_TYPES.EVAL_GRID:
      return "Eval grid";
    case PANEL_TYPES.ANNOTATIONS:
      return "Annotations";
    case PANEL_TYPES.OPTIMIZER_HISTORY:
      return "Optimizer history";
    case PANEL_TYPES.RUN_LOGS:
      return "Run logs";
  }
}

export const DEFAULT_LAYOUTS: Record<DockRoute, SerializedDockview> = {
  "project-detail": buildLayout([
    PANEL_TYPES.EDITOR,
    PANEL_TYPES.EVAL_GRID,
    PANEL_TYPES.ANNOTATIONS,
    PANEL_TYPES.OPTIMIZER_HISTORY,
  ]),
  "run-detail": buildLayout([
    PANEL_TYPES.RUN_LOGS,
    PANEL_TYPES.EVAL_GRID,
    PANEL_TYPES.ANNOTATIONS,
  ]),
  "evaluator-session": buildLayout([
    PANEL_TYPES.EVAL_GRID,
    PANEL_TYPES.ANNOTATIONS,
  ]),
};
