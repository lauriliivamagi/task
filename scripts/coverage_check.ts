#!/usr/bin/env -S deno run -A
/**
 * Coverage threshold gate.
 *
 * Deno has no `deno coverage --fail-under`, so this parses the lcov totals
 * (LF = lines found, LH = lines hit) from `deno coverage` and exits non-zero
 * if line coverage is below COVERAGE_MIN (percent, default 0 = report-only).
 *
 * Expects the coverage/ profile produced by `deno task test:cov`.
 */
const min = Number(Deno.env.get("COVERAGE_MIN") ?? "0");

const { code, stdout, stderr } = await new Deno.Command(Deno.execPath(), {
  args: ["coverage", "coverage", "--lcov", "--exclude=^file:///tmp/"],
  stdout: "piped",
  stderr: "piped",
}).output();

if (code !== 0) {
  console.error(new TextDecoder().decode(stderr));
  Deno.exit(code);
}

const lcov = new TextDecoder().decode(stdout);
let found = 0;
let hit = 0;
for (const line of lcov.split("\n")) {
  if (line.startsWith("LF:")) found += Number(line.slice(3));
  else if (line.startsWith("LH:")) hit += Number(line.slice(3));
}

const pct = found === 0 ? 100 : (hit / found) * 100;
console.log(`Line coverage: ${pct.toFixed(2)}% (${hit}/${found} lines)`);

if (pct < min) {
  console.error(`Coverage ${pct.toFixed(2)}% is below minimum ${min}%`);
  Deno.exit(1);
}
