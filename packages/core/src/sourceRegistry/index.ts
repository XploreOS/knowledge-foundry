// Source registry CRUD over data/source_registry/<domain>/sources.jsonl.
// Records are validated on read and write and kept sorted by source_id.

import { SourceRecord } from '../schemas/index.js';
import type { SourceRecord as SourceRecordType } from '../schemas/index.js';
import {
  resolveRoot,
  sourceRegistryFile,
  readJsonlIfExists,
  writeJsonl,
} from '../storage/index.js';
import type { WorkspaceOpts } from '../storage/index.js';

/** Read all source records for a domain (empty array when none exist yet). */
export async function listSources(
  domain: string,
  opts?: WorkspaceOpts,
): Promise<SourceRecordType[]> {
  const root = resolveRoot(opts);
  return readJsonlIfExists(sourceRegistryFile(root, domain), SourceRecord);
}

/** Read a single source record, or undefined when it is not present. */
export async function getSource(
  domain: string,
  sourceId: string,
  opts?: WorkspaceOpts,
): Promise<SourceRecordType | undefined> {
  const sources = await listSources(domain, opts);
  return sources.find((s) => s.source_id === sourceId);
}

/**
 * Validate + upsert a source record by source_id into its domain registry.
 * Returns the persisted (validated) record.
 */
export async function createSource(
  record: SourceRecordType,
  opts?: WorkspaceOpts,
): Promise<SourceRecordType> {
  const validated = SourceRecord.parse(record);
  const root = resolveRoot(opts);
  const file = sourceRegistryFile(root, validated.domain);
  const existing = await readJsonlIfExists(file, SourceRecord);
  const next = existing.filter((s) => s.source_id !== validated.source_id);
  next.push(validated);
  await writeJsonl(file, next, 'source_id');
  return validated;
}

/**
 * Merge a patch into an existing source record, bump updated_at, re-validate
 * and persist. Throws when the source does not exist. `now` is injectable to
 * keep callers deterministic in tests.
 */
export async function updateSource(
  domain: string,
  sourceId: string,
  patch: Partial<SourceRecordType>,
  opts?: WorkspaceOpts & { now?: string },
): Promise<SourceRecordType> {
  const root = resolveRoot(opts);
  const file = sourceRegistryFile(root, domain);
  const existing = await readJsonlIfExists(file, SourceRecord);
  const current = existing.find((s) => s.source_id === sourceId);
  if (!current) {
    throw new Error(`source ${sourceId} not found in domain ${domain}`);
  }
  const now = opts?.now ?? new Date().toISOString();
  const merged = SourceRecord.parse({ ...current, ...patch, updated_at: now });
  const next = existing.filter((s) => s.source_id !== sourceId);
  next.push(merged);
  await writeJsonl(file, next, 'source_id');
  return merged;
}
