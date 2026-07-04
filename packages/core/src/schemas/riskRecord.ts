// Schema for data/risk/<source_id>/risk.jsonl — contract-spec.md section 2
// "RiskRecord". A single risk flag raised by risk screening against a source
// or chunk, matching a category declared in the domain's risk_rules.yaml.

import { z } from 'zod';
import { Id, RiskAction, RiskSeverity } from './enums.js';

/** A single risk flag raised against a source or chunk. */
export const RiskRecord = z
  .object({
    risk_id: Id,
    source_id: Id,
    chunk_id: Id.optional(),
    risk_type: z.string(),
    severity: RiskSeverity,
    action: RiskAction,
    description: z.string(),
    resolved: z.boolean().default(false),
    resolution_note: z.string().optional(),
    reviewed_by: z.string().optional(),
  })
  .strict();
export type RiskRecord = z.infer<typeof RiskRecord>;
