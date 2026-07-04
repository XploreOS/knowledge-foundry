// Schema for data/chunks/<source_id>/chunks.jsonl — contract-spec.md
// section 2 "ChunkRecord". Semantically chunked, retrieval-ready units of
// content carrying a mandatory citation and inherited license terms; tagging
// fields are added later by the tagger and stay optional until then.

import { z } from 'zod';
import { AllowedUses, Id, IsoDateTime, LicenseClass, ReviewState } from './enums.js';

/** A single tagged entity mention found within a chunk. */
const ChunkEntity = z
  .object({
    type: z.string(),
    value: z.string(),
  })
  .strict();

/** A single semantically chunked, taggable retrieval unit. */
export const ChunkRecord = z
  .object({
    chunk_id: Id,
    source_id: Id,
    section_path: z.string(),
    text: z.string().min(1),
    citation: z.string(),
    license_class: LicenseClass,
    allowed_uses: AllowedUses,
    topics: z.array(z.string()).optional(),
    entities: z.array(ChunkEntity).optional(),
    chunk_type: z.string().optional(),
    evidence_level: z.string().optional(),
    audience: z.array(z.string()).optional(),
    review_state: ReviewState,
    created_at: IsoDateTime,
  })
  .strict();
export type ChunkRecord = z.infer<typeof ChunkRecord>;
