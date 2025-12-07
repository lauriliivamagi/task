/**
 * CommandPalette Component
 *
 * Modal overlay for command selection with filtering.
 */

import React from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { useTuiActorRef, useTuiSelector } from "../machines/index.ts";
import type { Command } from "../machines/tui.types.ts";
import { theme } from "./theme.ts";
import { getModalWidth } from "../responsive.ts";

interface CommandPaletteProps {
  commands: Command[];
  onExecute: (command: Command) => void;
}

export function CommandPalette(
  { commands, onExecute }: CommandPaletteProps,
): React.ReactElement {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const paletteWidth = getModalWidth(terminalWidth, 50);

  const actorRef = useTuiActorRef();
  const filter = useTuiSelector((state) => state.context.paletteFilter);
  const selectedIndex = useTuiSelector(
    (state) => state.context.paletteSelectedIndex,
  );

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(filter.toLowerCase()) ||
      (cmd.shortcut?.toLowerCase().includes(filter.toLowerCase()) ?? false),
  );

  // Clamp selected index to valid range
  const clampedIndex = Math.min(
    selectedIndex,
    Math.max(0, filteredCommands.length - 1),
  );

  useInput((input, key) => {
    if (key.escape) {
      actorRef.send({ type: "CANCEL" });
      return;
    }

    if (key.return && filteredCommands.length > 0) {
      // Close palette first, then execute command
      actorRef.send({
        type: "EXECUTE_COMMAND",
        commandId: filteredCommands[clampedIndex].id,
      });
      onExecute(filteredCommands[clampedIndex]);
      return;
    }

    if (key.upArrow) {
      actorRef.send({ type: "PALETTE_UP" });
      return;
    }

    if (key.downArrow) {
      actorRef.send({ type: "PALETTE_DOWN", max: filteredCommands.length });
      return;
    }

    if (key.backspace || key.delete) {
      // Remove last character from filter
      actorRef.send({
        type: "UPDATE_PALETTE_FILTER",
        value: filter.slice(0, -1),
      });
      return;
    }

    // Regular character input
    if (input && !key.ctrl && !key.meta) {
      actorRef.send({
        type: "UPDATE_PALETTE_FILTER",
        value: filter + input,
      });
    }
  });

  // Responsive widths for alignment
  const innerWidth = paletteWidth - 6; // Subtract padding and border
  const labelWidth = Math.floor(innerWidth * 0.7);
  const shortcutWidth = Math.floor(innerWidth * 0.3);

  return (
    <Box
      flexDirection="column"
      borderStyle={theme.borders.overlay}
      borderColor={theme.colors.accent}
      paddingX={2}
      paddingY={1}
      width={paletteWidth}
    >
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color={theme.colors.accent}>
          Command Palette
        </Text>
        <Text color={theme.colors.muted}>Esc to close</Text>
      </Box>

      <Box
        borderStyle={theme.borders.unfocused}
        borderColor={theme.colors.accent}
        paddingX={1}
        marginBottom={1}
      >
        <Text color={theme.colors.muted}>&gt;</Text>
        <Text>{filter}</Text>
        <Text color={theme.colors.success}>█</Text>
      </Box>

      <Box flexDirection="column">
        {filteredCommands.length === 0
          ? <Text color={theme.colors.muted}>No matching commands</Text>
          : (
            filteredCommands.slice(0, 8).map((cmd, idx) => (
              <Box key={cmd.id} justifyContent="space-between">
                <Box width={labelWidth}>
                  <Text
                    color={idx === clampedIndex
                      ? theme.colors.accent
                      : theme.colors.text}
                    bold={idx === clampedIndex}
                  >
                    {idx === clampedIndex ? "\u25B8 " : "  "}
                    {cmd.label}
                  </Text>
                </Box>
                <Box width={shortcutWidth} justifyContent="flex-end">
                  <Text
                    color={idx === clampedIndex
                      ? theme.colors.warning
                      : theme.colors.muted}
                  >
                    {cmd.shortcut}
                  </Text>
                </Box>
              </Box>
            ))
          )}
      </Box>

      <Box marginTop={1}>
        <Text color={theme.colors.muted}>
          ↑↓ navigate • Enter select
        </Text>
      </Box>
    </Box>
  );
}
