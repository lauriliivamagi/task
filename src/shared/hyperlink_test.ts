import { assertEquals } from "@std/assert";
import { linkifyText, makeHyperlink } from "./hyperlink.ts";

const OSC = "\x1b]";
const ST = "\x07";

Deno.test("makeHyperlink - wraps text with OSC 8 escape codes", () => {
  const result = makeHyperlink("Click me", "https://example.com");
  assertEquals(
    result,
    `${OSC}8;;https://example.com${ST}Click me${OSC}8;;${ST}`,
  );
});

Deno.test("makeHyperlink - handles special characters in URL", () => {
  const result = makeHyperlink("Search", "https://google.com/search?q=test");
  assertEquals(
    result,
    `${OSC}8;;https://google.com/search?q=test${ST}Search${OSC}8;;${ST}`,
  );
});

Deno.test("linkifyText - returns empty string unchanged", () => {
  assertEquals(linkifyText(""), "");
});

Deno.test("linkifyText - returns text without links unchanged", () => {
  assertEquals(linkifyText("Hello world"), "Hello world");
});

Deno.test("linkifyText - converts http URL to hyperlink", () => {
  const result = linkifyText("Visit http://example.com for more");
  assertEquals(
    result,
    `Visit ${OSC}8;;http://example.com${ST}http://example.com${OSC}8;;${ST} for more`,
  );
});

Deno.test("linkifyText - converts https URL to hyperlink", () => {
  const result = linkifyText("Check https://github.com/user/repo");
  assertEquals(
    result,
    `Check ${OSC}8;;https://github.com/user/repo${ST}https://github.com/user/repo${OSC}8;;${ST}`,
  );
});

Deno.test("linkifyText - handles URL at start of text", () => {
  const result = linkifyText("https://example.com is great");
  assertEquals(
    result,
    `${OSC}8;;https://example.com${ST}https://example.com${OSC}8;;${ST} is great`,
  );
});

Deno.test("linkifyText - handles URL at end of text", () => {
  const result = linkifyText("Visit https://example.com");
  assertEquals(
    result,
    `Visit ${OSC}8;;https://example.com${ST}https://example.com${OSC}8;;${ST}`,
  );
});

Deno.test("linkifyText - strips trailing punctuation from URL", () => {
  const result = linkifyText("See https://example.com, and more.");
  assertEquals(
    result,
    `See ${OSC}8;;https://example.com${ST}https://example.com${OSC}8;;${ST}, and more.`,
  );
});

Deno.test("linkifyText - handles multiple URLs in text", () => {
  const result = linkifyText(
    "Check https://a.com and https://b.com for info",
  );
  assertEquals(
    result,
    `Check ${OSC}8;;https://a.com${ST}https://a.com${OSC}8;;${ST} and ${OSC}8;;https://b.com${ST}https://b.com${OSC}8;;${ST} for info`,
  );
});

Deno.test("linkifyText - converts absolute file path to hyperlink", () => {
  const result = linkifyText("See /home/user/file.txt for details");
  assertEquals(
    result,
    `See ${OSC}8;;file:///home/user/file.txt${ST}/home/user/file.txt${OSC}8;;${ST} for details`,
  );
});

Deno.test("linkifyText - converts home-relative path to hyperlink", () => {
  const home = Deno.env.get("HOME") || "";
  const result = linkifyText("Edit ~/config/app.json now");
  assertEquals(
    result,
    `Edit ${OSC}8;;file://${home}/config/app.json${ST}~/config/app.json${OSC}8;;${ST} now`,
  );
});

Deno.test("linkifyText - converts relative path with ./ to hyperlink", () => {
  const cwd = Deno.cwd();
  const result = linkifyText("Run ./scripts/test.sh please");
  assertEquals(
    result,
    `Run ${OSC}8;;file://${cwd}/./scripts/test.sh${ST}./scripts/test.sh${OSC}8;;${ST} please`,
  );
});

Deno.test("linkifyText - converts relative path with ../ to hyperlink", () => {
  const cwd = Deno.cwd();
  const result = linkifyText("See ../other/file.md");
  assertEquals(
    result,
    `See ${OSC}8;;file://${cwd}/../other/file.md${ST}../other/file.md${OSC}8;;${ST}`,
  );
});

Deno.test("linkifyText - does not match paths without file extension", () => {
  // Paths without extensions should not be matched to avoid false positives
  const result = linkifyText("The /usr/bin directory contains binaries");
  assertEquals(result, "The /usr/bin directory contains binaries");
});

Deno.test("linkifyText - handles mixed URLs and file paths", () => {
  const result = linkifyText(
    "Download from https://example.com and save to /tmp/file.zip",
  );
  assertEquals(
    result,
    `Download from ${OSC}8;;https://example.com${ST}https://example.com${OSC}8;;${ST} and save to ${OSC}8;;file:///tmp/file.zip${ST}/tmp/file.zip${OSC}8;;${ST}`,
  );
});

Deno.test("linkifyText - handles URL with path and query parameters", () => {
  const result = linkifyText(
    "Open https://github.com/user/repo/issues?state=open",
  );
  assertEquals(
    result,
    `Open ${OSC}8;;https://github.com/user/repo/issues?state=open${ST}https://github.com/user/repo/issues?state=open${OSC}8;;${ST}`,
  );
});

Deno.test("linkifyText - handles null/undefined gracefully", () => {
  // @ts-ignore - testing runtime behavior
  assertEquals(linkifyText(null), null);
  // @ts-ignore - testing runtime behavior
  assertEquals(linkifyText(undefined), undefined);
});
