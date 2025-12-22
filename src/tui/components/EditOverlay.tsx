/**
 * EditOverlay Component
 *
 * Renders edit overlays (dropdowns, file browser, inputs) centered on screen.
 * Used for status, priority, project, due date, and attachment editing.
 */

import React from "react";
import { Box, Text, useStdout } from "ink";
import {
  selectUiMode,
  useTuiActorRef,
  useTuiSelector,
} from "../machines/index.ts";
import type { TaskStatus } from "../../shared/schemas.ts";
import { ConfirmationDialog } from "./ConfirmationDialog.tsx";
import { Dropdown, type DropdownOption } from "./Dropdown.tsx";
import { FileBrowser } from "./FileBrowser.tsx";
import { MultilineInput } from "./MultilineInput.tsx";
import { theme } from "./theme.ts";

import { formatRecurrence } from "../../shared/recurrence-parser.ts";
import type { RecurrenceRule } from "../../shared/schemas.ts";
import { getModalWidth } from "../responsive.ts";

const BG_COLOR = "#16213e";
const BASE_WIDTH = 40;

// Status options for dropdown
const STATUS_OPTIONS: DropdownOption<TaskStatus>[] = [
  { label: "Todo", value: "todo", color: theme.colors.text },
  { label: "In Progress", value: "in-progress", color: theme.colors.warning },
  { label: "Done", value: "done", color: theme.colors.success },
];

// Priority options for dropdown
const PRIORITY_OPTIONS: DropdownOption<number>[] = [
  { label: "Normal", value: 0, color: theme.colors.text },
  { label: "High", value: 1, color: theme.colors.warning },
  { label: "Urgent", value: 2, color: theme.colors.error },
];

// Special sentinel value to indicate "create new project" action
const CREATE_PROJECT_SENTINEL = -999;

export function EditOverlay(): React.ReactElement | null {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const WIDTH = getModalWidth(terminalWidth, BASE_WIDTH);

  const actorRef = useTuiActorRef();
  const mode = useTuiSelector(selectUiMode);
  const task = useTuiSelector((state) => state.context.selectedTask);
  const projects = useTuiSelector((state) => state.context.projects);
  const dueDateText = useTuiSelector((state) => state.context.dueDateText);
  const tagsText = useTuiSelector((state) => state.context.tagsText);
  const recurrenceText = useTuiSelector(
    (state) => state.context.recurrenceText,
  );
  const newProjectName = useTuiSelector(
    (state) => state.context.newProjectName,
  );
  const gcalDurationText = useTuiSelector(
    (state) => state.context.gcalDurationText,
  );
  const durationText = useTuiSelector((state) => state.context.durationText);

  // Build project options for dropdown (includes "Create new project" option)
  const projectOptions: DropdownOption<number | null>[] = [
    { label: "None", value: null, color: theme.colors.muted },
    ...projects.map((p) => ({
      label: p.name,
      value: p.id,
      color: theme.colors.primary,
    })),
    {
      label: "+ Create new project",
      value: CREATE_PROJECT_SENTINEL,
      color: theme.colors.success,
    },
  ];

  if (!task) return null;

  // Status dropdown
  if (mode === "changingStatus") {
    return (
      <Dropdown
        options={STATUS_OPTIONS}
        selectedValue={task.status}
        onSelect={(value) => actorRef.send({ type: "SELECT_STATUS", value })}
        onCancel={() => actorRef.send({ type: "CANCEL" })}
        title="Change Status"
      />
    );
  }

  // Priority dropdown
  if (mode === "changingPriority") {
    return (
      <Dropdown
        options={PRIORITY_OPTIONS}
        selectedValue={task.priority}
        onSelect={(value) => actorRef.send({ type: "SELECT_PRIORITY", value })}
        onCancel={() => actorRef.send({ type: "CANCEL" })}
        title="Change Priority"
      />
    );
  }

  // Project dropdown
  if (mode === "changingProject") {
    return (
      <Dropdown
        options={projectOptions}
        selectedValue={task.project_id}
        onSelect={(value) => {
          if (value === CREATE_PROJECT_SENTINEL) {
            actorRef.send({ type: "SELECT_CREATE_PROJECT" });
          } else {
            actorRef.send({ type: "SELECT_PROJECT", value });
          }
        }}
        onCancel={() => actorRef.send({ type: "CANCEL" })}
        title="Change Project"
      />
    );
  }

  // New project creation input
  if (mode === "creatingProject") {
    const padLine = (text: string) => text.padEnd(WIDTH, " ");

    return (
      <Box
        flexDirection="column"
        borderStyle={theme.borders.overlay}
        borderColor={theme.colors.success}
      >
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Box>
          <Text backgroundColor={BG_COLOR} bold color={theme.colors.success}>
            {" Create New Project"}
          </Text>
          <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
            {" ".repeat(WIDTH - 28)}Esc to cancel{" "}
          </Text>
        </Box>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {padLine(" Enter project name")}
        </Text>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Box
          borderStyle={theme.borders.unfocused}
          borderColor={theme.colors.muted}
        >
          <Text backgroundColor={BG_COLOR}></Text>
          <MultilineInput
            value={newProjectName}
            onChange={(value) =>
              actorRef.send({ type: "UPDATE_PROJECT_NAME", value })}
            onSubmit={() => actorRef.send({ type: "SUBMIT" })}
            placeholder="Project name..."
          />
          <Text backgroundColor={BG_COLOR}>{" ".repeat(WIDTH - 14)}</Text>
        </Box>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {padLine(" Enter to create & assign")}
        </Text>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
      </Box>
    );
  }

  // Due date input
  if (mode === "changingDueDate") {
    const padLine = (text: string) => text.padEnd(WIDTH, " ");

    return (
      <Box
        flexDirection="column"
        borderStyle={theme.borders.overlay}
        borderColor={theme.colors.warning}
      >
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Box>
          <Text backgroundColor={BG_COLOR} bold color={theme.colors.warning}>
            {" Change Due Date"}
          </Text>
          <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
            {" ".repeat(WIDTH - 28)}Esc to cancel{" "}
          </Text>
        </Box>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {padLine(" Format: YYYY-MM-DD or YYYY-MM-DD HH:MM")}
        </Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {padLine(" Or natural: tomorrow at 14:00, next Monday")}
        </Text>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Box
          borderStyle={theme.borders.unfocused}
          borderColor={theme.colors.muted}
        >
          <Text backgroundColor={BG_COLOR}></Text>
          <MultilineInput
            value={dueDateText}
            onChange={(value) =>
              actorRef.send({ type: "UPDATE_DUE_DATE", value })}
            onSubmit={() => actorRef.send({ type: "SUBMIT" })}
            placeholder="2024-12-31 14:00 or tomorrow at 14:00"
          />
          <Text backgroundColor={BG_COLOR}>{" ".repeat(WIDTH - 14)}</Text>
        </Box>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {padLine(" Enter to save")}
        </Text>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
      </Box>
    );
  }

  // Tags input
  if (mode === "changingTags") {
    const padLine = (text: string) => text.padEnd(WIDTH, " ");

    return (
      <Box
        flexDirection="column"
        borderStyle={theme.borders.overlay}
        borderColor={theme.colors.primary}
      >
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Box>
          <Text backgroundColor={BG_COLOR} bold color={theme.colors.primary}>
            {" Edit Tags"}
          </Text>
          <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
            {" ".repeat(WIDTH - 22)}Esc to cancel{" "}
          </Text>
        </Box>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {padLine(" Edit tags (space or comma separated)")}
        </Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {padLine(" Remove tags by deleting them")}
        </Text>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Box
          borderStyle={theme.borders.unfocused}
          borderColor={theme.colors.muted}
        >
          <Text backgroundColor={BG_COLOR}></Text>
          <MultilineInput
            value={tagsText}
            onChange={(value) => actorRef.send({ type: "UPDATE_TAGS", value })}
            onSubmit={() => actorRef.send({ type: "SUBMIT" })}
            placeholder="bug feature urgent"
          />
          <Text backgroundColor={BG_COLOR}>{" ".repeat(WIDTH - 14)}</Text>
        </Box>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {padLine(" Enter to save")}
        </Text>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
      </Box>
    );
  }

  // Recurrence input
  if (mode === "changingRecurrence") {
    const padLine = (text: string) => text.padEnd(WIDTH, " ");
    const currentRecurrence = task.recurrence
      ? formatRecurrence(task.recurrence as RecurrenceRule)
      : "None";

    return (
      <Box
        flexDirection="column"
        borderStyle={theme.borders.overlay}
        borderColor={theme.colors.success}
      >
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Box>
          <Text backgroundColor={BG_COLOR} bold color={theme.colors.success}>
            {" Edit Recurrence"}
          </Text>
          <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
            {" ".repeat(WIDTH - 28)}Esc to cancel{" "}
          </Text>
        </Box>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {padLine(` Current: ${currentRecurrence}`)}
        </Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {padLine(" Examples: every day, every Monday,")}
        </Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {padLine(" monthly, every 2 weeks")}
        </Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {padLine(" Leave empty to remove recurrence")}
        </Text>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Box
          borderStyle={theme.borders.unfocused}
          borderColor={theme.colors.muted}
        >
          <Text backgroundColor={BG_COLOR}></Text>
          <MultilineInput
            value={recurrenceText}
            onChange={(value) =>
              actorRef.send({ type: "UPDATE_RECURRENCE", value })}
            onSubmit={() => actorRef.send({ type: "SUBMIT" })}
            placeholder="every day"
          />
          <Text backgroundColor={BG_COLOR}>{" ".repeat(WIDTH - 14)}</Text>
        </Box>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {padLine(" Enter to save")}
        </Text>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
      </Box>
    );
  }

  // File browser for attachments
  if (mode === "addingAttachment") {
    return (
      <FileBrowser
        onSelect={(filepath) =>
          actorRef.send({ type: "SELECT_FILE", filepath })}
        onCancel={() => actorRef.send({ type: "CANCEL" })}
      />
    );
  }

  // Task duration input
  if (mode === "changingDuration") {
    const padLine = (text: string) => text.padEnd(WIDTH, " ");

    return (
      <Box
        flexDirection="column"
        borderStyle={theme.borders.overlay}
        borderColor={theme.colors.primary}
      >
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Box>
          <Text backgroundColor={BG_COLOR} bold color={theme.colors.primary}>
            {" Edit Duration"}
          </Text>
          <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
            {" ".repeat(WIDTH - 26)}Esc to cancel{" "}
          </Text>
        </Box>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {padLine(" Duration in hours (0.25-24, empty to clear)")}
        </Text>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Box
          borderStyle={theme.borders.unfocused}
          borderColor={theme.colors.muted}
        >
          <Text backgroundColor={BG_COLOR}></Text>
          <MultilineInput
            value={durationText}
            onChange={(value) =>
              actorRef.send({ type: "UPDATE_DURATION", value })}
            onSubmit={() => actorRef.send({ type: "CONFIRM_DURATION" })}
            placeholder=""
          />
          <Text backgroundColor={BG_COLOR}>{" ".repeat(WIDTH - 14)}</Text>
        </Box>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {padLine(" Enter to save")}
        </Text>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
      </Box>
    );
  }

  // Google Calendar duration input
  if (mode === "enteringGcalDuration") {
    const padLine = (text: string) => text.padEnd(WIDTH, " ");

    return (
      <Box
        flexDirection="column"
        borderStyle={theme.borders.overlay}
        borderColor={theme.colors.primary}
      >
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Box>
          <Text backgroundColor={BG_COLOR} bold color={theme.colors.primary}>
            {" Sync to Calendar"}
          </Text>
          <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
            {" ".repeat(WIDTH - 28)}Esc to cancel{" "}
          </Text>
        </Box>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {padLine(" Event duration in hours")}
        </Text>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Box
          borderStyle={theme.borders.unfocused}
          borderColor={theme.colors.muted}
        >
          <Text backgroundColor={BG_COLOR}></Text>
          <MultilineInput
            value={gcalDurationText}
            onChange={(value) =>
              actorRef.send({ type: "UPDATE_GCAL_DURATION", value })}
            onSubmit={() => actorRef.send({ type: "CONFIRM_GCAL_SYNC" })}
            placeholder="1"
          />
          <Text backgroundColor={BG_COLOR}>{" ".repeat(WIDTH - 14)}</Text>
        </Box>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
        <Text backgroundColor={BG_COLOR} color={theme.colors.muted}>
          {padLine(" Enter to sync")}
        </Text>
        <Text backgroundColor={BG_COLOR}>{padLine("")}</Text>
      </Box>
    );
  }

  // Delete confirmation
  if (mode === "confirmingDelete") {
    const taskTitle = task?.title ?? "this task";
    return (
      <ConfirmationDialog
        title="Delete Task"
        message={`Delete "${taskTitle}"?`}
        onConfirm={() => actorRef.send({ type: "CONFIRM_DELETE" })}
        onCancel={() => actorRef.send({ type: "CANCEL" })}
      />
    );
  }

  return null;
}
