/**
 * DatabasePicker Component
 *
 * Modal overlay for selecting a database to switch to.
 */

import React, { useEffect, useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { useTuiActorRef } from "../machines/index.ts";
import { theme } from "./theme.ts";
import { getModalWidth } from "../responsive.ts";
import { getActiveDbName } from "../../db/client.ts";
import { getDatabasesDir } from "../../shared/config.ts";
import { exists } from "@std/fs";
import { join } from "@std/path";

interface DatabaseInfo {
  name: string;
  isActive: boolean;
}

export function DatabasePicker(): React.ReactElement {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const pickerWidth = getModalWidth(terminalWidth, 40);

  const actorRef = useTuiActorRef();
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load database list on mount
  useEffect(() => {
    async function loadDatabases(): Promise<void> {
      const dbsDir = getDatabasesDir();
      const activeDb = getActiveDbName();
      const dbs: DatabaseInfo[] = [];

      try {
        for await (const entry of Deno.readDir(dbsDir)) {
          if (entry.isDirectory) {
            const dbPath = join(dbsDir, entry.name, "data.db");
            if (await exists(dbPath)) {
              dbs.push({
                name: entry.name,
                isActive: entry.name === activeDb,
              });
            }
          }
        }
      } catch {
        // Databases directory doesn't exist yet
      }

      // Sort alphabetically, but keep "default" first
      dbs.sort((a, b) => {
        if (a.name === "default") return -1;
        if (b.name === "default") return 1;
        return a.name.localeCompare(b.name);
      });

      setDatabases(dbs);

      // Set initial selection to current database
      const activeIndex = dbs.findIndex((d) => d.isActive);
      if (activeIndex >= 0) {
        setSelectedIndex(activeIndex);
      }

      setLoading(false);
    }

    loadDatabases();
  }, []);

  useInput((input, key) => {
    if (key.escape) {
      actorRef.send({ type: "CANCEL_DB_PICKER" });
      return;
    }

    if (key.return && databases.length > 0) {
      const selected = databases[selectedIndex];
      if (selected && !selected.isActive) {
        actorRef.send({ type: "SELECT_DB", name: selected.name });
      } else {
        // Already on this database, just close
        actorRef.send({ type: "CANCEL_DB_PICKER" });
      }
      return;
    }

    if (key.upArrow || input === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return;
    }

    if (key.downArrow || input === "j") {
      setSelectedIndex((i) => Math.min(databases.length - 1, i + 1));
      return;
    }
  });

  if (loading) {
    return (
      <Box
        flexDirection="column"
        borderStyle={theme.borders.overlay}
        borderColor={theme.colors.accent}
        paddingX={2}
        paddingY={1}
        width={pickerWidth}
      >
        <Text color={theme.colors.muted}>Loading databases...</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle={theme.borders.overlay}
      borderColor={theme.colors.accent}
      paddingX={2}
      paddingY={1}
      width={pickerWidth}
    >
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color={theme.colors.accent}>
          Switch Database
        </Text>
        <Text color={theme.colors.muted}>Esc to close</Text>
      </Box>

      <Box flexDirection="column">
        {databases.length === 0
          ? <Text color={theme.colors.muted}>No databases found</Text>
          : (
            databases.slice(0, 10).map((db, idx) => (
              <Box key={db.name}>
                <Text
                  color={idx === selectedIndex
                    ? theme.colors.accent
                    : db.isActive
                    ? theme.colors.success
                    : theme.colors.text}
                  bold={idx === selectedIndex}
                >
                  {idx === selectedIndex ? "\u25B8 " : "  "}
                  {db.name}
                  {db.isActive && (
                    <Text color={theme.colors.success}>(current)</Text>
                  )}
                </Text>
              </Box>
            ))
          )}
      </Box>

      <Box marginTop={1}>
        <Text color={theme.colors.muted}>
          ↑↓/jk navigate • Enter select
        </Text>
      </Box>
    </Box>
  );
}
