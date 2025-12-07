/**
 * TaskDetail Component
 *
 * Displays the selected task details including subtasks, comments, and attachments.
 * Handles inline editing modes for comments and descriptions.
 * Overlay editing (status, priority, project, due date, attachments) is handled
 * by EditOverlay component at the app level.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import TextInput from "ink-text-input";
import {
  selectUiMode,
  useTuiActorRef,
  useTuiSelector,
} from "../machines/index.ts";
import { MultilineInput } from "./MultilineInput.tsx";
import { theme } from "./theme.ts";
import { formatRecurrence } from "../../shared/recurrence-parser.ts";
import type { RecurrenceRule } from "../../shared/schemas.ts";
import { LinkedText } from "./LinkedText.tsx";
import { getCommentWidth, type LayoutMode } from "../responsive.ts";

/** Format a UTC date/datetime string to local system time in ISO format */
function formatLocalDate(utcString: string): string {
  let normalized: string;

  if (utcString.endsWith("Z")) {
    // Already has Z suffix
    normalized = utcString;
  } else if (utcString.includes("T")) {
    // Has time but no Z - append Z
    normalized = utcString + "Z";
  } else if (utcString.includes(" ") && utcString.length > 10) {
    // SQLite datetime format: "YYYY-MM-DD HH:MM:SS" - replace space with T and append Z
    normalized = utcString.replace(" ", "T") + "Z";
  } else {
    // Date-only: "YYYY-MM-DD" - append midnight UTC
    normalized = utcString + "T00:00:00Z";
  }

  const date = new Date(normalized);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${
    pad(date.getDate())
  } ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Split text into lines respecting terminal width and newlines */
function splitIntoLines(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n");

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }

    let remaining = paragraph;
    while (remaining.length > 0) {
      if (remaining.length <= maxWidth) {
        lines.push(remaining);
        break;
      }

      // Find last space before maxWidth
      let breakPoint = remaining.lastIndexOf(" ", maxWidth);
      if (breakPoint === -1 || breakPoint === 0) {
        breakPoint = maxWidth; // Hard break if no space found
      }

      lines.push(remaining.slice(0, breakPoint));
      remaining = remaining.slice(breakPoint).trimStart();
    }
  }

  return lines;
}

interface ScrollableCommentProps {
  comment: { id: number; content: string; created_at: string };
  maxHeight: number;
  maxWidth: number;
  isHighlighted: boolean;
  isFocused: boolean;
  scrollOffset: number;
}

function ScrollableComment({
  comment,
  maxHeight,
  maxWidth,
  isHighlighted,
  isFocused,
  scrollOffset,
}: ScrollableCommentProps): React.ReactElement {
  const lines = useMemo(
    () => splitIntoLines(comment.content, maxWidth),
    [comment.content, maxWidth],
  );

  const totalLines = lines.length;
  const needsScroll = totalLines > maxHeight;
  const maxScrollOffset = Math.max(0, totalLines - maxHeight);
  const safeOffset = Math.min(scrollOffset, maxScrollOffset);

  const visibleLines = lines.slice(safeOffset, safeOffset + maxHeight);
  const hasMoreAbove = safeOffset > 0;
  const hasMoreBelow = safeOffset + maxHeight < totalLines;

  // Visual states: focused (scrolling) > highlighted (selected) > normal
  const borderStyle = isFocused
    ? theme.borders.focused
    : theme.borders.unfocused;
  const borderColor = isFocused
    ? theme.colors.warning
    : isHighlighted
    ? theme.colors.primary
    : theme.colors.muted;

  return (
    <Box
      flexDirection="column"
      marginLeft={1}
      borderStyle={borderStyle}
      borderColor={borderColor}
      paddingX={1}
      flexShrink={1}
      overflow="hidden"
    >
      <Text color={theme.colors.muted}>
        {formatLocalDate(comment.created_at)}
      </Text>

      {needsScroll && hasMoreAbove && (
        <Text color={theme.colors.muted}>▲ more</Text>
      )}

      {visibleLines.map((line, idx) => {
        // Hard truncate - use maxWidth passed to component
        const truncatedLine = line.length > maxWidth
          ? line.slice(0, maxWidth - 1) + "…"
          : line || " ";
        return <LinkedText key={idx}>{truncatedLine}</LinkedText>;
      })}

      {needsScroll && hasMoreBelow && (
        <Text color={theme.colors.muted}>▼ more</Text>
      )}

      {needsScroll && !isFocused && (
        <Text color={theme.colors.muted} dimColor>
          (Enter to scroll)
        </Text>
      )}
    </Box>
  );
}

interface TaskDetailProps {
  isFocused: boolean;
  height?: number;
  layoutMode?: LayoutMode;
}

export function TaskDetail(
  { isFocused, height, layoutMode = "split" }: TaskDetailProps,
): React.ReactElement {
  const actorRef = useTuiActorRef();
  const task = useTuiSelector((state) => state.context.selectedTask);
  const mode = useTuiSelector(selectUiMode);
  const commentText = useTuiSelector((state) => state.context.commentText);
  const descriptionText = useTuiSelector((state) =>
    state.context.descriptionText
  );
  const titleText = useTuiSelector((state) => state.context.titleText);
  const [scrollOffset, setScrollOffset] = useState(0);

  // In-comment scrolling state
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const [highlightedCommentIndex, setHighlightedCommentIndex] = useState(0);
  const [focusedCommentId, setFocusedCommentId] = useState<number | null>(null);
  const [inCommentScrollOffset, setInCommentScrollOffset] = useState(0);
  const isInCommentFocusMode = focusedCommentId !== null;

  const isAddingComment = mode === "addingComment";
  const isEditingDescription = mode === "editingDescription";
  const isEditingTitle = mode === "editingTitle";
  const isEditing = isAddingComment || isEditingDescription || isEditingTitle;

  // Calculate how many comments can be displayed
  // Header section takes ~12 lines (title, status, priority, project, due, description)
  // Each comment has fixed max height (border + timestamp + content lines + indicators)
  // Help text takes 2 lines
  const headerLines = 12;
  const helpLines = 2;
  const maxCommentContentLines = 5;
  // Comment box: 2 (border) + 1 (timestamp) + maxCommentContentLines + 1 (potential indicator)
  const linesPerComment = 2 + 1 + maxCommentContentLines + 1;
  const availableForComments = height
    ? Math.max(0, height - headerLines - helpLines)
    : 20;
  const maxVisibleComments = Math.max(
    1,
    Math.floor(availableForComments / linesPerComment),
  );

  // Calculate visible comments based on scroll
  const { visibleComments, hasMoreAbove, hasMoreBelow, totalComments } =
    useMemo(() => {
      if (!task) {
        return {
          visibleComments: [],
          hasMoreAbove: false,
          hasMoreBelow: false,
          totalComments: 0,
        };
      }

      const total = task.comments.length;
      const maxOffset = Math.max(0, total - maxVisibleComments);
      const safeOffset = Math.min(scrollOffset, maxOffset);

      return {
        visibleComments: task.comments.slice(
          safeOffset,
          safeOffset + maxVisibleComments,
        ),
        hasMoreAbove: safeOffset > 0,
        hasMoreBelow: safeOffset + maxVisibleComments < total,
        totalComments: total,
      };
    }, [task, scrollOffset, maxVisibleComments]);

  // Reset scroll and focus state when task changes
  useEffect(() => {
    setScrollOffset(0);
    setHighlightedCommentIndex(0);
    setFocusedCommentId(null);
    setInCommentScrollOffset(0);
  }, [task?.id]);

  // Clamp scroll offset when maxVisibleComments changes
  useEffect(() => {
    if (task) {
      const maxOffset = Math.max(0, task.comments.length - maxVisibleComments);
      setScrollOffset((prev) => Math.min(prev, maxOffset));
    }
  }, [task, maxVisibleComments]);

  // Clamp highlighted index when visible comments change
  useEffect(() => {
    if (visibleComments.length > 0) {
      setHighlightedCommentIndex((prev) =>
        Math.min(prev, visibleComments.length - 1)
      );
    }
  }, [visibleComments.length]);

  // Calculate max scroll offset for focused comment
  const focusedComment = focusedCommentId
    ? visibleComments.find((c) => c.id === focusedCommentId)
    : null;
  // Comment content width based on terminal width and layout mode
  const commentContentWidth = getCommentWidth(terminalWidth, layoutMode);
  const focusedCommentLines = focusedComment
    ? splitIntoLines(focusedComment.content, commentContentWidth)
    : [];
  const maxInCommentScrollOffset = Math.max(
    0,
    focusedCommentLines.length - maxCommentContentLines,
  );

  // Handle scroll with arrow keys when focused and not editing
  useInput(
    (input, key) => {
      if (!isFocused || isEditing || !task) return;

      // Comment focus mode: k/j scroll within comment, Enter/Escape exits
      if (isInCommentFocusMode) {
        if (key.return || key.escape) {
          setFocusedCommentId(null);
          setInCommentScrollOffset(0);
          return;
        }
        if (key.upArrow || input === "k") {
          setInCommentScrollOffset((prev) => Math.max(0, prev - 1));
        } else if (key.downArrow || input === "j") {
          setInCommentScrollOffset((prev) =>
            Math.min(maxInCommentScrollOffset, prev + 1)
          );
        }
        return;
      }

      // Normal mode: k/j highlight comments, Enter focuses highlighted comment
      if (visibleComments.length === 0) return;

      const maxHighlightIndex = visibleComments.length - 1;
      const maxListOffset = Math.max(
        0,
        task.comments.length - maxVisibleComments,
      );

      if (key.upArrow || input === "k") {
        if (highlightedCommentIndex > 0) {
          // Move highlight up within visible comments
          setHighlightedCommentIndex((prev) => prev - 1);
        } else if (scrollOffset > 0) {
          // At top of visible, scroll list up
          setScrollOffset((prev) => Math.max(0, prev - 1));
        }
      } else if (key.downArrow || input === "j") {
        if (highlightedCommentIndex < maxHighlightIndex) {
          // Move highlight down within visible comments
          setHighlightedCommentIndex((prev) => prev + 1);
        } else if (scrollOffset < maxListOffset) {
          // At bottom of visible, scroll list down
          setScrollOffset((prev) => Math.min(maxListOffset, prev + 1));
        }
      } else if (key.return) {
        // Focus the highlighted comment for scrolling
        const highlighted = visibleComments[highlightedCommentIndex];
        if (highlighted) {
          setFocusedCommentId(highlighted.id);
          setInCommentScrollOffset(0);
        }
      }
    },
    { isActive: isFocused && !isEditing },
  );

  if (!task) {
    return (
      <Text color={theme.colors.muted}>
        Select a task to view details
      </Text>
    );
  }

  const priorityLabel = task.priority === 2
    ? "Urgent"
    : task.priority === 1
    ? "High"
    : "Normal";

  // Build title with parent prefix for subtasks
  const displayTitle = task.parent_title
    ? `${task.parent_title} > ${task.title}`
    : task.title;

  return (
    <Box flexDirection="column" height={height}>
      {/* Title */}
      <Box
        borderStyle={theme.borders.overlay}
        borderColor={isEditingTitle
          ? theme.colors.warning
          : isFocused
          ? theme.colors.primary
          : theme.colors.muted}
        paddingX={1}
      >
        {isEditingTitle
          ? (
            <TextInput
              value={titleText}
              onChange={(value) =>
                actorRef.send({ type: "UPDATE_TITLE", value })}
              onSubmit={() => actorRef.send({ type: "SUBMIT" })}
            />
          )
          : (
            <Text
              bold
              color={isFocused ? theme.colors.primary : theme.colors.muted}
            >
              {displayTitle}
            </Text>
          )}
      </Box>

      {/* Status & Priority */}
      <Box marginTop={1} flexDirection="column">
        <Text>
          <Text color={theme.colors.muted}>ID:</Text>
          {task.id}
        </Text>
        <Text>
          <Text color={theme.colors.muted}>
            <Text underline>S</Text>tatus:
          </Text>
          <Text
            color={task.status === "done"
              ? theme.colors.success
              : task.status === "in-progress"
              ? theme.colors.warning
              : theme.colors.text}
          >
            {task.status}
          </Text>
        </Text>
        <Text>
          <Text color={theme.colors.muted}>
            <Text underline>P</Text>riority:
          </Text>
          <Text
            color={task.priority === 2
              ? theme.colors.error
              : task.priority === 1
              ? theme.colors.warning
              : theme.colors.text}
          >
            {priorityLabel}
          </Text>
        </Text>
        <Text>
          <Text color={theme.colors.muted}>
            Pr<Text underline>o</Text>ject:
          </Text>
          {task.project_name || "-"}
        </Text>
        <Text>
          <Text color={theme.colors.muted}>
            D<Text underline>u</Text>e:
          </Text>
          {task.due_date ? formatLocalDate(task.due_date) : "-"}
        </Text>
        <Text>
          <Text color={theme.colors.muted}>Duration:</Text>
          {task.duration_hours ? `${task.duration_hours}h` : "-"}
        </Text>
        <Text>
          <Text color={theme.colors.muted}>
            <Text underline>T</Text>ags:
          </Text>
          {task.tags && task.tags.length > 0
            ? task.tags.map((t) => `#${t.name}`).join(" ")
            : "-"}
        </Text>
        <Text>
          <Text color={theme.colors.muted}>
            <Text underline>R</Text>ecurrence:
          </Text>
          {task.recurrence
            ? formatRecurrence(task.recurrence as RecurrenceRule)
            : "-"}
        </Text>
        <Box flexDirection="column">
          <Text color={theme.colors.muted}>
            <Text underline>C</Text>alendar Event:
          </Text>
          {task.gcal_event_url
            ? (
              <Box marginLeft={2}>
                <LinkedText>{`${task.gcal_event_url} ↗`}</LinkedText>
              </Box>
            )
            : (
              <Text>
                {task.gcal_event_id ? ` ${task.gcal_event_id}` : " -"}
              </Text>
            )}
        </Box>
      </Box>

      {/* Description */}
      <Box marginTop={1}>
        <Text color={theme.colors.muted}>
          <Text underline>D</Text>escription:
        </Text>
      </Box>
      <Box marginLeft={2}>
        {isEditingDescription
          ? (
            <Box
              borderStyle={theme.borders.unfocused}
              borderColor={theme.colors.warning}
            >
              <MultilineInput
                value={descriptionText}
                onChange={(value) =>
                  actorRef.send({ type: "UPDATE_DESCRIPTION", value })}
                onSubmit={() => actorRef.send({ type: "SUBMIT" })}
                placeholder="Enter description..."
              />
            </Box>
          )
          : task.description
          ? <LinkedText>{task.description}</LinkedText>
          : <Text>-</Text>}
      </Box>

      {/* Comments with scroll indicators */}
      {totalComments > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text bold underline>Comments:</Text>
            {totalComments > maxVisibleComments && (
              <Text color={theme.colors.muted}>
                ({scrollOffset + 1}-{Math.min(
                  scrollOffset + maxVisibleComments,
                  totalComments,
                )}/{totalComments})
              </Text>
            )}
          </Box>

          {hasMoreAbove && <Text color={theme.colors.muted}>↑ more above</Text>}

          {visibleComments.map((comment, idx) => (
            <ScrollableComment
              key={`comment-${comment.id}`}
              comment={comment}
              maxHeight={maxCommentContentLines}
              maxWidth={commentContentWidth}
              isHighlighted={idx === highlightedCommentIndex &&
                !isInCommentFocusMode}
              isFocused={focusedCommentId === comment.id}
              scrollOffset={focusedCommentId === comment.id
                ? inCommentScrollOffset
                : 0}
            />
          ))}

          {hasMoreBelow && <Text color={theme.colors.muted}>↓ more below</Text>}
        </Box>
      )}

      {/* Attachments */}
      {task.attachments.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold underline>Attachments:</Text>
          {task.attachments.map((att) => (
            <Box key={`attachment-${att.id}`} marginLeft={1}>
              <Text color={theme.colors.primary}>
                📎 {att.filename}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Add Comment Input */}
      {isAddingComment && (
        <Box
          marginTop={1}
          borderStyle={theme.borders.unfocused}
          borderColor={theme.colors.warning}
          flexDirection="column"
        >
          <Text>
            Add Comment:{" "}
            <Text dimColor>(Esc to cancel, Shift+Enter for new line)</Text>
          </Text>
          <MultilineInput
            value={commentText}
            onChange={(value) =>
              actorRef.send({ type: "UPDATE_COMMENT", value })}
            onSubmit={() => actorRef.send({ type: "SUBMIT" })}
            placeholder="Enter comment..."
          />
        </Box>
      )}

      {/* Help text - hide in single-column mode to save space */}
      {!isEditing && isFocused && layoutMode !== "single" && (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.colors.muted}>
            {isInCommentFocusMode
              ? "k/j:scroll Esc:exit | "
              : totalComments > 0
              ? "k/j:select Enter:read | "
              : ""}
            e:title s:status p:priority o:project u:due D:dur t:tags r:recur
            a:attach c:comment d:desc
          </Text>
        </Box>
      )}
    </Box>
  );
}
