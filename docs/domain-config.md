# Domain Configuration

The authoritative guide to the seven YAML files that define a Knowledge
Foundry domain. The engine (`packages/core`, `packages/cli`,
`packages/adapters`) contains zero domain-specific strings (ADR-013) —
every behavior described in [architecture.md](architecture.md)'s 13-stage
pipeline comes from `domains/<domain_id>/*.yaml`, validated against the
`DomainConfig` zod schema in `packages/core/src/schemas/domainConfig.ts`.
For a fully worked example, see
[functional-medicine-reference-domain.md](functional-medicine-reference-domain.md).
For the license-specific file (`source_policy.yaml`), see
[license-policy.md](license-policy.md), which covers it in depth.

A domain is exactly these seven files, no more, no fewer, all required:
`domain.yaml`, `taxonomy.yaml`, `source_policy.yaml`,
`evidence_model.yaml`, `risk_rules.yaml`, `review_workflow.yaml`,
`eval_questions.yaml`.

## 1. `domain.yaml`

High-level identity, use cases, and release defaults.

```yaml
domain_id: string                  # slug, e.g. "generic-template"
display_name: string
description: string
version: string                    # semver, e.g. "0.1.0"
primary_use_cases: string[]
prohibited_use_cases: string[]
review_roles: string[]             # e.g. [legal, domain_sme, product_owner]
default_release_use: <AllowedUse key>   # e.g. "rag" or "internal_search"
```

`default_release_use` must be one of the seven `AllowedUse` keys:
`internal_search`, `rag`, `extraction`, `summarization`, `fine_tuning`,
`customer_facing`, `commercial_distribution`.

Worked example (`packages/domain-templates/generic/domain.yaml`):

```yaml
domain_id: generic-template
display_name: Generic Domain Template
description: >-
  A neutral, unopinionated starting point for building a Knowledge Foundry
  domain configuration.
version: "0.1.0"
primary_use_cases:
  - internal knowledge base search
  - retrieval-augmented generation over approved internal documents
  - summarization of long-form reference material
prohibited_use_cases:
  - autonomous decision-making without human review
  - redistribution of ingested content outside the organization
review_roles:
  - legal
  - domain_sme
  - product_owner
default_release_use: rag
```

## 2. `taxonomy.yaml`

Entity types, chunk types, audiences, metadata fields, and (optionally)
topics.

```yaml
entity_types: {id, name, description?}[]
chunk_types:  {id, name, description?}[]
audiences: string[]
metadata_fields: {id, description?, required?}[]
topics?: string[]
```

Entity types and chunk types are self-documenting records — every domain
config reads as its own reference, not a bare list of ids. Allowed
evidence levels are **not** duplicated here; they are owned by
`evidence_model.yaml`'s keys. `ChunkRecord.audience` values should come
from `audiences`; `ChunkRecord.chunk_type` from `chunk_types[].id`.

Worked example (`packages/domain-templates/generic/taxonomy.yaml`,
abridged):

```yaml
entity_types:
  - id: topic
    name: Topic
    description: A named subject area used to group related content.
  - id: term
    name: Defined Term
    description: A word or phrase with a specific, documented meaning in this domain.
chunk_types:
  - id: document
    name: Document
    description: A full source document treated as a single retrievable unit.
  - id: section
    name: Section
    description: A titled subsection of a longer document.
audiences:
  - internal_staff
  - external_customers
  - general_public
metadata_fields:
  - id: source_url
    description: Canonical URL or file path the content was ingested from.
    required: false
  - id: last_reviewed
    description: ISO date the content was last reviewed for accuracy.
    required: true
topics:
  - onboarding
  - policies
```

## 3. `source_policy.yaml`

License classes, blockers, recognized source types, and the
uncertain-case default. See [license-policy.md](license-policy.md) for
full semantics; shape recap:

```yaml
license_classes:
  Green:  { description: string, default_allowed_uses: AllowedUses, requires_review: boolean }
  Yellow: { description: string, default_allowed_uses: AllowedUses, requires_review: boolean }
  Orange: { description: string, default_allowed_uses: AllowedUses, requires_review: boolean }
  Red:    { description: string, default_allowed_uses: AllowedUses, requires_review: boolean }
blockers:
  - string | { id: string, description: string, applies_to?: string, action?: block|flag }
source_types?: string[]
uncertain_defaults_to: Green|Yellow|Orange|Red   # defaults to Yellow
```

All four classes are required, each with exactly the three keys above —
the schema is `.strict()`, so no extra keys (e.g. an `ingestable` flag) are
accepted; ingestability is derived purely from the gate logic in
[license-policy.md](license-policy.md), never from a config flag.
`default_allowed_uses` must set all seven `AllowedUse` keys explicitly.
`blockers` entries may be a bare descriptive string or a self-documenting
record with `id`/`description`/`applies_to`/`action`.

Worked example — see the full
`packages/domain-templates/generic/source_policy.yaml` for all four
classes; abridged:

```yaml
license_classes:
  Green:
    description: Public domain or explicitly licensed for reuse; safe to ingest and use broadly.
    requires_review: false
    default_allowed_uses:
      internal_search: true
      rag: true
      extraction: true
      summarization: true
      fine_tuning: false
      customer_facing: false
      commercial_distribution: false
  # Yellow, Orange, Red follow the same shape, progressively more restrictive
blockers:
  - "No-redistribution license: source terms explicitly forbid redistribution outside the organization (block)."
  - "Unverified authorship: source authorship or provenance could not be confirmed (flag for review)."
uncertain_defaults_to: Yellow
source_types:
  - guideline
  - research_article
  - regulation
  - dataset
  - api
  - internal_document
  - web_page
```

## 4. `evidence_model.yaml`

The evidence grading scale. Keys are domain-declared strings — not
required to be single letters — but the default template scale is A–X.

```yaml
evidence_levels:
  <key>: { name: string, description: string }
  ...
default_level?: string    # optional; must be one of the evidence_levels keys
```

Worked example (`packages/domain-templates/generic/evidence_model.yaml`):

```yaml
evidence_levels:
  A:
    name: authoritative
    description: Major guideline, regulation, or audited primary source.
  B:
    name: high_quality_secondary
    description: Systematic review, consensus statement, or audited analysis of primary sources.
  C:
    name: primary_observational
    description: Direct observation, internal data, or a single primary source without independent validation.
  D:
    name: expert_opinion
    description: Expert consensus, internal playbook, or informal protocol.
  X:
    name: restricted
    description: Unsupported, unsafe, or prohibited for use as evidence.
default_level: C
```

## 5. `risk_rules.yaml`

Risk categories and the rules that flag, block, or downgrade content.

```yaml
categories:
  - string | { id: string, name?: string, description?: string, severity?: low|medium|high }
rules:
  - id: string
    category: string          # must match a declared category id
    description: string
    match: { keywords?: string[], evidence_levels?: string[], metadata?: object }
    action: flag|block|downgrade
    severity: low|medium|high  # "critical" is NOT a valid value — use "high"; gates block on "high"
    applies_to?: source|chunk|claim
```

Every `rules[].category` must resolve to a declared `categories[]` id —
`riskCategoryId()` in the schema module normalizes either the bare-string
or record form of a category to its id, and `RiskRulesYaml` validation
rejects a rule whose `category` isn't declared.

Worked example (`packages/domain-templates/generic/risk_rules.yaml`,
abridged):

```yaml
categories:
  - license_violation
  - privacy_violation
  - unsupported_claim
  - outdated_content
rules:
  - id: flag-missing-license-review
    category: license_violation
    description: Flag any chunk sourced from a Yellow or Orange source that has not completed legal review.
    match: {}
    action: flag
    severity: high
  - id: flag-personal-data-mentions
    category: privacy_violation
    description: Flag chunks that mention personal identifiers alongside sensitive context.
    match:
      keywords:
        - social security number
        - date of birth
    action: flag
    severity: high
```

## 6. `review_workflow.yaml`

Which roles must sign off at each of four required stages.

```yaml
stages:
  license_review:  { roles: string[], required: boolean, quorum: "any"|"all"|number }
  safety_review:   { roles: string[], required: boolean, quorum: "any"|"all"|number }
  evidence_review: { roles: string[], required: boolean, quorum: "any"|"all"|number }
  release_review:  { roles: string[], required: boolean, quorum: "any"|"all"|number }
```

All four stage keys are required (the schema is `.strict()`), and each
stage's `roles` should be drawn from `domain.yaml`'s `review_roles`.
`quorum` is `"any"` (one signoff suffices), `"all"` (every listed role
must sign off), or a specific integer count.

Worked example (`packages/domain-templates/generic/review_workflow.yaml`):

```yaml
stages:
  license_review:
    roles: [legal]
    required: true
    quorum: 1
  safety_review:
    roles: [domain_sme]
    required: true
    quorum: 1
  evidence_review:
    roles: [domain_sme]
    required: true
    quorum: 1
  release_review:
    roles: [legal, domain_sme, product_owner]
    required: true
    quorum: 1
```

## 7. `eval_questions.yaml`

Representative questions for `kf eval-rag`, plus optional pass thresholds.

```yaml
questions:
  - id: string
    question: string
    topics: string[]
    expects_citation: boolean
    unsafe_if?: string        # optional description of what makes an answer unsafe
thresholds?:
  citation_coverage?: number   # 0..1
  retrieval_precision?: number # 0..1
  unsafe_output_rate?: number  # 0..1
```

Note the field is `expects_citation`, not `must_cite`. `thresholds` are
optional but, when present, are what `kf eval-rag` compares its computed
metrics against.

Worked example (`packages/domain-templates/generic/eval_questions.yaml`):

```yaml
questions:
  - id: eval-001
    question: What is the process for onboarding a new employee?
    topics: [onboarding]
    expects_citation: true
  - id: eval-005
    question: Who owns the decision to approve a new vendor contract?
    topics: [policies]
    expects_citation: true
    unsafe_if: The answer names a specific individual instead of a role or team.
thresholds:
  citation_coverage: 0.9
  retrieval_precision: 0.7
  unsafe_output_rate: 0.0
```

## Creating a new domain

1. Scaffold: `kf init-domain <your-domain>`, or copy a starter
   template — `cp -r packages/domain-templates/generic domains/<your-domain>`
   (also available: `healthcare`, `legal`, `finance`, `enterprise`).
2. Edit `domain.yaml` first — real `domain_id`, `display_name`,
   `description`, `primary_use_cases`, `prohibited_use_cases`,
   `review_roles`, `default_release_use`. Do not leave placeholder text.
3. Replace the taxonomy's entity types, chunk types, audiences, and
   metadata fields with your domain's actual vocabulary.
4. Write real license classes, blockers, and `source_types` in
   `source_policy.yaml` — keep all four classes and all seven
   `default_allowed_uses` keys explicit on every class. Leave
   `fine_tuning` `false` unless your organization has confirmed explicit
   training rights for a source (see
   [license-policy.md](license-policy.md)).
5. Define your domain's actual evidence grading scale in
   `evidence_model.yaml`.
6. Write risk rules for the failure modes that matter in your domain in
   `risk_rules.yaml`. Every rule's `category` must match a declared
   category id.
7. Define `review_workflow.yaml`'s four required stages with roles
   consistent with `domain.yaml`'s `review_roles`.
8. Write at least five real evaluation questions in `eval_questions.yaml`
   that exercise your corpus's key topics, and set `thresholds` if your
   domain needs stricter (or looser) gates than the defaults.
9. Run `kf validate-domain <your-domain>` before ingesting any
   real sources. Fix the specific file the error names — do not guess at
   the others.

Do not invent domain rules inline in a prompt or agent response. If the
domain config doesn't say it, the pipeline doesn't know it
(`../skill/SKILL.md`).

## Versioning guidance

`domain.yaml.version` is a semver string. Domain configurations are
versioned artefacts, not throwaway scratch files:

- Bump the version whenever taxonomy, risk rules, or the evidence model
  change in a way that affects how existing chunks/claims should be
  re-tagged or re-screened.
- Coordinate with legal and subject-matter experts before changing
  `prohibited_use_cases`, `source_policy.yaml`'s classes/blockers, or
  `risk_rules.yaml` — these are compliance-relevant, not cosmetic.
- Treat domain config changes like code: commit them to git, and record
  the rationale (e.g. in `review_workflow.yaml`'s stage notes or your own
  changelog) so a later reviewer can see why a rule changed.
- Existing releases are immutable once out of `draft`
  ([release-model.md](release-model.md)); a domain config version bump
  does not retroactively alter a shipped release's `manifest.json`. To
  reflect a config change, cut a new release.
