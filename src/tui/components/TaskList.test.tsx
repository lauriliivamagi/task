/**
 * TaskList Component Tests
 *
 * Regression coverage for the terminal-resize crash:
 * detaching and re-attaching a terminal multiplexer session (e.g. herdr,
 * tmux) shrinks the terminal height. The shrink reduces SelectInput's visible
 * `limit`, but ink-select-input keeps its internal `selectedIndex` from before
 * the resize. The next navigation keypress then computes an index beyond the
 * visible window and calls `onHighlight(undefined)`. `handleHighlight` must not
 * crash when handed an undefined item.
 */

import { assert } from "@std/assert";
import { render } from "ink-testing-library";
import React from "react";
import { TaskList } from "./TaskList.tsx";
import { TuiMachineContext } from "../machines/index.ts";
import { MockTaskClient } from "../mock_client.ts";
import { delay, KEYS, stripAnsi, waitForText } from "../test-utils.ts";
import { MemoryFS } from "../../shared/fs-abstraction.ts";

Deno.test({
  name:
    "TaskList - navigating after terminal shrink does not crash (detach/re-attach)",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const client = new MockTaskClient();
    // Select a task near the end of the list so its index lands outside the
    // visible window once the terminal is shrunk.
    const input = { client, lastSelectedTaskId: 114, fs: new MemoryFS() };

    const tree = (height: number) => (
      <TuiMachineContext.Provider options={{ input }}>
        <TaskList
          isFocused
          isCreatingTask={false}
          height={height}
          layoutMode="split"
        />
      </TuiMachineContext.Provider>
    );

    // Start tall: the full list is visible and the selected index is in range.
    const { lastFrame, stdin, rerender, unmount } = render(tree(40));

    try {
      await waitForText(lastFrame, "Extra Task 15");

      // Simulate the terminal resize on re-attach: the window shrinks so the
      // stale selected index now exceeds the visible limit.
      rerender(tree(10));
      await delay(20);

      // Navigate down. Pre-fix this fed `undefined` to handleHighlight and
      // threw "Cannot read properties of undefined (reading 'value')".
      stdin.write(KEYS.DOWN);
      await delay(20);

      const frame = stripAnsi(lastFrame() ?? "");
      assert(frame.length > 0, "TUI should still be rendering after navigation");
    } finally {
      unmount();
    }
  },
});
