import React, { useState } from "react";
import { Text, useInput } from "ink";
import { render } from "ink-testing-library";
import { assertEquals } from "@std/assert";
import { waitForText } from "../src/tui/test-utils.ts";

const Counter = () => {
  const [count, setCount] = useState(0);
  useInput((input, _key) => {
    if (input === "+") {
      setCount((c) => c + 1);
    }
  });
  return <Text>Count: {count}</Text>;
};

Deno.test({
  name: "Ink POC: Renders text",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const { lastFrame, unmount } = render(<Text>Hello World</Text>);
    assertEquals(lastFrame(), "Hello World");
    unmount();
  },
});

Deno.test({
  name: "Ink POC: Interaction",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = render(<Counter />);
    assertEquals(lastFrame(), "Count: 0");

    stdin.write("+");
    // Use robust waitForText instead of fixed delay
    await waitForText(lastFrame, "Count: 1");

    assertEquals(lastFrame(), "Count: 1");
    unmount();
  },
});
