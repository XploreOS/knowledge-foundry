---
description: Evaluate a release's retrieval quality against the domain's eval questions
---

# /evaluate-rag

## Purpose

Run automated retrieval and safety tests against a release using the
domain's representative question set, to measure whether the release is
actually good enough to serve RAG, internal search, or training use cases
before it is approved.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `--release-id <id>` | Yes | The release to evaluate. |
| `--domain <domain_id>` | Yes | Domain configuration supplying the evaluation question set. |
| `--root <path>` | No | Workspace root; defaults to current working directory. |

## Preconditions

- `releases/<domain_id>/<release_id>/manifest.json` and
  `approved_chunks.jsonl` exist (release has been built via
  `kf build-release`).
- `domains/<domain_id>/eval_questions.yaml` is present and validated.

## Steps

1. Load the domain's representative evaluation questions from
   `domains/<domain_id>/eval_questions.yaml`.
2. For each question, run retrieval against the release's
   `approved_chunks.jsonl` and generate a response using only retrieved
   chunks.
3. Score each response for: citation coverage (does every factual
   statement trace to a retrieved chunk's citation), retrieval precision
   (are the retrieved chunks actually relevant), unsafe output rate (does
   any response surface content that should have been screened out), and
   license compliance (does the response respect each chunk's
   `allowed_uses`).
4. Run `kf eval-rag --release-id <release_id> --domain <domain_id>` to
   write the canonical `EvaluationResult` to
   `evals/<release_id>/results.json` with the aggregated metrics and
   per-question results.
5. Embed the same results in the release manifest's `evaluation` field
   for release reviewers.

## Outputs

- `evals/<release_id>/results.json` — citation coverage, retrieval
  precision, unsafe output rate, license errors, and per-question detail
  (also embedded in `releases/<domain_id>/<release_id>/manifest.json`'s
  `evaluation` field).

## Failure modes

- **Question set missing or too small to be representative** — report
  this; do not fabricate additional questions outside
  `domains/<domain_id>/eval_questions.yaml` to pad coverage.
- **Low citation coverage or retrieval precision** — this is a legitimate
  evaluation result, not a failure of the command; it signals that
  chunking, tagging, or source coverage needs improvement upstream before
  the release is approved.
- **Unsafe output detected** — record it plainly in the results; this is
  exactly what evaluation exists to catch, and it should route back to
  risk screening or human review, not be smoothed over in the metrics.

## Example invocation

"Evaluate release `coreaevo-p0-v0.1` using the CoreAevo evaluation
questions. Report citation coverage and highlight any unsafe responses."

## Related CLI command

`kf eval-rag`.

## Review gates

Evaluation results are a required input to release review — legal,
domain experts, and the product owner review the metrics before a release
moves from `draft` to `approved`. A release cannot be approved without
`evals/<release_id>/results.json` present and embedded in its manifest's
`evaluation` field.
