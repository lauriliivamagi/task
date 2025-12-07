/**
 * Centralized Keyboard Handler
 *
 * Handles all global keyboard input and dispatches events to the state machine.
 * Mode-aware: different keys work in different modes.
 *
 * Uses KeybindingManager as single source of truth for keybindings.
 */

import React from "react";
import { useInput } from "ink";
import {
  selectIsEditing,
  selectUiMode,
  useTuiActorRef,
  useTuiSelector,
} from "../machines/index.ts";
import { copyToClipboard } from "../../shared/clipboard.ts";
import { DEFAULT_TEMPLATE, renderTemplate } from "../../shared/templates.ts";
import type { TaskFull } from "../../shared/schemas.ts";
import { logger } from "../../shared/logger.ts";
import { exitTui } from "../exit.ts";
import {
  getKeybindingManager,
  type KeyInfo,
} from "../../shared/keybindings.ts";

/** Format key info for debug logging */
function formatKey(input: string, key: KeyInfo): string {
  const modifiers: string[] = [];
  if (key.ctrl) modifiers.push("Ctrl");
  if (key.meta) modifiers.push("Meta");
  if (key.shift) modifiers.push("Shift");

  const special: string[] = [];
  if (key.return) special.push("Return");
  if (key.escape) special.push("Escape");
  if (key.tab) special.push("Tab");
  if (key.backspace) special.push("Backspace");
  if (key.delete) special.push("Delete");
  if (key.upArrow) special.push("Up");
  if (key.downArrow) special.push("Down");
  if (key.leftArrow) special.push("Left");
  if (key.rightArrow) special.push("Right");

  const keyDesc = special.length > 0
    ? special.join("+")
    : input
    ? `'${input}'`
    : "(empty)";

  return modifiers.length > 0 ? `${modifiers.join("+")}+${keyDesc}` : keyDesc;
}

/** Log a keyboard event being dispatched */
function logDispatch(eventType: string, mode: string, key: string): void {
  logger.debug(`Key dispatch: ${key} -> ${eventType}`, "keyboard", { mode });
}

type ActorRef = ReturnType<typeof useTuiActorRef>;

export function KeyboardHandler(): React.ReactElement | null {
  const actorRef = useTuiActorRef();
  const mode = useTuiSelector(selectUiMode);
  const isEditing = useTuiSelector(selectIsEditing);
  const selectedTask = useTuiSelector((state) => state.context.selectedTask) as
    | TaskFull
    | null;
  const searchQuery = useTuiSelector((state) => state.context.searchQuery);

  const manager = getKeybindingManager();

  useInput((input, key) => {
    const keyStr = formatKey(input, key);
    logger.debug(`Key received: ${keyStr}`, "keyboard", {
      mode,
      isEditing,
      hasSelectedTask: selectedTask !== null,
    });

    // === Global toggle handlers (work in any non-editing mode) ===
    // These are handled specially because they toggle overlays on/off

    // Command palette toggle - Shift+P (capital P)
    if (input === "P" && !isEditing) {
      if (mode === "commandPalette") {
        logDispatch("CANCEL", mode, keyStr);
        actorRef.send({ type: "CANCEL" });
      } else {
        logDispatch("OPEN_COMMAND_PALETTE", mode, keyStr);
        actorRef.send({ type: "OPEN_COMMAND_PALETTE" });
      }
      return;
    }

    // Help toggle - ? key
    if (input === "?" && !isEditing) {
      if (mode === "help") {
        logDispatch("CANCEL", mode, keyStr);
        actorRef.send({ type: "CANCEL" });
      } else {
        logDispatch("OPEN_HELP", mode, keyStr);
        actorRef.send({ type: "OPEN_HELP" });
      }
      return;
    }

    // Mode-specific handlers for editing/overlay modes
    switch (mode) {
      case "commandPalette":
        // Command palette input is handled by CommandPalette component directly
        return;

      case "creatingTask":
        handleEditingInput(key, actorRef, mode, keyStr);
        return;

      case "searching":
        handleEditingInput(key, actorRef, mode, keyStr);
        return;

      case "addingComment":
        handleMultilineEditingInput(key, actorRef, mode, keyStr);
        return;

      case "editingDescription":
        handleMultilineEditingInput(key, actorRef, mode, keyStr);
        return;

      case "changingDueDate":
        handleMultilineEditingInput(key, actorRef, mode, keyStr);
        return;

      case "creatingProject":
        handleMultilineEditingInput(key, actorRef, mode, keyStr);
        return;

      case "changingTags":
        handleMultilineEditingInput(key, actorRef, mode, keyStr);
        return;

      case "changingRecurrence":
        handleMultilineEditingInput(key, actorRef, mode, keyStr);
        return;

      case "editingTitleInList":
        handleEditingInput(key, actorRef, mode, keyStr);
        return;

      case "editingTitle":
        handleEditingInput(key, actorRef, mode, keyStr);
        return;

      case "enteringGcalDuration":
        handleGcalDurationInput(key, actorRef, mode, keyStr);
        return;

      case "changingDuration":
        handleDurationInput(key, actorRef, mode, keyStr);
        return;

      // Dropdown/selection modes - handled by components directly
      case "changingStatus":
      case "changingPriority":
      case "changingProject":
      case "addingAttachment":
        // Escape is handled by useInput in the component
        return;

      // Help mode - just handle escape
      case "help":
        if (key.escape) {
          logDispatch("CANCEL", mode, keyStr);
          actorRef.send({ type: "CANCEL" });
        }
        return;

      // Submitting states - ignore input
      case "submittingTask":
        return;
    }

    // === List and Detail modes: use KeybindingManager ===

    // Determine binding mode from UI mode
    const bindingMode = mode === "list" ? "listView" : "detailView";

    // Normalize key input
    const normalizedKey = manager.normalizeKey(input, key);

    // Handle clear search with Escape when search is active (special case)
    if (key.escape && searchQuery) {
      logDispatch("CLEAR_SEARCH", mode, keyStr);
      actorRef.send({ type: "CLEAR_SEARCH" });
      return;
    }

    // Look up action
    const action = manager.lookupAction(normalizedKey, bindingMode);

    if (!action) {
      // No binding for this key
      return;
    }

    logger.debug(
      `Keybinding matched: ${normalizedKey} -> ${action}`,
      "keyboard",
      { mode },
    );

    // Handle special actions that don't dispatch to state machine
    if (manager.isSpecialAction(action)) {
      switch (action) {
        case "yankTask":
          if (selectedTask) {
            logger.debug("Yank task to clipboard", "keyboard", {
              mode,
              keyStr,
            });
            const rendered = renderTemplate(DEFAULT_TEMPLATE, selectedTask);
            copyToClipboard(rendered).catch(() => {
              // Silently fail
            });
          }
          return;

        case "quit":
          logger.debug("Quit requested", "keyboard", { mode });
          exitTui(0);
          return;

        case "moveDown":
        case "moveUp":
          // Navigation is handled by SelectInput component, not state machine
          // The SelectInput in TaskList.tsx handles j/k/Up/Down directly
          return;
      }
      return;
    }

    // Get the XState event type and dispatch
    const eventType = manager.getEventType(action);
    if (eventType) {
      logDispatch(eventType, mode, keyStr);
      // Cast to any since we know the event types are valid TuiEvent types
      // deno-lint-ignore no-explicit-any
      actorRef.send({ type: eventType } as any);
    }
  });

  return null; // No UI, just handles input
}

// === Editing mode handlers ===

/**
 * Handle input in single-line editing modes (Escape cancels, Enter submits)
 */
function handleEditingInput(
  key: KeyInfo,
  actorRef: ActorRef,
  mode: string,
  keyStr: string,
): void {
  if (key.escape) {
    logDispatch("CANCEL", mode, keyStr);
    actorRef.send({ type: "CANCEL" });
    return;
  }

  if (key.return) {
    logDispatch("SUBMIT", mode, keyStr);
    actorRef.send({ type: "SUBMIT" });
    return;
  }

  // Text input is handled by the TextInput component directly
}

/**
 * Handle input in multiline editing modes (Escape cancels, Enter without Shift submits)
 */
function handleMultilineEditingInput(
  key: KeyInfo,
  actorRef: ActorRef,
  mode: string,
  keyStr: string,
): void {
  if (key.escape) {
    logDispatch("CANCEL", mode, keyStr);
    actorRef.send({ type: "CANCEL" });
    return;
  }

  if (key.return && !key.shift) {
    logDispatch("SUBMIT", mode, keyStr);
    actorRef.send({ type: "SUBMIT" });
    return;
  }

  // Multiline input handles shift+enter for newlines
}

/**
 * Handle input in Google Calendar duration mode
 */
function handleGcalDurationInput(
  key: KeyInfo,
  actorRef: ActorRef,
  mode: string,
  keyStr: string,
): void {
  if (key.escape) {
    logDispatch("CANCEL", mode, keyStr);
    actorRef.send({ type: "CANCEL" });
    return;
  }

  if (key.return) {
    logDispatch("CONFIRM_GCAL_SYNC", mode, keyStr);
    actorRef.send({ type: "CONFIRM_GCAL_SYNC" });
    return;
  }
}

/**
 * Handle input in duration editing mode
 */
function handleDurationInput(
  key: KeyInfo,
  actorRef: ActorRef,
  mode: string,
  keyStr: string,
): void {
  if (key.escape) {
    logDispatch("CANCEL", mode, keyStr);
    actorRef.send({ type: "CANCEL" });
    return;
  }

  if (key.return) {
    logDispatch("CONFIRM_DURATION", mode, keyStr);
    actorRef.send({ type: "CONFIRM_DURATION" });
    return;
  }
}
