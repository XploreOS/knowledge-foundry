// Acceptance areas 7 + 10(unit) — pre-release gate (contract-spec §4).
// Each of the six blockers must trigger individually, every blocker string
// must name the offending id, and a fully clean corpus must pass. The
// missing-citation case doubles as the unit half of acceptance area 10.

import { describe, expect, it } from 'vitest';
import { emptyAllowedUses, preReleaseGate } from '@knowledge-foundry/core';
import type { AllowedUses } from '@knowledge-foundry/core';
import { makeChunk, makeRisk, makeSource } from '../helpers.js';

const RELEASE_USES: Partial<AllowedUses> = { internal_search: true, rag: true };

/** A source that passes every release check for intended use 'rag'. */
function cleanSource(overrides = {}) {
  return makeSource({
    review_state: 'tagged',
    license_class: 'Green',
    allowed_uses: { ...emptyAllowedUses(), ...RELEASE_USES },
    ...overrides,
  });
}

describe('preReleaseGate', () => {
  it('passes a clean release (Green source, cited chunks, no risks)', () => {
    const result = preReleaseGate({
      sources: [cleanSource()],
      chunks: [makeChunk()],
      risks: [],
      intendedUse: 'rag',
    });
    expect(result).toEqual({ allowed: true, blockers: [] });
  });

  it('blocker 1: any Red member source blocks, naming the source id', () => {
    const result = preReleaseGate({
      sources: [cleanSource(), cleanSource({ source_id: 'red-src', license_class: 'Red' })],
      chunks: [makeChunk()],
      risks: [],
      intendedUse: 'rag',
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain('source red-src is license class Red');
  });

  it('blocker 2: a Yellow member source lacking approval blocks, naming the source id', () => {
    const result = preReleaseGate({
      sources: [
        cleanSource({
          source_id: 'yellow-src',
          license_class: 'Yellow',
          approval_status: null,
        }),
      ],
      chunks: [makeChunk()],
      risks: [],
      intendedUse: 'rag',
    });
    expect(result.allowed).toBe(false);
    expect(
      result.blockers.some(
        (b) => b.includes('yellow-src') && b.includes('approval_status=approved_for_ingestion'),
      ),
    ).toBe(true);
  });

  it('blocker 2 counterpart: an APPROVED Yellow source does not trigger the approval blocker', () => {
    const result = preReleaseGate({
      sources: [
        cleanSource({
          source_id: 'yellow-src',
          license_class: 'Yellow',
          approval_status: 'approved_for_ingestion',
        }),
      ],
      chunks: [makeChunk()],
      risks: [],
      intendedUse: 'rag',
    });
    expect(result).toEqual({ allowed: true, blockers: [] });
  });

  it('blocker 3: an unresolved high-severity risk blocks, naming the risk id', () => {
    const result = preReleaseGate({
      sources: [cleanSource()],
      chunks: [makeChunk()],
      risks: [makeRisk({ risk_id: 'test-source-risk-9', resolved: false, severity: 'high' })],
      intendedUse: 'rag',
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers.some((b) => b.includes('test-source-risk-9'))).toBe(true);
  });

  it('blocker 3 counterparts: resolved-high and unresolved-low risks do NOT block', () => {
    const result = preReleaseGate({
      sources: [cleanSource()],
      chunks: [makeChunk()],
      risks: [
        makeRisk({ risk_id: 'test-source-risk-1', resolved: true, severity: 'high' }),
        makeRisk({ risk_id: 'test-source-risk-2', resolved: false, severity: 'low' }),
      ],
      intendedUse: 'rag',
    });
    expect(result).toEqual({ allowed: true, blockers: [] });
  });

  it('blocker 4: a chunk with an empty citation blocks, naming the chunk id', () => {
    const result = preReleaseGate({
      sources: [cleanSource()],
      chunks: [
        makeChunk(),
        makeChunk({ chunk_id: 'test-source#0001', citation: '' }),
      ],
      risks: [],
      intendedUse: 'rag',
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain('chunk test-source#0001 has no citation');
  });

  it('blocker 5: an intended use not permitted by every member source blocks', () => {
    const result = preReleaseGate({
      sources: [
        cleanSource({
          source_id: 'search-only-src',
          allowed_uses: { ...emptyAllowedUses(), internal_search: true }, // no rag
        }),
      ],
      chunks: [makeChunk()],
      risks: [],
      intendedUse: 'rag',
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain(
      "source search-only-src does not permit intended use 'rag'",
    );
  });

  it('blocker 6: fine_tuning intended but a member source lacks training rights', () => {
    const result = preReleaseGate({
      sources: [
        cleanSource(), // grants rag but fine_tuning=false
      ],
      chunks: [makeChunk()],
      risks: [],
      intendedUse: ['rag', 'fine_tuning'],
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain(
      'fine_tuning requested but source test-source lacks fine_tuning rights',
    );
  });

  it('blocker 6 counterpart: fine_tuning passes when every source grants training rights', () => {
    const result = preReleaseGate({
      sources: [
        cleanSource({
          allowed_uses: { ...emptyAllowedUses(), ...RELEASE_USES, fine_tuning: true },
        }),
      ],
      chunks: [makeChunk()],
      risks: [],
      intendedUse: ['rag', 'fine_tuning'],
    });
    expect(result).toEqual({ allowed: true, blockers: [] });
  });

  it('reports every violated blocker at once (aggregated, deduplicated)', () => {
    const result = preReleaseGate({
      sources: [
        cleanSource({ source_id: 'red-src', license_class: 'Red', allowed_uses: emptyAllowedUses() }),
      ],
      chunks: [makeChunk({ chunk_id: 'red-src#0000', source_id: 'red-src', citation: '' })],
      risks: [makeRisk({ risk_id: 'red-src-risk-1', source_id: 'red-src' })],
      intendedUse: 'rag',
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain('source red-src is license class Red');
    expect(result.blockers.some((b) => b.includes('red-src-risk-1'))).toBe(true);
    expect(result.blockers).toContain('chunk red-src#0000 has no citation');
    expect(result.blockers).toContain("source red-src does not permit intended use 'rag'");
    // No duplicated blocker strings.
    expect(new Set(result.blockers).size).toBe(result.blockers.length);
  });
});
