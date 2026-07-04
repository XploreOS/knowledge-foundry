// Schema for evals/<release_id>/results.json — contract-spec.md section 2
// "EvaluationResult". Also embeddable in a ReleaseManifest's `evaluation`
// field once eval-rag has run against the release.

import { z } from 'zod';
import { Id, IsoDateTime } from './enums.js';

/** Result of running one evaluation question against a release's retrieval. */
const PerQuestionResult = z
  .object({
    question: z.string(),
    retrieved_chunk_ids: z.array(z.string()),
    has_citation: z.boolean(),
    unsafe: z.boolean(),
    notes: z.string().optional(),
  })
  .strict();

/** Aggregate RAG evaluation metrics for a single release. */
export const EvaluationResult = z
  .object({
    release_id: Id,
    domain_id: Id,
    evaluated_at: IsoDateTime,
    question_count: z.number().int().nonnegative(),
    citation_coverage: z.number().min(0).max(1),
    retrieval_precision: z.number().min(0).max(1),
    unsafe_output_rate: z.number().min(0).max(1),
    license_errors: z.number().int().nonnegative(),
    per_question: z.array(PerQuestionResult),
  })
  .strict();
export type EvaluationResult = z.infer<typeof EvaluationResult>;
