// Schema for data/reviews/<domain_id>/reviews.jsonl — contract-spec.md
// section 2 "ReviewRecord". A single reviewer's decision on some target
// artefact (source, chunk, claim, risk, conflict or release).

import { z } from 'zod';
import { Id, IsoDateTime, ReviewDecision, ReviewRole, ReviewTargetType } from './enums.js';

/** A single reviewer's decision on a target artefact. */
export const ReviewRecord = z
  .object({
    review_id: Id,
    target_type: ReviewTargetType,
    target_id: z.string(),
    role: ReviewRole,
    decision: ReviewDecision,
    reviewer: z.string(),
    note: z.string().optional(),
    reviewed_at: IsoDateTime,
  })
  .strict();
export type ReviewRecord = z.infer<typeof ReviewRecord>;
