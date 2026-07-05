// Acceptance area 5 — release manifest validation (contract-spec §2
// ReleaseManifest). A manifest built by buildRelease must round-trip through
// the ReleaseManifest schema, carry a complete license_class_counts map (all
// five classes), and record per-gate results + member-file checksums.

import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ReleaseManifest,
  buildRelease,
  createSource,
  emptyAllowedUses,
  releaseChunksFile,
  releaseManifestFile,
} from '@knowledge-foundry/core';
import {
  makeChunk,
  makeSource,
  makeTempRoot,
  pathExists,
  removeTempRoot,
  writeJsonlFile,
} from '../helpers.js';

describe('release manifest', () => {
  let root: string;

  beforeEach(async () => {
    root = await makeTempRoot();
    // One advanced (tagged) Green source with a cited, tagged chunk.
    await createSource(
      makeSource({
        review_state: 'tagged',
        license_class: 'Green',
        allowed_uses: { ...emptyAllowedUses(), internal_search: true, rag: true },
      }),
      { root },
    );
    await writeJsonlFile(path.join(root, 'data', 'chunks', 'test-source', 'chunks.jsonl'), [
      makeChunk({ review_state: 'tagged', evidence_level: 'C' }),
    ]);
  });

  afterEach(async () => {
    await removeTempRoot(root);
  });

  it('buildRelease produces a manifest that parses with the ReleaseManifest schema', async () => {
    const { blocked, manifest } = await buildRelease({
      root,
      domainId: 'demo',
      releaseId: 'demo-p0-v0.1.0',
      intendedUse: 'rag',
      now: '2026-07-04T12:00:00Z',
    });

    expect(blocked).toBe(false);
    // Round-trip through the schema — both in memory and as written to disk.
    expect(() => ReleaseManifest.parse(manifest)).not.toThrow();
    const onDisk = JSON.parse(
      await fs.readFile(releaseManifestFile(root, 'demo', 'demo-p0-v0.1.0'), 'utf8'),
    );
    const parsed = ReleaseManifest.parse(onDisk);

    expect(parsed.release_id).toBe('demo-p0-v0.1.0');
    expect(parsed.domain_id).toBe('demo');
    expect(parsed.state).toBe('draft');
    expect(parsed.blockers).toEqual([]);
    expect(parsed.source_count).toBe(1);
    expect(parsed.chunk_count).toBe(1);
    expect(parsed.sources).toEqual([{ source_id: 'test-source', license_class: 'Green' }]);
    expect(parsed.evidence_summary).toEqual({ C: 1 });
    // Six named gate results, all passing.
    expect(parsed.gate_results).toHaveLength(6);
    expect(parsed.gate_results.every((g) => g.passed)).toBe(true);
    // Member file with a real sha256 checksum.
    expect(parsed.member_files).toHaveLength(1);
    expect(parsed.member_files[0]?.path).toBe('approved_chunks.jsonl');
    expect(parsed.member_files[0]?.checksum_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(await pathExists(releaseChunksFile(root, 'demo', 'demo-p0-v0.1.0'))).toBe(true);
  });

  it('license_class_counts keys are complete (all five license classes)', async () => {
    const { manifest } = await buildRelease({
      root,
      domainId: 'demo',
      releaseId: 'demo-p0-v0.1.0',
      intendedUse: 'rag',
    });

    expect(Object.keys(manifest.license_class_counts).sort()).toEqual([
      'Green',
      'Orange',
      'Red',
      'Unknown',
      'Yellow',
    ]);
    expect(manifest.license_class_counts).toEqual({
      Green: 1,
      Yellow: 0,
      Orange: 0,
      Red: 0,
      Unknown: 0,
    });
  });

  it('a blocked release writes a schema-valid manifest with state blocked and no chunk set', async () => {
    // intended use the source does not permit -> gate blocks.
    const { blocked, manifest } = await buildRelease({
      root,
      domainId: 'demo',
      releaseId: 'demo-p0-v0.2.0',
      intendedUse: 'customer_facing',
    });

    expect(blocked).toBe(true);
    const parsed = ReleaseManifest.parse(manifest);
    expect(parsed.state).toBe('blocked');
    expect(parsed.blockers.length).toBeGreaterThan(0);
    expect(parsed.member_files).toEqual([]);
    expect(await pathExists(releaseChunksFile(root, 'demo', 'demo-p0-v0.2.0'))).toBe(false);
  });

  it('schema rejects a manifest with incomplete license_class_counts', () => {
    const good = {
      release_id: 'demo-p0-v0.1.0',
      domain_id: 'demo',
      state: 'draft',
      created_at: '2026-07-04T12:00:00Z',
      updated_at: '2026-07-04T12:00:00Z',
      intended_use: 'rag',
      source_count: 0,
      sources: [],
      license_class_counts: { Green: 0, Yellow: 0, Orange: 0, Red: 0, Unknown: 0 },
      evidence_summary: {},
      chunk_count: 0,
      gate_results: [],
      blockers: [],
      member_files: [],
    };
    expect(() => ReleaseManifest.parse(good)).not.toThrow();

    const { Unknown: _u, ...incomplete } = good.license_class_counts;
    expect(() =>
      ReleaseManifest.parse({ ...good, license_class_counts: incomplete }),
    ).toThrow();
  });
});
