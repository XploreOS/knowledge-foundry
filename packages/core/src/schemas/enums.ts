// Shared enumerations and primitive value schemas used across every Knowledge
// Foundry artefact (source records, chunks, claims, risks, reviews, releases).
// Single source of truth per docs/internal/contract-spec.md section 1 — do not
// duplicate these enums in other schema files.

import { z } from 'zod';

/**
 * Combined license classification. Used both for `likely_license` (the
 * discovery-time guess) and `license_class` (the value set once a human/tool
 * has formally classified the source) — per the contract spec these share one
 * enum, including the "Unknown" value for not-yet-classified sources.
 */
export const LICENSE_CLASSES = ['Green', 'Yellow', 'Orange', 'Red', 'Unknown'] as const;
export const LicenseClass = z.enum(LICENSE_CLASSES);
export type LicenseClass = z.infer<typeof LicenseClass>;

/** The fixed set of ways an artefact may be permitted to be used. */
export const ALLOWED_USE_KEYS = [
  'internal_search',
  'rag',
  'extraction',
  'summarization',
  'fine_tuning',
  'customer_facing',
  'commercial_distribution',
] as const;
export const AllowedUseKey = z.enum(ALLOWED_USE_KEYS);
export type AllowedUseKey = z.infer<typeof AllowedUseKey>;

/** A complete map of every allowed-use flag to a boolean; each defaults to false. */
export const AllowedUses = z
  .object({
    internal_search: z.boolean().default(false),
    rag: z.boolean().default(false),
    extraction: z.boolean().default(false),
    summarization: z.boolean().default(false),
    fine_tuning: z.boolean().default(false),
    customer_facing: z.boolean().default(false),
    commercial_distribution: z.boolean().default(false),
  })
  .strict();
export type AllowedUses = z.infer<typeof AllowedUses>;

/** Returns a fresh AllowedUses value with every flag set to false. */
export function emptyAllowedUses(): AllowedUses {
  return {
    internal_search: false,
    rag: false,
    extraction: false,
    summarization: false,
    fine_tuning: false,
    customer_facing: false,
    commercial_distribution: false,
  };
}

/** Priority tier assigned to a source for ingestion scheduling. */
export const INGESTION_PRIORITIES = ['P0', 'P1', 'P2'] as const;
export const IngestionPriority = z.enum(INGESTION_PRIORITIES);
export type IngestionPriority = z.infer<typeof IngestionPriority>;

/** Lifecycle state of a source/chunk record as it moves through the pipeline. */
export const REVIEW_STATES = [
  'candidate',
  'license_review',
  'approved_for_ingestion',
  'ingested',
  'normalized',
  'chunked',
  'tagged',
  'needs_review',
  'approved',
  'rejected',
  'deprecated',
] as const;
export const ReviewState = z.enum(REVIEW_STATES);
export type ReviewState = z.infer<typeof ReviewState>;

/** Lifecycle state of a release manifest. */
export const RELEASE_STATES = ['draft', 'blocked', 'approved', 'indexed', 'deprecated'] as const;
export const ReleaseState = z.enum(RELEASE_STATES);
export type ReleaseState = z.infer<typeof ReleaseState>;

/** Action a risk rule/record prescribes when triggered. */
export const RISK_ACTIONS = ['flag', 'block', 'downgrade'] as const;
export const RiskAction = z.enum(RISK_ACTIONS);
export type RiskAction = z.infer<typeof RiskAction>;

/** Severity level attached to a risk record. */
export const RISK_SEVERITIES = ['low', 'medium', 'high'] as const;
export const RiskSeverity = z.enum(RISK_SEVERITIES);
export type RiskSeverity = z.infer<typeof RiskSeverity>;

/** Human decision recorded against a review target. */
export const REVIEW_DECISIONS = ['approved', 'rejected', 'edited', 'needs_info'] as const;
export const ReviewDecision = z.enum(REVIEW_DECISIONS);
export type ReviewDecision = z.infer<typeof ReviewDecision>;

/** The kind of artefact a ReviewRecord targets. */
export const REVIEW_TARGET_TYPES = ['source', 'chunk', 'claim', 'risk', 'conflict', 'release'] as const;
export const ReviewTargetType = z.enum(REVIEW_TARGET_TYPES);
export type ReviewTargetType = z.infer<typeof ReviewTargetType>;

/** Domain-declared reviewer role (e.g. legal, clinical_sme, compliance, product_owner, cmo). */
export const ReviewRole = z.string().min(1);
export type ReviewRole = z.infer<typeof ReviewRole>;

/** Domain-declared source type (e.g. guideline, regulation, research_article, dataset, api, ...). */
export const SourceType = z.string().min(1);
export type SourceType = z.infer<typeof SourceType>;

/**
 * Evidence grading level. The concrete allowed set (default scale A|B|C|D|X)
 * is declared per-domain in evidence_model.yaml; at the schema layer any
 * nonempty string is accepted.
 */
export const EvidenceLevel = z.string().min(1);
export type EvidenceLevel = z.infer<typeof EvidenceLevel>;

/**
 * Stable, human-readable slug identifier used for every artefact id.
 * Lowercase kebab/slug; chunk ids additionally allow a trailing `#<seq>`.
 */
export const Id = z.string().min(1).regex(/^[a-z0-9][a-z0-9._#-]*$/, 'must be a lowercase slug id');
export type Id = z.infer<typeof Id>;

/** ISO-8601 UTC timestamp string, e.g. "2026-07-04T12:00:00Z". */
export const IsoDateTime = z.string().datetime({ offset: true });
export type IsoDateTime = z.infer<typeof IsoDateTime>;
