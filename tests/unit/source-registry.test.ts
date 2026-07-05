// Acceptance area 2 — source registry validation (contract-spec §2
// SourceRecord, §5 storage). createSource/getSource/updateSource must
// round-trip validated records through data/source_registry/<domain>/sources.jsonl
// and reject invalid records at the boundary.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createSource,
  getSource,
  listSources,
  updateSource,
} from '@knowledge-foundry/core';
import type { SourceRecord } from '@knowledge-foundry/core';
import { makeSource, makeTempRoot, removeTempRoot } from '../helpers.js';

describe('source registry', () => {
  let root: string;

  beforeEach(async () => {
    root = await makeTempRoot();
  });

  afterEach(async () => {
    await removeTempRoot(root);
  });

  it('round-trips a source record: createSource then getSource returns the same record', async () => {
    const record = makeSource();
    const saved = await createSource(record, { root });
    expect(saved).toEqual(record);

    const fetched = await getSource('demo', 'test-source', { root });
    expect(fetched).toEqual(record);
  });

  it('getSource returns undefined for an unknown source id', async () => {
    await createSource(makeSource(), { root });
    expect(await getSource('demo', 'does-not-exist', { root })).toBeUndefined();
  });

  it('listSources returns an empty array for a domain with no registry yet', async () => {
    expect(await listSources('empty-domain', { root })).toEqual([]);
  });

  it('createSource upserts by source_id instead of duplicating', async () => {
    await createSource(makeSource({ title: 'First Title' }), { root });
    await createSource(makeSource({ title: 'Second Title' }), { root });

    const all = await listSources('demo', { root });
    expect(all).toHaveLength(1);
    expect(all[0]?.title).toBe('Second Title');
  });

  it('updateSource merges a patch, bumps updated_at, and persists', async () => {
    await createSource(makeSource(), { root });

    const updated = await updateSource(
      'demo',
      'test-source',
      { review_state: 'approved_for_ingestion', approval_status: 'approved_for_ingestion' },
      { root, now: '2026-07-04T13:00:00Z' },
    );
    expect(updated.review_state).toBe('approved_for_ingestion');
    expect(updated.approval_status).toBe('approved_for_ingestion');
    expect(updated.updated_at).toBe('2026-07-04T13:00:00Z');

    const persisted = await getSource('demo', 'test-source', { root });
    expect(persisted).toEqual(updated);
  });

  it('updateSource throws when the source does not exist', async () => {
    await expect(
      updateSource('demo', 'ghost-source', { notes: 'x' }, { root }),
    ).rejects.toThrow(/ghost-source not found in domain demo/);
  });

  it('createSource rejects a record with an invalid review_state', async () => {
    const invalid = { ...makeSource(), review_state: 'totally-bogus' } as unknown as SourceRecord;
    await expect(createSource(invalid, { root })).rejects.toThrow();
  });

  it('createSource rejects a record with a malformed checksum', async () => {
    const invalid = makeSource({ checksum_sha256: 'NOT-A-SHA' as SourceRecord['checksum_sha256'] });
    await expect(createSource(invalid, { root })).rejects.toThrow(/sha256/);
  });
});
