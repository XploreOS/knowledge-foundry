// v0.2 review-workflow enforcement — the pure quorum gate
// (evaluateReviewStage / evaluateReviewWorkflow) and the recordReview IO path.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  evaluateReviewStage,
  evaluateReviewWorkflow,
  listReviews,
  recordReview,
  reviewId,
  reviewsForTarget,
} from '@knowledge-foundry/core';
import type { ReviewRecord, ReviewWorkflowStage } from '@knowledge-foundry/core';
import { NOW, makeDomainConfig, makeTempRoot, removeTempRoot } from '../helpers.js';

function makeReview(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    review_id: 'demo-review-0001',
    target_type: 'release',
    target_id: 'demo-p0-v0.2.0',
    role: 'legal',
    decision: 'approved',
    reviewer: 'alice',
    reviewed_at: NOW,
    ...overrides,
  };
}

describe('evaluateReviewStage — quorum semantics', () => {
  const base: ReviewWorkflowStage = { roles: ['legal'], required: true, quorum: 'any' };

  it('quorum "any" is satisfied by one approval from a listed role', () => {
    const result = evaluateReviewStage('license_review', base, [makeReview()]);
    expect(result.satisfied).toBe(true);
    expect(result.approvals).toEqual([{ reviewer: 'alice', role: 'legal' }]);
  });

  it('quorum "any" is unsatisfied with no reviews', () => {
    const result = evaluateReviewStage('license_review', base, []);
    expect(result.satisfied).toBe(false);
    expect(result.reasons).toEqual([
      'stage license_review: no approval recorded (needs any of roles [legal])',
    ]);
  });

  it('reviews by roles the stage does not list never count', () => {
    const result = evaluateReviewStage('license_review', base, [
      makeReview({ role: 'product_owner' }),
    ]);
    expect(result.satisfied).toBe(false);
    expect(result.approvals).toEqual([]);
  });

  it('quorum "all" requires an approval from every listed role', () => {
    const stage: ReviewWorkflowStage = {
      roles: ['legal', 'domain_sme'],
      required: true,
      quorum: 'all',
    };
    const partial = evaluateReviewStage('safety_review', stage, [makeReview()]);
    expect(partial.satisfied).toBe(false);
    expect(partial.reasons).toEqual([
      'stage safety_review: missing approval from role(s) [domain_sme]',
    ]);

    const full = evaluateReviewStage('safety_review', stage, [
      makeReview(),
      makeReview({ review_id: 'demo-review-0002', role: 'domain_sme', reviewer: 'bob' }),
    ]);
    expect(full.satisfied).toBe(true);
  });

  it('numeric quorum counts distinct approving reviewers across listed roles', () => {
    const stage: ReviewWorkflowStage = {
      roles: ['legal', 'domain_sme', 'product_owner'],
      required: true,
      quorum: 2,
    };
    const one = evaluateReviewStage('release_review', stage, [makeReview()]);
    expect(one.satisfied).toBe(false);
    expect(one.reasons).toEqual([
      'stage release_review: 1 of 2 required approvals recorded (roles [legal, domain_sme, product_owner])',
    ]);

    const two = evaluateReviewStage('release_review', stage, [
      makeReview(),
      makeReview({ review_id: 'demo-review-0002', role: 'product_owner', reviewer: 'carol' }),
    ]);
    expect(two.satisfied).toBe(true);
  });

  it('the same reviewer approving twice counts once toward a numeric quorum', () => {
    const stage: ReviewWorkflowStage = { roles: ['legal'], required: true, quorum: 2 };
    const result = evaluateReviewStage('license_review', stage, [
      makeReview(),
      makeReview({ review_id: 'demo-review-0002', reviewed_at: '2026-07-04T13:00:00Z' }),
    ]);
    expect(result.satisfied).toBe(false);
    expect(result.approvals).toHaveLength(1);
  });

  it('an effective rejection blocks the stage even when quorum is met', () => {
    const stage: ReviewWorkflowStage = { roles: ['legal', 'domain_sme'], required: true, quorum: 'any' };
    const result = evaluateReviewStage('license_review', stage, [
      makeReview(),
      makeReview({ review_id: 'demo-review-0002', role: 'domain_sme', reviewer: 'bob', decision: 'rejected' }),
    ]);
    expect(result.satisfied).toBe(false);
    expect(result.reasons).toContain('stage license_review: rejected by bob (domain_sme)');
  });

  it("a reviewer's latest decision supersedes an earlier one", () => {
    const rejectedThenApproved = evaluateReviewStage('license_review', base, [
      makeReview({ decision: 'rejected', reviewed_at: '2026-07-04T10:00:00Z' }),
      makeReview({ review_id: 'demo-review-0002', decision: 'approved', reviewed_at: '2026-07-04T11:00:00Z' }),
    ]);
    expect(rejectedThenApproved.satisfied).toBe(true);

    const approvedThenRejected = evaluateReviewStage('license_review', base, [
      makeReview({ decision: 'approved', reviewed_at: '2026-07-04T10:00:00Z' }),
      makeReview({ review_id: 'demo-review-0002', decision: 'rejected', reviewed_at: '2026-07-04T11:00:00Z' }),
    ]);
    expect(approvedThenRejected.satisfied).toBe(false);
  });

  it('same-timestamp decisions tie-break by review_id (later id wins)', () => {
    const result = evaluateReviewStage('license_review', base, [
      makeReview({ review_id: 'demo-review-0002', decision: 'approved' }),
      makeReview({ review_id: 'demo-review-0001', decision: 'rejected' }),
    ]);
    expect(result.satisfied).toBe(true);
  });

  it('needs_info and edited decisions never count toward quorum', () => {
    const result = evaluateReviewStage('license_review', base, [
      makeReview({ decision: 'needs_info' }),
      makeReview({ review_id: 'demo-review-0002', reviewer: 'bob', decision: 'edited' }),
    ]);
    expect(result.satisfied).toBe(false);
    expect(result.approvals).toEqual([]);
    expect(result.rejections).toEqual([]);
  });

  it('a non-required stage is always satisfied', () => {
    const stage: ReviewWorkflowStage = { roles: ['legal'], required: false, quorum: 'all' };
    const result = evaluateReviewStage('license_review', stage, []);
    expect(result.satisfied).toBe(true);
    expect(result.reasons).toEqual([]);
  });
});

describe('evaluateReviewWorkflow — aggregate verdict', () => {
  it('one review counts toward every stage listing its role', () => {
    const config = makeDomainConfig();
    // generic-style workflow: license[legal], safety[domain_sme],
    // evidence[domain_sme], release[legal, product_owner] — all quorum 1.
    const result = evaluateReviewWorkflow(config.review_workflow, [
      makeReview(),
      makeReview({ review_id: 'demo-review-0002', role: 'domain_sme', reviewer: 'bob' }),
    ]);
    expect(result.stages.map((s) => `${s.stage}:${s.satisfied}`)).toEqual([
      'license_review:true',
      'safety_review:true',
      'evidence_review:true',
      'release_review:true',
    ]);
    expect(result.satisfied).toBe(true);
  });

  it('aggregates unsatisfied required stages into blockers in stage order', () => {
    const config = makeDomainConfig();
    const result = evaluateReviewWorkflow(config.review_workflow, []);
    expect(result.satisfied).toBe(false);
    expect(result.blockers).toEqual([
      'stage license_review: 0 of 1 required approvals recorded (roles [legal])',
      'stage safety_review: 0 of 1 required approvals recorded (roles [domain_sme])',
      'stage evidence_review: 0 of 1 required approvals recorded (roles [domain_sme])',
      'stage release_review: 0 of 1 required approvals recorded (roles [legal, product_owner])',
    ]);
  });
});

describe('recordReview / listReviews / reviewsForTarget', () => {
  let root: string;
  const config = makeDomainConfig();

  beforeEach(async () => {
    root = await makeTempRoot('kf-reviews-');
  });

  afterEach(async () => {
    await removeTempRoot(root);
  });

  it('appends validated records with sequential zero-padded ids', async () => {
    const first = await recordReview(config, {
      root,
      domainId: 'demo',
      targetType: 'release',
      targetId: 'demo-p0-v0.2.0',
      role: 'legal',
      decision: 'approved',
      reviewer: 'alice',
      now: NOW,
    });
    const second = await recordReview(config, {
      root,
      domainId: 'demo',
      targetType: 'source',
      targetId: 'toy-handbook',
      role: 'domain_sme',
      decision: 'needs_info',
      reviewer: 'bob',
      note: 'citation unclear',
      now: NOW,
    });

    expect(first.review_id).toBe('demo-review-0001');
    expect(second.review_id).toBe('demo-review-0002');
    expect(reviewId('demo', 3)).toBe('demo-review-0003');

    const all = await listReviews('demo', { root });
    expect(all).toHaveLength(2);

    const releaseReviews = await reviewsForTarget('demo', 'release', 'demo-p0-v0.2.0', { root });
    expect(releaseReviews).toEqual([first]);
  });

  it('rejects a role the domain does not declare', async () => {
    await expect(
      recordReview(config, {
        root,
        domainId: 'demo',
        targetType: 'release',
        targetId: 'demo-p0-v0.2.0',
        role: 'cfo',
        decision: 'approved',
        reviewer: 'mallory',
        now: NOW,
      }),
    ).rejects.toThrow(/role "cfo" is not declared/);
    expect(await listReviews('demo', { root })).toEqual([]);
  });
});
