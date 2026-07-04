// Markdown adapter: an identity normalizer. Markdown is already the target
// normalized format, so normalization is a trimmed passthrough with a single
// trailing newline.

/** Normalize Markdown input to canonical form (trimmed + trailing newline). */
export function normalizeMarkdown(input: string): string {
  return `${input.replace(/\r\n/g, '\n').trimEnd()}\n`;
}
