// Schema for data/normalized/<source_id>/metadata.json — contract-spec.md
// section 2 "NormalizedDocument sidecar". The body itself lives alongside in
// document.md; this is only the JSON metadata sidecar.

import { z } from 'zod';
import { Id, IsoDateTime } from './enums.js';

/** A single heading captured from the normalized document. */
const NormalizedDocumentHeading = z
  .object({
    level: z.number().int().min(1),
    text: z.string(),
    anchor: z.string(),
  })
  .strict();

/** Sidecar metadata for a single normalized (Markdown) document. */
export const NormalizedDocumentMeta = z
  .object({
    source_id: Id,
    title: z.string(),
    headings: z.array(NormalizedDocumentHeading),
    toc: z.array(z.string()).optional(),
    citations: z.array(z.string()),
    page_count: z.number().int().nonnegative().optional(),
    normalized_at: IsoDateTime,
    source_checksum_sha256: z.string().regex(/^[a-f0-9]{64}$/, 'must be a lowercase hex sha256 digest'),
  })
  .strict();
export type NormalizedDocumentMeta = z.infer<typeof NormalizedDocumentMeta>;
