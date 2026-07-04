# Knowledge Foundry v0.1 — Internal Contract Spec (SHARED, AUTHORITATIVE)

> This file is the single source of truth every subagent must follow so that
> schemas, domain YAML, CLI, and tests agree. Field names, enum values, ID
> formats, and file paths below are NORMATIVE. Do not rename or add required
> fields without the orchestrator's approval. Optional fields may be added.

## 0. Conventions

- Language: TypeScript, ESM, Node ≥ 20. Schemas: `zod` v3. YAML: `yaml` v2.
- All record files are JSONL (one JSON object per line). Manifests/results are JSON. Normalized documents are Markdown + a JSON sidecar.
- Package import names: `@knowledge-foundry/core`, `@knowledge-foundry/adapters`, `@knowledge-foundry/cli`.
- Timestamps: ISO-8601 UTC strings (e.g. `2026-07-04T12:00:00Z`).
- IDs are lowercase kebab/slug. Never spaces.

## 1. Enums (single source: `packages/core/src/schemas/enums.ts`)

```
LicenseClass       = "Green" | "Yellow" | "Orange" | "Red" | "Unknown"
AllowedUse (keys)  = internal_search | rag | extraction | summarization | fine_tuning | customer_facing | commercial_distribution
IngestionPriority  = "P0" | "P1" | "P2"
ReviewState        = candidate | license_review | approved_for_ingestion | ingested | normalized | chunked | tagged | needs_review | approved | rejected | deprecated
ReleaseState       = draft | blocked | approved | indexed | deprecated
EvidenceLevel      = string constrained per-domain (default scale A|B|C|D|X); schema accepts any nonempty string, domain config declares the allowed set
RiskAction         = flag | block | downgrade
ReviewRole         = string (domain-declared, e.g. legal, clinical_sme, compliance, product_owner, cmo)
SourceType         = string (e.g. guideline, regulation, research_article, dataset, api, internal_document, webpage, pdf)
```

`AllowedUses` object = `{ internal_search: boolean, rag: boolean, extraction: boolean, summarization: boolean, fine_tuning: boolean, customer_facing: boolean, commercial_distribution: boolean }` (all default false).

## 2. Record schemas (`packages/core/src/schemas/*.ts`), one file per schema, re-exported from `schemas/index.ts`

### SourceRecord (`data/source_registry/**/*.jsonl`)
```
source_id: string (slug)         // stable primary key
title: string
publisher: string
canonical_url: string (url or "" for internal)
source_type: string
domain: string                   // domain_id
topics: string[]
likely_license: LicenseClass     // discovery guess
license_class?: LicenseClass     // set by classifier
allowed_uses?: AllowedUses       // set by classifier
legal_review_required?: boolean
ingestion_priority: "P0"|"P1"|"P2"
review_state: ReviewState        // starts "candidate"
approval_status?: "approved_for_ingestion" | "rejected" | null
notes?: string
retrieved_at?: string
checksum_sha256?: string         // filled after ingestion
created_at: string
updated_at: string
```

### LicenseClassification (embedded in / applied to SourceRecord; also standalone record)
```
source_id, license_class, allowed_uses, legal_review_required, rationale?: string, classified_at: string
```

### RawArtifactManifest (`data/raw/<source_id>/manifest.json`)
```
source_id, canonical_url, publisher, source_type,
retrieved_at, checksum_sha256, byte_size, content_type, files: string[], errors: string[]
```

### NormalizedDocument sidecar (`data/normalized/<source_id>/metadata.json`; body in `document.md`)
```
source_id, title, headings: {level:number, text:string, anchor:string}[],
toc?: string[], citations: string[], page_count?: number, normalized_at: string, source_checksum_sha256: string
```

### ChunkRecord (`data/chunks/<source_id>/chunks.jsonl`)
```
chunk_id: string                 // "<source_id>#<zero-padded-seq>", e.g. "nih-ods-vitamin-d#0007"
source_id: string
section_path: string             // e.g. "Dosage > Adults"
text: string (nonempty)
citation: string                 // REQUIRED for release; may be "" pre-review but gate blocks empty
license_class: LicenseClass      // inherited from source
allowed_uses: AllowedUses        // inherited from source
// tagging fields (added by tagger, optional until tagged):
topics?: string[]
entities?: {type: string, value: string}[]
chunk_type?: string
evidence_level?: string
audience?: string[]
review_state: ReviewState
created_at: string
```

### ClaimRecord (`data/claims/<source_id>/claims.jsonl`)
```
claim_id: string                 // "<source_id>-claim-<seq>"
source_id, chunk_id,
claim_text: string,
population_or_scope: string,
intervention: string,
outcome: string,
evidence_level: string,
limitations: string,
review_state: ReviewState
```

### RiskRecord (`data/risk/<source_id>/risk.jsonl`)
```
risk_id: string                  // "<source_id>-risk-<seq>"
source_id, chunk_id?,
risk_type: string                // matches a risk_rules.yaml category
severity: "low"|"medium"|"high"
action: RiskAction               // flag|block|downgrade
description: string,
resolved: boolean,               // default false; release blocks on unresolved high severity
resolution_note?: string,
reviewed_by?: string
```

### ConflictRecord (`data/conflicts/<domain_id>/<topic>.jsonl`)
```
conflict_id: string
domain_id, topic,
chunk_ids: string[]              // >= 2
nature: string,
references: string[],
resolved: boolean,
resolution_note?: string
```

### ReviewRecord (`data/reviews/<domain_id>/reviews.jsonl`)
```
review_id: string
target_type: "source"|"chunk"|"claim"|"risk"|"conflict"|"release"
target_id: string
role: string                     // ReviewRole
decision: "approved"|"rejected"|"edited"|"needs_info"
reviewer: string,
note?: string,
reviewed_at: string
```

### ReleaseManifest (`releases/<domain_id>/<release_id>/manifest.json`)
```
release_id: string               // "<domain>-<tier>-v<semver>", e.g. "functional-medicine-p0-v0.1.0"
domain_id: string
state: ReleaseState              // draft|blocked|approved|indexed|deprecated
created_at, updated_at,
intended_use: AllowedUse key or list,   // what this release is FOR
source_count: number,
sources: {source_id: string, license_class: LicenseClass}[],
license_class_counts: Record<LicenseClass, number>,
evidence_summary: Record<string, number>,   // evidence_level -> count
chunk_count: number,
gate_results: {gate: string, passed: boolean, details: string}[],
blockers: string[],              // human-readable; empty when state != blocked
member_files: {path: string, checksum_sha256: string}[],
evaluation?: EvaluationResult    // filled by eval-rag
```

### EvaluationResult (`evals/<release_id>/results.json`, also embeddable in manifest)
```
release_id, domain_id, evaluated_at,
question_count: number,
citation_coverage: number,       // 0..1
retrieval_precision: number,     // 0..1
unsafe_output_rate: number,      // 0..1
license_errors: number,
per_question: {question: string, retrieved_chunk_ids: string[], has_citation: boolean, unsafe: boolean, notes?: string}[]
```

### DomainConfig (aggregate of the 7 YAML files, validated on load)
See section 3.

## 3. Domain config files — `domains/<domain_id>/` and `packages/domain-templates/<name>/`

Seven files. Zod schema `DomainConfig` aggregates them. YAML MUST parse into these shapes.

### domain.yaml
```
domain_id: string
display_name: string
description: string
version: string                  // semver
primary_use_cases: string[]
prohibited_use_cases: string[]
review_roles: string[]
default_release_use: AllowedUse key (e.g. "rag" or "internal_search")
```

### taxonomy.yaml
```
entity_types: {id: string, name: string, description?: string}[]
chunk_types:  {id: string, name: string, description?: string}[]
audiences: string[]
metadata_fields: {id: string, description?: string, required?: boolean}[]
topics?: string[]
# Allowed evidence levels are owned by evidence_model.yaml (its keys), NOT duplicated here.
# ChunkRecord.audience values should come from `audiences`; chunk_type from chunk_types[].id.
```

### source_policy.yaml
```
license_classes:                 # describe each of Green/Yellow/Orange/Red
  Green: { description: string, default_allowed_uses: AllowedUses, requires_review: boolean }
  Yellow: {...}
  Orange: {...}
  Red: {...}
blockers:                        # descriptors that force Red / flag; strings or records
  - string | {id: string, description: string, applies_to?: string, action?: block|flag}
source_types?: string[]          # optional: allowed source types for this domain
uncertain_defaults_to: "Yellow"  # more restrictive default rule (Green|Yellow|Orange|Red)
```
Each license class policy = `{ description: string, default_allowed_uses: AllowedUses, requires_review: boolean }`. Do NOT add other keys (strict schema).

### evidence_model.yaml
```
evidence_levels:
  A: { name: string, description: string }
  B: {...}
  ...
  X: { name: restricted, description: string }
default_level?: string           # optional; must be one of the evidence_levels keys
```

### risk_rules.yaml
```
categories:                      # bare id strings OR self-documenting records
  - string | {id: string, name?: string, description?: string, severity?: low|medium|high}
rules:
  - id: string
    category: string             # must match a category id
    description: string
    match: { keywords?: string[], evidence_levels?: string[], metadata?: object }
    action: flag|block|downgrade
    severity: low|medium|high    # "critical" is NOT valid — use high (gates block on high)
    applies_to?: source|chunk|claim
```
Helper `riskCategoryId(cat)` in schemas normalizes either category form to its id.

### review_workflow.yaml
```
stages:
  license_review: { roles: string[], required: boolean, quorum: "any"|"all"|number }
  safety_review: {...}
  evidence_review: {...}
  release_review: {...}
```

### eval_questions.yaml
```
questions:
  - id: string
    question: string
    topics: string[]
    expects_citation: boolean
    unsafe_if?: string           # optional description of what makes an answer unsafe
thresholds?:                     # optional pass thresholds consumed by eval-rag
  citation_coverage?: number     # 0..1
  retrieval_precision?: number
  unsafe_output_rate?: number
```

## 4. Deterministic gates (`packages/core/src/gates/`) — pure functions, code-only

```
preIngestGate(source: SourceRecord): {allowed: boolean, reasons: string[]}
  - Red  -> blocked
  - Yellow|Orange without approval_status==="approved_for_ingestion" -> blocked
  - Unknown -> blocked (must classify first)
  - Green -> allowed

citationGate(chunk: ChunkRecord): {allowed: boolean, reasons: string[]}
  - empty/whitespace citation -> blocked

licenseConsistencyGate(chunk, source): checks chunk.allowed_uses ⊆ source allowed_uses for the intended use

preReleaseGate(input): {allowed: boolean, blockers: string[]}
  Blocks release when ANY of:
   1. any member source is Red
   2. any Yellow/Orange member source lacks approval_status==="approved_for_ingestion"
   3. any unresolved RiskRecord with severity "high"
   4. any member chunk fails citationGate
   5. license errors: intended_use not permitted by every member source's allowed_uses
   6. intended_use includes fine_tuning but any member source has allowed_uses.fine_tuning === false
```

Gates return structured results; CLI maps `allowed:false` to a non-zero exit and prints `reasons`/`blockers`.

## 5. Storage module (`packages/core/src/storage/`)

Owns ALL path construction. Workspace root defaults to `process.cwd()`, overridable via `--root` / `KF_ROOT`. Exposes typed read/write helpers for each artefact type (readJsonl, writeJsonl, appendJsonl, readJson, writeJson, readMarkdown, writeMarkdown, domain config load). Raw artefacts are write-once: refuse overwrite unless `--force`.

## 6. CLI commands (`packages/cli`) — 1:1 with core

`kf <command> [--domain <id>] [--root <dir>] ...` for:
init-domain, validate-domain, create-source, discover, classify-license, ingest, normalize, chunk, tag, extract-claims, screen-risk, detect-conflicts, build-release, eval-rag, validate-release.

Every command: validate inputs/outputs with the zod schemas above; on validation or gate failure print a clear message and exit non-zero; on success exit 0. No hidden global state; deterministic output ordering (sort records by id).

## 7. Skill files (`skill/`) mapping

Each `skill/commands/<name>.md` documents the matching `kf` command (Purpose, Inputs, Preconditions, Steps, Outputs, Failure modes, Example invocation, Related CLI command, Review gates). Each `skill/agents/<name>.md` maps to a pipeline stage (Role, Responsibilities, Inputs, Outputs, Allowed actions, Prohibited actions, Prompt template, Validation checklist, Escalation rules). Hooks map to gate functions.
