// Ingestion (contract-spec §2 RawArtifactManifest, ADR-014). Enforces the
// pre-ingest gate BEFORE writing anything, then stores the raw artefact
// write-once with a checksum manifest so immutability is auditable.

import { RawArtifactManifest, SourceRecord } from '../schemas/index.js';
import type {
  RawArtifactManifest as RawArtifactManifestType,
  SourceRecord as SourceRecordType,
} from '../schemas/index.js';
import { preIngestGate } from '../gates/index.js';
import {
  resolveRoot,
  rawFilePath,
  rawManifestFile,
  sha256,
  writeBytesOnce,
  writeJson,
} from '../storage/index.js';
import type { WorkspaceOpts } from '../storage/index.js';

/** The fetched content to be stored for a source. */
export interface IngestContent {
  buffer: Uint8Array | string;
  contentType: string;
  fileName?: string;
}

export type IngestResult =
  | { blocked: true; reasons: string[] }
  | { blocked: false; source: SourceRecordType; manifest: RawArtifactManifestType };

/** Choose a raw file name; guess an extension from the content type. */
function defaultFileName(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes('html')) return 'raw.html';
  if (ct.includes('markdown')) return 'raw.md';
  if (ct.includes('json')) return 'raw.json';
  if (ct.includes('csv')) return 'raw.csv';
  if (ct.includes('pdf')) return 'raw.pdf';
  if (ct.includes('xml')) return 'raw.xml';
  return 'raw.txt';
}

/**
 * Ingest a source: run the pre-ingest gate first (a blocked source writes
 * NOTHING), then store the raw bytes write-once and record a checksum
 * manifest. Returns the source advanced to review_state 'ingested'.
 */
export async function ingest(
  source: SourceRecordType,
  content: IngestContent,
  opts?: WorkspaceOpts & { now?: string },
): Promise<IngestResult> {
  const gate = preIngestGate(source);
  if (!gate.allowed) {
    return { blocked: true, reasons: gate.reasons };
  }

  const root = resolveRoot(opts);
  const now = opts?.now ?? new Date().toISOString();
  const fileName = content.fileName ?? defaultFileName(content.contentType);

  const bytes =
    typeof content.buffer === 'string' ? Buffer.from(content.buffer, 'utf8') : content.buffer;
  const checksum = sha256(bytes);

  await writeBytesOnce(rawFilePath(root, source.source_id, fileName), bytes, {
    force: opts?.force ?? false,
  });

  const manifest: RawArtifactManifestType = RawArtifactManifest.parse({
    source_id: source.source_id,
    canonical_url: source.canonical_url,
    publisher: source.publisher,
    source_type: source.source_type,
    retrieved_at: now,
    checksum_sha256: checksum,
    byte_size: bytes.byteLength,
    content_type: content.contentType,
    files: [fileName],
    errors: [],
  });
  await writeJson(rawManifestFile(root, source.source_id), manifest);

  const updated: SourceRecordType = SourceRecord.parse({
    ...source,
    review_state: 'ingested',
    checksum_sha256: checksum,
    retrieved_at: now,
    updated_at: now,
  });

  return { blocked: false, source: updated, manifest };
}
