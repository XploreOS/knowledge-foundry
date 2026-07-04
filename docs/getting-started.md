# Getting Started

A 10-minute walkthrough: install the project, stand up a toy domain, and
push one source through the full 13-stage pipeline to a versioned,
evaluated release. See [architecture.md](architecture.md) for how the
pieces fit together, [domain-config.md](domain-config.md) for the YAML
files referenced below, and [license-policy.md](license-policy.md) /
[release-model.md](release-model.md) for the gates this walkthrough
exercises.

## Prerequisites

- Node.js >= 20
- npm (ships with Node; this repo uses npm workspaces — see
  [decisions.md ADR-001](../docs/decisions.md))

## Install

```bash
npm install
npm run build
npm test

# Link the CLI so `kf` resolves on PATH
npm link -w @knowledge-foundry/cli
```

`npm run build` compiles `packages/core`, `packages/adapters`, and
`packages/cli` with `tsc` (ADR-008). `npm test` builds, then runs Vitest
across the workspace (ADR-007).

## The workspace concept

Every `kf` command reads and writes under a **workspace root** —
the directory containing `domains/`, `data/`, `releases/`, and `evals/`.
The root defaults to the current working directory. Override it two ways,
both equivalent:

```bash
kf validate-domain demo --root /path/to/workspace
# or
KF_ROOT=/path/to/workspace kf validate-domain demo
```

`packages/core/src/storage/` owns all path construction from the root —
no other module builds a path by hand (contract-spec.md §5). Every path
shown below is relative to the workspace root.

## 10-minute walkthrough

The walkthrough builds one toy domain (`demo`), registers one Green
(safely reusable) source, and carries it all the way to an evaluated
release. Run each command from your workspace root.

### 1. Scaffold and validate the domain

```bash
kf init-domain demo
kf validate-domain demo
```

**Artefacts:** `domains/demo/domain.yaml`, `taxonomy.yaml`,
`source_policy.yaml`, `evidence_model.yaml`, `risk_rules.yaml`,
`review_workflow.yaml`, `eval_questions.yaml` — the seven files every
domain must define (contract-spec.md §3). `kf init-domain` scaffolds them;
you must edit in real scope, taxonomy, risk rules, and review roles before
anything downstream is meaningful — see
[domain-config.md](domain-config.md). `kf validate-domain` parses and
zod-validates all seven against the `DomainConfig` schema. **No other
pipeline stage may run against `demo` until this passes.**

### 2. Register a toy source

```bash
kf create-source --domain demo --source-id onboarding-guide \
  --title "New Hire Onboarding Guide" \
  --publisher "Internal" \
  --type internal_document \
  --topics onboarding \
  --likely-license Green \
  --priority P0
```

**Artefact:** an appended `SourceRecord` in
`data/source_registry/demo/*.jsonl`, with `review_state: "candidate"` and
`likely_license: "Green"` (a discovery-time guess, not yet a confirmed
`license_class`).

### 3. Classify the license and record approval

```bash
kf classify-license --domain demo --source onboarding-guide --class Green --approve
```

**Artefact:** the source record is updated with `license_class: "Green"`,
`allowed_uses` (from `source_policy.yaml`'s Green defaults), and
`legal_review_required: false`. `--approve` records the human approval
decision as `approval_status: "approved_for_ingestion"` — see
[license-policy.md](license-policy.md) for exactly when approval is
required versus implied by Green.

### 4. Ingest

```bash
kf ingest --source onboarding-guide --file ./onboarding-guide.md
```

**Artefacts:** the raw file written immutably under
`data/raw/onboarding-guide/`, plus a `RawArtifactManifest` at
`data/raw/onboarding-guide/manifest.json` recording `checksum_sha256`,
`retrieved_at`, `byte_size`, and `content_type`. `review_state` advances
to `"ingested"`.

**Gate:** `preIngestGate` runs first. Because the source is Green, it
passes. If it were Red, or Yellow/Orange without
`approval_status = "approved_for_ingestion"`, `kf ingest` would refuse
unconditionally — see [license-policy.md](license-policy.md).

### 5. Normalize

```bash
kf normalize --source onboarding-guide
```

**Artefacts:** `data/normalized/onboarding-guide/document.md` (clean
Markdown, boilerplate stripped, headings/tables/citations preserved) and
a metadata sidecar `data/normalized/onboarding-guide/metadata.json`
(`headings`, `toc`, `citations`, `source_checksum_sha256`). The raw
artefact's checksum is re-verified before conversion.

### 6. Chunk

```bash
kf chunk --source onboarding-guide
```

**Artefact:** `data/chunks/onboarding-guide/chunks.jsonl`, one
`ChunkRecord` per line — `chunk_id` (e.g. `onboarding-guide#0001`),
`section_path`, `text`, `citation`, `license_class`, `allowed_uses`
(inherited from the source). `citation` may be empty at this point, but
nothing downstream can release a chunk that stays that way.

### 7. Tag

```bash
kf tag --source onboarding-guide --domain demo
```

**Artefact:** the same `chunks.jsonl`, enriched with `topics`, `entities`,
`chunk_type`, `evidence_level`, and `audience` — every value drawn from
`domains/demo/taxonomy.yaml` and `evidence_model.yaml`. `review_state`
advances to `"tagged"`.

### 8. Extract claims

```bash
kf extract-claims --source onboarding-guide
```

**Artefact:** `data/claims/onboarding-guide/claims.jsonl`, one
`ClaimRecord` per claim — `claim_text`, `population_or_scope`,
`intervention`, `outcome`, `evidence_level`, `limitations`.

### 9. Screen risk

```bash
kf screen-risk --source onboarding-guide --domain demo
```

**Artefact:** `data/risk/onboarding-guide/risk.jsonl`, one `RiskRecord`
per match against `domains/demo/risk_rules.yaml` — `risk_type`,
`severity` (`low`/`medium`/`high`), `action` (`flag`/`block`/`downgrade`),
`resolved: false`. Nothing here resolves itself; a human reviewer sets
`resolved: true` later.

### 10. Detect conflicts

```bash
kf detect-conflicts --domain demo
```

**Artefact:** `data/conflicts/demo/<topic>.jsonl` — empty (or absent) for
a single-source toy domain, since a conflict needs two or more
contradicting chunks. This becomes meaningful once a second source
covering the same topic is added.

### 11. Build the release

```bash
kf build-release --domain demo --release-id demo-rag-v0.1.0
```

**Artefacts:** `releases/demo/demo-rag-v0.1.0/manifest.json` (a
`ReleaseManifest` — `source_count`, `license_class_counts`,
`evidence_summary`, `chunk_count`, `gate_results`, `blockers`, `state`)
and `releases/demo/demo-rag-v0.1.0/approved_chunks.jsonl`.

**Gate:** `preReleaseGate` runs here. It blocks the release (`state:
"blocked"`, with reasons in `blockers`) if any member source is Red, any
Yellow/Orange member source lacks approval, any chunk has an unresolved
high-severity risk flag, any chunk is missing a citation, the intended
use isn't permitted by every member source, or `fine_tuning` is requested
without explicit training rights on every source. With one clean Green
source, `demo-rag-v0.1.0` starts at `state: "draft"`. See
[release-model.md](release-model.md).

### 12. Validate the release

```bash
kf validate-release --domain demo --release-id demo-rag-v0.1.0
```

Re-runs every release gate against the current state of the manifest's
member sources, chunks, and risk records — catching regressions (e.g. a
risk flag reopened, or a source's approval revoked since `build-release`
ran). A release cannot move from `draft`/`blocked` to `approved` while
`validate-release` reports a blocker, and — per `skill/SKILL.md` — it
also cannot be marked `approved` without an `EvaluationResult` attached
(next step). In practice, run `kf eval-rag` before asking human reviewers
to approve the release, even though `validate-release` itself does not
require it to have already run.

### 13. Evaluate RAG quality

```bash
kf eval-rag --domain demo --release-id demo-rag-v0.1.0
```

**Artefacts:** `evals/demo-rag-v0.1.0/results.json` — an
`EvaluationResult` with `citation_coverage`, `retrieval_precision`,
`unsafe_output_rate`, `license_errors`, and a `per_question` breakdown
against `domains/demo/eval_questions.yaml` — also embedded in the
release manifest's `evaluation` field.

## What just happened: the gates

Three gate functions did all the enforcement above, and they are pure
TypeScript in `packages/core/src/gates/`, never LLM judgment (ADR-011):

- **`preIngestGate`** — blocked step 4 unless the source was Green, or
  Yellow/Orange with recorded approval.
- **`citationGate`** — would have blocked step 11 if any chunk from step
  6 still had an empty citation.
- **`preReleaseGate`** — evaluated all six release-blocking conditions at
  step 11 (and again at step 12) and produced the `gate_results` /
  `blockers` you see in the manifest.

No agent, prompt, or skill instruction can talk any of these into passing
early. See [license-policy.md](license-policy.md) and
[release-model.md](release-model.md) for the full rules, and
[../skill/CLAUDE.md](../skill/CLAUDE.md) for the operating contract every
agent in this skillset follows.

## Where to go next

- Add a second source on the same topic to see `kf detect-conflicts`
  produce a real conflict record.
- Try a Yellow or Red source to see `preIngestGate` refuse it — see
  [license-policy.md](license-policy.md).
- Replace `demo` with the shipped reference domain:
  [functional-medicine-reference-domain.md](functional-medicine-reference-domain.md)
  walks the same pipeline against `domains/functional-medicine/`.
- Read [domain-config.md](domain-config.md) before writing a real domain
  — do not invent domain rules inline; every behavior must come from the
  seven YAML files.
