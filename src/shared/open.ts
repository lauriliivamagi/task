/**
 * Cross-platform file/URL opener.
 *
 * Spawns the OS default handler for a path:
 *   - macOS: `open`
 *   - Windows: `start ""`
 *   - Linux/other: `xdg-open`
 *
 * Fire-and-forget: does not wait for completion.
 */
export function openPath(path: string): void {
  const os = Deno.build.os;
  const cmd = os === "darwin" ? "open" : os === "windows" ? "cmd" : "xdg-open";
  const args = os === "windows" ? ["/c", "start", "", path] : [path];

  const child = new Deno.Command(cmd, {
    args,
    stdout: "null",
    stderr: "null",
  }).spawn();

  try {
    child.unref();
  } catch {
    // Some runtimes may not support unref(); safe to ignore.
  }
}
