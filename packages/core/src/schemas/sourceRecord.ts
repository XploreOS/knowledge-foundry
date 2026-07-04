// Schema for entries in data/source_registry/**/*.jsonl — contract-spec.md
// section 2 "SourceRecord". The candidate/approved source registry entry.

import { z } from 'zod';
import {
  AllowedUses,
  Id,
  IngestionPriority,
  IsoDateTime,
  LicenseClass,
  ReviewState,
  SourceType,
} from './enums.js';

/** A single source registry entry: candidate through approved/rejected. */
export const SourceRecord = z
  .object({
    source_id: Id,
    title: z.string(),
    publisher: z.string(),
    canonical_url: z.string(),
    source_type: SourceType,
    domain: Id,
    topics: z.array(z.string()),
    likely_license: LicenseClass,
    license_class: LicenseClass.optional(),
    allowed_uses: AllowedUses.optional(),
    legal_review_required: z.boolean().optional(),
    ingestion_priority: IngestionPriority,
    review_state: ReviewState,
    approval_status: z.enum(['approved_for_ingestion', 'rejected']).nullable().optional(),
    notes: z.string().optional(),
    retrieved_at: IsoDateTime.optional(),
    checksum_sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/, 'must be a lowercase hex sha256 digest')
      .optional(),
    created_at: IsoDateTime,
    updated_at: IsoDateTime,
  })
  .strict();
export type SourceRecord = z.infer<typeof SourceRecord>;
