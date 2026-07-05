// Acceptance area 3 — license classification rules (contract-spec §2
// LicenseClassification, packages/core/src/licensing). classifyLicense copies
// policy defaults verbatim, auto-approves review-free Green, routes Yellow to
// legal review, resolves Unknown via uncertain_defaults_to, terminally rejects
// Red, and NEVER grants fine_tuning unless the policy default grants it.

import { describe, expect, it } from 'vitest';
import { classifyLicense, emptyAllowedUses } from '@knowledge-foundry/core';
import { NOW, makeDomainConfig, makeSource } from '../helpers.js';

describe('license classification', () => {
  const config = makeDomainConfig();

  it('Green: copies the policy default_allowed_uses verbatim and auto-grants approval', () => {
    const { source, classification } = classifyLicense(makeSource(), config, {
      licenseClass: 'Green',
      now: NOW,
    });

    expect(source.license_class).toBe('Green');
    expect(source.allowed_uses).toEqual({
      ...emptyAllowedUses(),
      internal_search: true,
      rag: true,
      extraction: true,
      summarization: true,
    });
    expect(source.legal_review_required).toBe(false);
    // Green with requires_review=false is auto-approved for ingestion.
    expect(source.review_state).toBe('approved_for_ingestion');
    expect(source.approval_status).toBe('approved_for_ingestion');

    expect(classification.license_class).toBe('Green');
    expect(classification.allowed_uses).toEqual(source.allowed_uses);
    expect(classification.classified_at).toBe(NOW);
  });

  it('Yellow: requires legal review, enters license_review, and is NOT auto-approved', () => {
    const { source } = classifyLicense(makeSource(), config, {
      licenseClass: 'Yellow',
      now: NOW,
    });

    expect(source.license_class).toBe('Yellow');
    expect(source.legal_review_required).toBe(true);
    expect(source.review_state).toBe('license_review');
    expect(source.approval_status).toBeNull();
    // Yellow policy default grants internal_search only.
    expect(source.allowed_uses).toEqual({ ...emptyAllowedUses(), internal_search: true });
  });

  it('Unknown: resolves to the policy uncertain_defaults_to class (Yellow)', () => {
    const { source, classification } = classifyLicense(makeSource(), config, {
      licenseClass: 'Unknown',
      now: NOW,
    });

    expect(source.license_class).toBe('Yellow');
    expect(classification.license_class).toBe('Yellow');
    expect(source.legal_review_required).toBe(true);
    expect(source.review_state).toBe('license_review');
  });

  it("Red: terminally rejected — review_state 'rejected' AND approval_status 'rejected'", () => {
    const { source } = classifyLicense(makeSource(), config, {
      licenseClass: 'Red',
      now: NOW,
    });

    expect(source.license_class).toBe('Red');
    expect(source.review_state).toBe('rejected');
    expect(source.approval_status).toBe('rejected');
    expect(source.allowed_uses).toEqual(emptyAllowedUses());
  });

  it('Red rejection overrides any prior approval on the source record', () => {
    const previouslyApproved = makeSource({
      review_state: 'approved_for_ingestion',
      approval_status: 'approved_for_ingestion',
    });
    const { source } = classifyLicense(previouslyApproved, config, {
      licenseClass: 'Red',
      now: NOW,
    });

    expect(source.review_state).toBe('rejected');
    expect(source.approval_status).toBe('rejected');
  });

  it('fine_tuning stays false when the policy default does not grant it', () => {
    const { source } = classifyLicense(makeSource(), config, {
      licenseClass: 'Green',
      now: NOW,
    });
    expect(source.allowed_uses?.fine_tuning).toBe(false);
  });

  it('fine_tuning is granted ONLY when the policy default grants it', () => {
    const grantingConfig = makeDomainConfig({ greenAllowedUses: { fine_tuning: true } });
    const { source } = classifyLicense(makeSource(), grantingConfig, {
      licenseClass: 'Green',
      now: NOW,
    });
    expect(source.allowed_uses?.fine_tuning).toBe(true);

    // Same request against a non-granting policy: fine_tuning must be false.
    const { source: denied } = classifyLicense(makeSource(), makeDomainConfig(), {
      licenseClass: 'Green',
      now: NOW,
    });
    expect(denied.allowed_uses?.fine_tuning).toBe(false);
  });

  it('records the rationale on the classification when provided', () => {
    const { classification } = classifyLicense(makeSource(), config, {
      licenseClass: 'Green',
      rationale: 'public domain per publisher statement',
      now: NOW,
    });
    expect(classification.rationale).toBe('public domain per publisher statement');
  });
});
