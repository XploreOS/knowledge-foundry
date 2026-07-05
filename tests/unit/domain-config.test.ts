// Acceptance area 1 — domain config validation (contract-spec §3).
// The seven-YAML DomainConfig loader must accept the shipped
// domains/functional-medicine config, reject a taxonomy using the old
// string-based entity_types shape (naming the offending path), and produce a
// clear error for a domain with missing files.

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadDomainConfig, validateDomain } from '@knowledge-foundry/core';
import { FIXTURES_DIR, REPO_ROOT, makeTempRoot, removeTempRoot } from '../helpers.js';

describe('domain config validation', () => {
  it('loads the shipped functional-medicine domain as valid', async () => {
    const config = await loadDomainConfig('functional-medicine', { root: REPO_ROOT });

    expect(config.domain.domain_id).toBe('functional-medicine');
    // All seven sections must be present and structurally valid.
    expect(config.taxonomy.entity_types.length).toBeGreaterThan(0);
    expect(config.taxonomy.entity_types[0]).toHaveProperty('id');
    expect(config.taxonomy.entity_types[0]).toHaveProperty('name');
    expect(Object.keys(config.source_policy.license_classes).sort()).toEqual([
      'Green',
      'Orange',
      'Red',
      'Yellow',
    ]);
    expect(Object.keys(config.evidence_model.evidence_levels).length).toBeGreaterThan(0);
    expect(config.eval_questions.questions.length).toBeGreaterThan(0);

    const verdict = await validateDomain('functional-medicine', { root: REPO_ROOT });
    expect(verdict).toEqual({ valid: true, issues: [] });
  });

  describe('broken taxonomy (old string-based entity_types shape)', () => {
    let root: string;

    beforeEach(async () => {
      root = await makeTempRoot();
      await fs.cp(
        path.join(FIXTURES_DIR, 'broken-domain'),
        path.join(root, 'domains', 'broken-taxonomy'),
        { recursive: true },
      );
    });

    afterEach(async () => {
      await removeTempRoot(root);
    });

    it('validateDomain rejects it, listing the offending taxonomy.entity_types path', async () => {
      const verdict = await validateDomain('broken-taxonomy', { root });

      expect(verdict.valid).toBe(false);
      expect(verdict.issues.length).toBeGreaterThan(0);
      // Every string entity_type must be reported at its path.
      expect(verdict.issues.some((i) => i.includes('taxonomy.entity_types'))).toBe(true);
    });

    it('loadDomainConfig throws with the offending path in the message', async () => {
      await expect(loadDomainConfig('broken-taxonomy', { root })).rejects.toThrow(
        /taxonomy\.entity_types/,
      );
    });
  });

  it('reports a clear error naming each missing file for an uninitialised domain', async () => {
    const root = await makeTempRoot();
    try {
      const verdict = await validateDomain('no-such-domain', { root });
      expect(verdict.valid).toBe(false);
      expect(verdict.issues).toContain('missing domain.yaml for domain no-such-domain');
      expect(verdict.issues).toContain('missing taxonomy.yaml for domain no-such-domain');
      expect(verdict.issues).toHaveLength(7); // all seven files reported missing

      await expect(loadDomainConfig('no-such-domain', { root })).rejects.toThrow(
        /missing domain\.yaml for domain no-such-domain/,
      );
    } finally {
      await removeTempRoot(root);
    }
  });
});
