/**
 * Keyboard Shortcuts Configuration
 *
 * Single source of truth for all TUI keyboard shortcuts.
 * Supports user customization via ~/.task-cli/config.json
 */

import { z } from "zod";
import { logger } from "./logger.ts";
import { MAX_KEYBINDINGS_PER_MODE } from "./limits.ts";

// =============================================================================
// Types and Schemas
// =============================================================================

/**
 * Binding modes correspond to TUI view states
 */
export type BindingMode = "listView" | "detailView" | "global";

/**
 * Action identifiers that map to XState events or special handlers
 */
export const ActionId = z.enum([
  // List view actions
  "moveDown",
  "moveUp",
  "switchToDetail",
  "createTask",
  "createSubtask",
  "editTitleInList",
  "toggleDone",
  "toggleProgress",
  "yankTask",
  "startWork",
  "moveTaskUp",
  "moveTaskDown",
  "startSearch",
  "refresh",
  "clearSearch",

  // Detail view actions
  "switchToList",
  "editTitle",
  "editDescription",
  "addComment",
  "changeStatus",
  "changePriority",
  "changeProject",
  "changeDueDate",
  "editTags",
  "editRecurrence",
  "addAttachment",
  "editDuration",
  "syncToCalendar",

  // Global actions
  "openCommandPalette",
  "openHelp",
  "quit",
  "cancel",
]);

export type ActionId = z.infer<typeof ActionId>;

/**
 * Human-readable labels for actions (used in Help overlay)
 */
export const ACTION_LABELS: Record<ActionId, string> = {
  moveDown: "Move down",
  moveUp: "Move up",
  switchToDetail: "Detail view",
  createTask: "New task",
  createSubtask: "New subtask",
  editTitleInList: "Edit title",
  toggleDone: "Toggle done",
  toggleProgress: "Toggle progress",
  yankTask: "Yank to clipboard",
  startWork: "Start work",
  moveTaskUp: "Move task up",
  moveTaskDown: "Move task down",
  startSearch: "Search",
  refresh: "Refresh",
  clearSearch: "Clear search",
  switchToList: "List view",
  editTitle: "Edit title",
  editDescription: "Edit description",
  addComment: "Add comment",
  changeStatus: "Change status",
  changePriority: "Change priority",
  changeProject: "Change project",
  changeDueDate: "Change due date",
  editTags: "Edit tags",
  editRecurrence: "Edit recurrence",
  addAttachment: "Add attachment",
  editDuration: "Edit duration",
  syncToCalendar: "Sync to Calendar",
  openCommandPalette: "Command palette",
  openHelp: "Toggle help",
  quit: "Quit",
  cancel: "Cancel / Close",
};

/**
 * Map action IDs to XState event types
 * Some actions are "special" and handled differently (yankTask, quit)
 */
export const ACTION_TO_EVENT: Record<ActionId, string | null> = {
  moveDown: null, // Handled by SelectInput component
  moveUp: null, // Handled by SelectInput component
  switchToDetail: "TAB",
  createTask: "START_CREATE_TASK",
  createSubtask: "START_CREATE_SUBTASK",
  editTitleInList: "START_EDIT_TITLE_IN_LIST",
  toggleDone: "TOGGLE_STATUS",
  toggleProgress: "TOGGLE_PROGRESS",
  yankTask: null, // Special: clipboard operation
  startWork: "START_WORK",
  moveTaskUp: "MOVE_TASK_UP",
  moveTaskDown: "MOVE_TASK_DOWN",
  startSearch: "START_SEARCH",
  refresh: "REFRESH",
  clearSearch: "CLEAR_SEARCH",
  switchToList: "TAB",
  editTitle: "START_EDIT_TITLE",
  editDescription: "START_EDIT_DESCRIPTION",
  addComment: "START_ADD_COMMENT",
  changeStatus: "START_CHANGE_STATUS",
  changePriority: "START_CHANGE_PRIORITY",
  changeProject: "START_CHANGE_PROJECT",
  changeDueDate: "START_CHANGE_DUE_DATE",
  editTags: "START_CHANGE_TAGS",
  editRecurrence: "START_CHANGE_RECURRENCE",
  addAttachment: "START_ADD_ATTACHMENT",
  editDuration: "START_CHANGE_DURATION",
  syncToCalendar: "START_GCAL_SYNC",
  openCommandPalette: "OPEN_COMMAND_PALETTE",
  openHelp: "OPEN_HELP",
  quit: null, // Special: calls exitTui()
  cancel: "CANCEL",
};

/**
 * Mode-specific keybinding overrides in config
 */
const ModeBindings = z.record(z.string(), ActionId);
export type ModeBindings = z.infer<typeof ModeBindings>;

/**
 * Full keybindings configuration schema
 */
export const KeybindingsConfig = z.object({
  listView: ModeBindings.optional(),
  detailView: ModeBindings.optional(),
  global: ModeBindings.optional(),
});

export type KeybindingsConfig = z.infer<typeof KeybindingsConfig>;

// =============================================================================
// Default Keybindings
// =============================================================================

interface DefaultBinding {
  key: string;
  action: ActionId;
}

/**
 * Default list view keybindings (matches current hardcoded behavior)
 */
const DEFAULT_LIST_BINDINGS: DefaultBinding[] = [
  { key: "j", action: "moveDown" },
  { key: "Down", action: "moveDown" },
  { key: "k", action: "moveUp" },
  { key: "Up", action: "moveUp" },
  { key: "l", action: "switchToDetail" },
  { key: "Right", action: "switchToDetail" },
  { key: "Tab", action: "switchToDetail" },
  { key: "Enter", action: "switchToDetail" },
  { key: "n", action: "createTask" },
  { key: "o", action: "createSubtask" },
  { key: "e", action: "editTitleInList" },
  { key: "x", action: "toggleDone" },
  { key: "p", action: "toggleProgress" },
  { key: "y", action: "yankTask" },
  { key: "w", action: "startWork" },
  { key: "J", action: "moveTaskDown" },
  { key: "K", action: "moveTaskUp" },
  { key: "/", action: "startSearch" },
  { key: "R", action: "refresh" },
];

/**
 * Default detail view keybindings
 */
const DEFAULT_DETAIL_BINDINGS: DefaultBinding[] = [
  { key: "h", action: "switchToList" },
  { key: "Left", action: "switchToList" },
  { key: "Tab", action: "switchToList" },
  { key: "e", action: "editTitle" },
  { key: "d", action: "editDescription" },
  { key: "c", action: "addComment" },
  { key: "s", action: "changeStatus" },
  { key: "p", action: "changePriority" },
  { key: "o", action: "changeProject" },
  { key: "u", action: "changeDueDate" },
  { key: "t", action: "editTags" },
  { key: "r", action: "editRecurrence" },
  { key: "a", action: "addAttachment" },
  { key: "D", action: "editDuration" },
  { key: "G", action: "syncToCalendar" },
  { key: "y", action: "yankTask" },
  { key: "w", action: "startWork" },
  { key: "/", action: "startSearch" },
  { key: "J", action: "moveTaskDown" },
  { key: "K", action: "moveTaskUp" },
];

/**
 * Default global keybindings (work in all modes)
 */
const DEFAULT_GLOBAL_BINDINGS: DefaultBinding[] = [
  { key: "P", action: "openCommandPalette" },
  { key: "?", action: "openHelp" },
  { key: "q", action: "quit" },
  { key: "Escape", action: "cancel" },
];

// =============================================================================
// Key Info Interface (from Ink's useInput)
// =============================================================================

export interface KeyInfo {
  return: boolean;
  escape: boolean;
  tab: boolean;
  upArrow: boolean;
  downArrow: boolean;
  leftArrow: boolean;
  rightArrow: boolean;
  backspace: boolean;
  delete: boolean;
  shift: boolean;
  ctrl: boolean;
  meta: boolean;
}

// =============================================================================
// Resolved Binding (for Help display)
// =============================================================================

export interface ResolvedBinding {
  key: string;
  action: ActionId;
  label: string;
}

// =============================================================================
// KeybindingManager
// =============================================================================

export class KeybindingManager {
  private listBindings: Map<string, ActionId> = new Map();
  private detailBindings: Map<string, ActionId> = new Map();
  private globalBindings: Map<string, ActionId> = new Map();

  // Reverse lookup: action -> keys (for Help display)
  private listActionKeys: Map<ActionId, string[]> = new Map();
  private detailActionKeys: Map<ActionId, string[]> = new Map();
  private globalActionKeys: Map<ActionId, string[]> = new Map();

  constructor(config?: KeybindingsConfig) {
    // Load defaults first
    this.loadDefaults();

    // Apply user overrides if provided
    if (config) {
      this.applyUserConfig(config);
    }
  }

  /**
   * Load default keybindings
   */
  private loadDefaults(): void {
    for (const binding of DEFAULT_LIST_BINDINGS) {
      this.addBinding(binding.key, binding.action, "listView");
    }
    for (const binding of DEFAULT_DETAIL_BINDINGS) {
      this.addBinding(binding.key, binding.action, "detailView");
    }
    for (const binding of DEFAULT_GLOBAL_BINDINGS) {
      this.addBinding(binding.key, binding.action, "global");
    }
  }

  /**
   * Apply user configuration overrides
   */
  private applyUserConfig(config: KeybindingsConfig): void {
    if (config.listView) {
      this.applyModeOverrides(config.listView, "listView");
    }
    if (config.detailView) {
      this.applyModeOverrides(config.detailView, "detailView");
    }
    if (config.global) {
      this.applyModeOverrides(config.global, "global");
    }
  }

  /**
   * Apply overrides for a specific mode
   */
  private applyModeOverrides(
    overrides: ModeBindings,
    mode: BindingMode,
  ): void {
    let count = 0;
    for (const [key, action] of Object.entries(overrides)) {
      if (count >= MAX_KEYBINDINGS_PER_MODE) {
        logger.warn(
          `Too many keybindings in ${mode}, ignoring rest`,
          "keybinding",
          { mode, count },
        );
        break;
      }

      // Validate action
      const parseResult = ActionId.safeParse(action);
      if (!parseResult.success) {
        logger.warn(
          `Invalid action "${action}" for key "${key}" in ${mode}`,
          "keybinding",
        );
        continue;
      }

      // Check for existing binding (warn but override)
      const existing = this.getBindingsMap(mode).get(key);
      if (existing && existing !== action) {
        logger.debug(
          `Overriding ${mode} binding: ${key} (${existing} -> ${action})`,
          "keybinding",
        );
      }

      this.addBinding(key, action, mode);
      count++;
    }
  }

  /**
   * Add a binding to the appropriate map
   */
  private addBinding(key: string, action: ActionId, mode: BindingMode): void {
    const bindingsMap = this.getBindingsMap(mode);
    const actionKeysMap = this.getActionKeysMap(mode);

    // Remove key from previous action's key list if it exists
    const existingAction = bindingsMap.get(key);
    if (existingAction) {
      const existingKeys = actionKeysMap.get(existingAction);
      if (existingKeys) {
        const idx = existingKeys.indexOf(key);
        if (idx >= 0) existingKeys.splice(idx, 1);
      }
    }

    // Add binding
    bindingsMap.set(key, action);

    // Update reverse lookup
    const keys = actionKeysMap.get(action) ?? [];
    if (!keys.includes(key)) {
      keys.push(key);
      actionKeysMap.set(action, keys);
    }
  }

  /**
   * Get bindings map for a mode
   */
  private getBindingsMap(mode: BindingMode): Map<string, ActionId> {
    switch (mode) {
      case "listView":
        return this.listBindings;
      case "detailView":
        return this.detailBindings;
      case "global":
        return this.globalBindings;
    }
  }

  /**
   * Get action-to-keys map for a mode
   */
  private getActionKeysMap(mode: BindingMode): Map<ActionId, string[]> {
    switch (mode) {
      case "listView":
        return this.listActionKeys;
      case "detailView":
        return this.detailActionKeys;
      case "global":
        return this.globalActionKeys;
    }
  }

  /**
   * Normalize keyboard input to a key string
   */
  normalizeKey(input: string, key: KeyInfo): string {
    // Handle special keys first
    if (key.escape) return "Escape";
    if (key.return) return "Enter";
    if (key.tab) return "Tab";
    if (key.upArrow) return "Up";
    if (key.downArrow) return "Down";
    if (key.leftArrow) return "Left";
    if (key.rightArrow) return "Right";
    if (key.backspace) return "Backspace";
    if (key.delete) return "Delete";

    // Handle modifiers
    const parts: string[] = [];
    if (key.ctrl) parts.push("Ctrl");
    if (key.meta) parts.push("Meta");

    // For single characters, just use the input directly
    // Uppercase letters already include the Shift modifier implicitly
    if (input) {
      parts.push(input);
    }

    return parts.join("+");
  }

  /**
   * Look up action for a key in a given mode
   * Checks mode-specific bindings first, then global
   */
  lookupAction(
    normalizedKey: string,
    mode: "listView" | "detailView",
  ): ActionId | null {
    // Try mode-specific first
    const modeBindings = this.getBindingsMap(mode);
    const action = modeBindings.get(normalizedKey);
    if (action) return action;

    // Fall back to global
    const globalAction = this.globalBindings.get(normalizedKey);
    if (globalAction) return globalAction;

    return null;
  }

  /**
   * Get the XState event type for an action
   * Returns null for special actions (yankTask, quit)
   */
  getEventType(action: ActionId): string | null {
    return ACTION_TO_EVENT[action];
  }

  /**
   * Check if an action is special (not dispatched to state machine)
   */
  isSpecialAction(action: ActionId): boolean {
    return ACTION_TO_EVENT[action] === null;
  }

  /**
   * Get all bindings for a mode (for Help display)
   * Returns bindings sorted by action for consistent display
   */
  getBindingsForMode(mode: BindingMode): ResolvedBinding[] {
    const actionKeysMap = this.getActionKeysMap(mode);
    const bindings: ResolvedBinding[] = [];

    for (const [action, keys] of actionKeysMap) {
      if (keys.length > 0) {
        bindings.push({
          key: this.formatKeysForDisplay(keys),
          action,
          label: ACTION_LABELS[action],
        });
      }
    }

    return bindings;
  }

  /**
   * Format multiple keys for display (e.g., "j / Down")
   */
  private formatKeysForDisplay(keys: string[]): string {
    return keys
      .map((k) => this.formatKeyForDisplay(k))
      .join(" / ");
  }

  /**
   * Format a single key for display
   */
  private formatKeyForDisplay(key: string): string {
    // Map internal key names to display names
    const displayNames: Record<string, string> = {
      Up: "\u2191",
      Down: "\u2193",
      Left: "\u2190",
      Right: "\u2192",
    };

    // Check for modifier prefix
    if (key.includes("+")) {
      const parts = key.split("+");
      const mainKey = parts[parts.length - 1];
      const modifiers = parts.slice(0, -1);

      // Format modifiers
      const formattedModifiers = modifiers.map((m) => {
        if (m === "Ctrl") return "Ctrl";
        if (m === "Meta") return "Meta";
        return m;
      });

      const displayKey = displayNames[mainKey] ?? mainKey;
      return [...formattedModifiers, displayKey].join("+");
    }

    return displayNames[key] ?? key;
  }

  /**
   * Get keys bound to a specific action in a mode
   */
  getKeysForAction(action: ActionId, mode: BindingMode): string[] {
    const actionKeysMap = this.getActionKeysMap(mode);
    return actionKeysMap.get(action) ?? [];
  }
}

// =============================================================================
// Singleton Pattern
// =============================================================================

let manager: KeybindingManager | null = null;

/**
 * Get the global KeybindingManager instance
 * Initializes with defaults if not already initialized
 */
export function getKeybindingManager(): KeybindingManager {
  if (!manager) {
    manager = new KeybindingManager();
  }
  return manager;
}

/**
 * Initialize the KeybindingManager with config
 * Call this early in app startup after loading config
 */
export function initKeybindings(config?: KeybindingsConfig): void {
  manager = new KeybindingManager(config);
}

/**
 * Reset the singleton (for testing)
 */
export function resetKeybindings(): void {
  manager = null;
}
