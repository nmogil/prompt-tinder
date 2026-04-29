import type { FunctionComponent } from "react";
import type { IDockviewPanelProps } from "dockview";

/**
 * Typed registry of panel kinds known to the dock (M27.7).
 *
 * Adding a new panel kind: append to PANEL_TYPES, add a corresponding entry
 * to panelComponents, and decide whether the panel is part of the evaluator
 * registry (see EVALUATOR_PANEL_TYPES below).
 *
 * Blind-eval rule: the evaluator registry is a strict subset. Any panel that
 * could leak version metadata (editor, optimizer history, run logs) MUST be
 * excluded.
 */
export const PANEL_TYPES = {
  EDITOR: "editor",
  EVAL_GRID: "eval-grid",
  ANNOTATIONS: "annotations",
  OPTIMIZER_HISTORY: "optimizer-history",
  RUN_LOGS: "run-logs",
} as const;

export type PanelType = (typeof PANEL_TYPES)[keyof typeof PANEL_TYPES];

export const EVALUATOR_PANEL_TYPES: ReadonlySet<PanelType> = new Set<PanelType>([
  PANEL_TYPES.EVAL_GRID,
  PANEL_TYPES.ANNOTATIONS,
]);

export interface PanelComponentParams {
  /** Each panel may declare its own params via the dockview API; consumers cast as needed. */
  [key: string]: unknown;
}

export type PanelComponent = FunctionComponent<IDockviewPanelProps>;

/**
 * Build the component registry. Consumers pass the actual React components
 * from the host route — this keeps panelRegistry decoupled from the heavy
 * editor / grid bundles.
 */
export function buildRegistry(
  parts: Partial<Record<PanelType, PanelComponent>>,
): Record<PanelType, PanelComponent> {
  const filler: PanelComponent = () => null;
  return {
    [PANEL_TYPES.EDITOR]: parts[PANEL_TYPES.EDITOR] ?? filler,
    [PANEL_TYPES.EVAL_GRID]: parts[PANEL_TYPES.EVAL_GRID] ?? filler,
    [PANEL_TYPES.ANNOTATIONS]: parts[PANEL_TYPES.ANNOTATIONS] ?? filler,
    [PANEL_TYPES.OPTIMIZER_HISTORY]:
      parts[PANEL_TYPES.OPTIMIZER_HISTORY] ?? filler,
    [PANEL_TYPES.RUN_LOGS]: parts[PANEL_TYPES.RUN_LOGS] ?? filler,
  };
}
