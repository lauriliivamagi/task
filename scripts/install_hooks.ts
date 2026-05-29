#!/usr/bin/env -S deno run -A
/**
 * Installs git hooks by pointing core.hooksPath at the tracked hooks/ directory
 * and marking the hook scripts executable.
 *
 * Run once after cloning:  deno task hooks:install
 *
 * Using core.hooksPath (rather than symlinking into .git/hooks) keeps the hooks
 * version-controlled and installs them with a single command. Note: once
 * core.hooksPath is set, git reads hooks ONLY from hooks/ and ignores
 * .git/hooks/.
 */
const HOOKS_DIR = "hooks";
const HOOKS = ["pre-push", "pre-commit", "prepare-commit-msg"];

const { code, stderr } = await new Deno.Command("git", {
  args: ["config", "core.hooksPath", HOOKS_DIR],
  stderr: "piped",
}).output();

if (code !== 0) {
  console.error(new TextDecoder().decode(stderr));
  Deno.exit(code);
}

for (const name of HOOKS) {
  try {
    await Deno.chmod(`${HOOKS_DIR}/${name}`, 0o755);
  } catch {
    // Windows: chmod is a no-op; git still executes the hooks.
  }
}

console.log(`Installed git hooks via core.hooksPath=${HOOKS_DIR}/`);
