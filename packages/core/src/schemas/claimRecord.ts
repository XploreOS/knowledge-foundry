// Schema for data/claims/<source_id>/claims.jsonl — contract-spec.md
// section 2 "ClaimRecord". An explicit claim extracted from a single chunk.

import { z } from 'zod';
import { EvidenceLevel, Id, ReviewState } from './enums.js';

/** A single extracted claim, linked back to the chunk it was derived from. */
export const ClaimRecord = z
  .object({
    claim_id: Id,
    source_id: Id,
    chunk_id: Id,
    claim_text: z.string(),
    population_or_scope: z.string(),
    intervention: z.string(),
    outcome: z.string(),
    evidence_level: EvidenceLevel,
    limitations: z.string(),
    review_state: ReviewState,
  })
  .strict();
export type ClaimRecord = z.infer<typeof ClaimRecord>;
