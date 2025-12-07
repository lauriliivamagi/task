import React, { useState } from "react";
import { Text, useInput } from "ink";
import { render } from "ink-testing-library";
import { assertEquals } from "@std/assert";

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
    // Allow a small delay for the event loop to process the input and re-render
    await new Promise((resolve) => setTimeout(resolve, 10));

    assertEquals(lastFrame(), "Count: 1");
    unmount();
  },
});
