/**
 * TUI Application
 *
 * Main entry point for the terminal user interface.
 * Uses XState for state management via TuiMachineContext.
 */

import React from "react";
import { Box, render, Text } from "ink";
import Spinner from "ink-spinner";
import { createClient } from "../sdk/client.ts";
import type { TuiMachineInput } from "./machines/tui.types.ts";
import { logger } from "../shared/logger.ts";
import { getLastSelectedTaskId } from "./tui-state.ts";
import { getActiveDbName } from "../db/client.ts";
import { AssertionError } from "../shared/assert.ts";
import { isAutoSyncEnabled, syncOnStartup } from "../shared/sync.ts";
import { getConfig } from "../shared/config.ts";
import { initKeybindings } from "../shared/keybindings.ts";
import { exitTui, registerInkInstance } from "./exit.ts";
import { APP_VERSION } from "../shared/version.ts";
import {
  CommandPalette,
  CreateTaskInput,
  DatabasePicker,
  EditOverlay,
  EditTitleInput,
  Help,
  KeyboardHandler,
  SearchInput,
  TaskDetail,
  TaskList,
  theme,
  ViewTabIndicator,
} from "./components/index.ts";
import { useResponsive } from "./hooks/index.ts";
import { BREAKPOINTS } from "./responsive.ts";
import {
  selectFocus,
  selectIsCommandPaletteOpen,
  selectIsCreatingTask,
  selectIsHelpOpen,
  selectIsLoading,
  selectIsSearching,
  selectUiMode,
  TuiMachineContext,
  useTuiActorRef,
  useTuiSelector,
} from "./machines/index.ts";
import type { Command } from "./machines/tui.types.ts";

// === Command Definitions ===

function useCommands(): Command[] {
  return [
    {
      id: "quit",
      label: "Quit Application",
      shortcut: "q",
      context: "global",
    },
    {
      id: "search",
      label: "Search Tasks",
      shortcut: "/",
      context: "global",
    },
    {
      id: "sync-pull",
      label: "Sync Pull",
      shortcut: "gp",
      context: "global",
    },
    {
      id: "sync-push",
      label: "Sync Push",
      shortcut: "gP",
      context: "global",
    },
    {
      id: "gcal-sync",
      label: "Sync to Calendar",
      shortcut: "G",
      context: "detail",
    },
    {
      id: "switch-database",
      label: "Switch Database",
      context: "global",
    },
  ];
}

// === Header Component ===

type HeaderMode = "normal" | "commandPalette" | "help" | "databasePicker";

interface HeaderProps {
  mode: HeaderMode;
  layoutMode: "single" | "split";
}

function Header({ mode, layoutMode }: HeaderProps): React.ReactElement {
  const dbName = getActiveDbName();

  const renderModeText = (): React.ReactElement => {
    switch (mode) {
      case "commandPalette":
        return (
          <Text color={theme.colors.accent} bold>
            Command Palette
          </Text>
        );
      case "help":
        return (
          <Text color={theme.colors.accent} bold>
            Keyboard Shortcuts
          </Text>
        );
      case "databasePicker":
        return (
          <Text color={theme.colors.accent} bold>
            Switch Database
          </Text>
        );
      default:
        // Hide verbose shortcuts in single-column mode to save space
        if (layoutMode === "single") {
          return (
            <Text color={theme.colors.accent} bold>
              Shift+P:commands ?:help
            </Text>
          );
        }
        return (
          <>
            <Text color={theme.colors.muted}>
              q:quit Shift+r:refresh /:search{" "}
            </Text>
            <Text color={theme.colors.accent} bold>
              Shift+P:commands{" "}
            </Text>
            <Text color={theme.colors.muted}>?:help</Text>
          </>
        );
    }
  };

  return (
    <Box marginBottom={1}>
      <Text bold color={theme.colors.title}>
        Task
      </Text>
      <Text color={theme.colors.muted}>
        {` v${APP_VERSION} | `}
      </Text>
      <Text color={theme.colors.accent}>[{dbName}]</Text>
      <Text color={theme.colors.muted}>
        |{" "}
      </Text>
      {renderModeText()}
    </Box>
  );
}

// === Error Banner Component ===

function ErrorBanner(): React.ReactElement | null {
  const error = useTuiSelector((state) => state.context.error);

  if (!error) return null;

  return (
    <Box marginBottom={1}>
      <Text color={theme.colors.error}>Error: {error}</Text>
    </Box>
  );
}

// === Status Banner Component ===

function StatusBanner(): React.ReactElement | null {
  const status = useTuiSelector((state) => state.context.status);

  if (!status) return null;

  return (
    <Box marginBottom={1}>
      <Spinner type="dots" />
      <Text color={theme.colors.muted}>{status}</Text>
    </Box>
  );
}

// === Loading View ===

function LoadingView(): React.ReactElement {
  return (
    <Box>
      <Spinner type="dots" />
      <Text>Loading...</Text>
    </Box>
  );
}

// === Main Layout ===

function MainLayout(): React.ReactElement {
  const focus = useTuiSelector(selectFocus);
  const isCreatingTask = useTuiSelector(selectIsCreatingTask);
  const isSearching = useTuiSelector(selectIsSearching);
  const mode = useTuiSelector(selectUiMode);
  const isEditingTitleInList = mode === "editingTitleInList";
  const searchQuery = useTuiSelector((state) => state.context.searchQuery);
  const selectedTask = useTuiSelector((state) => state.context.selectedTask);

  const { terminalHeight, layoutMode } = useResponsive();

  // Calculate responsive height based on terminal size
  // Reserve space for header (2 lines), error banner (1), padding (2), help text (1), tab indicator (1 in single mode)
  const reservedLines = layoutMode === "single" ? 7 : 6;
  const availableHeight = Math.max(10, terminalHeight - reservedLines);

  // Shared props for TaskList
  const taskListProps = {
    isFocused: focus === "list" && !isEditingTitleInList &&
      mode !== "pickingDatabase" && mode !== "switchingDatabase",
    isCreatingTask,
    height: Math.max(5, availableHeight - 4),
    layoutMode,
  };

  // Single-column mode: show only the focused panel with tab indicator
  if (layoutMode === "single") {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <ViewTabIndicator
          focus={focus}
          searchQuery={searchQuery}
          isSearching={isSearching}
        />

        {focus === "list"
          ? (
            <Box flexDirection="column" flexGrow={1}>
              <Box
                borderStyle={theme.borders.focused}
                borderColor={theme.colors.primary}
                flexDirection="column"
                padding={1}
                height={availableHeight}
                overflow="hidden"
              >
                <Box>
                  <Text bold underline>Tasks</Text>
                  {searchQuery && !isSearching && (
                    <Text color={theme.colors.accent}>
                      {` [/${searchQuery}] `}
                      <Text color={theme.colors.muted}>(Esc to clear)</Text>
                    </Text>
                  )}
                </Box>
                {isSearching && <SearchInput />}
                {isCreatingTask && <CreateTaskInput />}
                {isEditingTitleInList && <EditTitleInput />}
                <TaskList {...taskListProps} />
              </Box>
            </Box>
          )
          : (
            <Box flexDirection="column" flexGrow={1}>
              <Box
                borderStyle={theme.borders.focused}
                borderColor={theme.colors.primary}
                flexDirection="column"
                padding={1}
                height={availableHeight}
                overflow="hidden"
              >
                <TaskDetail
                  isFocused
                  height={Math.max(5, availableHeight - 4)}
                  layoutMode={layoutMode}
                />
              </Box>
            </Box>
          )}
      </Box>
    );
  }

  // Split mode: current two-panel layout
  return (
    <Box flexDirection="row" flexGrow={1}>
      {/* Task List Panel */}
      <Box width="40%" flexDirection="column" marginRight={2}>
        <Box
          borderStyle={focus === "list"
            ? theme.borders.focused
            : theme.borders.unfocused}
          borderColor={focus === "list"
            ? theme.colors.primary
            : theme.colors.muted}
          flexDirection="column"
          padding={1}
          height={availableHeight}
          overflow="hidden"
        >
          <Box>
            <Text bold underline>Tasks</Text>
            {searchQuery && !isSearching && (
              <Text color={theme.colors.accent}>
                {` [/${searchQuery}] `}
                <Text color={theme.colors.muted}>(Esc to clear)</Text>
              </Text>
            )}
          </Box>
          {isSearching && <SearchInput />}
          {isCreatingTask && <CreateTaskInput />}
          {isEditingTitleInList && <EditTitleInput />}
          <TaskList {...taskListProps} />
        </Box>
        {/* Always render help text to prevent layout shifts */}
        <Text
          color={!isCreatingTask && focus === "list"
            ? theme.colors.muted
            : "transparent"}
        >
          e: edit, n: new{selectedTask?.parent_id === null
            ? ", o: subtask"
            : ""}, x: done, p: progress, y: yank
        </Text>
      </Box>

      {/* Detail Panel */}
      <Box width="60%" flexDirection="column">
        <Box
          borderStyle={focus === "detail"
            ? theme.borders.focused
            : theme.borders.unfocused}
          borderColor={focus === "detail"
            ? theme.colors.primary
            : theme.colors.muted}
          flexDirection="column"
          padding={1}
          height={availableHeight}
          overflow="hidden"
        >
          {/* Subtract 4 for border (2) + padding (2) */}
          <TaskDetail
            isFocused={focus === "detail"}
            height={Math.max(5, availableHeight - 4)}
            layoutMode={layoutMode}
          />
        </Box>
      </Box>
    </Box>
  );
}

// === Command Palette View ===

function CommandPaletteView(): React.ReactElement {
  const actorRef = useTuiActorRef();
  const commands = useCommands();

  const handleExecute = (command: Command) => {
    switch (command.id) {
      case "quit":
        exitTui(0);
        break;
      case "search":
        actorRef.send({ type: "START_SEARCH" });
        break;
      case "sync-pull":
        actorRef.send({ type: "SYNC_PULL" });
        break;
      case "sync-push":
        actorRef.send({ type: "SYNC_PUSH" });
        break;
      case "gcal-sync":
        actorRef.send({ type: "START_GCAL_SYNC" });
        break;
      case "switch-database":
        actorRef.send({ type: "SHOW_DB_PICKER" });
        break;
    }
  };

  return (
    <Box flexGrow={1} justifyContent="center" alignItems="center">
      <CommandPalette commands={commands} onExecute={handleExecute} />
    </Box>
  );
}

// === Help View ===

function HelpView(): React.ReactElement {
  return (
    <Box flexGrow={1} justifyContent="center" alignItems="center">
      <Help />
    </Box>
  );
}

// === Database Picker View ===

function DatabasePickerView(): React.ReactElement {
  return (
    <Box flexGrow={1} justifyContent="center" alignItems="center">
      <DatabasePicker />
    </Box>
  );
}

// === Overlay Edit Modes ===
const OVERLAY_MODES = [
  "changingStatus",
  "changingPriority",
  "changingProject",
  "creatingProject",
  "changingDueDate",
  "changingTags",
  "changingRecurrence",
  "changingDuration",
  "addingAttachment",
  "enteringGcalDuration",
  "confirmingDelete",
  "deletingTask",
];

// === TUI Content (inside context) ===

function TuiContent(): React.ReactElement {
  const isLoading = useTuiSelector(selectIsLoading);
  const isCommandPaletteOpen = useTuiSelector(selectIsCommandPaletteOpen);
  const isHelpOpen = useTuiSelector(selectIsHelpOpen);
  const mode = useTuiSelector(selectUiMode);
  const tasks = useTuiSelector((state) => state.context.tasks);

  const {
    terminalWidth,
    layoutMode,
    isTooNarrow,
    overlayMarginLeft,
    overlayWidth,
  } = useResponsive();

  // Show loading spinner only if we have no tasks yet
  const showLoading = isLoading && tasks.length === 0;

  // Check if we're in an overlay edit mode
  const isOverlayMode = OVERLAY_MODES.includes(mode);

  // Check if we're picking a database
  const isPickingDatabase = mode === "pickingDatabase" ||
    mode === "switchingDatabase";

  // Determine header mode
  const headerMode: HeaderMode = isCommandPaletteOpen
    ? "commandPalette"
    : isHelpOpen
    ? "help"
    : isPickingDatabase
    ? "databasePicker"
    : "normal";

  // Show warning if terminal is too narrow
  if (isTooNarrow) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={theme.colors.warning} bold>
          Terminal too narrow ({terminalWidth} columns)
        </Text>
        <Text color={theme.colors.muted}>
          Minimum width: {BREAKPOINTS.MIN_WIDTH}{" "}
          columns. Please resize your terminal.
        </Text>
      </Box>
    );
  }

  return (
    <>
      <KeyboardHandler />
      <Box flexDirection="column" padding={1} height="100%">
        <Header mode={headerMode} layoutMode={layoutMode} />
        <ErrorBanner />
        <StatusBanner />

        {isCommandPaletteOpen
          ? <CommandPaletteView />
          : isHelpOpen
          ? <HelpView />
          : isPickingDatabase
          ? <DatabasePickerView />
          : showLoading
          ? <LoadingView />
          : (
            <Box flexDirection="column" flexGrow={1}>
              <MainLayout />
              {/* Overlay rendered on top of layout */}
              {isOverlayMode && (
                <Box
                  position="absolute"
                  marginTop={layoutMode === "single" ? 3 : 2}
                  marginLeft={overlayMarginLeft}
                  width={overlayWidth}
                  justifyContent="center"
                >
                  <EditOverlay />
                </Box>
              )}
            </Box>
          )}
      </Box>
    </>
  );
}

// === App Component (Provider) ===

/** Props for the App component - same as TuiMachineInput */
type AppProps = TuiMachineInput;

export function App(
  { client, lastSelectedTaskId, fs, stateFile }: AppProps,
): React.ReactElement {
  return (
    <TuiMachineContext.Provider
      options={{
        input: { client, lastSelectedTaskId, fs, stateFile },
      }}
    >
      <TuiContent />
    </TuiMachineContext.Provider>
  );
}

// === Assertion Error Handler ===

function handleAssertionError(error: AssertionError): never {
  logger.error("Assertion failed in TUI", "tui", {
    assertion: error.message,
    context: error.context,
    data: error.data,
    stack: error.stack,
  });
  console.error(`\nASSERTION FAILED: ${error.message}`);
  console.error("This is a bug. Please report it.");
  if (error.context) {
    console.error(`Context: ${error.context}`);
  }
  Deno.exit(1);
}

// === Entry Point ===

export async function startTui(serverUrl: string): Promise<void> {
  // Set up global error handlers for assertion failures.
  globalThis.addEventListener("error", (event) => {
    if (event.error instanceof AssertionError) {
      handleAssertionError(event.error);
    }
  });

  globalThis.addEventListener("unhandledrejection", (event) => {
    if (event.reason instanceof AssertionError) {
      handleAssertionError(event.reason);
    }
  });

  // Auto-sync: pull latest changes before startup (if enabled)
  if (await isAutoSyncEnabled()) {
    console.log("Syncing...");
  }
  await syncOnStartup();

  // Load config and initialize keybindings with custom overrides
  const config = await getConfig();
  initKeybindings(config.keybindings);

  const client = createClient({ baseUrl: serverUrl });

  // Verify server is running
  try {
    await client.health();
  } catch (error) {
    if (error instanceof AssertionError) {
      handleAssertionError(error);
    }
    logger.error("Failed to connect to server", "tui", {
      serverUrl,
      error: String(error),
    });
    console.error("Failed to connect to server at", serverUrl);
    Deno.exit(1);
  }

  // Load last selected task ID for restoring selection
  const lastSelectedTaskId = await getLastSelectedTaskId();

  logger.info("TUI started", "tui", { serverUrl, lastSelectedTaskId });

  // Register shutdown handler for Ctrl+C (SIGINT)
  // The 'q' key and command palette quit use exitTui() which handles sync
  Deno.addSignalListener("SIGINT", async () => {
    await exitTui(0);
  });

  const { unmount } = render(
    <App client={client} lastSelectedTaskId={lastSelectedTaskId} />,
  );
  registerInkInstance(unmount);
}
