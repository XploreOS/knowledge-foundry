// License classification (contract-spec §2 LicenseClassification, ADR-011).
// Pure transformation — no IO. Applies a domain's source_policy to a source,
// copying the policy's default_allowed_uses; it NEVER invents usage rights.

import {
  AllowedUses,
  LicenseClassification,
  SourceRecord,
  emptyAllowedUses,
} from '../schemas/index.js';
import type {
  AllowedUses as AllowedUsesType,
  DomainConfig,
  LicenseClass,
  LicenseClassification as LicenseClassificationType,
  SourceRecord as SourceRecordType,
} from '../schemas/index.js';

export interface ClassifyLicenseOptions {
  /** The class a human/tool assigned; 'Unknown' defers to policy defaults. */
  licenseClass: LicenseClass;
  rationale?: string;
  now?: string;
}

export interface ClassifyLicenseResult {
  source: SourceRecordType;
  classification: LicenseClassificationType;
}

/** The four concrete policy classes declared in source_policy.license_classes. */
type PolicyClass = 'Green' | 'Yellow' | 'Orange' | 'Red';

/**
 * Classify a source. When `licenseClass` is 'Unknown' the more restrictive
 * `uncertain_defaults_to` class is used to resolve a concrete classification.
 * The resulting allowed_uses are copied verbatim from the policy default —
 * in particular fine_tuning is granted ONLY if the policy default grants it.
 */
export function classifyLicense(
  source: SourceRecordType,
  domainConfig: DomainConfig,
  opts: ClassifyLicenseOptions,
): ClassifyLicenseResult {
  const now = opts.now ?? new Date().toISOString();
  const policy = domainConfig.source_policy;

  // Resolve the concrete policy class whose defaults we copy.
  const effectiveClass: PolicyClass =
    opts.licenseClass === 'Unknown' ? policy.uncertain_defaults_to : opts.licenseClass;

  const classPolicy = policy.license_classes[effectiveClass];

  // Copy the policy default, then re-parse through the schema to apply the
  // strict AllowedUses shape (all seven keys present, defaults filled).
  const defaults = AllowedUses.parse(classPolicy.default_allowed_uses ?? emptyAllowedUses());
  const allowedUses: AllowedUsesType = { ...defaults };

  // HARD RULE: never grant fine_tuning unless the policy default grants it.
  if (classPolicy.default_allowed_uses?.fine_tuning !== true) {
    allowedUses.fine_tuning = false;
  }

  const legalReviewRequired = classPolicy.requires_review;

  // review_state: Red is terminally rejected regardless of what the policy's
  // requires_review flag says — a prohibited source must never carry an
  // approval-ish state. Otherwise license_review when a human must sign off;
  // approval_status is auto-granted ONLY for a Green class needing no review.
  const reviewState =
    effectiveClass === 'Red' ? 'rejected' : legalReviewRequired ? 'license_review' : 'approved_for_ingestion';
  const approvalStatus =
    effectiveClass === 'Red'
      ? 'rejected'
      : effectiveClass === 'Green' && !legalReviewRequired
        ? 'approved_for_ingestion'
        : source.approval_status ?? null;

  const updated: SourceRecordType = SourceRecord.parse({
    ...source,
    license_class: effectiveClass,
    allowed_uses: allowedUses,
    legal_review_required: legalReviewRequired,
    review_state: reviewState,
    approval_status: approvalStatus,
    updated_at: now,
  });

  const classification: LicenseClassificationType = LicenseClassification.parse({
    source_id: source.source_id,
    license_class: effectiveClass,
    allowed_uses: allowedUses,
    legal_review_required: legalReviewRequired,
    ...(opts.rationale !== undefined ? { rationale: opts.rationale } : {}),
    classified_at: now,
  });

  return { source: updated, classification };
}
