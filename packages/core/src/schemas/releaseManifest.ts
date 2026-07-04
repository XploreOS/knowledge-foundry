// Schema for releases/<domain_id>/<release_id>/manifest.json — contract-spec.md
// section 2 "ReleaseManifest". The machine-readable manifest summarising a
// versioned corpus release: member sources, license/evidence breakdowns,
// gate results and (once eval-rag has run) evaluation metrics.

import { z } from 'zod';
import { AllowedUseKey, Id, IsoDateTime, LicenseClass, ReleaseState } from './enums.js';
import { EvaluationResult } from './evaluationResult.js';

const ReleaseSourceRef = z
  .object({
    source_id: Id,
    license_class: LicenseClass,
  })
  .strict();

const GateResult = z
  .object({
    gate: z.string(),
    passed: z.boolean(),
    details: z.string(),
  })
  .strict();

const MemberFile = z
  .object({
    path: z.string(),
    checksum_sha256: z.string().regex(/^[a-f0-9]{64}$/, 'must be a lowercase hex sha256 digest'),
  })
  .strict();

/** Count of member sources per license class. */
const LicenseClassCounts = z
  .object({
    Green: z.number().int().nonnegative(),
    Yellow: z.number().int().nonnegative(),
    Orange: z.number().int().nonnegative(),
    Red: z.number().int().nonnegative(),
    Unknown: z.number().int().nonnegative(),
  })
  .strict();

/** Manifest describing a single versioned corpus release. */
export const ReleaseManifest = z
  .object({
    release_id: Id,
    domain_id: Id,
    state: ReleaseState,
    created_at: IsoDateTime,
    updated_at: IsoDateTime,
    intended_use: z.union([AllowedUseKey, z.array(AllowedUseKey)]),
    source_count: z.number().int().nonnegative(),
    sources: z.array(ReleaseSourceRef),
    license_class_counts: LicenseClassCounts,
    evidence_summary: z.record(z.string(), z.number().int().nonnegative()),
    chunk_count: z.number().int().nonnegative(),
    gate_results: z.array(GateResult),
    blockers: z.array(z.string()),
    member_files: z.array(MemberFile),
    evaluation: EvaluationResult.optional(),
  })
  .strict();
export type ReleaseManifest = z.infer<typeof ReleaseManifest>;
