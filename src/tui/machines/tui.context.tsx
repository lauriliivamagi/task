/**
 * React Context for TUI State Machine
 *
 * Provides global access to the TUI state machine using XState's createActorContext.
 * Components can use useSelector for efficient re-renders and useActorRef to send events.
 */

import { createActorContext } from "@xstate/react";
import { tuiMachine } from "./tui.machine.ts";
import type { SnapshotFrom } from "xstate";

// Create the actor context with the TUI machine
export const TuiMachineContext = createActorContext(tuiMachine);

// Re-export hooks for convenience
export const useTuiActorRef = TuiMachineContext.useActorRef;
export const useTuiSelector = TuiMachineContext.useSelector;

// Type for machine snapshot
type TuiSnapshot = SnapshotFrom<typeof tuiMachine>;

// Helper selectors for common state checks
export const selectIsLoading = (state: TuiSnapshot) =>
  state.matches({ data: "loading" });

export const selectIsReady = (state: TuiSnapshot) =>
  state.matches({ data: "ready" });

export const selectHasError = (state: TuiSnapshot) =>
  state.matches({ data: "error" });

export const selectIsCommandPaletteOpen = (state: TuiSnapshot) =>
  state.matches({ ui: "commandPalette" });

export const selectIsHelpOpen = (state: TuiSnapshot) =>
  state.matches({ ui: "help" });

export const selectIsCreatingTask = (state: TuiSnapshot) =>
  state.matches({ ui: "creatingTask" }) ||
  state.matches({ ui: "submittingTask" });

export const selectIsSearching = (state: TuiSnapshot) =>
  state.matches({ ui: "searching" });

export const selectIsEditing = (state: TuiSnapshot) =>
  state.matches({ ui: "detailEditing" }) ||
  state.matches({ ui: "creatingTask" }) ||
  state.matches({ ui: "submittingTask" }) ||
  state.matches({ ui: "searching" }) ||
  state.matches({ ui: "editingTitleInList" }) ||
  state.matches({ ui: "submittingTitleInList" });

export const selectFocus = (state: TuiSnapshot): "list" | "detail" => {
  if (
    state.matches({ ui: { normal: "detail" } }) ||
    state.matches({ ui: "detailEditing" })
  ) {
    return "detail";
  }
  return "list";
};

export const selectUiMode = (state: TuiSnapshot) => {
  // Check data region states first (for duration overlays)
  if (state.matches({ data: "enteringGcalDuration" })) {
    return "enteringGcalDuration";
  }
  if (state.matches({ data: "enteringDuration" })) {
    return "changingDuration";
  }
  if (state.matches({ data: "updatingDuration" })) {
    return "changingDuration";
  }

  if (state.matches({ ui: "commandPalette" })) return "commandPalette";
  if (state.matches({ ui: "help" })) return "help";
  if (state.matches({ ui: "searching" })) return "searching";
  if (state.matches({ ui: "creatingTask" })) return "creatingTask";
  if (state.matches({ ui: "submittingTask" })) return "submittingTask";
  if (state.matches({ ui: "editingTitleInList" })) return "editingTitleInList";
  if (state.matches({ ui: "submittingTitleInList" })) {
    return "editingTitleInList";
  }
  if (state.matches({ ui: "pickingDatabase" })) return "pickingDatabase";
  if (state.matches({ ui: "switchingDatabase" })) return "switchingDatabase";

  // Detail editing uses currentEditingMode from context (child machine state)
  if (state.matches({ ui: "detailEditing" })) {
    const mode = state.context.currentEditingMode;
    // Map child machine states to UI modes
    switch (mode) {
      case "addingComment":
      case "submittingComment":
        return "addingComment";
      case "editingDescription":
      case "submittingDescription":
        return "editingDescription";
      case "changingStatus":
      case "submittingStatus":
        return "changingStatus";
      case "changingPriority":
      case "submittingPriority":
        return "changingPriority";
      case "loadingProjects":
      case "changingProject":
      case "submittingProject":
        return "changingProject";
      case "creatingNewProject":
      case "submittingNewProject":
        return "creatingProject";
      case "changingDueDate":
      case "submittingDueDate":
        return "changingDueDate";
      case "changingTags":
      case "submittingTags":
        return "changingTags";
      case "changingRecurrence":
      case "submittingRecurrence":
        return "changingRecurrence";
      case "addingAttachment":
      case "submittingAttachment":
        return "addingAttachment";
      case "editingTitle":
      case "submittingTitle":
        return "editingTitle";
      default:
        return "addingComment";
    }
  }

  if (state.matches({ ui: { normal: "list" } })) return "list";
  if (state.matches({ ui: { normal: "detail" } })) return "detail";
  return "list";
};
