// Acceptance area 4 — chunk schema validation + citation gate (contract-spec
// §2 ChunkRecord, §4 citationGate). A valid chunk parses; the schema allows an
// empty citation string (pre-review) but the citation gate blocks it; empty
// text is rejected outright by the schema.

import { describe, expect, it } from 'vitest';
import { ChunkRecord, citationGate } from '@knowledge-foundry/core';
import { makeChunk } from '../helpers.js';

describe('chunk schema + citation gate', () => {
  it('parses a valid ChunkRecord', () => {
    const chunk = makeChunk();
    const parsed = ChunkRecord.parse(chunk);
    expect(parsed).toEqual(chunk);
  });

  it('parses a fully tagged ChunkRecord (optional tagging fields present)', () => {
    const parsed = ChunkRecord.parse(
      makeChunk({
        topics: ['policies'],
        entities: [{ type: 'role', value: 'Role' }],
        chunk_type: 'section',
        evidence_level: 'C',
        audience: ['internal_staff'],
        review_state: 'tagged',
      }),
    );
    expect(parsed.chunk_type).toBe('section');
    expect(parsed.evidence_level).toBe('C');
  });

  it("schema accepts citation: '' (pre-review) — the gate, not the schema, enforces it", () => {
    const parsed = ChunkRecord.parse(makeChunk({ citation: '' }));
    expect(parsed.citation).toBe('');
  });

  it('citationGate blocks a chunk with an empty citation, naming the chunk id', () => {
    const result = citationGate(makeChunk({ citation: '' }));
    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual(['chunk test-source#0000 has no citation']);
  });

  it('citationGate blocks a whitespace-only citation', () => {
    const result = citationGate(makeChunk({ citation: '   ' }));
    expect(result.allowed).toBe(false);
  });

  it('citationGate allows a chunk carrying a real citation', () => {
    const result = citationGate(makeChunk({ citation: 'https://example.com/doc#s1' }));
    expect(result).toEqual({ allowed: true, reasons: [] });
  });

  it('schema rejects a chunk with empty text', () => {
    expect(() => ChunkRecord.parse(makeChunk({ text: '' }))).toThrow();
  });

  it('schema rejects a chunk missing required license fields', () => {
    const { license_class: _lc, ...rest } = makeChunk();
    expect(() => ChunkRecord.parse(rest)).toThrow();
  });

  it('schema rejects unknown extra fields (strict contract)', () => {
    expect(() =>
      ChunkRecord.parse({ ...makeChunk(), embedding: [0.1, 0.2] } as unknown),
    ).toThrow();
  });
});
