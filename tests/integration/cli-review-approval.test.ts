// v0.2 review workflow enforcement — end-to-end through the real kf binary:
// a draft release cannot become `approved` until eval-rag has run AND every
// required review_workflow.yaml stage has its recorded sign-off quorum.

import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FIXTURES_DIR, makeTempRoot, pathExists, removeTempRoot, runKf } from '../helpers.js';

const RELEASE_ID = 'demo-p0-v0.2.0';
const REJECTED_RELEASE_ID = 'demo-p0-v0.2.1';
const FIXTURE_MD = path.join(FIXTURES_DIR, 'toy-handbook.md');

async function manifestState(root: string, releaseId: string): Promise<string> {
  const manifest = JSON.parse(
    await fs.readFile(path.join(root, 'releases', 'demo', releaseId, 'manifest.json'), 'utf8'),
  );
  return manifest.state as string;
}

describe('CLI review workflow enforcement (kf review / review-status / approve-release)', () => {
  let root: string;

  beforeAll(async () => {
    root = await makeTempRoot('kf-review-');
    // Drive the toy pipeline to a clean draft release.
    const steps: string[][] = [
      ['init-domain', 'demo'],
      [
        'create-source',
        '--domain', 'demo',
        '--source-id', 'toy-handbook',
        '--title', 'Company Operations Handbook',
        '--publisher', 'ACME Corp',
        '--source-type', 'guideline',
        '--likely-license', 'Green',
      ],
      ['classify-license', '--domain', 'demo', '--source-id', 'toy-handbook', '--class', 'Green'],
      ['ingest', '--domain', 'demo', '--source-id', 'toy-handbook', '--file', FIXTURE_MD],
      ['normalize', '--domain', 'demo', '--source-id', 'toy-handbook'],
      ['chunk', '--domain', 'demo', '--source-id', 'toy-handbook'],
      ['tag', '--domain', 'demo', '--source-id', 'toy-handbook'],
      ['screen-risk', '--domain', 'demo', '--source-id', 'toy-handbook'],
      ['build-release', '--domain', 'demo', '--release-id', RELEASE_ID],
    ];
    for (const args of steps) {
      const result = await runKf(root, args);
      if (result.code !== 0) {
        throw new Error(`setup step kf ${args.join(' ')} failed:\n${result.output}`);
      }
    }
  }, 120_000);

  afterAll(async () => {
    await removeTempRoot(root);
  });

  it('blocks approval of a draft with no evaluation and no sign-offs', async () => {
    const result = await runKf(root, [
      'approve-release', '--domain', 'demo', '--release-id', RELEASE_ID,
    ]);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain('RELEASE APPROVAL BLOCKED');
    expect(result.output).toContain('no EvaluationResult attached');
    expect(result.output).toContain('stage license_review: 0 of 1 required approvals recorded');
    expect(await manifestState(root, RELEASE_ID)).toBe('draft');
  });

  it('rejects a review from a role the domain does not declare', async () => {
    const result = await runKf(root, [
      'review',
      '--domain', 'demo',
      '--target-type', 'release',
      '--target-id', RELEASE_ID,
      '--role', 'cfo',
      '--decision', 'approved',
      '--reviewer', 'mallory',
    ]);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain('role "cfo" is not declared');
  });

  it('rejects a review of a release that does not exist', async () => {
    const result = await runKf(root, [
      'review',
      '--domain', 'demo',
      '--target-type', 'release',
      '--target-id', 'demo-p0-v9.9.9',
      '--role', 'legal',
      '--decision', 'approved',
      '--reviewer', 'alice',
    ]);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain('not found');
  });

  it('still blocks approval after evaluation + a partial set of sign-offs', async () => {
    const evalResult = await runKf(root, ['eval-rag', '--domain', 'demo', '--release-id', RELEASE_ID]);
    expect(evalResult.code, evalResult.output).toBe(0);

    const review = await runKf(root, [
      'review',
      '--domain', 'demo',
      '--target-type', 'release',
      '--target-id', RELEASE_ID,
      '--role', 'legal',
      '--decision', 'approved',
      '--reviewer', 'alice',
      '--note', 'license posture verified',
    ]);
    expect(review.code, review.output).toBe(0);
    expect(review.stdout).toContain('recorded review "demo-review-0001"');
    // legal satisfies license_review and release_review (quorum 1)...
    expect(review.stdout).toContain('stage license_review: satisfied');
    expect(review.stdout).toContain('stage release_review: satisfied');
    // ...but not the domain_sme stages.
    expect(review.stdout).toContain('all_required_stages_satisfied: false');

    const statusResult = await runKf(root, [
      'review-status', '--domain', 'demo', '--target-type', 'release', '--target-id', RELEASE_ID,
    ]);
    expect(statusResult.code).not.toBe(0);
    expect(statusResult.output).toContain('stage safety_review: 0 of 1 required approvals recorded');

    const approve = await runKf(root, [
      'approve-release', '--domain', 'demo', '--release-id', RELEASE_ID,
    ]);
    expect(approve.code).not.toBe(0);
    expect(approve.output).toContain('stage safety_review');
    expect(approve.output).not.toContain('no EvaluationResult attached');
    expect(await manifestState(root, RELEASE_ID)).toBe('draft');
  }, 60_000);

  it('approves once every required stage has its recorded quorum', async () => {
    const review = await runKf(root, [
      'review',
      '--domain', 'demo',
      '--target-type', 'release',
      '--target-id', RELEASE_ID,
      '--role', 'domain_sme',
      '--decision', 'approved',
      '--reviewer', 'bob',
    ]);
    expect(review.code, review.output).toBe(0);
    expect(review.stdout).toContain('all_required_stages_satisfied: true');

    const statusResult = await runKf(root, [
      'review-status', '--domain', 'demo', '--target-type', 'release', '--target-id', RELEASE_ID,
    ]);
    expect(statusResult.code, statusResult.output).toBe(0);

    const approve = await runKf(root, [
      'approve-release', '--domain', 'demo', '--release-id', RELEASE_ID,
    ]);
    expect(approve.code, approve.output).toBe(0);
    expect(approve.stdout).toContain(`approved release "${RELEASE_ID}"`);
    expect(approve.stdout).toContain('state: approved');
    expect(await manifestState(root, RELEASE_ID)).toBe('approved');

    // reviews.jsonl is the audit trail.
    expect(await pathExists(path.join(root, 'data', 'reviews', 'demo', 'reviews.jsonl'))).toBe(true);
  }, 60_000);

  it('refuses to re-approve an already-approved (immutable) release', async () => {
    const result = await runKf(root, [
      'approve-release', '--domain', 'demo', '--release-id', RELEASE_ID,
    ]);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain('already approved');
    expect(await manifestState(root, RELEASE_ID)).toBe('approved');
  });

  it('a recorded rejection blocks approval even when quorum is otherwise met', async () => {
    const setup: string[][] = [
      ['build-release', '--domain', 'demo', '--release-id', REJECTED_RELEASE_ID],
      ['eval-rag', '--domain', 'demo', '--release-id', REJECTED_RELEASE_ID],
      [
        'review',
        '--domain', 'demo', '--target-type', 'release', '--target-id', REJECTED_RELEASE_ID,
        '--role', 'legal', '--decision', 'approved', '--reviewer', 'alice',
      ],
      [
        'review',
        '--domain', 'demo', '--target-type', 'release', '--target-id', REJECTED_RELEASE_ID,
        '--role', 'domain_sme', '--decision', 'rejected', '--reviewer', 'bob',
        '--note', 'section 3 misquotes the travel policy',
      ],
    ];
    for (const args of setup) {
      const result = await runKf(root, args);
      expect(result.code, `kf ${args.join(' ')}:\n${result.output}`).toBe(0);
    }

    const approve = await runKf(root, [
      'approve-release', '--domain', 'demo', '--release-id', REJECTED_RELEASE_ID,
    ]);
    expect(approve.code).not.toBe(0);
    expect(approve.output).toContain('rejected by bob (domain_sme)');
    expect(await manifestState(root, REJECTED_RELEASE_ID)).toBe('draft');
  }, 60_000);
});
