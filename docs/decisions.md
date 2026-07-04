# Architecture Decisions — Knowledge Foundry

Running record of architecture decisions made by the Fable 5 orchestrator.
Each decision lists the choice, alternatives considered, and rationale.

## ADR-001 — Package manager: npm (with workspaces)

**Decision:** npm workspaces monorepo.
**Alternatives:** pnpm, yarn.
**Rationale:** npm ships with Node (v24 available on the build machine), requires zero extra installs for marketplace users, and workspaces are sufficient for a 4-package monorepo. Local-first constraint favors the lowest-dependency option.

## ADR-002 — CLI framework: commander

**Decision:** `commander`.
**Alternatives:** oclif (too heavy for v0.1), custom parser (re-invents help/subcommands/validation ergonomics).
**Rationale:** Small, stable, no scaffolding lock-in, first-class subcommand + option parsing, works cleanly in ESM.

## ADR-003 — Schema system: zod

**Decision:** `zod` (v3), all schemas centralized in `packages/core/src/schemas/`.
**Rationale:** Master prompt preference; runtime validation + inferred TypeScript types from a single source of truth. Every CLI command validates inputs and outputs against these schemas.

## ADR-004 — Storage: local filesystem, no database

**Decision:** All artefacts are files under `data/`, `releases/`, `evals/` inside a workspace directory. A `storage` module in core owns path layout and atomic writes; no other module builds paths by hand.
**Rationale:** v1 constraint (local-first, no DB). File layout mirrors docs/requirements/02: `data/source_registry/`, `data/raw/`, `data/normalized/`, `data/chunks/`, `data/claims/`, `data/risk/`, `data/conflicts/`, `releases/`, `evals/`.

## ADR-005 — Config format: YAML for domain configs

**Decision:** YAML (via the `yaml` package) for the 7 domain config files (`domain.yaml`, `taxonomy.yaml`, `source_policy.yaml`, `evidence_model.yaml`, `risk_rules.yaml`, `review_workflow.yaml`, `eval_questions.yaml`). Parsed then validated with zod.
**Rationale:** Human-editable by legal/SME reviewers; master prompt preference.

## ADR-006 — Record format: JSONL for record sets

**Decision:** JSONL for source records, chunks, claims, risks, conflicts, reviews. JSON for manifests (`manifest.json`, ingestion manifests, eval results). Markdown for normalized documents (with a JSON metadata sidecar).
**Rationale:** Streaming-friendly, line-diffable in git, each line independently schema-validated.

## ADR-007 — Test framework: Vitest

**Decision:** Vitest, run from the repo root over `tests/unit`, `tests/integration` plus package-level unit tests.
**Rationale:** Master prompt preference; native ESM + TypeScript support without transpile config.

## ADR-008 — Build system: tsc (TypeScript compiler)

**Decision:** Plain `tsc` per package with project references from a shared `tsconfig.base.json`.
**Alternatives:** tsup/esbuild bundling.
**Rationale:** Deterministic output, zero bundler config, keeps generated JS readable (coding standard #9). Bundling can be added later for npm publishing without changing source.

## ADR-009 — Module system: ESM

**Decision:** ESM only (`"type": "module"`, `moduleResolution: "NodeNext"`), Node >= 20.
**Rationale:** Node 20+ is the floor for current LTS; ESM avoids dual-build complexity in v0.1. CJS consumers are not a v0.1 target.

## ADR-010 — Release artifact format

**Decision:** A release is a directory `releases/<domain_id>/<release_id>/` containing:
- `manifest.json` — machine-readable `ReleaseManifest` (sources, license class counts, evidence summary, gate results, state, checksums of member files, and the embedded `evaluation` result once `kf eval-rag` has run)
- `approved_chunks.jsonl` — chunks that passed all gates and reviews

The canonical `EvaluationResult` file lives at `evals/<release_id>/results.json`; the manifest embeds a copy rather than duplicating a third file inside the release directory.
Release states: `draft → blocked | approved → indexed → deprecated`. The directory is treated as immutable once state leaves `draft`; corrections require a new release_id.
**Rationale:** Directory-of-files matches local-first storage, is trivially indexable by any RAG stack, and the manifest satisfies the machine-readable requirement. Zip/tarball export deferred past v0.1.

## ADR-011 — Gates are deterministic core functions, not LLM judgments

**Decision:** License, safety, citation, and release gates are pure TypeScript functions in `packages/core/src/gates/` (re-exported by licensing/release modules). The CLI, tests, and skill hooks all call the same functions. Agents may *prepare* data but a gate result comes only from code.
Blocked by code, always:
1. Red source ingestion.
2. Yellow/Orange ingestion without `approval_status=approved_for_ingestion`.
3. Release with unresolved high-risk flags.
4. Release containing chunks without citations.
5. Release with license errors (chunk allowed_uses inconsistent with source license).
6. Release with `fine_tuning=true` while any member source lacks explicit training rights.
**Rationale:** Master prompt operating principle — "Deterministic JS/TS tools enforce the rules."

## ADR-012 — Skill layout: `skill/` directory with markdown-defined commands/agents/hooks

**Decision:** `skill/SKILL.md`, `skill/CLAUDE.md`, `skill/AGENTS.md`, `skill/commands/*.md` (12), `skill/agents/*.md` (11), `skill/hooks/*.md` (4). Hooks are documented contracts that map to `kf` validation commands (e.g. pre-ingest hook runs `kf classify-license --check` / gate functions), so the guardrail logic lives once, in core.
**Rationale:** Keeps the skillset standalone and portable; every skill instruction maps to a deterministic CLI operation.

## ADR-013 — Domain genericity

**Decision:** The engine (core, cli, adapters) contains zero domain-specific strings. All domain behavior comes from `domains/<domain_id>/*.yaml` validated by `DomainConfig` schemas. Functional medicine ships only as `domains/functional-medicine/` + `examples/functional-medicine/` — deletable without touching the engine.
**Rationale:** Hard requirement: multiple domains through configuration, not code forks.

## ADR-014 — IDs and immutability

**Decision:** Stable, human-readable slug IDs (`source_id`, `chunk_id = <source_id>#<seq>`, `claim_id`, `risk_id`, `conflict_id`, `release_id = <domain>-<tier>-v<semver>`). Raw artefacts under `data/raw/<source_id>/` are write-once; every raw artefact carries a SHA-256 checksum recorded in its ingestion manifest, verified before normalization.
**Rationale:** Provenance and auditability requirements; checksums make immutability checkable, not just conventional.
