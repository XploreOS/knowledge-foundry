// Shared, stable, grep-able printing for the kf CLI. stdout carries data (one
// `key: value` fact per line); stderr carries errors, warnings and notes.
// Failures never throw raw stack traces at the user — they print a clean
// `Error: <message>` (plus detail lines) and set process.exitCode = 1.

/** Marker error: already reported to the user; the top-level runner swallows it. */
export class CliError extends Error {}

/** Print a data line to stdout. */
export function line(s = ''): void {
  process.stdout.write(`${s}\n`);
}

/** Print a `key: value` fact to stdout. */
export function kv(key: string, value: unknown): void {
  line(`${key}: ${String(value)}`);
}

/** Print an advisory note to stderr (does not affect exit code). */
export function note(s: string): void {
  process.stderr.write(`note: ${s}\n`);
}

/** Print a warning to stderr (does not affect exit code). */
export function warn(s: string): void {
  process.stderr.write(`warning: ${s}\n`);
}

/**
 * Report a command failure: print `Error: <message>` and any detail lines to
 * stderr, set the process exit code, and throw a CliError so the calling action
 * stops immediately. The top-level runner recognises CliError and prints nothing
 * further (the message is already on screen).
 */
export function fail(message: string, details: string[] = []): never {
  process.stderr.write(`Error: ${message}\n`);
  for (const d of details) process.stderr.write(`  - ${d}\n`);
  process.exitCode = 1;
  throw new CliError(message);
}

/**
 * Report a gate block visually and unmistakably, then fail. Used for the
 * pre-ingest and pre-release gates so a refusal cannot be mistaken for success.
 */
export function blocked(title: string, reasons: string[]): never {
  const bar = '='.repeat(Math.max(title.length + 8, 24));
  process.stderr.write(`\n${bar}\n`);
  process.stderr.write(`==  ${title}\n`);
  process.stderr.write(`${bar}\n`);
  for (const r of reasons) process.stderr.write(`  - ${r}\n`);
  process.stderr.write('\n');
  process.exitCode = 1;
  throw new CliError(title);
}
