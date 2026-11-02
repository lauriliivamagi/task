/**
 * Kitty keyboard protocol selection for the TUI.
 *
 * Without the protocol, terminals send Shift+Enter as a plain "\r", so
 * multiline inputs cannot tell it from Enter. Ink's "auto" mode only enables
 * the protocol for terminals it recognises (kitty, WezTerm, Ghostty). herdr
 * hides the outer terminal behind TERM_PROGRAM=herdr and collapses modified
 * Enter to "\r" for panes that did not ask for a protocol, but honours the
 * protocol when an app enables it.
 */

import type { KittyKeyboardOptions } from "ink";

export function kittyKeyboardMode(
  termProgram: string | undefined,
): NonNullable<KittyKeyboardOptions["mode"]> {
  return termProgram === "herdr" ? "enabled" : "auto";
}
