// Generic filesystem IO helpers used by every storage-backed operation.
// JSON is pretty-printed (2-space); JSONL record sets are sorted by their id
// field so on-disk output is deterministic and line-diffable (ADR-006).

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import type { z } from 'zod';

/** Format zod issues as `path: message` lines for actionable error output. */
export function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

/** SHA-256 hex digest of the given bytes or UTF-8 string. */
export function sha256(data: Uint8Array | string): string {
  const hash = createHash('sha256');
  hash.update(typeof data === 'string' ? Buffer.from(data, 'utf8') : data);
  return hash.digest('hex');
}

/** Create a directory (and parents) if it does not already exist. */
export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/** True when the given path exists. */
export async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function readText(file: string): Promise<string> {
  return fs.readFile(file, 'utf8');
}

export async function writeText(file: string, content: string): Promise<void> {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, content, 'utf8');
}

/** Read raw bytes (used for checksum verification of immutable artefacts). */
export async function readBytes(file: string): Promise<Buffer> {
  return fs.readFile(file);
}

/**
 * Write a raw artefact write-once (ADR-014): refuse to overwrite an existing
 * file unless `force` is set. Immutability is what makes the checksum audit
 * trail meaningful, so this guard is deliberate.
 */
export async function writeBytesOnce(
  file: string,
  data: Uint8Array | string,
  opts?: { force?: boolean },
): Promise<void> {
  if (!opts?.force && (await exists(file))) {
    throw new Error(
      `raw artefact already exists and is write-once: ${file} — pass { force: true } to overwrite`,
    );
  }
  await ensureDir(path.dirname(file));
  const bytes = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  await fs.writeFile(file, bytes);
}

/** Read and JSON-parse a file, optionally validating against a zod schema. */
export async function readJson<S extends z.ZodTypeAny>(file: string, schema: S): Promise<z.infer<S>>;
export async function readJson<T = unknown>(file: string): Promise<T>;
export async function readJson(file: string, schema?: z.ZodTypeAny): Promise<unknown> {
  const raw = await readText(file);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${file}: invalid JSON — ${(err as Error).message}`);
  }
  if (!schema) return parsed;
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`${file}: schema validation failed — ${formatZodIssues(result.error)}`);
  }
  return result.data;
}

/** Pretty-print a value as JSON (2-space) with a trailing newline. */
export async function writeJson(file: string, value: unknown): Promise<void> {
  await writeText(file, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Read a JSONL file and validate every line against `schema`. Errors name the
 * offending line number so bad records are easy to locate.
 */
export async function readJsonl<S extends z.ZodTypeAny>(
  file: string,
  schema: S,
): Promise<z.infer<S>[]> {
  const raw = await readText(file);
  const out: z.infer<S>[] = [];
  const lines = raw.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.trim() === '') return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      throw new Error(`${file}:${index + 1}: invalid JSON — ${(err as Error).message}`);
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `${file}:${index + 1}: schema validation failed — ${formatZodIssues(result.error)}`,
      );
    }
    out.push(result.data);
  });
  return out;
}

/** Like {@link readJsonl} but returns an empty array when the file is absent. */
export async function readJsonlIfExists<S extends z.ZodTypeAny>(
  file: string,
  schema: S,
): Promise<z.infer<S>[]> {
  if (!(await exists(file))) return [];
  return readJsonl(file, schema);
}

/**
 * Write a record set as JSONL, sorted ascending by `idField` for deterministic
 * output. An empty record set writes an empty file (a valid, empty artefact).
 */
export async function writeJsonl<T extends Record<string, unknown>>(
  file: string,
  records: readonly T[],
  idField: keyof T,
): Promise<void> {
  const sorted = [...records].sort((a, b) => {
    const av = String(a[idField]);
    const bv = String(b[idField]);
    return av < bv ? -1 : av > bv ? 1 : 0;
  });
  const body = sorted.map((record) => JSON.stringify(record)).join('\n');
  await writeText(file, body.length > 0 ? `${body}\n` : '');
}
