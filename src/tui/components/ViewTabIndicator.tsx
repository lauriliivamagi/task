/**
 * ViewTabIndicator Component
 *
 * Shows which view (List/Detail) is active in single-column mode.
 * Displays tab-style indicators with keyboard hint.
 */

import React from "react";
import { Box, Text } from "ink";
import { theme } from "./theme.ts";
import type { Focus } from "../machines/tui.types.ts";

interface ViewTabIndicatorProps {
  focus: Focus;
  searchQuery?: string;
  isSearching?: boolean;
}

export function ViewTabIndicator({
  focus,
  searchQuery,
  isSearching,
}: ViewTabIndicatorProps): React.ReactElement {
  return (
    <Box marginBottom={1}>
      <Box marginRight={2}>
        <Text
          bold={focus === "list"}
          color={focus === "list" ? theme.colors.primary : theme.colors.muted}
          inverse={focus === "list"}
        >
          {" List "}
        </Text>
      </Box>
      <Box marginRight={2}>
        <Text
          bold={focus === "detail"}
          color={focus === "detail" ? theme.colors.primary : theme.colors.muted}
          inverse={focus === "detail"}
        >
          {" Detail "}
        </Text>
      </Box>
      <Text color={theme.colors.muted}>Tab to switch</Text>

      {searchQuery && !isSearching && (
        <Text color={theme.colors.accent}>{` | /${searchQuery}`}</Text>
      )}
    </Box>
  );
}
