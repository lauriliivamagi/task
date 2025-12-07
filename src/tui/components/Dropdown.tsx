/**
 * Dropdown Component
 *
 * Overlay dropdown for selecting from a list of options.
 * Supports arrow key navigation, Enter to select, Escape to cancel.
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { theme } from "./theme.ts";

const BG_COLOR = "#16213e";

export interface DropdownOption<T> {
  label: string;
  value: T;
  color?: string;
}

interface DropdownProps<T> {
  options: DropdownOption<T>[];
  selectedValue: T;
  onSelect: (value: T) => void;
  onCancel: () => void;
  title: string;
}

export function Dropdown<T>({
  options,
  selectedValue,
  onSelect,
  onCancel,
  title,
}: DropdownProps<T>): React.ReactElement {
  // Find initial index based on current selection
  const initialIndex = options.findIndex((o) => o.value === selectedValue);
  const [highlightedIndex, setHighlightedIndex] = useState(
    initialIndex >= 0 ? initialIndex : 0,
  );

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return) {
      onSelect(options[highlightedIndex].value);
      return;
    }

    if (key.upArrow || input === "k") {
      setHighlightedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow || input === "j") {
      setHighlightedIndex((prev) => Math.min(options.length - 1, prev + 1));
      return;
    }
  });

  // Calculate width for consistent background
  const maxLabelLen = Math.max(...options.map((o) => o.label.length)) + 6;
  const width = Math.max(maxLabelLen, title.length + 16);

  const padLine = (text: string) => text.padEnd(width, " ");

  return (
    <Box
      flexDirection="column"
      borderStyle={theme.borders.overlay}
      borderColor={theme.colors.warning}
    >
      <Text backgroundColor={BG_COLOR}>
        {padLine("")}
      </Text>
      <Box>
        <Text backgroundColor={BG_COLOR} bold color={theme.colors.warning}>
          {" "}
          {title}
        </Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {" ".repeat(width - title.length - 14)}Esc to cancel{" "}
        </Text>
      </Box>
      <Text backgroundColor={BG_COLOR}>
        {padLine("")}
      </Text>

      {options.map((option, idx) => {
        const isHighlighted = idx === highlightedIndex;
        const isSelected = option.value === selectedValue;
        const color = isHighlighted
          ? (option.color || theme.colors.primary)
          : theme.colors.text;
        const prefix = isHighlighted ? " ▸ " : "   ";
        const suffix = isSelected ? " ✓" : "  ";
        const label = `${prefix}${option.label}${suffix}`;

        return (
          <Text
            key={String(option.value)}
            color={color}
            bold={isHighlighted}
            backgroundColor={BG_COLOR}
          >
            {padLine(label)}
          </Text>
        );
      })}

      <Text backgroundColor={BG_COLOR}>
        {padLine("")}
      </Text>
      <Text color={theme.colors.muted} backgroundColor={BG_COLOR}>
        {padLine(" ↑↓/jk navigate • Enter select")}
      </Text>
      <Text backgroundColor={BG_COLOR}>
        {padLine("")}
      </Text>
    </Box>
  );
}
