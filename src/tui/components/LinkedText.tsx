/**
 * LinkedText Component
 *
 * Renders text with URLs and file paths as clickable hyperlinks.
 * Uses ink-link which properly handles terminal width calculations.
 */

import React from "react";
import { Text } from "ink";
import Link from "ink-link";

// URL pattern: matches http:// or https:// URLs
const URL_PATTERN = /https?:\/\/[^\s<>"\])}]+/g;

// File path patterns with extensions to avoid false positives
const FILE_PATH_PATTERN =
  /(?:^|(?<=\s))(?:\/[\w./-]+\.\w+|~\/[\w./-]+\.\w+|\.\.?\/[\w./-]+\.\w+)(?=\s|$|[,;:!?)\]}>])/g;

interface TextSegment {
  type: "text" | "link";
  content: string;
  url?: string;
}

/**
 * Convert a file path to a file:// URL.
 */
function filePathToUrl(path: string): string {
  let absolutePath = path;

  if (path.startsWith("~/")) {
    const home = Deno.env.get("HOME") || "";
    absolutePath = home + path.slice(1);
  } else if (path.startsWith("./") || path.startsWith("../")) {
    absolutePath = Deno.cwd() + "/" + path;
  }

  return "file://" + encodeURI(absolutePath);
}

/**
 * Parse text into segments of plain text and links.
 */
function parseTextSegments(text: string): TextSegment[] {
  if (!text) return [{ type: "text", content: text || "" }];

  interface Match {
    start: number;
    end: number;
    text: string;
    url: string;
  }

  const matches: Match[] = [];

  // Find all URL matches
  for (const match of text.matchAll(URL_PATTERN)) {
    if (match.index !== undefined) {
      let url = match[0];
      // Clean trailing punctuation
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
    return [{ type: "text", content: text }];
  }

  // Sort by start position and remove overlaps
  matches.sort((a, b) => a.start - b.start);
  const filtered: Match[] = [];
  let lastEnd = 0;
  for (const match of matches) {
    if (match.start >= lastEnd) {
      filtered.push(match);
      lastEnd = match.end;
    }
  }

  // Build segments
  const segments: TextSegment[] = [];
  let pos = 0;
  for (const match of filtered) {
    if (match.start > pos) {
      segments.push({ type: "text", content: text.slice(pos, match.start) });
    }
    segments.push({ type: "link", content: match.text, url: match.url });
    pos = match.end;
  }
  if (pos < text.length) {
    segments.push({ type: "text", content: text.slice(pos) });
  }

  return segments;
}

interface LinkedTextProps {
  children: string;
}

/**
 * Renders text with clickable hyperlinks for URLs and file paths.
 */
export function LinkedText({ children }: LinkedTextProps): React.ReactElement {
  const segments = parseTextSegments(children);

  return (
    <Text>
      {segments.map((segment, idx) =>
        segment.type === "link"
          ? (
            <Link key={idx} url={segment.url ?? ""} fallback={false}>
              {segment.content}
            </Link>
          )
          : <Text key={idx}>{segment.content}</Text>
      )}
    </Text>
  );
}
