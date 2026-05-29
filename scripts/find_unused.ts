#!/usr/bin/env -S deno run -A
/**
 * Native dead-code finder for this Deno project.
 *
 * Why not knip/ts-prune: both are package.json-centric and treat jsr:/npm:
 * specifiers as unresolved noise. `deno info --json` is Deno's own module
 * resolver — it understands the import map, jsr:/npm: specifiers, .ts
 * extensions, and dynamic import() edges.
 *
 * It reports files under src/ that are unreachable from any entry point or
 * test file. src/main.ts statically pulls the whole production graph
 * (CLI/serve/tui); src/tui/dev_tui.tsx is a manual dev harness entry; every
 * *_test.ts / *.test.tsx file (in src/ and tests/) is treated as a root, so
 * code that has tests but isn't wired into main.ts yet still counts as used.
 *
 * Exit code 1 if any unused files are found (so CI / the `ci` task can gate
 * on it), 0 otherwise.
 */
import { walk } from "@std/fs";
import { toFileUrl } from "@std/path";

const ROOT = new URL("../", import.meta.url); // scripts/ is one level below root
const SRC = new URL("src/", ROOT);

// Entry points whose import graph defines "reachable" production/dev code.
const ENTRY_GLOBS = ["src/main.ts", "src/tui/dev_tui.tsx"];
const TEST_PATTERNS = [/_test\.ts$/, /\.test\.tsx?$/];

// src/ files intentionally unreachable from any entry/test, kept on purpose.
const IGNORE_FILES = new Set<string>([]);

const CONCURRENCY = 6;

interface DenoInfo {
  roots: string[];
  modules: Array<{ specifier: string }>;
}

async function graphFrom(entry: string): Promise<DenoInfo> {
  const { code, stdout, stderr } = await new Deno.Command(Deno.execPath(), {
    args: ["info", "--json", entry],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (code !== 0) {
    throw new Error(
      `deno info failed for ${entry}: ${new TextDecoder().decode(stderr)}`,
    );
  }
  return JSON.parse(new TextDecoder().decode(stdout)) as DenoInfo;
}

const isLocalSrc = (s: string): boolean =>
  s.startsWith("file://") && s.includes("/src/");

async function collect(dir: URL, onlyTests: boolean): Promise<string[]> {
  const out: string[] = [];
  try {
    for await (
      const e of walk(dir, { exts: [".ts", ".tsx"], includeDirs: false })
    ) {
      if (!onlyTests || TEST_PATTERNS.some((re) => re.test(e.path))) {
        out.push(e.path);
      }
    }
  } catch {
    // Directory may not exist; ignore.
  }
  return out;
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

async function main(): Promise<void> {
  const allSrc = new Set(
    (await collect(SRC, false)).map((p) => toFileUrl(p).href),
  );
  const entries = [
    ...ENTRY_GLOBS,
    ...(await collect(SRC, true)),
    ...(await collect(new URL("tests/", ROOT), true)),
  ];

  const graphs = await mapLimit(entries, CONCURRENCY, graphFrom);
  const reachable = new Set<string>();
  for (const info of graphs) {
    for (const m of info.modules) {
      if (isLocalSrc(m.specifier)) reachable.add(m.specifier);
    }
  }

  const rel = (href: string): string =>
    decodeURIComponent(href.replace(ROOT.href, ""));
  const unused = [...allSrc]
    .filter((f) => !reachable.has(f))
    .map(rel)
    .filter((f) => !IGNORE_FILES.has(f))
    .sort();

  if (unused.length > 0) {
    console.error(
      `Unused files (unreachable from any entry/test) — ${unused.length}:`,
    );
    for (const f of unused) console.error(`  ${f}`);
    console.error(
      "\nIf a file is a legitimate entry, add it to ENTRY_GLOBS; " +
        "if intentionally kept, add it to IGNORE_FILES.",
    );
    Deno.exit(1);
  }
  console.log(`OK: all ${allSrc.size} src files reachable from entries/tests.`);
}

await main();
