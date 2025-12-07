/**
 * TaskList Component
 *
 * Displays the list of tasks with selection highlighting.
 * Uses useSelector for efficient re-renders.
 * Subtasks are visually indented under their parent tasks.
 */

import React, { useEffect, useMemo } from "react";
import { Text, useStdout } from "ink";
import SelectInput from "ink-select-input";

/** Truncate text to maxLength with ellipsis */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "…";
}
import { useTuiActorRef, useTuiSelector } from "../machines/index.ts";
import type { TaskWithProject } from "../../shared/schemas.ts";
import { theme } from "./theme.ts";
import { getMaxTitleWidth, type LayoutMode } from "../responsive.ts";

interface TaskListProps {
  isFocused: boolean;
  isCreatingTask: boolean;
  height?: number;
  layoutMode?: LayoutMode;
}

/** Organize tasks so subtasks appear immediately after their parent */
function organizeTasksHierarchically(
  tasks: TaskWithProject[],
): TaskWithProject[] {
  // Group tasks by parent_id
  const parentTasks = tasks.filter((t) => !t.parent_id);
  const subtasksByParent = new Map<number, TaskWithProject[]>();

  for (const task of tasks) {
    if (task.parent_id) {
      const existing = subtasksByParent.get(task.parent_id) || [];
      existing.push(task);
      subtasksByParent.set(task.parent_id, existing);
    }
  }

  // Sort parent tasks by order ASC
  parentTasks.sort((a, b) => a.order - b.order);

  // Build the ordered list: parent followed by its subtasks
  const result: TaskWithProject[] = [];
  for (const parent of parentTasks) {
    result.push(parent);
    const subtasks = subtasksByParent.get(parent.id) || [];
    // Sort subtasks by order ASC within their parent
    subtasks.sort((a, b) => a.order - b.order);
    result.push(...subtasks);
  }

  // Exclude orphan subtasks (whose parent is not in the list)
  // These are subtasks of completed/filtered-out parent tasks and should not
  // be displayed to avoid confusion (they appear indented but parent is hidden)

  return result;
}

export function TaskList(
  { isFocused, isCreatingTask, height, layoutMode = "split" }: TaskListProps,
): React.ReactElement {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const actorRef = useTuiActorRef();
  const tasks = useTuiSelector((state) => state.context.tasks);
  const selectedIndex = useTuiSelector((state) => state.context.selectedIndex);
  const pendingSelectTaskId = useTuiSelector(
    (state) => state.context.pendingSelectTaskId,
  );

  const organizedTasks = useMemo(
    () => organizeTasksHierarchically(tasks),
    [tasks],
  );

  // Get currently selected task ID from the machine's selectedIndex
  const currentTaskId = tasks[selectedIndex]?.id ?? null;

  // Check if pending task exists in the current task list
  const pendingTaskExists = pendingSelectTaskId !== null &&
    organizedTasks.some((t) => t.id === pendingSelectTaskId);

  // Create a stable key for SelectInput that changes when we need to reset selection
  // This includes: when tasks change (to reapply currentTaskId-based selection)
  // and when a new pending task is ready
  // Include all fields that affect display so key changes when display changes
  const tasksSignature = tasks
    .map((t) =>
      `${t.id}:${t.status}:${t.project_id ?? ""}:${t.order}:${t.title}:${
        t.gcal_event_id ?? ""
      }:${t.duration_hours ?? ""}`
    )
    .join(",");
  const selectKey = `${tasksSignature}-${pendingSelectTaskId ?? "none"}-${
    currentTaskId ?? "none"
  }`;

  // Calculate initial index - prioritize pending selection, then current selection
  const initialIndex = useMemo(() => {
    // First priority: pending task selection (for newly created tasks)
    if (pendingSelectTaskId !== null) {
      const idx = organizedTasks.findIndex((t) => t.id === pendingSelectTaskId);
      if (idx >= 0) return idx;
    }
    // Second priority: preserve current selection
    if (currentTaskId !== null) {
      const idx = organizedTasks.findIndex((t) => t.id === currentTaskId);
      if (idx >= 0) return idx;
    }
    return 0;
  }, [organizedTasks, pendingSelectTaskId, currentTaskId]);

  // Manually trigger HIGHLIGHT_TASK when there's a pending selection
  useEffect(() => {
    if (pendingTaskExists) {
      const task = organizedTasks.find((t) => t.id === pendingSelectTaskId);
      if (task) {
        actorRef.send({ type: "HIGHLIGHT_TASK", task });
      }
    }
  }, [pendingTaskExists, pendingSelectTaskId, organizedTasks, actorRef]);

  // Max title length based on terminal width and layout mode
  const maxTitleWidth = getMaxTitleWidth(terminalWidth, layoutMode);

  const items = organizedTasks.map((task) => {
    const statusSymbol = task.status === "done"
      ? "\u2714" // checkmark
      : task.status === "in-progress"
      ? "\u25B6" // play
      : "\u25CB"; // circle
    const prioritySymbol = task.priority === 2
      ? "!!"
      : task.priority === 1
      ? "!"
      : "";
    const recurrenceSymbol = task.recurrence ? " \u27F3" : "";
    const calendarSymbol = task.gcal_event_id ? " \uD83D\uDCC5" : ""; // Calendar icon
    // Indent subtasks with a tree-like prefix
    const indent = task.parent_id ? "  \u2514 " : "";
    // Truncate title for list view (full title shown in detail panel)
    const titleWidth = maxTitleWidth - (task.parent_id ? 4 : 0);
    const displayTitle = truncate(task.title, Math.max(20, titleWidth));
    const baseLabel =
      `${indent}${statusSymbol} ${displayTitle} ${prioritySymbol}${recurrenceSymbol}${calendarSymbol}`;
    // Apply strikethrough for done tasks using ANSI codes
    const label = task.status === "done"
      ? `\x1b[9m${baseLabel}\x1b[0m`
      : baseLabel;
    return {
      label,
      value: task,
      key: task.id.toString(),
    };
  });

  const handleHighlight = (item: { value: TaskWithProject }) => {
    actorRef.send({ type: "HIGHLIGHT_TASK", task: item.value });
  };

  if (items.length === 0) {
    return (
      <Text color={theme.colors.muted}>
        No tasks found. Press 'n' to add a task.
      </Text>
    );
  }

  // Calculate visible items based on available height
  // Subtract 2 for "Tasks" header and potential create input
  const visibleLimit = height ? Math.max(5, height - 2) : 10;

  return (
    <SelectInput
      // Key forces remount when tasks change or pending selection is ready
      // This ensures initialIndex is reapplied to preserve selection
      key={selectKey}
      items={items}
      initialIndex={initialIndex}
      limit={visibleLimit}
      onSelect={() => {}} // We use highlight for navigation
      onHighlight={handleHighlight}
      isFocused={isFocused && !isCreatingTask}
    />
  );
}
