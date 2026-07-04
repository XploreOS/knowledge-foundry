// Schema for data/raw/<source_id>/manifest.json — contract-spec.md section 2
// "RawArtifactManifest". Recorded provenance/checksum for an immutable raw
// artefact fetched during ingestion.

import { z } from 'zod';
import { Id, IsoDateTime, SourceType } from './enums.js';

/** Manifest describing the raw files fetched for a single source. */
export const RawArtifactManifest = z
  .object({
    source_id: Id,
    canonical_url: z.string(),
    publisher: z.string(),
    source_type: SourceType,
    retrieved_at: IsoDateTime,
    checksum_sha256: z.string().regex(/^[a-f0-9]{64}$/, 'must be a lowercase hex sha256 digest'),
    byte_size: z.number().int().nonnegative(),
    content_type: z.string(),
    files: z.array(z.string()),
    errors: z.array(z.string()),
  })
  .strict();
export type RawArtifactManifest = z.infer<typeof RawArtifactManifest>;
