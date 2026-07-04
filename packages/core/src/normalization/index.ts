// Normalization (contract-spec §2 NormalizedDocument). Reads the immutable raw
// artefact named in its manifest, verifies the checksum (immutability guard),
// then produces document.md + a metadata.json sidecar.

import { NormalizedDocumentMeta, RawArtifactManifest } from '../schemas/index.js';
import type {
  NormalizedDocumentMeta as NormalizedDocumentMetaType,
  SourceRecord as SourceRecordType,
} from '../schemas/index.js';
import {
  resolveRoot,
  rawFilePath,
  rawManifestFile,
  normalizedDocFile,
  normalizedMetaFile,
  readBytes,
  readJson,
  sha256,
  writeText,
  writeJson,
} from '../storage/index.js';
import type { WorkspaceOpts } from '../storage/index.js';
import { parseHeadings, stripHtmlToMarkdown } from '../internal/text.js';

/**
 * Normalize a source's raw artefact into Markdown + metadata. Throws if the
 * on-disk raw bytes no longer match the checksum recorded at ingestion —
 * raw artefacts are immutable and a mismatch is a hard integrity failure.
 */
export async function normalize(
  source: SourceRecordType,
  opts?: WorkspaceOpts & { now?: string },
): Promise<NormalizedDocumentMetaType> {
  const root = resolveRoot(opts);
  const now = opts?.now ?? new Date().toISOString();

  const manifest = await readJson(rawManifestFile(root, source.source_id), RawArtifactManifest);
  const rawName = manifest.files[0];
  if (rawName === undefined) {
    throw new Error(`raw manifest for ${source.source_id} lists no files to normalize`);
  }

  const bytes = await readBytes(rawFilePath(root, source.source_id, rawName));
  if (sha256(bytes) !== manifest.checksum_sha256) {
    throw new Error('raw artefact checksum mismatch — immutability violated');
  }

  const rawText = bytes.toString('utf8');
  const isHtml = manifest.content_type.toLowerCase().includes('html');
  const document = isHtml ? stripHtmlToMarkdown(rawText) : rawText;

  await writeText(normalizedDocFile(root, source.source_id), document);

  const meta: NormalizedDocumentMetaType = NormalizedDocumentMeta.parse({
    source_id: source.source_id,
    title: source.title,
    headings: parseHeadings(document),
    citations: source.canonical_url.trim() !== '' ? [source.canonical_url] : [],
    normalized_at: now,
    source_checksum_sha256: manifest.checksum_sha256,
  });
  await writeJson(normalizedMetaFile(root, source.source_id), meta);

  return meta;
}
