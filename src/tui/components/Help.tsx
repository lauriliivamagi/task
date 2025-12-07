/**
 * Help Component
 *
 * Modal overlay displaying keyboard shortcuts for the TUI.
 * Reads bindings from KeybindingManager for accurate display.
 * Scrollable in single-column mode.
 */

import React, { useMemo, useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { theme } from "./theme.ts";
import {
  getKeybindingManager,
  type ResolvedBinding,
} from "../../shared/keybindings.ts";
import { getLayoutMode } from "../responsive.ts";

interface ShortcutItem {
  key: string;
  description: string;
}

/** A line item for the scrollable list - either a section header or a shortcut */
type HelpLine =
  | { type: "header"; title: string }
  | { type: "shortcut"; key: string; description: string }
  | { type: "spacer" };

function bindingsToShortcuts(bindings: ResolvedBinding[]): ShortcutItem[] {
  return bindings.map((binding) => ({
    key: binding.key,
    description: binding.label,
  }));
}

function ShortcutColumn(
  { title, shortcuts }: { title: string; shortcuts: ShortcutItem[] },
): React.ReactElement {
  const keyWidth = 12;

  return (
    <Box flexDirection="column" marginRight={2}>
      <Text bold color={theme.colors.accent} underline>
        {title}
      </Text>
      <Box height={1} />
      {shortcuts.map((item, idx) => (
        <Box key={idx}>
          <Box width={keyWidth}>
            <Text color={theme.colors.warning}>{item.key}</Text>
          </Box>
          <Text color={theme.colors.text}>{item.description}</Text>
        </Box>
      ))}
    </Box>
  );
}

/** Render a single line in the scrollable help view */
function HelpLineItem(
  { line, keyWidth }: { line: HelpLine; keyWidth: number },
): React.ReactElement {
  switch (line.type) {
    case "header":
      return (
        <Text bold color={theme.colors.accent} underline>
          {line.title}
        </Text>
      );
    case "shortcut":
      return (
        <Box>
          <Box width={keyWidth}>
            <Text color={theme.colors.warning}>{line.key}</Text>
          </Box>
          <Text color={theme.colors.text}>{line.description}</Text>
        </Box>
      );
    case "spacer":
      return <Text></Text>;
  }
}

export function Help(): React.ReactElement {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const terminalHeight = stdout?.rows ?? 24;
  const layoutMode = getLayoutMode(terminalWidth);

  const [scrollOffset, setScrollOffset] = useState(0);

  const manager = getKeybindingManager();

  const listBindings = manager.getBindingsForMode("listView");
  const detailBindings = manager.getBindingsForMode("detailView");
  const globalBindings = manager.getBindingsForMode("global");

  const listShortcuts = bindingsToShortcuts(listBindings);
  const detailShortcuts = bindingsToShortcuts(detailBindings);
  const globalShortcuts = bindingsToShortcuts(globalBindings);

  // Build flat list of lines for scrollable view
  const allLines = useMemo((): HelpLine[] => {
    const lines: HelpLine[] = [];

    lines.push({ type: "header", title: "List View" });
    for (const s of listShortcuts) {
      lines.push({ type: "shortcut", key: s.key, description: s.description });
    }
    lines.push({ type: "spacer" });

    lines.push({ type: "header", title: "Detail View" });
    for (const s of detailShortcuts) {
      lines.push({ type: "shortcut", key: s.key, description: s.description });
    }
    lines.push({ type: "spacer" });

    lines.push({ type: "header", title: "Global" });
    for (const s of globalShortcuts) {
      lines.push({ type: "shortcut", key: s.key, description: s.description });
    }

    return lines;
  }, [listShortcuts, detailShortcuts, globalShortcuts]);

  // Calculate available height for scrollable content in single mode
  // Reserve: border (2) + padding (2) + header (2) + scroll hints (2)
  const reservedLines = 8;
  const maxVisibleLines = Math.max(5, terminalHeight - reservedLines);
  const totalLines = allLines.length;
  const needsScroll = layoutMode === "single" && totalLines > maxVisibleLines;
  const maxScrollOffset = Math.max(0, totalLines - maxVisibleLines);

  // Handle scroll input in single-column mode
  useInput(
    (input, key) => {
      if (!needsScroll) return;

      if (key.upArrow || input === "k") {
        setScrollOffset((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow || input === "j") {
        setScrollOffset((prev) => Math.min(maxScrollOffset, prev + 1));
      }
    },
    { isActive: needsScroll },
  );

  const visibleLines = needsScroll
    ? allLines.slice(scrollOffset, scrollOffset + maxVisibleLines)
    : allLines;
  const hasMoreAbove = scrollOffset > 0;
  const hasMoreBelow = scrollOffset < maxScrollOffset;

  // Split mode: use columns
  if (layoutMode !== "single") {
    return (
      <Box
        flexDirection="column"
        borderStyle={theme.borders.overlay}
        borderColor={theme.colors.accent}
        paddingX={2}
        paddingY={1}
      >
        <Box marginBottom={1} justifyContent="space-between">
          <Text bold color={theme.colors.accent}>
            Keyboard Shortcuts
          </Text>
          <Text color={theme.colors.muted}>Press ? or Esc to close</Text>
        </Box>

        <Box flexDirection="row">
          <ShortcutColumn title="List View" shortcuts={listShortcuts} />
          <ShortcutColumn title="Detail View" shortcuts={detailShortcuts} />
          <ShortcutColumn title="Global" shortcuts={globalShortcuts} />
        </Box>
      </Box>
    );
  }

  // Single-column mode: scrollable vertical list
  const keyWidth = 12;

  return (
    <Box
      flexDirection="column"
      borderStyle={theme.borders.overlay}
      borderColor={theme.colors.accent}
      paddingX={2}
      paddingY={1}
      width={terminalWidth - 4}
    >
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color={theme.colors.accent}>
          Keyboard Shortcuts
        </Text>
        <Text color={theme.colors.muted}>? or Esc to close</Text>
      </Box>

      {needsScroll && hasMoreAbove && (
        <Text color={theme.colors.muted}>↑ j/k to scroll</Text>
      )}

      <Box flexDirection="column">
        {visibleLines.map((line, idx) => (
          <HelpLineItem key={idx} line={line} keyWidth={keyWidth} />
        ))}
      </Box>

      {needsScroll && hasMoreBelow && (
        <Text color={theme.colors.muted}>↓ more below</Text>
      )}

      {needsScroll && !hasMoreAbove && !hasMoreBelow && (
        <Text color={theme.colors.muted}>j/k to scroll</Text>
      )}
    </Box>
  );
}
