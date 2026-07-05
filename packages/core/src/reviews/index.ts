// Review sign-off recording over data/reviews/<domain_id>/reviews.jsonl
// (contract-spec §2 ReviewRecord). A reviewer's decision is data, not UI:
// records are appended here and aggregated by the review-workflow quorum gate
// (gates/evaluateReviewWorkflow) — this module never decides anything itself.

import { ReviewRecord } from '../schemas/index.js';
import type {
  DomainConfig,
  ReviewDecision,
  ReviewRecord as ReviewRecordType,
  ReviewTargetType,
} from '../schemas/index.js';
import { reviewId } from '../ids/index.js';
import {
  resolveRoot,
  reviewsFile,
  readJsonlIfExists,
  writeJsonl,
} from '../storage/index.js';
import type { WorkspaceOpts } from '../storage/index.js';

/** Read every review recorded for a domain (empty array when none exist yet). */
export async function listReviews(
  domainId: string,
  opts?: WorkspaceOpts,
): Promise<ReviewRecordType[]> {
  const root = resolveRoot(opts);
  return readJsonlIfExists(reviewsFile(root, domainId), ReviewRecord);
}

/** Read the reviews recorded against one target artefact. */
export async function reviewsForTarget(
  domainId: string,
  targetType: ReviewTargetType,
  targetId: string,
  opts?: WorkspaceOpts,
): Promise<ReviewRecordType[]> {
  const reviews = await listReviews(domainId, opts);
  return reviews.filter((r) => r.target_type === targetType && r.target_id === targetId);
}

/** Next review sequence number: one past the highest existing `<domain>-review-<seq>`. */
function nextReviewSeq(domainId: string, existing: readonly ReviewRecordType[]): number {
  const prefix = `${domainId}-review-`;
  let max = 0;
  for (const review of existing) {
    if (!review.review_id.startsWith(prefix)) continue;
    const seq = review.review_id.slice(prefix.length);
    if (/^\d+$/.test(seq)) max = Math.max(max, Number(seq));
  }
  return max + 1;
}

export interface RecordReviewInput extends WorkspaceOpts {
  domainId: string;
  targetType: ReviewTargetType;
  targetId: string;
  role: string;
  decision: ReviewDecision;
  reviewer: string;
  note?: string;
  now?: string;
}

/**
 * Record one reviewer's decision on a target artefact. The role must be one of
 * the domain's declared review_roles (domain.yaml) — an unknown role would
 * silently never count toward any stage quorum, so it is rejected here.
 * Returns the persisted (validated) record.
 */
export async function recordReview(
  config: DomainConfig,
  input: RecordReviewInput,
): Promise<ReviewRecordType> {
  if (!config.domain.review_roles.includes(input.role)) {
    throw new Error(
      `role "${input.role}" is not declared in domain "${input.domainId}" review_roles ` +
        `[${config.domain.review_roles.join(', ')}]`,
    );
  }

  const root = resolveRoot(input);
  const file = reviewsFile(root, input.domainId);
  const existing = await readJsonlIfExists(file, ReviewRecord);

  const record = ReviewRecord.parse({
    review_id: reviewId(input.domainId, nextReviewSeq(input.domainId, existing)),
    target_type: input.targetType,
    target_id: input.targetId,
    role: input.role,
    decision: input.decision,
    reviewer: input.reviewer,
    ...(input.note !== undefined ? { note: input.note } : {}),
    reviewed_at: input.now ?? new Date().toISOString(),
  });

  await writeJsonl(file, [...existing, record], 'review_id');
  return record;
}
