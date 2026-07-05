# Implementation Log — Knowledge Foundry

Maintained by the Fable 5 orchestrator. Newest entries at the bottom.

## 2026-07-04 — Phase 0: Repository assessment and implementation plan

### 1. Repo assessment

- **Repo type:** docs-only. Contents before this build: `docs/requirements/01–06*.md`, `docs/prompts/01-master-prompt.md`, `.claude/settings.local.json`. No `package.json`, no source code, not a git repository.
- **Toolchain:** Node v24.15.0, npm 11.6.1, git 2.54 (Windows). Meets all needs; no installs required beyond npm packages.
- **Conclusion:** Greenfield build. The target structure from the master prompt is adopted as-is (no existing layout to reconcile). Existing `docs/` files are preserved untouched; new docs are added alongside them. Repo will be `git init`-ed so domain configs and releases are versioned (per requirements 06).
- **Requirements gaps noted (resolved by orchestrator decision, none product-direction-changing):**
  - Master prompt lists `kf create-source` and `kf validate-release` — not described in requirements docs; implemented as registry-entry creation and release-gate re-check respectively.
  - Requirements name the reference domain "CoreAevo"; master prompt says functional medicine and warns against hardcoding. Resolution: domain_id `functional-medicine`, with CoreAevo-style taxonomy content.
  - "Sonnet 4.6" subagents requested; harness exposes model tier `sonnet` — used for all implementation subagents.
  - No paid APIs in basic mode → discovery agent operates on user-supplied/manual candidate lists and web fetch; no search-API dependency in the CLI.

### 2. Implementation phases

| Phase | Content | Owner |
|---|---|---|
| 0 | Assessment, plan, decisions, git init, root + package scaffolding (package.json workspaces, tsconfigs, vitest, README, LICENSE, .gitignore) | Fable 5 (orchestrator) |
| Wave A (parallel) | A1 zod schemas · A2 skillset files (SKILL/CLAUDE/AGENTS + 12 commands + 11 agents + 4 hooks) · A3 five domain templates · A4 functional-medicine reference domain + example | Sonnet subagents |
| Wave B (sequential) | B1 core library modules + deterministic gates + adapters (needs A1) · B2 `kf` CLI, 15 commands (needs B1) | Sonnet subagents |
| Wave C (parallel) | C1 Vitest unit/integration tests + fixtures · C2 developer docs (7 files) | Sonnet subagents |
| Final | Orchestrator review of all output, `npm install/build/test`, run the 18 acceptance criteria end-to-end, fix gaps, `docs/v0.1-readiness-report.md`, commit | Fable 5 (orchestrator) |

### 3. Subagent task breakdown (all Sonnet, constrained scope, disjoint file paths)

1. **Schema Engineer** → `packages/core/src/schemas/` — 12 schemas (DomainConfig, SourceRecord, LicenseClassification, RawArtifactManifest, NormalizedDocument, ChunkRecord, ClaimRecord, RiskRecord, ConflictRecord, ReviewRecord, ReleaseManifest, EvaluationResult) + shared enums (license classes, allowed uses, review states, release states, ingestion priorities).
2. **Skillset Writer** → `skill/` — SKILL.md, CLAUDE.md, AGENTS.md, 12 command files, 11 agent files, 4 hook files, each with the section structure mandated by the master prompt.
3. **Domain Template Engineer** → `packages/domain-templates/{generic,healthcare,legal,finance,enterprise}/` — 7 YAML files each, schema-conformant; plus stub example READMEs for legal/finance/enterprise under `examples/`.
4. **Functional Medicine Engineer** → `domains/functional-medicine/` (7 YAML) + `examples/functional-medicine/` (walkthrough + sample candidate sources + toy corpus inputs).
5. **Core Engineer** → `packages/core/src/{storage,sourceRegistry,licensing,gates,ingestion,normalization,chunking,tagging,claims,risk,conflicts,release,evals}/` + `packages/adapters/src/{web,pdf,markdown,json,csv,localFs}/` (minimal v0.1 adapters; pdf = passthrough stub with clear error).
6. **CLI Engineer** → `packages/cli/src/` — commander entrypoint `kf` + 15 commands mapping 1:1 to core functions, schema-validated I/O, actionable errors, correct exit codes.
7. **Test Engineer** → `tests/{unit,integration,fixtures}/` — the 10 mandated test areas including Red-source ingestion block and missing-citation failure, plus toy-corpus happy path.
8. **Documentation Engineer** → `docs/{getting-started,architecture,domain-config,license-policy,release-model,marketplace-readiness,functional-medicine-reference-domain}.md`.
9. **Release Reviewer role** is retained by the orchestrator (final review, gap analysis, readiness report) per the master prompt's ownership split.

### 4. v0.1 acceptance criteria (verbatim from master prompt; all must pass)

1. `npm install` succeeds. 2. `npm test` succeeds. 3. `npm run build` succeeds. 4. `kf init-domain demo` creates a valid domain folder. 5. `kf validate-domain demo` validates it. 6. A toy source can be created and classified. 7. A Green source passes pre-ingest validation. 8. A Red source is blocked from ingestion. 9. A toy normalized document can be chunked. 10. A chunk missing citation fails validation. 11. A release manifest can be generated. 12. A release with unresolved high-risk flags is blocked. 13. The functional-medicine reference domain validates. 14. Skill files exist and are coherent. 15. Slash command files map to CLI commands. 16. Agent files include prompts and guardrails. 17. Documentation explains use and extension. 18. Project is handoff-ready without additional context.

### 5. Initial architecture decisions (see below)

## 2026-07-04 — Wave A complete: schemas, skillset, templates, reference domain

- **Schemas (A1)**: 12 zod schemas + shared enums frozen in `packages/core/src/schemas/`; `tsc` clean. A prior-session agent had left divergent schema files (object citations, split license enums); these were replaced wholesale with contract-spec-conformant versions.
- **Skillset (A2)**: `skill/` complete — SKILL.md, CLAUDE.md, AGENTS.md, 12 commands, 11 agents, 4 hooks; all mandated sections present; `--workspace` → `--root` inconsistency fixed by orchestrator review.
- **Templates (A3) + functional medicine (A4)**: all 5 templates and `domains/functional-medicine/` now pass `DomainConfig.safeParse` (ALL_VALID). Schema widened by orchestrator decision to adopt the richer template shapes: self-documenting `{id,name,description}` entity/chunk types, `audiences`/`topics`/`metadata_fields[]` in taxonomy, optional `source_types`, blocker records, risk-category records, per-rule `applies_to`, eval `thresholds` + `unsafe_if`, `evidence_model.default_level`. Conformance rules enforced the other way where safety demanded: `ingestable` key removed (ingestability derives from gates only), `severity: critical` mapped to `high` (gates block on `high`), `min_approvals` → `quorum`, `must_cite` → `expects_citation`.
- **Incident**: session limit killed three subagents mid-flight; orchestrator finished the YAML conformance inline and re-verified. Model policy going forward per user: Sonnet for medium tasks, Opus for high-complexity (core, CLI, tests).

## 2026-07-05 — Waves B, C and final acceptance: v0.1 COMPLETE

- **Core (B1, Opus)**: storage/ids/gates + 11 stage modules + adapters; both packages build clean; 7-case gate smoke check passed. Orchestrator approved all 6 documented deviations (safe over-blocking, evaluateRelease superset, Unknown→uncertain_defaults_to resolution).
- **CLI (B2, Opus)**: 15 `kf` commands; full pipeline smoke-tested end-to-end incl. negative paths (Red BLOCKED, unapproved Yellow BLOCKED, blocked release manifests). Orchestrator hardened `classifyLicense`: Red now terminally `rejected` regardless of policy `requires_review`.
- **Docs (C2, Sonnet)**: 7 developer docs. Its consistency findings were fixed by the orchestrator: `--workspace`→`--root` in 12 command files, `kf init-domain --validate`→`kf validate-domain` in 7 READMEs, `critical` severity removed from 3 skill files (enum is low|medium|high), ADR-010 aligned on `evals/<release_id>/results.json`, positional domain args in 3 docs. An encoding regression from a PowerShell batch edit (UTF-8 read as ANSI, 143 mojibake occurrences in 21 files) was caught and fully repaired via git restore + a UTF-8-safe Node re-edit.
- **Tests (C1, Opus, resumed after session-limit interruption)**: 60 tests / 10 files, all passing; covers every mandated area incl. CLI e2e happy path and both CLI failure paths; zero source bugs found.
- **Final acceptance (orchestrator)**: fresh `npm test` (build + 60/60), live `kf init-domain demo` / `validate-domain demo` / `validate-domain functional-medicine` all pass. **18/18 acceptance criteria met** — see `docs/v0.1-readiness-report.md`.

### Architecture decisions reference

Recorded as ADR-001 … ADR-014 in `docs/decisions.md`: npm workspaces; commander; zod; local-FS storage module; YAML domain configs; JSONL records / JSON manifests; Vitest; tsc builds; ESM + Node ≥ 20; directory-based release artifact with machine-readable manifest; deterministic code-only gates; markdown-defined skill commands/agents/hooks backed by CLI checks; zero domain strings in the engine; slug IDs + SHA-256-checksummed immutable raw artefacts.
