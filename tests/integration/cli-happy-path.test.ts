// Acceptance area 8 — CLI happy path (contract-spec §6). Drives the full toy
// pipeline through the real kf binary in an isolated mkdtemp workspace:
// init-domain -> validate-domain -> create-source -> classify-license ->
// ingest -> normalize -> chunk -> tag -> extract-claims -> screen-risk ->
// detect-conflicts -> build-release -> validate-release -> eval-rag.
// Every step must exit 0 and the key artefacts must exist on disk.

import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  FIXTURES_DIR,
  makeTempRoot,
  pathExists,
  readJsonlFile,
  removeTempRoot,
  runKf,
} from '../helpers.js';

const RELEASE_ID = 'demo-p0-v0.1.0';
const FIXTURE_MD = path.join(FIXTURES_DIR, 'toy-handbook.md');

describe('CLI happy path (full toy pipeline)', () => {
  let root: string;

  beforeAll(async () => {
    root = await makeTempRoot('kf-happy-');
  });

  afterAll(async () => {
    await removeTempRoot(root);
  });

  // The pipeline is stateful: each step builds on the previous one, so the
  // steps run inside one sequential test to keep ordering explicit.
  it('runs every pipeline command with exit code 0', async () => {
    const steps: string[][] = [
      ['init-domain', 'demo'],
      ['validate-domain', 'demo'],
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
      ['extract-claims', '--domain', 'demo', '--source-id', 'toy-handbook'],
      ['screen-risk', '--domain', 'demo', '--source-id', 'toy-handbook'],
      ['detect-conflicts', '--domain', 'demo'],
      ['build-release', '--domain', 'demo', '--release-id', RELEASE_ID],
      ['validate-release', '--domain', 'demo', '--release-id', RELEASE_ID],
      ['eval-rag', '--domain', 'demo', '--release-id', RELEASE_ID],
    ];

    for (const args of steps) {
      const result = await runKf(root, args);
      expect(
        result.code,
        `kf ${args.join(' ')} failed (exit ${result.code}):\n${result.output}`,
      ).toBe(0);
    }
  }, 120_000);

  it('produced chunks.jsonl with cited, tagged chunks', async () => {
    const chunksPath = path.join(root, 'data', 'chunks', 'toy-handbook', 'chunks.jsonl');
    expect(await pathExists(chunksPath)).toBe(true);

    const chunks = await readJsonlFile<{
      chunk_id: string;
      citation: string;
      license_class: string;
      review_state: string;
    }>(chunksPath);
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.citation.trim()).not.toBe('');
      expect(chunk.license_class).toBe('Green');
      expect(chunk.review_state).toBe('tagged');
    }
  });

  it('produced a draft release manifest with an approved chunk set', async () => {
    const manifestPath = path.join(root, 'releases', 'demo', RELEASE_ID, 'manifest.json');
    expect(await pathExists(manifestPath)).toBe(true);

    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    expect(manifest.state).toBe('draft');
    expect(manifest.release_id).toBe(RELEASE_ID);
    expect(manifest.blockers).toEqual([]);
    expect(manifest.source_count).toBe(1);
    expect(manifest.chunk_count).toBeGreaterThan(0);
    expect(manifest.license_class_counts).toEqual({
      Green: 1,
      Yellow: 0,
      Orange: 0,
      Red: 0,
      Unknown: 0,
    });

    expect(
      await pathExists(path.join(root, 'releases', 'demo', RELEASE_ID, 'approved_chunks.jsonl')),
    ).toBe(true);
  });

  it('produced evals results.json and folded the evaluation into the manifest', async () => {
    const resultsPath = path.join(root, 'evals', RELEASE_ID, 'results.json');
    expect(await pathExists(resultsPath)).toBe(true);

    const results = JSON.parse(await fs.readFile(resultsPath, 'utf8'));
    expect(results.release_id).toBe(RELEASE_ID);
    expect(results.question_count).toBeGreaterThan(0);
    expect(results.citation_coverage).toBeGreaterThanOrEqual(0);
    expect(results.citation_coverage).toBeLessThanOrEqual(1);
    expect(results.license_errors).toBe(0);
    expect(Array.isArray(results.per_question)).toBe(true);
    expect(results.per_question).toHaveLength(results.question_count);

    const manifest = JSON.parse(
      await fs.readFile(path.join(root, 'releases', 'demo', RELEASE_ID, 'manifest.json'), 'utf8'),
    );
    expect(manifest.evaluation?.release_id).toBe(RELEASE_ID);
  });
});
