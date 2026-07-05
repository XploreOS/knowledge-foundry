// Acceptance area 9 — CLI failure path: ingesting a Red-classified source must
// be refused by the pre-ingest gate with a non-zero exit, an unmistakable
// "BLOCKED" banner, and NO raw artefact written to disk.

import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  FIXTURES_DIR,
  makeTempRoot,
  pathExists,
  removeTempRoot,
  runKf,
} from '../helpers.js';

const FIXTURE_MD = path.join(FIXTURES_DIR, 'toy-handbook.md');

describe('CLI failure path: Red source ingestion', () => {
  let root: string;

  beforeAll(async () => {
    root = await makeTempRoot('kf-red-');
    for (const args of [
      ['init-domain', 'demo'],
      [
        'create-source',
        '--domain', 'demo',
        '--source-id', 'forbidden-src',
        '--title', 'Proprietary Textbook',
        '--publisher', 'Closed Press',
        '--source-type', 'webpage',
        '--likely-license', 'Red',
      ],
      ['classify-license', '--domain', 'demo', '--source-id', 'forbidden-src', '--class', 'Red'],
    ]) {
      const result = await runKf(root, args);
      expect(result.code, `setup step failed: kf ${args.join(' ')}\n${result.output}`).toBe(0);
    }
  });

  afterAll(async () => {
    await removeTempRoot(root);
  });

  it('classify-license --class Red terminally rejects the source', async () => {
    const result = await runKf(root, [
      'classify-license', '--domain', 'demo', '--source-id', 'forbidden-src', '--class', 'Red',
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('license_class: Red');
    expect(result.stdout).toContain('review_state: rejected');
  });

  it('ingest exits non-zero and prints BLOCKED naming the Red source', async () => {
    const result = await runKf(root, [
      'ingest', '--domain', 'demo', '--source-id', 'forbidden-src', '--file', FIXTURE_MD,
    ]);

    expect(result.code).not.toBe(0);
    expect(result.output).toContain('BLOCKED');
    expect(result.output).toContain('forbidden-src');
    expect(result.output).toMatch(/Red/);
  });

  it('a blocked ingest writes NO raw artefact', async () => {
    expect(await pathExists(path.join(root, 'data', 'raw', 'forbidden-src'))).toBe(false);
  });
});
