// Schemas for the seven YAML files that make up a domain configuration under
// domains/<domain_id>/*.yaml and packages/domain-templates/<name>/*.yaml —
// contract-spec.md section 3: domain.yaml, taxonomy.yaml, source_policy.yaml,
// evidence_model.yaml, risk_rules.yaml, review_workflow.yaml and
// eval_questions.yaml, plus the aggregate DomainConfig that composes them.

import { z } from 'zod';
import { AllowedUseKey, AllowedUses, Id, ReviewRole, RiskAction, RiskSeverity } from './enums.js';

/** domain.yaml — high-level description, use cases, review roles, release defaults. */
export const DomainYaml = z
  .object({
    domain_id: Id,
    display_name: z.string(),
    description: z.string(),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, 'version must be semver'),
    primary_use_cases: z.array(z.string()),
    prohibited_use_cases: z.array(z.string()),
    review_roles: z.array(ReviewRole),
    default_release_use: AllowedUseKey,
  })
  .strict();
export type DomainYaml = z.infer<typeof DomainYaml>;

/** A named vocabulary item (entity type or chunk type) declared by a domain. */
const NamedType = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    description: z.string().optional(),
  })
  .strict();

/** A metadata field a domain attaches to chunks, with an optional required flag. */
const MetadataField = z
  .object({
    id: z.string().min(1),
    description: z.string().optional(),
    required: z.boolean().optional(),
  })
  .strict();

/**
 * taxonomy.yaml — the domain's entity types, chunk types, audiences, metadata
 * fields and topics. Entity and chunk types are self-documenting {id,name,
 * description} records so a template reads as its own reference. Allowed
 * evidence levels are owned by evidence_model.yaml, not duplicated here.
 */
export const TaxonomyYaml = z
  .object({
    entity_types: z.array(NamedType),
    chunk_types: z.array(NamedType),
    audiences: z.array(z.string()),
    metadata_fields: z.array(MetadataField),
    topics: z.array(z.string()).optional(),
  })
  .strict();
export type TaxonomyYaml = z.infer<typeof TaxonomyYaml>;

const LicenseClassPolicy = z
  .object({
    description: z.string(),
    default_allowed_uses: AllowedUses,
    requires_review: z.boolean(),
  })
  .strict();

/** source_policy.yaml — license classes, blockers and the uncertain-case default. */
export const SourcePolicyYaml = z
  .object({
    license_classes: z
      .object({
        Green: LicenseClassPolicy,
        Yellow: LicenseClassPolicy,
        Orange: LicenseClassPolicy,
        Red: LicenseClassPolicy,
      })
      .strict(),
    blockers: z.array(
      z.union([
        z.string(),
        z
          .object({
            id: z.string().min(1),
            description: z.string(),
            applies_to: z.string().optional(),
            action: z.enum(['block', 'flag']).optional(),
          })
          .strict(),
      ]),
    ),
    source_types: z.array(z.string()).optional(),
    uncertain_defaults_to: z.enum(['Green', 'Yellow', 'Orange', 'Red']).default('Yellow'),
  })
  .strict();
export type SourcePolicyYaml = z.infer<typeof SourcePolicyYaml>;

/** evidence_model.yaml — evidence grading scale (domain-declared set of levels). */
export const EvidenceModelYaml = z
  .object({
    evidence_levels: z
      .record(z.string().min(1), z.object({ name: z.string(), description: z.string() }).strict())
      .refine((levels) => Object.keys(levels).length >= 1, {
        message: 'evidence_levels must declare at least one level',
      }),
    default_level: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((config, ctx) => {
    if (config.default_level !== undefined && !(config.default_level in config.evidence_levels)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `default_level "${config.default_level}" must be one of the declared evidence_levels`,
        path: ['default_level'],
      });
    }
  });
export type EvidenceModelYaml = z.infer<typeof EvidenceModelYaml>;

const RiskRuleMatch = z
  .object({
    keywords: z.array(z.string()).optional(),
    evidence_levels: z.array(z.string()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const RiskRule = z
  .object({
    id: z.string(),
    category: z.string(),
    description: z.string(),
    match: RiskRuleMatch,
    action: RiskAction,
    severity: RiskSeverity,
    applies_to: z.enum(['source', 'chunk', 'claim']).optional(),
  })
  .strict();

/** A risk category may be a bare id or a self-documenting record. */
const RiskCategory = z.union([
  z.string(),
  z
    .object({
      id: z.string().min(1),
      name: z.string().optional(),
      description: z.string().optional(),
      severity: RiskSeverity.optional(),
    })
    .strict(),
]);

/** Extract the id of a category regardless of which form it was declared in. */
export function riskCategoryId(category: z.infer<typeof RiskCategory>): string {
  return typeof category === 'string' ? category : category.id;
}

/** risk_rules.yaml — risk categories and the rules that flag/block/downgrade content. */
export const RiskRulesYaml = z
  .object({
    categories: z.array(RiskCategory),
    rules: z.array(RiskRule),
  })
  .strict()
  .superRefine((config, ctx) => {
    const categories = new Set(config.categories.map(riskCategoryId));
    config.rules.forEach((rule, index) => {
      if (!categories.has(rule.category)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `rule category "${rule.category}" must be declared in categories`,
          path: ['rules', index, 'category'],
        });
      }
    });
  });
export type RiskRulesYaml = z.infer<typeof RiskRulesYaml>;

const ReviewWorkflowStage = z
  .object({
    roles: z.array(z.string()),
    required: z.boolean(),
    quorum: z.union([z.literal('any'), z.literal('all'), z.number().int().positive()]),
  })
  .strict();

/** review_workflow.yaml — which roles must approve each pipeline stage. */
export const ReviewWorkflowYaml = z
  .object({
    stages: z
      .object({
        license_review: ReviewWorkflowStage,
        safety_review: ReviewWorkflowStage,
        evidence_review: ReviewWorkflowStage,
        release_review: ReviewWorkflowStage,
      })
      .strict(),
  })
  .strict();
export type ReviewWorkflowYaml = z.infer<typeof ReviewWorkflowYaml>;

const EvalQuestion = z
  .object({
    id: z.string(),
    question: z.string(),
    topics: z.array(z.string()),
    expects_citation: z.boolean(),
    unsafe_if: z.string().optional(),
  })
  .strict();

/** eval_questions.yaml — representative questions to evaluate a release's retrieval quality. */
export const EvalQuestionsYaml = z
  .object({
    questions: z.array(EvalQuestion),
    thresholds: z
      .object({
        citation_coverage: z.number().min(0).max(1).optional(),
        retrieval_precision: z.number().min(0).max(1).optional(),
        unsafe_output_rate: z.number().min(0).max(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type EvalQuestionsYaml = z.infer<typeof EvalQuestionsYaml>;

/** Composite of all seven domain configuration files for a single domain. */
export const DomainConfig = z
  .object({
    domain: DomainYaml,
    taxonomy: TaxonomyYaml,
    source_policy: SourcePolicyYaml,
    evidence_model: EvidenceModelYaml,
    risk_rules: RiskRulesYaml,
    review_workflow: ReviewWorkflowYaml,
    eval_questions: EvalQuestionsYaml,
  })
  .strict();
export type DomainConfig = z.infer<typeof DomainConfig>;
