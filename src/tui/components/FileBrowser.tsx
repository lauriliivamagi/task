/**
 * FileBrowser Component
 *
 * Simple file browser for selecting files from the file system.
 * Shows directories first, then files. Supports navigation with arrow keys.
 */

import React, { useEffect, useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { theme } from "./theme.ts";
import { getModalWidth } from "../responsive.ts";

const BG_COLOR = "#16213e";
const BASE_WIDTH = 60;

interface FileEntry {
  name: string;
  isDirectory: boolean;
}

interface FileBrowserProps {
  onSelect: (filepath: string) => void;
  onCancel: () => void;
  startPath?: string;
}

export function FileBrowser({
  onSelect,
  onCancel,
  startPath,
}: FileBrowserProps): React.ReactElement {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const WIDTH = getModalWidth(terminalWidth, BASE_WIDTH);

  const [currentPath, setCurrentPath] = useState(startPath || Deno.cwd());
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPath, setEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState(startPath || Deno.cwd());

  // Load directory contents when path changes
  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath]);

  async function loadDirectory(path: string): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const items: FileEntry[] = [];

      for await (const entry of Deno.readDir(path)) {
        items.push({
          name: entry.name,
          isDirectory: entry.isDirectory,
        });
      }

      // Sort: directories first, then files, both alphabetically
      items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      setEntries(items);
      setHighlightedIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read directory");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  function navigateUp(): void {
    const parent = currentPath.split("/").slice(0, -1).join("/") || "/";
    setCurrentPath(parent);
  }

  async function navigateToPath(path: string): Promise<void> {
    const normalizedPath = path.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
    try {
      const stat = await Deno.stat(normalizedPath);
      if (stat.isDirectory) {
        setCurrentPath(normalizedPath);
        setPathInput(normalizedPath);
        setEditingPath(false);
      } else if (stat.isFile) {
        onSelect(normalizedPath);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Invalid path",
      );
      setEditingPath(false);
    }
  }

  function handleSelect(): void {
    if (entries.length === 0) return;

    const entry = entries[highlightedIndex];
    const fullPath = `${currentPath}/${entry.name}`.replace(/\/+/g, "/");

    if (entry.isDirectory) {
      setCurrentPath(fullPath);
    } else {
      onSelect(fullPath);
    }
  }

  useInput((input, key) => {
    // Handle editing mode
    if (editingPath) {
      if (key.escape) {
        setEditingPath(false);
        setPathInput(currentPath);
        return;
      }

      if (key.return) {
        navigateToPath(pathInput);
        return;
      }

      if (key.backspace || key.delete) {
        setPathInput((prev) => prev.slice(0, -1));
        return;
      }

      if (key.tab) {
        setEditingPath(false);
        setPathInput(currentPath);
        return;
      }

      // Add typed character
      if (input && !key.ctrl && !key.meta) {
        setPathInput((prev) => prev + input);
      }
      return;
    }

    // Handle browsing mode
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.tab) {
      setEditingPath(true);
      setPathInput(currentPath);
      return;
    }

    if (key.return) {
      handleSelect();
      return;
    }

    if (key.upArrow || input === "k") {
      setHighlightedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow || input === "j") {
      setHighlightedIndex((prev) => Math.min(entries.length - 1, prev + 1));
      return;
    }

    if (key.backspace || key.delete) {
      navigateUp();
      return;
    }

    // Left arrow also goes up
    if (key.leftArrow) {
      navigateUp();
      return;
    }

    // Right arrow enters directory
    if (key.rightArrow && entries[highlightedIndex]?.isDirectory) {
      const entry = entries[highlightedIndex];
      const fullPath = `${currentPath}/${entry.name}`.replace(/\/+/g, "/");
      setCurrentPath(fullPath);
    }
  });

  // Display limited number of entries with scrolling
  const maxVisible = 10;
  const startIndex = Math.max(
    0,
    Math.min(
      highlightedIndex - Math.floor(maxVisible / 2),
      entries.length - maxVisible,
    ),
  );
  const visibleEntries = entries.slice(startIndex, startIndex + maxVisible);

  const padLine = (text: string) => text.padEnd(WIDTH, " ");
  const truncatePath = (path: string) =>
    path.length > WIDTH - 8 ? "..." + path.slice(-(WIDTH - 11)) : path;

  return (
    <Box
      flexDirection="column"
      borderStyle={theme.borders.overlay}
      borderColor={theme.colors.warning}
    >
      <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
      <Box>
        <Text backgroundColor={BG_COLOR} bold color={theme.colors.warning}>
          {" Select File"}
        </Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {" ".repeat(WIDTH - 24)}Esc to cancel{" "}
        </Text>
      </Box>
      <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>

      {editingPath
        ? (
          <>
            <Text backgroundColor={BG_COLOR} color={theme.colors.warning}>
              {padLine(` Path (editing): `)}
            </Text>
            <Box>
              <Text backgroundColor={BG_COLOR} color={theme.colors.primary}>
                {" "}
              </Text>
              <Text backgroundColor={BG_COLOR} color={theme.colors.text}>
                {pathInput.length > WIDTH - 4
                  ? "..." + pathInput.slice(-(WIDTH - 7))
                  : pathInput}
              </Text>
              <Text backgroundColor={theme.colors.primary} color={BG_COLOR}>
                {" "}
              </Text>
              <Text backgroundColor={BG_COLOR}>
                {" ".repeat(
                  Math.max(
                    0,
                    WIDTH - 3 - Math.min(pathInput.length, WIDTH - 4),
                  ),
                )}
              </Text>
            </Box>
          </>
        )
        : (
          <>
            <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
              {padLine(` Path: (Tab to edit)`)}
            </Text>
            <Text backgroundColor={BG_COLOR} color={theme.colors.primary}>
              {padLine(` ${truncatePath(currentPath)}`)}
            </Text>
          </>
        )}
      <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>

      {loading
        ? (
          <Text color={theme.colors.muted} backgroundColor={BG_COLOR}>
            {padLine(" Loading...")}
          </Text>
        )
        : error
        ? (
          <Text color={theme.colors.error} backgroundColor={BG_COLOR}>
            {padLine(` ${error}`)}
          </Text>
        )
        : entries.length === 0
        ? (
          <Text color={theme.colors.muted} backgroundColor={BG_COLOR}>
            {padLine(" Empty directory")}
          </Text>
        )
        : (
          visibleEntries.map((entry, idx) => {
            const actualIndex = startIndex + idx;
            const isHighlighted = actualIndex === highlightedIndex;
            const icon = entry.isDirectory ? "📁" : "📄";
            const color = isHighlighted
              ? theme.colors.primary
              : entry.isDirectory
              ? theme.colors.accent
              : theme.colors.text;
            const prefix = isHighlighted ? " ▸ " : "   ";
            const line = `${prefix}${icon} ${entry.name}`;

            return (
              <Text
                key={entry.name}
                color={color}
                bold={isHighlighted}
                backgroundColor={BG_COLOR}
              >
                {padLine(line)}
              </Text>
            );
          })
        )}

      {/* Fill remaining lines if fewer than maxVisible */}
      {!loading && !error && entries.length > 0 &&
        entries.length < maxVisible &&
        Array(maxVisible - Math.min(entries.length, maxVisible)).fill(0).map((
          _,
          i,
        ) => (
          <Text key={`empty-${i}`} backgroundColor={BG_COLOR}>
            {padLine("")}
          </Text>
        ))}

      <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
      <Text color={theme.colors.muted} backgroundColor={BG_COLOR}>
        {editingPath
          ? padLine(" Type path • Enter navigate • Tab/Esc cancel")
          : padLine(" ↑↓/jk navigate • Enter select • Tab edit path")}
      </Text>
      <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
    </Box>
  );
}
