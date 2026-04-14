/**
 * Cross-platform clipboard utilities
 */

async function tryClipboardCommand(
  cmd: string,
  args: string[],
  text: string,
  waitForExit = true,
): Promise<boolean> {
  try {
    const process = new Deno.Command(cmd, {
      args,
      stdin: "piped",
      stdout: "null",
      stderr: "null",
    });

    const child = process.spawn();
    const writer = child.stdin.getWriter();
    await writer.write(new TextEncoder().encode(text));
    await writer.close();

    if (waitForExit) {
      const { success } = await child.status;
      return success;
    }
    // For wl-copy: don't wait, it forks to background
    return true;
  } catch {
    return false;
  }
}

/**
 * Try reading binary data from a command's stdout.
 * Returns the bytes on a zero exit + non-empty output, otherwise null.
 */
async function tryReadCommand(
  cmd: string,
  args: string[],
): Promise<Uint8Array | null> {
  try {
    const process = new Deno.Command(cmd, {
      args,
      stdin: "null",
      stdout: "piped",
      stderr: "null",
    });
    const { success, stdout } = await process.output();
    if (!success || stdout.length === 0) return null;
    return stdout;
  } catch {
    return null;
  }
}

/**
 * Read a PNG image from the system clipboard.
 * Returns the raw PNG bytes, or null if the clipboard has no image
 * (or no supported clipboard tool is installed).
 */
export async function readImageFromClipboard(): Promise<Uint8Array | null> {
  const os = Deno.build.os;

  switch (os) {
    case "linux": {
      // Try Wayland first, then X11
      const wl = await tryReadCommand("wl-paste", ["--type", "image/png"]);
      if (wl) return wl;
      const xc = await tryReadCommand("xclip", [
        "-selection",
        "clipboard",
        "-t",
        "image/png",
        "-o",
      ]);
      if (xc) return xc;
      return null;
    }
    case "darwin":
      // Requires `brew install pngpaste` (no built-in CLI on macOS)
      return await tryReadCommand("pngpaste", ["-"]);
    default:
      return null;
  }
}

/**
 * Copy text to system clipboard
 * Returns true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  const os = Deno.build.os;

  switch (os) {
    case "darwin":
      return tryClipboardCommand("pbcopy", [], text);

    case "linux":
      // Try wl-copy first (Wayland) - don't wait, it forks to background
      if (await tryClipboardCommand("wl-copy", [], text, false)) return true;
      // Fall back to X11 clipboard tools
      if (await tryClipboardCommand("xsel", ["--clipboard", "--input"], text)) {
        return true;
      }
      if (
        await tryClipboardCommand("xclip", ["-selection", "clipboard"], text)
      ) {
        return true;
      }
      return false;

    case "windows":
      return tryClipboardCommand("clip", [], text);

    default:
      return false;
  }
}
