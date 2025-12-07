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
