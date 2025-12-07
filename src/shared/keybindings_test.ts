/**
 * Tests for keyboard shortcuts configuration
 */

import { assertEquals, assertNotEquals } from "@std/assert";
import {
  ActionId,
  getKeybindingManager,
  initKeybindings,
  KeybindingManager,
  type KeybindingsConfig,
  type KeyInfo,
  resetKeybindings,
} from "./keybindings.ts";

// Helper to create KeyInfo for testing
function makeKeyInfo(overrides: Partial<KeyInfo> = {}): KeyInfo {
  return {
    return: false,
    escape: false,
    tab: false,
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    backspace: false,
    delete: false,
    shift: false,
    ctrl: false,
    meta: false,
    ...overrides,
  };
}

// Reset singleton between tests
function setup(): void {
  resetKeybindings();
}

// =============================================================================
// KeybindingManager - Default Bindings
// =============================================================================

Deno.test("KeybindingManager - loads default list view bindings", () => {
  setup();
  const manager = new KeybindingManager();

  // Test basic list view bindings
  assertEquals(manager.lookupAction("j", "listView"), "moveDown");
  assertEquals(manager.lookupAction("k", "listView"), "moveUp");
  assertEquals(manager.lookupAction("n", "listView"), "createTask");
  assertEquals(manager.lookupAction("x", "listView"), "toggleDone");
  assertEquals(manager.lookupAction("e", "listView"), "editTitleInList");
});

Deno.test("KeybindingManager - loads default detail view bindings", () => {
  setup();
  const manager = new KeybindingManager();

  // Test basic detail view bindings
  assertEquals(manager.lookupAction("h", "detailView"), "switchToList");
  assertEquals(manager.lookupAction("e", "detailView"), "editTitle");
  assertEquals(manager.lookupAction("d", "detailView"), "editDescription");
  assertEquals(manager.lookupAction("c", "detailView"), "addComment");
  assertEquals(manager.lookupAction("s", "detailView"), "changeStatus");
});

Deno.test("KeybindingManager - loads default global bindings", () => {
  setup();
  const manager = new KeybindingManager();

  // Test global bindings (accessible from any mode)
  assertEquals(manager.lookupAction("P", "listView"), "openCommandPalette");
  assertEquals(manager.lookupAction("?", "listView"), "openHelp");
  assertEquals(manager.lookupAction("q", "listView"), "quit");
  assertEquals(manager.lookupAction("Escape", "listView"), "cancel");

  // Global bindings also work from detail view
  assertEquals(manager.lookupAction("P", "detailView"), "openCommandPalette");
  assertEquals(manager.lookupAction("q", "detailView"), "quit");
});

Deno.test("KeybindingManager - arrow keys work", () => {
  setup();
  const manager = new KeybindingManager();

  assertEquals(manager.lookupAction("Down", "listView"), "moveDown");
  assertEquals(manager.lookupAction("Up", "listView"), "moveUp");
  assertEquals(manager.lookupAction("Right", "listView"), "switchToDetail");
  assertEquals(manager.lookupAction("Left", "detailView"), "switchToList");
});

// =============================================================================
// KeybindingManager - User Overrides
// =============================================================================

Deno.test("KeybindingManager - user config overrides default", () => {
  setup();
  const config: KeybindingsConfig = {
    listView: {
      "n": "toggleDone", // Override: n now toggles done instead of createTask
    },
  };

  const manager = new KeybindingManager(config);

  assertEquals(manager.lookupAction("n", "listView"), "toggleDone");
});

Deno.test("KeybindingManager - user can add new keybindings", () => {
  setup();
  const config: KeybindingsConfig = {
    listView: {
      "Ctrl+n": "createTask", // New binding
    },
  };

  const manager = new KeybindingManager(config);

  // New binding works
  assertEquals(manager.lookupAction("Ctrl+n", "listView"), "createTask");

  // Default binding still exists
  assertEquals(manager.lookupAction("n", "listView"), "createTask");
});

Deno.test("KeybindingManager - user can override global bindings", () => {
  setup();
  const config: KeybindingsConfig = {
    global: {
      "Q": "quit", // Shift+Q instead of q
    },
  };

  const manager = new KeybindingManager(config);

  // New global binding works
  assertEquals(manager.lookupAction("Q", "listView"), "quit");
});

Deno.test("KeybindingManager - invalid actions are ignored", () => {
  setup();
  const config = {
    listView: {
      "z": "invalidAction", // Not a valid action
    },
  } as unknown as KeybindingsConfig;

  // Should not throw
  const manager = new KeybindingManager(config);

  // Invalid binding is ignored
  assertEquals(manager.lookupAction("z", "listView"), null);
});

// =============================================================================
// KeybindingManager - normalizeKey
// =============================================================================

Deno.test("KeybindingManager - normalizeKey handles simple keys", () => {
  setup();
  const manager = new KeybindingManager();

  assertEquals(manager.normalizeKey("j", makeKeyInfo()), "j");
  assertEquals(manager.normalizeKey("k", makeKeyInfo()), "k");
  assertEquals(manager.normalizeKey("J", makeKeyInfo()), "J");
  assertEquals(manager.normalizeKey("?", makeKeyInfo()), "?");
  assertEquals(manager.normalizeKey("/", makeKeyInfo()), "/");
});

Deno.test("KeybindingManager - normalizeKey handles special keys", () => {
  setup();
  const manager = new KeybindingManager();

  assertEquals(
    manager.normalizeKey("", makeKeyInfo({ escape: true })),
    "Escape",
  );
  assertEquals(
    manager.normalizeKey("", makeKeyInfo({ return: true })),
    "Enter",
  );
  assertEquals(manager.normalizeKey("", makeKeyInfo({ tab: true })), "Tab");
  assertEquals(manager.normalizeKey("", makeKeyInfo({ upArrow: true })), "Up");
  assertEquals(
    manager.normalizeKey("", makeKeyInfo({ downArrow: true })),
    "Down",
  );
  assertEquals(
    manager.normalizeKey("", makeKeyInfo({ leftArrow: true })),
    "Left",
  );
  assertEquals(
    manager.normalizeKey("", makeKeyInfo({ rightArrow: true })),
    "Right",
  );
  assertEquals(
    manager.normalizeKey("", makeKeyInfo({ backspace: true })),
    "Backspace",
  );
  assertEquals(
    manager.normalizeKey("", makeKeyInfo({ delete: true })),
    "Delete",
  );
});

Deno.test("KeybindingManager - normalizeKey handles Ctrl modifier", () => {
  setup();
  const manager = new KeybindingManager();

  assertEquals(
    manager.normalizeKey("n", makeKeyInfo({ ctrl: true })),
    "Ctrl+n",
  );
  assertEquals(
    manager.normalizeKey("s", makeKeyInfo({ ctrl: true })),
    "Ctrl+s",
  );
});

Deno.test("KeybindingManager - normalizeKey handles Meta modifier", () => {
  setup();
  const manager = new KeybindingManager();

  assertEquals(
    manager.normalizeKey("n", makeKeyInfo({ meta: true })),
    "Meta+n",
  );
});

Deno.test("KeybindingManager - normalizeKey handles multiple modifiers", () => {
  setup();
  const manager = new KeybindingManager();

  assertEquals(
    manager.normalizeKey("s", makeKeyInfo({ ctrl: true, meta: true })),
    "Ctrl+Meta+s",
  );
});

// =============================================================================
// KeybindingManager - getEventType
// =============================================================================

Deno.test("KeybindingManager - getEventType returns correct events", () => {
  setup();
  const manager = new KeybindingManager();

  assertEquals(manager.getEventType("createTask"), "START_CREATE_TASK");
  assertEquals(manager.getEventType("toggleDone"), "TOGGLE_STATUS");
  assertEquals(manager.getEventType("switchToDetail"), "TAB");
  assertEquals(
    manager.getEventType("editDescription"),
    "START_EDIT_DESCRIPTION",
  );
});

Deno.test("KeybindingManager - getEventType returns null for special actions", () => {
  setup();
  const manager = new KeybindingManager();

  assertEquals(manager.getEventType("yankTask"), null);
  assertEquals(manager.getEventType("quit"), null);
  assertEquals(manager.getEventType("moveDown"), null);
  assertEquals(manager.getEventType("moveUp"), null);
});

Deno.test("KeybindingManager - isSpecialAction identifies special actions", () => {
  setup();
  const manager = new KeybindingManager();

  assertEquals(manager.isSpecialAction("yankTask"), true);
  assertEquals(manager.isSpecialAction("quit"), true);
  assertEquals(manager.isSpecialAction("moveDown"), true);
  assertEquals(manager.isSpecialAction("moveUp"), true);

  assertEquals(manager.isSpecialAction("createTask"), false);
  assertEquals(manager.isSpecialAction("toggleDone"), false);
});

// =============================================================================
// KeybindingManager - getBindingsForMode (Help display)
// =============================================================================

Deno.test("KeybindingManager - getBindingsForMode returns bindings for display", () => {
  setup();
  const manager = new KeybindingManager();

  const listBindings = manager.getBindingsForMode("listView");

  // Should have bindings
  assertNotEquals(listBindings.length, 0);

  // Each binding should have key, action, label
  for (const binding of listBindings) {
    assertNotEquals(binding.key, "");
    assertNotEquals(binding.action, "");
    assertNotEquals(binding.label, "");
  }
});

Deno.test("KeybindingManager - getBindingsForMode combines multiple keys for same action", () => {
  setup();
  const manager = new KeybindingManager();

  const listBindings = manager.getBindingsForMode("listView");

  // Find moveDown binding - should have both "j" and "Down"
  const moveDownBinding = listBindings.find((b) => b.action === "moveDown");
  if (!moveDownBinding) {
    throw new Error("moveDown binding not found");
  }
  assertEquals(moveDownBinding.key.includes("j"), true);
  assertEquals(
    moveDownBinding.key.includes("\u2193") ||
      moveDownBinding.key.includes("Down"),
    true,
  );
});

// =============================================================================
// Singleton Pattern
// =============================================================================

Deno.test("getKeybindingManager - returns singleton instance", () => {
  setup();

  const manager1 = getKeybindingManager();
  const manager2 = getKeybindingManager();

  assertEquals(manager1, manager2);
});

Deno.test("initKeybindings - initializes with config", () => {
  setup();

  const config: KeybindingsConfig = {
    listView: {
      "Ctrl+t": "createTask",
    },
  };

  initKeybindings(config);

  const manager = getKeybindingManager();
  assertEquals(manager.lookupAction("Ctrl+t", "listView"), "createTask");
});

Deno.test("resetKeybindings - resets singleton", () => {
  setup();

  const config: KeybindingsConfig = {
    listView: {
      "Ctrl+t": "createTask",
    },
  };

  initKeybindings(config);
  const manager1 = getKeybindingManager();

  resetKeybindings();

  const manager2 = getKeybindingManager();
  assertNotEquals(manager1, manager2);

  // After reset, custom binding should be gone (back to defaults)
  assertEquals(manager2.lookupAction("Ctrl+t", "listView"), null);
});

// =============================================================================
// ActionId Schema Validation
// =============================================================================

Deno.test("ActionId schema - validates correct actions", () => {
  assertEquals(ActionId.safeParse("createTask").success, true);
  assertEquals(ActionId.safeParse("toggleDone").success, true);
  assertEquals(ActionId.safeParse("yankTask").success, true);
  assertEquals(ActionId.safeParse("quit").success, true);
});

Deno.test("ActionId schema - rejects invalid actions", () => {
  assertEquals(ActionId.safeParse("invalidAction").success, false);
  assertEquals(ActionId.safeParse("").success, false);
  assertEquals(ActionId.safeParse(123).success, false);
});
