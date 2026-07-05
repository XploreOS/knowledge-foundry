// Acceptance area 6 — pre-ingest gate (contract-spec §4). The gate decides
// whether a source may be fetched/stored AT ALL: Green allowed, Red blocked,
// Yellow blocked until a human records approval, Unknown/unclassified blocked.

import { describe, expect, it } from 'vitest';
import { preIngestGate } from '@knowledge-foundry/core';
import { makeSource } from '../helpers.js';

describe('preIngestGate', () => {
  it('allows a Green source', () => {
    const result = preIngestGate(makeSource({ license_class: 'Green' }));
    expect(result).toEqual({ allowed: true, reasons: [] });
  });

  it('blocks a Red source — ingestion prohibited', () => {
    const result = preIngestGate(
      makeSource({ source_id: 'red-src', license_class: 'Red' }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons.some((r) => r.includes('red-src') && r.includes('Red'))).toBe(true);
  });

  it('blocks a Yellow source without approval_status=approved_for_ingestion', () => {
    const result = preIngestGate(
      makeSource({ source_id: 'yellow-src', license_class: 'Yellow', approval_status: null }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons.some((r) => r.includes('yellow-src'))).toBe(true);
    expect(result.reasons.some((r) => r.includes('approved_for_ingestion'))).toBe(true);
  });

  it('allows a Yellow source once a human has approved it for ingestion', () => {
    const result = preIngestGate(
      makeSource({ license_class: 'Yellow', approval_status: 'approved_for_ingestion' }),
    );
    expect(result).toEqual({ allowed: true, reasons: [] });
  });

  it('blocks an Unknown source — must be classified first', () => {
    const result = preIngestGate(makeSource({ license_class: 'Unknown' }));
    expect(result.allowed).toBe(false);
    expect(result.reasons.some((r) => r.includes('classify first'))).toBe(true);
  });

  it('blocks an unclassified source (no license_class at all)', () => {
    const result = preIngestGate(makeSource()); // license_class undefined
    expect(result.allowed).toBe(false);
    expect(result.reasons.some((r) => r.includes('classify first'))).toBe(true);
  });

  it('blocks an Orange source without approval, allows it with approval', () => {
    expect(preIngestGate(makeSource({ license_class: 'Orange' })).allowed).toBe(false);
    expect(
      preIngestGate(
        makeSource({ license_class: 'Orange', approval_status: 'approved_for_ingestion' }),
      ).allowed,
    ).toBe(true);
  });
});
