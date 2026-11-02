/**
 * MultilineInput Component Tests
 *
 * Terminals send Shift+Enter as a plain "\r" unless the app enables the kitty
 * keyboard protocol, and multiplexers such as herdr collapse modified Enter to
 * "\r" for apps that did not ask for it. Alt+Enter ("\x1b\r") is the newline
 * key that works everywhere.
 */

import { assertEquals } from "@std/assert";
import { render } from "ink-testing-library";
import React, { useState } from "react";
import { MultilineInput } from "./MultilineInput.tsx";
import { delay, KEYS, stripAnsi } from "../test-utils.ts";

const CURSOR = "█";

function renderInput(): {
  write: (data: string) => Promise<void>;
  frame: () => string;
  submitted: () => string | null;
  unmount: () => void;
} {
  let submitted: string | null = null;
  function Harness(): React.ReactElement {
    const [value, setValue] = useState("");
    return (
      <MultilineInput
        value={value}
        onChange={setValue}
        onSubmit={(v) => {
          submitted = v;
        }}
      />
    );
  }
  const { stdin, lastFrame, unmount } = render(<Harness />);
  return {
    write: async (data: string) => {
      stdin.write(data);
      await delay(20);
    },
    frame: () => stripAnsi(lastFrame() ?? ""),
    submitted: () => submitted,
    unmount,
  };
}

Deno.test({
  name: "MultilineInput - Enter submits",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const input = renderInput();
    await delay(20);
    await input.write("a");
    await input.write(KEYS.ENTER);
    assertEquals(input.submitted(), "a");
    input.unmount();
  },
});

Deno.test({
  name: "MultilineInput - Alt+Enter inserts a newline instead of submitting",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const input = renderInput();
    await delay(20);
    await input.write("a");
    await input.write(KEYS.ALT_ENTER);
    await input.write("b");
    assertEquals(input.submitted(), null);
    assertEquals(input.frame(), `a\nb${CURSOR}`);
    input.unmount();
  },
});

Deno.test({
  name: "MultilineInput - kitty-protocol Shift+Enter inserts a newline",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const input = renderInput();
    await delay(20);
    await input.write("a");
    await input.write(KEYS.KITTY_SHIFT_ENTER);
    await input.write("b");
    assertEquals(input.submitted(), null);
    assertEquals(input.frame(), `a\nb${CURSOR}`);
    input.unmount();
  },
});

Deno.test({
  name: "MultilineInput - Ctrl+A moves the cursor to the start",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const input = renderInput();
    await delay(20);
    await input.write("abc");
    await input.write(KEYS.CTRL_A);
    await input.write("X");
    assertEquals(input.frame(), `X${CURSOR}abc`);
    input.unmount();
  },
});

Deno.test({
  name: "MultilineInput - kitty-protocol Ctrl+A moves the cursor to the start",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const input = renderInput();
    await delay(20);
    await input.write("abc");
    await input.write(KEYS.KITTY_CTRL_A);
    await input.write("X");
    assertEquals(input.frame(), `X${CURSOR}abc`);
    input.unmount();
  },
});

Deno.test({
  name: "MultilineInput - Ctrl+E moves the cursor to the end",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const input = renderInput();
    await delay(20);
    await input.write("abc");
    await input.write(KEYS.LEFT);
    await input.write(KEYS.LEFT);
    await input.write(KEYS.CTRL_E);
    await input.write("X");
    assertEquals(input.frame(), `abcX${CURSOR}`);
    input.unmount();
  },
});
