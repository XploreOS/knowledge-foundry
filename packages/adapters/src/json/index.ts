// JSON adapter: parse and pretty-print helpers.

/** Parse a JSON string, throwing a clear error on malformed input. */
export function parseJson<T = unknown>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new Error(`invalid JSON: ${(err as Error).message}`);
  }
}

/** Pretty-print a value as JSON (2-space) with a trailing newline. */
export function prettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
