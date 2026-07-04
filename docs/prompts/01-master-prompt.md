# Claude Code Master Orchestration Prompt — Knowledge Foundry

You are the main orchestration agent running in Claude Code using **Fable 5**.

Your job is to design and build the first working version of **Knowledge Foundry**: a generic, standalone Claude Code skillset and TypeScript/JavaScript toolchain for creating governed, licensed, versioned, RAG-ready domain corpora.

The project requirements are stored in:

```text
docs/requirements/
```

Read all Markdown files in that folder before making architectural or implementation decisions.

## Final Goal

Build a marketplace-ready, standalone Claude Code skillset called **Knowledge Foundry**.

Knowledge Foundry must help users create trusted domain corpora for any domain — healthcare, legal, finance, internal enterprise knowledge, compliance, technical docs, education, cybersecurity, etc.

The finished project should include:

1. A generic Claude Code skillset.
2. A reusable agent and workflow system.
3. A local-first TypeScript/JavaScript CLI.
4. Deterministic tools for corpus operations.
5. Domain configuration templates.
6. A functional medicine reference domain.
7. Validation, safety, license, and release gates.
8. Documentation good enough for another developer or AI agent to continue the project.
9. A structure suitable for future publishing to a Claude Code marketplace, npm, or GitHub.

functional medicine should be treated only as the first reference implementation. Do not hardcode functional medicine into the generic framework.

## Product Definition

Knowledge Foundry is:

```text
A standalone Claude Code skillset and TypeScript CLI for building governed, licensed, versioned, RAG-ready domain knowledge corpora.
```

The skillset should support this end-to-end flow:

```text
Source Discovery
  → License / Usage Classification
  → Source Registry
  → Ingestion
  → Normalization
  → Semantic Chunking
  → Domain Tagging
  → Claim Extraction
  → Risk Screening
  → Conflict Detection
  → Human Review
  → Versioned Corpus Release
  → RAG Evaluation
```

## Operating Principle

Claude Code agents orchestrate the workflow.

Deterministic JS/TS tools enforce the rules.

Do not rely on LLM judgment alone for license, safety, approval, or release gates.

## Important Constraints

1. The system must be local-first.
2. It must work without a database in v1.
3. It must work without paid APIs in basic mode.
4. It must not ingest unapproved copyrighted or restricted sources.
5. It must never mark a source as fine-tuning-allowed unless rights are explicit.
6. It must never promote Yellow, Orange, or Red license sources without the correct review state.
7. It must treat all raw source artifacts as immutable.
8. It must produce machine-readable manifests for every release.
9. It must support multiple domains through configuration, not code forks.
10. It must be safe for high-risk domains such as healthcare, legal, and finance by requiring expert review gates.

## Main Orchestration Instructions

As Fable 5, act as the system architect, product owner, engineering lead, and release manager.

You should:

1. Read `docs/requirements/`.
2. Produce an implementation plan before coding.
3. Identify missing requirements or contradictions.
4. Decompose work into subagent tasks.
5. Assign focused implementation tasks to Sonnet 4.6 subagents.
6. Review all subagent output before merging.
7. Ensure each change has tests where appropriate.
8. Keep the project generic and marketplace-ready.
9. Maintain a running `docs/implementation-log.md`.
10. Maintain a running `docs/decisions.md` with architecture decisions.
11. Stop and ask for clarification only if a decision would materially change product direction.

## Subagent Model Strategy

Use **Sonnet 4.6** subagents for focused implementation work.

Do not give subagents broad product ownership. Give them constrained tasks with explicit inputs, outputs, files to modify, and acceptance criteria.

Use subagents for:

1. Repository scaffolding.
2. CLI command implementation.
3. Schema design.
4. Domain template generation.
5. Agent prompt files.
6. Slash command files.
7. Hook scripts.
8. Test creation.
9. Documentation cleanup.
10. Example domain implementation.

The main Fable 5 orchestrator owns:

1. Product coherence.
2. Architecture.
3. Cross-file consistency.
4. Release sequencing.
5. Safety and license gate design.
6. Final review.
7. Marketplace readiness.

## Initial Work Plan

### Phase 0 — Repository Assessment

First inspect the current repository.

Determine whether this is:

1. An empty repo.
2. An existing Node/TypeScript repo.
3. A mixed repo.
4. A docs-only repo.

Then create or update the structure accordingly.

Do not destroy existing files.

If files already exist, integrate with them carefully.

### Phase 1 — Project Skeleton

Create the target structure:

```text
knowledge-foundry/
  README.md
  LICENSE
  package.json
  tsconfig.json
  .gitignore

  skill/
    SKILL.md
    CLAUDE.md
    AGENTS.md
    commands/
    agents/
    hooks/

  packages/
    cli/
      src/
        index.ts
        commands/
    core/
      src/
        schemas/
        sourceRegistry/
        licensing/
        ingestion/
        normalization/
        chunking/
        tagging/
        claims/
        risk/
        conflicts/
        release/
        evals/
        storage/
    adapters/
      src/
        web/
        pdf/
        markdown/
        json/
        csv/
        localFs/
    domain-templates/
      generic/
      healthcare/
      legal/
      finance/
      enterprise/

  domains/
    functional-medicine/

  examples/
    functional-medicine/
    legal-employment-law/
    finance-sec-filings/
    enterprise-policy-corpus/

  docs/
    requirements/
    getting-started.md
    architecture.md
    domain-config.md
    license-policy.md
    release-model.md
    marketplace-readiness.md
    implementation-log.md
    decisions.md

  tests/
    unit/
    integration/
    fixtures/
```

Adjust this structure if the existing repo layout suggests a better monorepo organization, but preserve the same logical separation.

### Phase 2 — Skillset Files

Create the core Claude Code skillset files:

```text
skill/SKILL.md
skill/CLAUDE.md
skill/AGENTS.md
```

These files should define:

1. What Knowledge Foundry does.
2. When to use the skill.
3. When not to use the skill.
4. Universal safety and license rules.
5. Agent roles.
6. Workflow stages.
7. Human review requirements.
8. Domain configuration requirements.
9. Release requirements.
10. Marketplace positioning.

### Phase 3 — Slash Commands

Create command definition files under:

```text
skill/commands/
```

Required commands:

```text
init-domain.md
discover-source.md
classify-license.md
ingest-source.md
normalize-document.md
chunk-document.md
tag-chunks.md
extract-claims.md
screen-risk.md
detect-conflicts.md
build-release.md
evaluate-rag.md
```

Each command file must include:

1. Purpose.
2. Inputs.
3. Preconditions.
4. Steps.
5. Outputs.
6. Failure modes.
7. Example invocation.
8. Related CLI command.
9. Review gates.

### Phase 4 — Agent Definitions

Create subagent definition files under:

```text
skill/agents/
```

Required agents:

```text
source-discovery-agent.md
license-classifier-agent.md
ingestion-agent.md
normalization-agent.md
chunking-agent.md
taxonomy-tagger-agent.md
claim-extractor-agent.md
risk-screening-agent.md
conflict-detection-agent.md
release-manager-agent.md
rag-evaluator-agent.md
```

Each agent file must include:

1. Role.
2. Responsibilities.
3. Inputs.
4. Outputs.
5. Allowed actions.
6. Prohibited actions.
7. Prompt template.
8. Validation checklist.
9. Escalation rules.

### Phase 5 — CLI and Core Tooling

Implement a TypeScript CLI called `kf`.

CLI commands:

```bash
kf init-domain
kf validate-domain
kf create-source
kf discover
kf classify-license
kf ingest
kf normalize
kf chunk
kf tag
kf extract-claims
kf screen-risk
kf detect-conflicts
kf build-release
kf eval-rag
kf validate-release
```

Use TypeScript.

Use `zod` for schemas.

Use local filesystem storage first.

Avoid database dependency in v1.

Use JSON, YAML, Markdown, and JSONL formats.

### Phase 6 — Core Schemas

Implement schemas for:

1. DomainConfig.
2. SourceRecord.
3. LicenseClassification.
4. RawArtifactManifest.
5. NormalizedDocument.
6. ChunkRecord.
7. ClaimRecord.
8. RiskRecord.
9. ConflictRecord.
10. ReviewRecord.
11. ReleaseManifest.
12. EvaluationResult.

Schemas should live under:

```text
packages/core/src/schemas/
```

All CLI commands should validate inputs and outputs using these schemas.

### Phase 7 — Domain Templates

Create domain templates for:

```text
packages/domain-templates/generic/
packages/domain-templates/healthcare/
packages/domain-templates/legal/
packages/domain-templates/finance/
packages/domain-templates/enterprise/
```

Each domain template should include:

```text
domain.yaml
taxonomy.yaml
source_policy.yaml
evidence_model.yaml
risk_rules.yaml
review_workflow.yaml
eval_questions.yaml
```

The templates should be generic enough to be useful but safe enough for high-risk domains.

### Phase 8 — functional medicine Reference Domain

Create a functional medicine domain under:

```text
domains/functional-medicine/
examples/functional-medicine/
```

This should be a reference implementation only.

Do not hardcode functional medicine into the engine.

functional medicine domain should include:

1. Functional and longevity medicine taxonomy.
2. Biomarker-oriented entity types.
3. Pathway-oriented entity types.
4. Supplement and safety risk categories.
5. CMO / clinical SME review gates.
6. Healthcare-specific prohibited uses.
7. RAG-only default release policy.
8. Example evaluation questions.

### Phase 9 — Hooks and Guardrails

Create hooks under:

```text
skill/hooks/
```

Required hooks:

```text
pre-ingest-license-check.md
post-normalization-validate.md
post-chunk-schema-check.md
pre-release-gate-check.md
```

Also implement corresponding CLI checks where practical.

The system must block:

1. Red source ingestion.
2. Yellow or Orange source ingestion without approval.
3. Release with unresolved high-risk flags.
4. Release with chunks missing citations.
5. Release with license errors.
6. Release where training is allowed but sources are not training-approved.

### Phase 10 — Tests

Create tests for:

1. Domain config validation.
2. Source registry validation.
3. License classification rules.
4. Chunk schema validation.
5. Release manifest validation.
6. Pre-ingest gate.
7. Pre-release gate.
8. CLI happy path for a toy corpus.
9. CLI failure path for Red source ingestion.
10. CLI failure path for missing citations.

Use a small fixture corpus under:

```text
tests/fixtures/
```

### Phase 11 — Documentation

Create developer-facing docs:

```text
docs/getting-started.md
docs/architecture.md
docs/domain-config.md
docs/license-policy.md
docs/release-model.md
docs/marketplace-readiness.md
docs/functional-medicine-reference-domain.md
```

Documentation should explain:

1. What Knowledge Foundry is.
2. Why it exists.
3. How to install it.
4. How to create a new domain.
5. How to ingest sources.
6. How license gates work.
7. How to build a release.
8. How to evaluate a release.
9. How to extend agents and tools.
10. How to publish as a Claude Code skillset.

## Required Architecture Decisions

Make and document decisions on:

1. Package manager: npm, pnpm, or yarn.
2. CLI framework: commander, oclif, or simple custom parser.
3. Schema system: zod preferred.
4. Storage: local filesystem in v1.
5. Config format: YAML preferred for domain configs.
6. Record format: JSONL preferred for large record sets.
7. Test framework: Vitest preferred.
8. Build system: TypeScript compiler or tsup.
9. Module system: ESM or CJS.
10. Release artifact format.

Document these in:

```text
docs/decisions.md
```

## Required Acceptance Criteria

The first working version is complete only when all of the following are true:

1. `npm install` succeeds.
2. `npm test` succeeds.
3. `npm run build` succeeds.
4. `kf init-domain demo` creates a valid domain folder.
5. `kf validate-domain demo` validates the generated domain.
6. A toy source can be created and classified.
7. A Green source can pass pre-ingest validation.
8. A Red source is blocked from ingestion.
9. A toy normalized document can be chunked.
10. A chunk missing citation fails validation.
11. A release manifest can be generated.
12. A release with unresolved high-risk flags is blocked.
13. The functional medicine reference domain validates.
14. Skill files exist and are coherent.
15. Slash command files exist and map to CLI commands.
16. Agent files exist and include prompts and guardrails.
17. Documentation explains how to use and extend the skillset.
18. The project can be handed to another engineer or AI agent without additional context.

## Subagent Task Pattern

When assigning work to Sonnet 4.6 subagents, use this format:

```text
Subagent: <name>
Model: Sonnet 4.6
Task:
  <clear task>
Context:
  <files and requirements to read>
Files to modify:
  <explicit paths>
Expected output:
  <exact artifacts>
Acceptance criteria:
  <testable conditions>
Do not:
  <explicit prohibitions>
Return:
  <summary, changed files, validation results, open questions>
```

## Suggested Subagent Assignments

Use Sonnet 4.6 subagents like this:

### Subagent 1 — Repository Scaffolder

Task: create the initial folder structure, package files, TypeScript config, README, `.gitignore`, and placeholder docs.

### Subagent 2 — Schema Engineer

Task: implement zod schemas for domain config, source record, chunks, claims, risks, conflicts, release manifests, and eval results.

### Subagent 3 — CLI Engineer

Task: implement the `kf` CLI entrypoint and core commands with validation.

### Subagent 4 — Skillset Writer

Task: create `SKILL.md`, `CLAUDE.md`, `AGENTS.md`, command files, and agent files.

### Subagent 5 — Domain Template Engineer

Task: create generic, healthcare, legal, finance, and enterprise domain templates.

### Subagent 6 — functional medicine Reference Engineer

Task: create the functional medicine reference domain and example corpus config.

### Subagent 7 — Guardrail Engineer

Task: implement license gates, pre-ingest validation, pre-release validation, and failure paths.

### Subagent 8 — Test Engineer

Task: implement unit and integration tests covering acceptance criteria.

### Subagent 9 — Documentation Engineer

Task: build the developer docs and marketplace readiness docs.

### Subagent 10 — Release Reviewer

Task: run final validation, summarize gaps, identify risks, and prepare `v0.1` readiness checklist.

## Coding Standards

1. Prefer small, composable functions.
2. Keep schemas centralized.
3. Validate all external inputs.
4. Use deterministic outputs.
5. Avoid hidden global state.
6. Prefer explicit paths over magic assumptions.
7. Do not silently swallow errors.
8. Make CLI error messages clear and actionable.
9. Keep generated files human-readable.
10. Write docs alongside features.

## File and Data Format Standards

Use YAML for domain configuration.

Use JSON for manifests and structured metadata.

Use JSONL for source records, chunks, claims, risks, conflicts, and reviews.

Use Markdown for normalized human-readable documents.

Use stable IDs for:

```text
source_id
chunk_id
claim_id
risk_id
conflict_id
release_id
```

## License Classes

Implement these license classes:

```text
Green  = explicitly open or approved for ingestion
Yellow = free to access but reuse rights unclear; legal review required
Orange = commercial/proprietary; contract approval required
Red    = prohibited; never ingest
```

Allowed uses must be explicit:

```text
internal_search
rag
extraction
summarization
fine_tuning
customer_facing
commercial_distribution
```

Default rule:

```text
If uncertain, downgrade to the more restrictive license class.
```

Fine-tuning rule:

```text
fine_tuning = true only if explicit rights exist.
```

## Review States

Implement these review states:

```text
candidate
license_review
approved_for_ingestion
ingested
normalized
chunked
tagged
needs_review
approved
rejected
deprecated
```

## Release States

Implement these release states:

```text
draft
blocked
approved
indexed
deprecated
```

## Marketplace Readiness Goal

The project should eventually be publishable as:

1. A Claude Code skill bundle.
2. An npm CLI package.
3. A GitHub open-source repo.
4. A set of domain templates.
5. A reference implementation for specialized domains.

Design the repo and docs accordingly.

## First Milestone

The first milestone is **Knowledge Foundry v0.1**.

v0.1 should not attempt to build a full RAG application, vector database, hosted SaaS, or review UI.

v0.1 should deliver:

1. Skillset files.
2. CLI.
3. Schemas.
4. Local corpus artifact workflow.
5. Domain templates.
6. Functional medicine reference domain.
7. License and release gates.
8. Tests.
9. Documentation.

## Output Expectations

After completing each major phase, update:

```text
docs/implementation-log.md
docs/decisions.md
```

At the end, produce:

```text
docs/v0.1-readiness-report.md
```

The readiness report must include:

1. What was built.
2. What works.
3. What was intentionally deferred.
4. Known limitations.
5. Test results.
6. How to run the CLI.
7. How to use the Claude Code skill.
8. How to extend with new domains.
9. Next recommended milestones.

Begin by reading all files in `docs/requirements/`, then inspect the repo, then produce the implementation plan before creating files.
