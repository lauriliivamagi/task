/**
 * AttachmentPicker Component
 *
 * Modal overlay for choosing which attachment to open when a task has
 * more than one. If only one exists, the state machine opens it
 * directly without rendering this picker.
 */

import React, { useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { useTuiActorRef, useTuiSelector } from "../machines/index.ts";
import { theme } from "./theme.ts";
import { getModalWidth } from "../responsive.ts";
import type { TaskFull } from "../../shared/schemas.ts";

export function AttachmentPicker(): React.ReactElement {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const pickerWidth = getModalWidth(terminalWidth, 60);

  const actorRef = useTuiActorRef();
  const attachments = useTuiSelector(
    (state) =>
      (state.context.selectedTask as TaskFull | null)?.attachments ?? [],
  );
  const isDeleteMode = useTuiSelector((state) =>
    state.matches({ ui: "pickingAttachmentForDelete" })
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (attachments.length === 0) return;

    if (key.escape) {
      actorRef.send({ type: "CANCEL_ATTACHMENT_PICKER" });
      return;
    }

    if (key.return) {
      actorRef.send(
        isDeleteMode
          ? {
            type: "SELECT_ATTACHMENT_FOR_DELETE",
            attachmentId: attachments[selectedIndex].id,
          }
          : {
            type: "SELECT_ATTACHMENT",
            attachmentId: attachments[selectedIndex].id,
          },
      );
      return;
    }

    if (key.upArrow || input === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return;
    }

    if (key.downArrow || input === "j") {
      setSelectedIndex((i) => Math.min(attachments.length - 1, i + 1));
      return;
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle={theme.borders.overlay}
      borderColor={isDeleteMode ? theme.colors.error : theme.colors.accent}
      paddingX={2}
      paddingY={1}
      width={pickerWidth}
    >
      <Box marginBottom={1} justifyContent="space-between">
        <Text
          bold
          color={isDeleteMode ? theme.colors.error : theme.colors.accent}
        >
          {isDeleteMode ? "Delete Attachment" : "Open Attachment"}
        </Text>
        <Text color={theme.colors.muted}>Esc to cancel</Text>
      </Box>

      <Box flexDirection="column">
        {attachments.map((att, idx) => (
          <Box key={`att-${att.id}`}>
            <Text
              color={idx === selectedIndex
                ? (isDeleteMode ? theme.colors.error : theme.colors.accent)
                : theme.colors.text}
              bold={idx === selectedIndex}
            >
              {idx === selectedIndex ? "\u25B8 " : "  "}
              📎 {att.filename}
            </Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color={theme.colors.muted}>
          ↑↓/jk navigate • Enter {isDeleteMode ? "delete" : "open"}
        </Text>
      </Box>
    </Box>
  );
}
