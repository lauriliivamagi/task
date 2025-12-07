/**
 * Terminal hyperlink utilities using OSC 8 escape sequences.
 *
 * OSC 8 is supported by most modern terminals:
 * - iTerm2, GNOME Terminal, Windows Terminal, kitty, Alacritty, etc.
 * - Terminals that don't support it will simply display the text without the link.
 *
 * @see https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda
 */

const OSC = "\x1b]";
const ST = "\x07"; // String Terminator (BEL)

/**
 * Wrap text with OSC 8 hyperlink escape codes.
 *
 * @param text - The visible text to display
 * @param url - The URL to link to
 * @returns Text wrapped with OSC 8 escape codes
 */
export function makeHyperlink(text: string, url: string): string {
  return `${OSC}8;;${url}${ST}${text}${OSC}8;;${ST}`;
}

// URL pattern: matches http:// or https:// URLs
// Stops at whitespace or common punctuation that's unlikely to be part of URL
const URL_PATTERN = /https?:\/\/[^\s<>"\])}]+/g;

// File path patterns:
// - Absolute paths: /path/to/file.ext
// - Home-relative paths: ~/path/to/file.ext
// - Relative paths: ./path/to/file.ext or ../path/to/file.ext
// Must have a file extension to avoid false positives
const FILE_PATH_PATTERN =
  /(?:^|(?<=\s))(?:\/[\w./-]+\.\w+|~\/[\w./-]+\.\w+|\.\.?\/[\w./-]+\.\w+)(?=\s|$|[,;:!?)\]}>])/g;

/**
 * Convert a file path to a file:// URL.
 * Handles absolute paths, home-relative (~/) paths, and relative paths.
 */
function filePathToUrl(path: string): string {
  let absolutePath = path;

  if (path.startsWith("~/")) {
    // Expand home directory
    const home = Deno.env.get("HOME") || "";
    absolutePath = home + path.slice(1);
  } else if (path.startsWith("./") || path.startsWith("../")) {
    // Convert relative path to absolute
    absolutePath = Deno.cwd() + "/" + path;
  }

  // Normalize the path and encode for URL
  return "file://" + encodeURI(absolutePath);
}

interface LinkMatch {
  start: number;
  end: number;
  text: string;
  url: string;
}

/**
 * Detect URLs and file paths in text and convert them to clickable hyperlinks.
 *
 * @param text - The text to process
 * @returns Text with URLs and file paths converted to OSC 8 hyperlinks
 */
export function linkifyText(text: string): string {
  if (!text) return text;

  const matches: LinkMatch[] = [];

  // Find all URL matches
  for (const match of text.matchAll(URL_PATTERN)) {
    if (match.index !== undefined) {
      // Clean up trailing punctuation that's probably not part of the URL
      let url = match[0];
      const trailingPunctuation = /[.,;:!?)}\]]+$/;
      const trailing = url.match(trailingPunctuation);
      if (trailing) {
        url = url.slice(0, -trailing[0].length);
      }

      matches.push({
        start: match.index,
        end: match.index + url.length,
        text: url,
        url: url,
      });
    }
  }

  // Find all file path matches
  for (const match of text.matchAll(FILE_PATH_PATTERN)) {
    if (match.index !== undefined) {
      const path = match[0];
      matches.push({
        start: match.index,
        end: match.index + path.length,
        text: path,
        url: filePathToUrl(path),
      });
    }
  }

  if (matches.length === 0) {
    return text;
  }

  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start);

  // Remove overlapping matches (keep the first one)
  const filteredMatches: LinkMatch[] = [];
  let lastEnd = 0;
  for (const match of matches) {
    if (match.start >= lastEnd) {
      filteredMatches.push(match);
      lastEnd = match.end;
    }
  }

  // Build result string
  let result = "";
  let pos = 0;
  for (const match of filteredMatches) {
    // Add text before the match
    result += text.slice(pos, match.start);
    // Add the hyperlink
    result += makeHyperlink(match.text, match.url);
    pos = match.end;
  }
  // Add remaining text
  result += text.slice(pos);

  return result;
}
