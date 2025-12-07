/**
 * MultilineInput Component
 *
 * A text input that supports multiline input with Shift+Enter and cursor navigation.
 */

import React, { useEffect, useState } from "react";
import { Text, useInput } from "ink";
import { theme } from "./theme.ts";

interface MultilineInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
}

export function MultilineInput({
  value,
  onChange,
  onSubmit,
  placeholder,
}: MultilineInputProps): React.ReactElement {
  // Track cursor position within the value
  const [cursorPos, setCursorPos] = useState(value.length);

  // Keep cursor at end when value changes externally (e.g., initial load)
  useEffect(() => {
    setCursorPos(value.length);
  }, [value.length === 0]); // Only reset when value becomes empty or on mount

  useInput((input, key) => {
    // Handle Shift+Enter (some terminals send specific escape codes)
    if (input === "\u001b[27;2;13~" || input === "[27;2;13~") {
      const newValue = value.slice(0, cursorPos) + "\n" +
        value.slice(cursorPos);
      onChange(newValue);
      setCursorPos(cursorPos + 1);
      return;
    }

    if (key.return) {
      if (key.shift) {
        const newValue = value.slice(0, cursorPos) + "\n" +
          value.slice(cursorPos);
        onChange(newValue);
        setCursorPos(cursorPos + 1);
      } else {
        onSubmit(value);
      }
      return;
    }

    // Arrow key navigation
    if (key.leftArrow) {
      setCursorPos(Math.max(0, cursorPos - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorPos(Math.min(value.length, cursorPos + 1));
      return;
    }

    // Home/End keys (Ctrl+A / Ctrl+E in some terminals)
    if (input === "\x01") {
      // Ctrl+A - go to start
      setCursorPos(0);
      return;
    }

    if (input === "\x05") {
      // Ctrl+E - go to end
      setCursorPos(value.length);
      return;
    }

    if (key.delete || key.backspace) {
      if (cursorPos > 0) {
        const newValue = value.slice(0, cursorPos - 1) + value.slice(cursorPos);
        onChange(newValue);
        setCursorPos(cursorPos - 1);
      }
      return;
    }

    // Delete key (forward delete)
    if (input === "\x7f" || key.delete) {
      if (cursorPos < value.length) {
        const newValue = value.slice(0, cursorPos) + value.slice(cursorPos + 1);
        onChange(newValue);
      }
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      const newValue = value.slice(0, cursorPos) + input +
        value.slice(cursorPos);
      onChange(newValue);
      setCursorPos(cursorPos + input.length);
    }
  });

  // Render value with cursor
  const beforeCursor = value.slice(0, cursorPos);
  const afterCursor = value.slice(cursorPos);
  const showPlaceholder = value.length === 0;

  return (
    <Text>
      {showPlaceholder
        ? (
          <>
            <Text color={theme.colors.success}>█</Text>
            <Text color="gray">{placeholder}</Text>
          </>
        )
        : (
          <>
            {beforeCursor}
            <Text color={theme.colors.success}>█</Text>
            {afterCursor}
          </>
        )}
    </Text>
  );
}
