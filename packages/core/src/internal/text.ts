// Internal, deterministic text helpers shared by normalization and chunking.
// Not part of the public package surface.

import { slugify } from '../ids/index.js';

export interface ParsedHeading {
  level: number;
  text: string;
  anchor: string;
}

const HEADING_RE = /^(#{1,6})\s+(.*\S)\s*$/;

/** Parse a single Markdown ATX heading line, or return null. */
export function parseHeadingLine(line: string): ParsedHeading | null {
  const match = HEADING_RE.exec(line);
  if (!match) return null;
  const hashes = match[1] ?? '';
  const text = (match[2] ?? '').trim();
  return { level: hashes.length, text, anchor: slugify(text) };
}

/** Extract every Markdown heading from a document body. */
export function parseHeadings(markdown: string): ParsedHeading[] {
  const headings: ParsedHeading[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const heading = parseHeadingLine(line);
    if (heading) headings.push(heading);
  }
  return headings;
}

const BLOCK_TAGS = ['p', 'div', 'section', 'article', 'li', 'tr', 'br', 'ul', 'ol', 'table'];

/**
 * Mechanically convert HTML to plain Markdown-ish text: drop script/style/nav
 * blocks, promote <h1>..<h6> to ATX headings so downstream heading parsing
 * works, insert newlines for common block tags, strip all remaining tags and
 * decode a handful of common entities. Deterministic, no DOM.
 */
export function stripHtmlToMarkdown(html: string): string {
  let out = html;
  // Remove non-content blocks entirely.
  out = out.replace(/<(script|style|nav|head)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  // Promote headings to ATX Markdown.
  out = out.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level: string, inner: string) => {
    const hashes = '#'.repeat(Number(level));
    return `\n${hashes} ${inner.replace(/<[^>]+>/g, '').trim()}\n`;
  });
  // Turn block-level tags into line breaks.
  for (const tag of BLOCK_TAGS) {
    out = out.replace(new RegExp(`</?${tag}\\b[^>]*>`, 'gi'), '\n');
  }
  // Strip every remaining tag.
  out = out.replace(/<[^>]+>/g, '');
  // Decode common entities.
  out = out
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  // Collapse excess blank lines and trailing spaces.
  out = out
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+$/g, '').replace(/^[ \t]+/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return `${out}\n`;
}

/** Split text into sentences on ., ! and ? boundaries. Never returns empties. */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** All numeric tokens (integers/decimals) found in text, as strings. */
export function extractNumbers(text: string): string[] {
  return text.match(/\d+(?:\.\d+)?/g) ?? [];
}
