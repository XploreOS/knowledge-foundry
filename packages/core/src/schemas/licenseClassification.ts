// Schema for a license classification decision applied to a SourceRecord —
// contract-spec.md section 2 "LicenseClassification". Embedded conceptually
// in SourceRecord (license_class/allowed_uses/legal_review_required) but also
// recorded as its own standalone event/record.

import { z } from 'zod';
import { AllowedUses, Id, IsoDateTime, LicenseClass } from './enums.js';

/** A recorded license classification decision for a source. */
export const LicenseClassification = z
  .object({
    source_id: Id,
    license_class: LicenseClass,
    allowed_uses: AllowedUses,
    legal_review_required: z.boolean(),
    rationale: z.string().optional(),
    classified_at: IsoDateTime,
  })
  .strict();
export type LicenseClassification = z.infer<typeof LicenseClassification>;
