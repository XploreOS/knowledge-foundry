// Acceptance area 10 (integration half) — a chunk with an empty citation must
// block release assembly. The workspace is crafted directly: a Green source
// advanced to 'tagged' plus a chunks.jsonl containing one uncited chunk (the
// ChunkRecord schema allows citation: "" pre-review — the GATE is the
// enforcement point). `kf build-release` must exit non-zero, print the
// citation blocker, and write a blocked manifest with no approved chunk set.

import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  makeTempRoot,
  pathExists,
  readJsonlFile,
  removeTempRoot,
  runKf,
  writeJsonlFile,
} from '../helpers.js';

const RELEASE_ID = 'demo-p0-v0.1.0';

describe('CLI failure path: missing citations block the release', () => {
  let root: string;

  beforeAll(async () => {
    root = await makeTempRoot('kf-cite-');

    // Real CLI setup: domain + Green source (auto-approved for ingestion).
    for (const args of [
      ['init-domain', 'demo'],
      [
        'create-source',
        '--domain', 'demo',
        '--source-id', 'uncited-src',
        '--title', 'Uncited Notes',
        '--publisher', 'ACME Corp',
        '--source-type', 'guideline',
        '--likely-license', 'Green',
      ],
      ['classify-license', '--domain', 'demo', '--source-id', 'uncited-src', '--class', 'Green'],
    ]) {
      const result = await runKf(root, args);
      expect(result.code, `setup step failed: kf ${args.join(' ')}\n${result.output}`).toBe(0);
    }

    // Craft the corpus state directly: advance the source to 'tagged' so it is
    // release-eligible, and write a chunks.jsonl whose only chunk has an empty
    // citation.
    const registryPath = path.join(root, 'data', 'source_registry', 'demo', 'sources.jsonl');
    const sources = await readJsonlFile<Record<string, unknown>>(registryPath);
    await writeJsonlFile(
      registryPath,
      sources.map((s) =>
        s.source_id === 'uncited-src' ? { ...s, review_state: 'tagged' } : s,
      ),
    );

    await writeJsonlFile(path.join(root, 'data', 'chunks', 'uncited-src', 'chunks.jsonl'), [
      {
        chunk_id: 'uncited-src#0000',
        source_id: 'uncited-src',
        section_path: 'Notes',
        text: 'An orphaned statement with no citation attached.',
        citation: '',
        license_class: 'Green',
        allowed_uses: {
          internal_search: true,
          rag: true,
          extraction: true,
          summarization: true,
          fine_tuning: false,
          customer_facing: false,
          commercial_distribution: false,
        },
        review_state: 'tagged',
        created_at: '2026-07-04T12:00:00Z',
      },
    ]);
  });

  afterAll(async () => {
    await removeTempRoot(root);
  });

  it('build-release exits non-zero and names the citation blocker', async () => {
    const result = await runKf(root, [
      'build-release', '--domain', 'demo', '--release-id', RELEASE_ID,
    ]);

    expect(result.code).not.toBe(0);
    expect(result.output.toLowerCase()).toContain('citation');
    expect(result.output).toContain('uncited-src#0000');
    expect(result.output).toContain('RELEASE BLOCKED');
  });

  it('writes a blocked manifest recording the citation blocker, and no approved chunk set', async () => {
    const manifestPath = path.join(root, 'releases', 'demo', RELEASE_ID, 'manifest.json');
    expect(await pathExists(manifestPath)).toBe(true);

    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    expect(manifest.state).toBe('blocked');
    expect(manifest.blockers).toContain('chunk uncited-src#0000 has no citation');
    const citationCheck = manifest.gate_results.find(
      (g: { gate: string }) => g.gate === 'chunk_citation',
    );
    expect(citationCheck?.passed).toBe(false);

    expect(
      await pathExists(path.join(root, 'releases', 'demo', RELEASE_ID, 'approved_chunks.jsonl')),
    ).toBe(false);
  });
});
