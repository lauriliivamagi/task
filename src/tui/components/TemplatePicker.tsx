/**
 * TemplatePicker Component
 *
 * Modal overlay for selecting a workspace template.
 * Auto-selects if 0 or 1 templates configured.
 */

import React, { useEffect, useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { useTuiActorRef } from "../machines/index.ts";
import { theme } from "./theme.ts";
import { getModalWidth } from "../responsive.ts";
import { getConfig } from "../../shared/config.ts";
import type { WorkspaceTemplate } from "../../shared/config.ts";

export function TemplatePicker(): React.ReactElement {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const pickerWidth = getModalWidth(terminalWidth, 50);

  const actorRef = useTuiActorRef();
  const [templates, setTemplates] = useState<WorkspaceTemplate[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTemplates(): Promise<void> {
      const config = await getConfig();
      const configured = config.work.templates;

      if (!configured || configured.length === 0) {
        // No external templates — use built-in behavior
        actorRef.send({ type: "SELECT_TEMPLATE", templateName: null });
        return;
      }

      if (configured.length === 1) {
        // Single template — auto-select
        actorRef.send({
          type: "SELECT_TEMPLATE",
          templateName: configured[0].name,
        });
        return;
      }

      setTemplates(configured);
      setLoading(false);
    }
    loadTemplates();
  }, []);

  useInput((input, key) => {
    if (loading || templates.length === 0) return;

    if (key.escape) {
      actorRef.send({ type: "CANCEL_TEMPLATE_PICKER" });
      return;
    }

    if (key.return) {
      actorRef.send({
        type: "SELECT_TEMPLATE",
        templateName: templates[selectedIndex].name,
      });
      return;
    }

    if (key.upArrow || input === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return;
    }

    if (key.downArrow || input === "j") {
      setSelectedIndex((i) => Math.min(templates.length - 1, i + 1));
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
        <Text color={theme.colors.muted}>Loading templates...</Text>
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
          Select Template
        </Text>
        <Text color={theme.colors.muted}>Esc to cancel</Text>
      </Box>

      <Box flexDirection="column">
        {templates.map((tmpl, idx) => (
          <Box key={tmpl.name} flexDirection="column">
            <Text
              color={idx === selectedIndex
                ? theme.colors.accent
                : theme.colors.text}
              bold={idx === selectedIndex}
            >
              {idx === selectedIndex ? "\u25B8 " : "  "}
              {tmpl.name}
            </Text>
            {tmpl.description && idx === selectedIndex && (
              <Text color={theme.colors.muted}>
                {"    "}{tmpl.description}
              </Text>
            )}
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color={theme.colors.muted}>
          ↑↓/jk navigate • Enter select
        </Text>
      </Box>
    </Box>
  );
}
