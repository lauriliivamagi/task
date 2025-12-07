/**
 * TUI Responsive Utilities
 *
 * Centralized breakpoint system for terminal responsiveness.
 * All layout decisions flow through these utilities.
 */

/**
 * Breakpoint constants for responsive layouts.
 */
export const BREAKPOINTS = {
  /** Minimum supported terminal width */
  MIN_WIDTH: 60,
  /** Threshold for single-column mode (below this uses single column) */
  NARROW: 100,
} as const;

export type LayoutMode = "single" | "split";

/**
 * Determine the layout mode based on terminal width.
 */
export function getLayoutMode(terminalWidth: number): LayoutMode {
  return terminalWidth < BREAKPOINTS.NARROW ? "single" : "split";
}

/**
 * Check if terminal is below minimum width.
 */
export function isTerminalTooNarrow(terminalWidth: number): boolean {
  return terminalWidth < BREAKPOINTS.MIN_WIDTH;
}

/**
 * Calculate modal width based on terminal size.
 * On narrow terminals, modals expand to fill available width.
 * On wide terminals, modals use their base width capped to terminal.
 */
export function getModalWidth(
  terminalWidth: number,
  baseWidth: number,
): number {
  const layoutMode = getLayoutMode(terminalWidth);
  if (layoutMode === "single") {
    // Full width with small margins
    return Math.max(BREAKPOINTS.MIN_WIDTH - 4, terminalWidth - 4);
  }
  // Standard width capped to terminal
  return Math.min(baseWidth, terminalWidth - 10);
}

/**
 * Calculate overlay margin for positioning.
 * In split mode, overlays appear over detail panel (42% margin).
 * In single mode, overlays are centered with small margin.
 */
export function getOverlayMarginLeft(
  terminalWidth: number,
  layoutMode: LayoutMode,
): number {
  if (layoutMode === "single") {
    return 2;
  }
  return Math.floor(terminalWidth * 0.42);
}

/**
 * Calculate overlay width as percentage string.
 */
export function getOverlayWidth(layoutMode: LayoutMode): string {
  return layoutMode === "single" ? "96%" : "58%";
}

/**
 * Calculate max title width for task list.
 * In single mode, uses full width minus margins.
 * In split mode, uses 55% of terminal width minus padding.
 */
export function getMaxTitleWidth(
  terminalWidth: number,
  layoutMode: LayoutMode,
): number {
  if (layoutMode === "single") {
    // Full width available, reserve for icons/margins
    return Math.max(20, terminalWidth - 15);
  }
  // Original calculation for split mode
  return Math.min(60, Math.floor(terminalWidth * 0.55) - 10);
}

/**
 * Calculate comment content width in detail panel.
 * In single mode, uses nearly full width.
 * In split mode, uses 60% panel width with constraints.
 */
export function getCommentWidth(
  terminalWidth: number,
  layoutMode: LayoutMode,
): number {
  if (layoutMode === "single") {
    return Math.max(30, terminalWidth - 10);
  }
  const detailPanelChars = Math.floor(terminalWidth * 0.6);
  return Math.max(30, Math.min(70, detailPanelChars - 15));
}
