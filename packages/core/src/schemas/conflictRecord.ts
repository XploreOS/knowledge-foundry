// Schema for data/conflicts/<domain_id>/<topic>.jsonl — contract-spec.md
// section 2 "ConflictRecord". A detected contradiction between two or more
// chunks on a shared topic, flagged for subject-matter-expert resolution.

import { z } from 'zod';
import { Id } from './enums.js';

/** A detected contradiction between two or more chunks on a shared topic. */
export const ConflictRecord = z
  .object({
    conflict_id: Id,
    domain_id: Id,
    topic: z.string(),
    chunk_ids: z.array(Id).min(2),
    nature: z.string(),
    references: z.array(z.string()),
    resolved: z.boolean().default(false),
    resolution_note: z.string().optional(),
  })
  .strict();
export type ConflictRecord = z.infer<typeof ConflictRecord>;
