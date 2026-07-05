# Architecture

How Knowledge Foundry is put together: the 13-stage pipeline, the
agents-orchestrate/tools-enforce split, the monorepo layout, the module
map of `packages/core`, and why the gates are pure functions. See
[getting-started.md](getting-started.md) for a runnable walkthrough of
this pipeline, [domain-config.md](domain-config.md) for the YAML that
parameterizes it, and [release-model.md](release-model.md) for the
release artifact this pipeline produces.

## Operating principle: agents orchestrate, tools enforce

Claude Code agents do every judgment-heavy step — searching, reading,
classifying, tagging, summarizing, extracting claims. A deterministic
TypeScript CLI (`kf`) enforces every rule that must never bend: license
gates, citation checks, release gates. This is not a convention; it is
enforced in code (ADR-011, [`../skill/CLAUDE.md`](../skill/CLAUDE.md) §1):

> Agents propose. `kf` disposes. No agent, prompt, or skill instruction
> can approve a source, resolve a risk flag, or ship a release — those
> are human decisions recorded through `kf` and checked by `kf`'s gate
> functions.

Concretely: an agent may draft a suggested `license_class`, a risk flag,
or a proposed evidence level. Only a human, acting through a `kf`
command, changes `review_state`, resolves a `RiskRecord`, or moves a
release's `state`. The gate functions themselves — `preIngestGate`,
`citationGate`, `licenseConsistencyGate`, `preReleaseGate` — live once,
in `packages/core/src/gates/`, and are called identically by the CLI, the
test suite, and the skill's hooks (ADR-011). See
[license-policy.md](license-policy.md) for what each gate blocks.

## The 13-stage pipeline

| # | Stage | Produces |
|---|-------|----------|
| 1 | Source discovery | Candidate `SourceRecord`s |
| 2 | License classification | `license_class`, `allowed_uses`, `legal_review_required` |
| 3 | Source registry approval | `approval_status = "approved_for_ingestion"` (human decision) |
| 4 | Ingestion | Immutable raw artefact + `RawArtifactManifest` (checksum, retrieval date) |
| 5 | Normalization | Clean Markdown/JSON + metadata sidecar |
| 6 | Semantic chunking | `chunks.jsonl` — section path, text, citation |
| 7 | Domain tagging | Chunks enriched with topics, entities, chunk type, evidence level, audience |
| 8 | Claim extraction | `claims.jsonl` — claim text, population, intervention, outcome, evidence level, limitations |
| 9 | Risk screening | `risk.jsonl` — risk type, severity, action, resolved |
| 10 | Conflict detection | `conflicts/*.jsonl` — contradictions across sources on shared topics |
| 11 | Human review | Reviewers approve, edit, or reject flagged chunks, claims, conflicts, sources |
| 12 | Versioned release | `manifest.json` + `approved_chunks.jsonl` |
| 13 | RAG evaluation | Citation coverage, retrieval precision, unsafe output rate, license errors |

Each stage's output is the next stage's input. Before invoking a stage,
verify the required upstream artefact exists and is schema-valid; do not
fabricate missing data to keep moving (`../skill/AGENTS.md`).

## Data flow

```
 discover/create-source        classify-license          (human approval)
 ───────────────────────►  SourceRecord  ───────────►  license_class,   ───────────►  approval_status
   candidate                                            allowed_uses                  = approved_for_ingestion
                                                                                              │
                                                                                              ▼
                                                                                        preIngestGate
                                                                                              │ pass
                                                                                              ▼
                    normalize                    chunk                    tag                ingest
 RawArtifactManifest ───────► NormalizedDocument ───────► ChunkRecord[] ───────► ChunkRecord[] ◄──┘
 (data/raw/<id>/)             (data/normalized/<id>/)     (no tags yet)          (tagged)
                                                                 │
                                       ┌─────────────────────────┼─────────────────────────┐
                                       ▼                         ▼                         ▼
                              extract-claims             screen-risk               detect-conflicts
                              ClaimRecord[]               RiskRecord[]              ConflictRecord[]
                              (data/claims/)              (data/risk/)              (data/conflicts/)
                                       │                         │                         │
                                       └─────────────────────────┼─────────────────────────┘
                                                                  ▼
                                                          (human review gates)
                                                                  │
                                                                  ▼
                                                            build-release
                                                          preReleaseGate ── blocked? ──► manifest.state=blocked, blockers[]
                                                                  │ pass
                                                                  ▼
                                              ReleaseManifest (state: draft) + approved_chunks.jsonl
                                                                  │
                                                                  ▼
                                                            eval-rag ──► EvaluationResult
                                                                  │      (evals/<release_id>/results.json,
                                                                  │       embedded in manifest.evaluation)
                                                                  ▼
                                      review (recorded sign-offs per review_workflow.yaml stage)
                                                                  │
                                                                  ▼
                                     approve-release ── quorum/gate/eval unmet? ──► blocked, reasons[]
                                                                  │ pass
                                                                  ▼
                                                          state: approved
                                                                  │
                                                                  ▼
                                                    indexed  ──►  deprecated (new release_id to correct)
```

## Monorepo layout

```
knowledge-foundry/
├── skill/                  Claude Code skillset (SKILL.md, CLAUDE.md, AGENTS.md,
│                           commands/, agents/, hooks/) — see below
├── packages/
│   ├── core/               @knowledge-foundry/core — domain-agnostic library:
│   │                       zod schemas, storage layout, pipeline operations, gates
│   ├── cli/                @knowledge-foundry/cli — the `kf` CLI (commander), 1:1
│   │                       with core operations
│   ├── adapters/           @knowledge-foundry/adapters — format/source adapters:
│   │                       web, localFs, markdown, json, csv, pdf (stub)
│   └── domain-templates/   Starter domain configs: generic, healthcare, legal,
│                           finance, enterprise (copy, then adapt)
├── domains/
│   └── functional-medicine/  Reference domain — 7 YAML files, deletable
├── examples/               Worked walkthroughs per domain/template
└── docs/                   This documentation
```

Four packages (ADR-001): `core`, `adapters`, `cli`, `domain-templates`, wired
together with npm workspaces (root `package.json`). `packages/domain-templates`
ships YAML + READMEs only, no compiled code.

## Module map: `packages/core/src/`

| Module | Responsibility |
|--------|-----------------|
| `schemas/` | Every zod schema (ADR-003) — `enums.ts` (shared enums, single source of truth), then one file per record type: `sourceRecord`, `licenseClassification`, `rawArtifactManifest`, `normalizedDocument`, `chunkRecord`, `claimRecord`, `riskRecord`, `conflictRecord`, `reviewRecord`, `releaseManifest`, `evaluationResult`, `domainConfig`. Re-exported from `schemas/index.ts`. |
| `storage/` | Owns all path construction under the workspace root (`--root` / `KF_ROOT`). Typed read/write helpers (`readJsonl`, `writeJsonl`, `appendJsonl`, `readJson`, `writeJson`, `readMarkdown`, `writeMarkdown`, domain config load). Raw artefacts are write-once — refuses overwrite unless `--force` (ADR-004, ADR-014). |
| `sourceRegistry/` | Source discovery/creation, candidate record management. |
| `licensing/` | License classification logic; wraps `preIngestGate`. |
| `gates/` | **Pure functions, no IO.** `preIngestGate`, `citationGate`, `licenseConsistencyGate`, `preReleaseGate` (and the underlying `evaluateRelease`). See below. |
| `ingestion/` | Fetch/store raw artefacts, checksum computation, ingestion manifests. |
| `normalization/` | Raw artefact → Markdown/JSON + metadata sidecar, checksum re-verification. |
| `chunking/` | Semantic chunk splitting, citation propagation. |
| `tagging/` | Applies domain taxonomy/evidence model to chunks. |
| `claims/` | Claim extraction into `ClaimRecord`s. |
| `risk/` | Applies `risk_rules.yaml` to produce `RiskRecord`s. |
| `conflicts/` | Cross-source contradiction detection. |
| `release/` | Release assembly (`preReleaseGate` consumer), manifest construction. |
| `evals/` | RAG evaluation runner, `EvaluationResult` construction. |
| `domain/` | `DomainConfig` loading/validation from the 7 YAML files. |
| `ids/` | Slug/ID construction and validation (`Id` schema, `chunk_id`, `release_id` formats). |
| `internal/` | Shared internals not part of the public `@knowledge-foundry/core` surface. |

## Why gates are pure functions (ADR-011)

`packages/core/src/gates/index.ts` exports plain functions with no I/O and
no hidden state:

```ts
preIngestGate(source: SourceRecord): { allowed: boolean; reasons: string[] }
citationGate(chunk: ChunkRecord): { allowed: boolean; reasons: string[] }
licenseConsistencyGate(chunk, source, intendedUse): { allowed: boolean; reasons: string[] }
preReleaseGate(input): { allowed: boolean; blockers: string[] }
```

Being pure means: identical input always produces identical output, they
are trivially unit-testable without a filesystem, and — critically — the
CLI, the test suite, and the skill's hooks (`skill/hooks/*.md`) all call
the *same* function. There is exactly one place a "Red source blocked" or
"missing citation" decision is made. An agent cannot talk a gate into a
different answer because the gate has no concept of a conversation; it
only has its typed input. See [license-policy.md](license-policy.md) for
what each gate blocks and why.

## Monorepo, skill, and domain layers

- **`skill/`** — the Claude Code skillset. `SKILL.md` (when/why to use
  this skill, the pipeline table, non-negotiable rules), `CLAUDE.md` (the
  binding operating contract: rules, stage-gating table, escalation
  routes, file layout), `AGENTS.md` (index of the 11 pipeline agents),
  `commands/*.md` (12 files, one per user-facing slash command),
  `agents/*.md` (11 files, one per pipeline-stage agent), `hooks/*.md` (4
  files, documented contracts mapping to gate functions) (ADR-012).
- **`domains/<domain_id>/`** — the only place domain-specific behavior
  lives. The engine contains zero domain-specific strings (ADR-013); see
  [domain-config.md](domain-config.md).
- **`data/`, `releases/`, `evals/`** — generated artefacts under the
  workspace root, in the layout fixed by `skill/CLAUDE.md` §4 and
  contract-spec.md §5.

## Toolchain decisions (ADRs)

| Choice | ADR | Why |
|--------|-----|-----|
| npm workspaces | ADR-001 | Zero extra installs for marketplace users; ships with Node. |
| `commander` for the CLI | ADR-002 | Small, stable, first-class ESM subcommand parsing. |
| `zod` v3 for schemas | ADR-003 | Runtime validation + inferred TS types from one source of truth. |
| Local filesystem, no DB | ADR-004 | v0.1 local-first constraint; `storage/` owns all paths. |
| YAML for domain config | ADR-005 | Human-editable by legal/SME reviewers. |
| JSONL for record sets, JSON for manifests, Markdown+sidecar for documents | ADR-006 | Streaming-friendly, line-diffable in git, independently validated per line. |
| Vitest | ADR-007 | Native ESM + TS support, no transpile config. |
| Plain `tsc` per package | ADR-008 | Deterministic output, no bundler config, readable generated JS. |
| ESM only, Node >= 20 | ADR-009 | Avoids dual-build (CJS/ESM) complexity in v0.1. |
| Directory-of-files release artifact | ADR-010 | Matches local-first storage; trivially indexable by any RAG stack. |
| Gates as pure core functions | ADR-011 | "Deterministic JS/TS tools enforce the rules." |
| `skill/` markdown-defined commands/agents/hooks | ADR-012 | Standalone, portable skillset; every instruction maps to a `kf` operation. |
| Zero domain strings in the engine | ADR-013 | Multiple domains through configuration, not code forks. |
| Slug IDs + SHA-256 checksums | ADR-014 | Provenance and auditability; checksums make immutability checkable. |

See [../docs/decisions.md](../docs/decisions.md) for the full ADR text.
