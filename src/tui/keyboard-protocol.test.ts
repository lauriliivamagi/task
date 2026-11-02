import { assertEquals } from "@std/assert";
import { kittyKeyboardMode } from "./keyboard-protocol.ts";

Deno.test("kittyKeyboardMode - herdr enables the protocol unconditionally", () => {
  assertEquals(kittyKeyboardMode("herdr"), "enabled");
});

Deno.test("kittyKeyboardMode - other terminals use Ink's auto-detection", () => {
  assertEquals(kittyKeyboardMode("ghostty"), "auto");
  assertEquals(kittyKeyboardMode("vscode"), "auto");
  assertEquals(kittyKeyboardMode(undefined), "auto");
});
