/**
 * ConfirmationDialog Component
 *
 * Modal dialog for confirming dangerous operations like task deletion.
 * Shows y/n options and supports keyboard input.
 */

import React from "react";
import { Box, Text, useStdout } from "ink";
import { theme } from "./theme.ts";
import { getModalWidth } from "../responsive.ts";

const BG_COLOR = "#16213e";
const BASE_WIDTH = 40;

interface ConfirmationDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationDialog({
  title,
  message,
}: ConfirmationDialogProps): React.ReactElement {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const WIDTH = getModalWidth(terminalWidth, BASE_WIDTH);

  const padLine = (text: string) => text.padEnd(WIDTH, " ");

  // Truncate message if needed
  const displayMessage = message.length > WIDTH - 4
    ? message.slice(0, WIDTH - 7) + "..."
    : message;

  return (
    <Box
      flexDirection="column"
      borderStyle={theme.borders.overlay}
      borderColor={theme.colors.error}
    >
      <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
      <Box>
        <Text backgroundColor={BG_COLOR} bold color={theme.colors.error}>
          {` ${title}`}
        </Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {" ".repeat(Math.max(1, WIDTH - title.length - 14))}Esc to cancel{" "}
        </Text>
      </Box>
      <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
      <Text backgroundColor={BG_COLOR} color={theme.colors.text}>
        {padLine(` ${displayMessage}`)}
      </Text>
      <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
      <Box>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {" "}
        </Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.success} bold>
          [y]
        </Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          es
        </Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {"    "}
        </Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.error} bold>
          [n]
        </Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          o
        </Text>
        <Text backgroundColor={BG_COLOR}>
          {" ".repeat(Math.max(1, WIDTH - 16))}
        </Text>
      </Box>
      <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
    </Box>
  );
}
