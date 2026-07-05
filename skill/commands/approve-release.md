---
description: Approve a draft release once the gate re-passes, evaluation is attached, and every required review stage has its recorded sign-off quorum
---

# /approve-release

## Purpose

Promote a draft release to `state: approved` — and refuse, with every
reason listed, while any release-blocking condition, missing evaluation,
or unsatisfied review-workflow stage remains. Approval is the enforced
outcome of recorded human sign-offs, never a manifest edit.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `--domain <domain_id>` | Yes | Domain the release belongs to. |
| `--release-id <id>` | Yes | The release to approve. |
| `--root <path>` | No | Workspace root; defaults to current working directory. |

## Preconditions

- The release exists and is in state `draft` (a `blocked` release must be
  fixed and rebuilt; anything past `draft` is immutable).
- `kf eval-rag` has run, so an `EvaluationResult` is attached to the
  manifest, and its metrics have been weighed against
  `eval_questions.yaml` thresholds by the release reviewers.
- The required reviewers have recorded their sign-offs on this release
  via `kf review --target-type release --target-id <release_id>`.

## Steps

1. Run `kf approve-release --domain <domain_id> --release-id <id>`.
2. The command re-runs the full pre-release gate against the live corpus
   (a source approval revoked or a risk flag reopened since
   `build-release` blocks approval).
3. It verifies an `EvaluationResult` is attached.
4. It aggregates the `ReviewRecord`s recorded against this release and
   evaluates every `review_workflow.yaml` stage's quorum
   (`evaluateReviewWorkflow` — pure, in `packages/core/src/gates/`).
5. Only if everything passes does it set `state: approved` and bump
   `updated_at`; on any blocker the manifest is left untouched and the
   command exits non-zero with every reason printed.

## Outputs

- `releases/<domain_id>/<release_id>/manifest.json` with
  `state: "approved"` — or unchanged, with a printed blocker list.
- A per-stage sign-off breakdown on stdout either way.

## Failure modes

- **Missing sign-offs** — one line per unsatisfied stage naming the
  missing roles or the shortfall against the quorum count.
- **A recorded rejection** — blocks the stage outright until the same
  reviewer records a superseding decision.
- **No `EvaluationResult`** — run `kf eval-rag` first.
- **Pre-release gate regression** — fix the underlying artefact and
  re-validate; do not hand-edit the manifest.
- **Release not in `draft`** — a `blocked` release must be rebuilt; an
  `approved`/`indexed`/`deprecated` release is immutable (corrections
  mean a new `release_id`).

## Example invocation

"All four reviewers have signed off on `demo-rag-v0.1.0` — approve the
release."

## Related CLI command

`kf approve-release`, fed by `kf review` / `kf review-status`, after
`kf build-release`, `kf validate-release`, and `kf eval-rag`.

## Review gates

This is the release-review gate made executable: `review_workflow.yaml`
declares who must sign off at each stage and with what quorum, and this
command refuses to flip `state` until those declarations are satisfied by
recorded `ReviewRecord`s. No agent, prompt, or deadline can bypass it.
