# Release Model

A release is the unit of shipment: a versioned, machine-readable snapshot
of a domain's approved corpus, evaluated and gated before anyone points a
RAG stack, search index, or fine-tuning job at it. This document covers
release directory anatomy, the `ReleaseManifest` schema, release states,
immutability, the `release_id` format, `gate_results`, and how `kf
eval-rag` attaches metrics that gate promotion. See
[license-policy.md](license-policy.md) for the six blocking conditions
referenced throughout, and [getting-started.md](getting-started.md) for a
runnable build-through-evaluate walkthrough.

## Release directory anatomy

```
releases/<domain_id>/<release_id>/
├── manifest.json          ReleaseManifest — machine-readable summary
└── approved_chunks.jsonl  Member chunks that passed every gate and review
```

`evals/<release_id>/results.json` holds the canonical `EvaluationResult`
once `kf eval-rag` has run; the same result is also embedded in
`manifest.json`'s `evaluation` field. It is not a third file inside the
release directory — the release directory holds only `manifest.json` and
`approved_chunks.jsonl`.

## `manifest.json` — the `ReleaseManifest` schema

```
release_id: string                          # "<domain>-<tier>-v<semver>"
domain_id: string
state: ReleaseState                         # draft|blocked|approved|indexed|deprecated
created_at, updated_at: string              # ISO-8601 UTC
intended_use: AllowedUse key | AllowedUse key[]   # what this release is FOR
source_count: number
sources: { source_id: string, license_class: LicenseClass }[]
license_class_counts: Record<LicenseClass, number>   # Green/Yellow/Orange/Red/Unknown -> count
evidence_summary: Record<string, number>    # evidence_level -> count
chunk_count: number
gate_results: { gate: string, passed: boolean, details: string }[]
blockers: string[]                          # human-readable; empty when state != blocked
member_files: { path: string, checksum_sha256: string }[]
evaluation?: EvaluationResult               # filled by `kf eval-rag`
```

- `license_class_counts` always has all five keys (`Green`, `Yellow`,
  `Orange`, `Red`, `Unknown`), each a nonnegative integer count of member
  sources.
- `intended_use` may be a single `AllowedUse` key (e.g. `"rag"`) or a list
  — `preReleaseGate` checks every use in the list against every member
  source.
- `gate_results` gives a named, per-gate breakdown — one entry per named
  check (e.g. `red_source`, `source_approval`, `unresolved_high_risk`,
  `chunk_citation`, `intended_use_license`, `fine_tuning_rights`), each
  with `passed: boolean` and a `details` string (a pass description when
  clean, the specific failing reasons joined together when not).
- `blockers` is the flat, human-readable rollup of every failing gate
  across the manifest — this is what `kf build-release` / `kf
  validate-release` print on failure, and what a release reviewer reads
  first.
- `member_files` records every file this release depends on, each with
  its own `checksum_sha256`, so the release's contents are independently
  verifiable.

## `approved_chunks.jsonl`

One `ChunkRecord` per line — the exact member set that passed every gate
(citation present, license-consistent, no unresolved high-severity risk)
and every required human review for this release's intended use. This is
the file a downstream RAG/search/fine-tuning system actually consumes;
`manifest.json` is the audit trail describing it.

## `evaluation` / `EvaluationResult`

```
release_id, domain_id, evaluated_at: string
question_count: number
citation_coverage: number       # 0..1
retrieval_precision: number     # 0..1
unsafe_output_rate: number      # 0..1
license_errors: number
per_question: {
  question: string,
  retrieved_chunk_ids: string[],
  has_citation: boolean,
  unsafe: boolean,
  notes?: string
}[]
```

Written to `evals/<release_id>/results.json` by `kf eval-rag`, then
embedded verbatim into `manifest.json`'s `evaluation` field so a release
reviewer never has to cross-reference two files to see both the gate
results and the evaluation metrics together.

## Release states

```
draft → blocked | approved → indexed → deprecated
```

- **`draft`** — `kf build-release` produced a manifest with no blocking
  condition present. Pending human release review and (per
  `../skill/SKILL.md`) an attached `EvaluationResult`.
- **`blocked`** — one or more of the six release-blocking conditions
  (see [license-policy.md](license-policy.md)) is present. The manifest
  records every reason in `blockers[]`; nothing is silently dropped.
  Fix the underlying issue and re-run `kf build-release` — do not hand-
  edit the manifest to force `state` to something else.
- **`approved`** — legal, domain experts, and the product owner have
  jointly signed off per `domains/<domain_id>/review_workflow.yaml`'s
  `release_review` stage, `kf validate-release` reports no blocker, and
  an `EvaluationResult` is attached. Only reachable from a clean
  `draft`/`blocked` re-check.
- **`indexed`** — the release has been integrated into its target system
  (vector index, search index, training pipeline) per `intended_use`.
- **`deprecated`** — superseded by a newer release; retained for audit
  history, no longer the active release for its domain/tier.

## Immutability

A release directory is treated as immutable once `state` leaves `draft`.
There is no in-place correction: a fix means building a **new**
`release_id`, never editing a shipped manifest or chunk set. This mirrors
raw-artefact immutability (ADR-014) — both exist so that anyone auditing
a release later can trust that what they're looking at is exactly what
was reviewed and approved, not something patched afterward.

## `release_id` format

```
<domain>-<tier>-v<semver>
```

Example: `functional-medicine-p0-v0.1.0`, `demo-rag-v0.1.0`. `<tier>` is a
domain-chosen label for the release's scope or priority (e.g. `p0`, `rag`,
a named cohort) — not a fixed enum. `<semver>` follows standard semantic
versioning. `release_id`, like every id in this system, is a lowercase,
human-readable slug (`../docs/internal/contract-spec.md` §0) — never
constructed by hand in a way that diverges from what `kf build-release`
produces.

## `gate_results` in practice

Each entry corresponds to one of the six checks in
`evaluateRelease()` (`packages/core/src/gates/index.ts`):

| `gate` | Passes when |
|--------|-------------|
| `red_source` | No member source is license class Red. |
| `source_approval` | Every Yellow/Orange member source has `approval_status === "approved_for_ingestion"`. |
| `unresolved_high_risk` | No member chunk carries an unresolved `RiskRecord` with `severity === "high"`. |
| `chunk_citation` | Every member chunk has a non-empty citation. |
| `intended_use_license` | Every member source's `allowed_uses` permits every use in `intended_use`. |
| `fine_tuning_rights` | If `intended_use` includes `fine_tuning`, every member source has `allowed_uses.fine_tuning === true`. |

`preReleaseGate` returns `{ allowed, blockers }`; the richer
`evaluateRelease` (which `preReleaseGate` wraps) also returns the full
`checks: ReleaseCheck[]` array that becomes `gate_results` in the
manifest. Blocker order is 1–6 as listed, deduplicated, so the manifest's
`blockers[]` reads in a stable, deterministic order every time
(`../docs/internal/contract-spec.md` §6 — deterministic output ordering).

## How `kf eval-rag` attaches metrics and gates promotion

```bash
kf eval-rag --domain <domain_id> --release-id <release_id>
```

1. Loads `domains/<domain_id>/eval_questions.yaml`.
2. Runs retrieval against `approved_chunks.jsonl` for every question,
   generating a response using only retrieved chunks.
3. Scores each response: `has_citation` (does the answer trace to a
   retrieved chunk's citation), `retrieved_chunk_ids` (were the right
   chunks retrieved), `unsafe` (did screened-out content surface anyway).
4. Aggregates into `citation_coverage`, `retrieval_precision`,
   `unsafe_output_rate`, `license_errors`, and writes
   `evals/<release_id>/results.json`, embedding the same object into
   `manifest.json`'s `evaluation` field.
5. If `eval_questions.yaml` declares `thresholds`
   (`citation_coverage`, `retrieval_precision`, `unsafe_output_rate`),
   these are the bar release reviewers check the computed metrics
   against before agreeing to move `state` to `approved` — a release
   cannot be marked `approved` without `evaluation` present, regardless
   of what the numbers say; low scores are a legitimate, expected
   evaluation result that should send the release back upstream (better
   chunking, tagging, or source coverage), not get smoothed over.

`kf eval-rag` does not itself flip `state`; it supplies the evidence human
release reviewers weigh alongside `gate_results` and `blockers` when
deciding to approve.
