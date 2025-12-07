/**
 * useResponsive Hook
 *
 * Provides responsive context for TUI components.
 * Wraps useStdout and computes layout mode based on terminal dimensions.
 */

import { useMemo } from "react";
import { useStdout } from "ink";
import {
  getLayoutMode,
  getOverlayMarginLeft,
  getOverlayWidth,
  isTerminalTooNarrow,
  type LayoutMode,
} from "../responsive.ts";

export interface ResponsiveContext {
  /** Terminal width in columns */
  terminalWidth: number;
  /** Terminal height in rows */
  terminalHeight: number;
  /** Current layout mode based on terminal width */
  layoutMode: LayoutMode;
  /** True if terminal is below minimum supported width */
  isTooNarrow: boolean;
  /** Left margin for overlay positioning */
  overlayMarginLeft: number;
  /** Width for overlays as percentage string */
  overlayWidth: string;
}

/**
 * Hook that provides responsive layout context.
 * Re-computes when terminal dimensions change.
 */
export function useResponsive(): ResponsiveContext {
  const { stdout } = useStdout();

  const terminalWidth = stdout?.columns ?? 80;
  const terminalHeight = stdout?.rows ?? 24;

  return useMemo(() => {
    const layoutMode = getLayoutMode(terminalWidth);
    return {
      terminalWidth,
      terminalHeight,
      layoutMode,
      isTooNarrow: isTerminalTooNarrow(terminalWidth),
      overlayMarginLeft: getOverlayMarginLeft(terminalWidth, layoutMode),
      overlayWidth: getOverlayWidth(layoutMode),
    };
  }, [terminalWidth, terminalHeight]);
}
