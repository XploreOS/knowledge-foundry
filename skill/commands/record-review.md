---
description: Record a human reviewer decision on a source, chunk, claim, risk, conflict, or release
---

# /record-review

## Purpose

Record one human reviewer's decision — approval, rejection, edit, or
request for more information — on a target artefact as a `ReviewRecord`,
so that stage quorums declared in `review_workflow.yaml` can be enforced
in code rather than organizationally.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `--domain <domain_id>` | Yes | Domain the review belongs to. |
| `--target-type <type>` | Yes | One of `source`, `chunk`, `claim`, `risk`, `conflict`, `release`. |
| `--target-id <id>` | Yes | Id of the reviewed artefact (e.g. a `release_id`). |
| `--role <role>` | Yes | Reviewer role; must be declared in `domain.yaml`'s `review_roles`. |
| `--decision <d>` | Yes | One of `approved`, `rejected`, `edited`, `needs_info`. |
| `--reviewer <name>` | Yes | The human reviewer's identity (name or handle). |
| `--note <s>` | No | Free-form review note (e.g. what needs fixing). |
| `--root <path>` | No | Workspace root; defaults to current working directory. |

## Preconditions

- The domain exists and validates (`kf validate-domain`).
- The decision being recorded is a real human's decision. An agent may
  draft the material under review, but never invents or records a
  decision on a human's behalf (operating contract Rule 7).
- For `source` and `release` targets the artefact must already exist —
  the CLI refuses a review of an unknown id to catch typos.

## Steps

1. Run `kf review --domain <domain_id> --target-type <type>
   --target-id <id> --role <role> --decision <d> --reviewer <name>`.
2. The record is appended to `data/reviews/<domain_id>/reviews.jsonl`
   with a sequential `review_id` (`<domain>-review-<seq>`).
3. The command then prints the per-stage quorum status for the target —
   which `review_workflow.yaml` stages are now satisfied and which still
   lack sign-offs. `kf review-status` prints the same read-only.

## Outputs

- One appended `ReviewRecord` in `data/reviews/<domain_id>/reviews.jsonl`
  — the durable audit trail of who decided what, as which role, when.
- A per-stage quorum status report on stdout.

## Failure modes

- **Role not declared in `domain.yaml` `review_roles`** — refused; an
  undeclared role would silently never count toward any stage quorum.
- **Unknown target id (source/release)** — refused with a pointer to the
  command that creates it.
- **Invalid `--target-type` or `--decision`** — refused with the allowed
  values listed.

## Example invocation

"Record that legal counsel Alice approved release
`demo-rag-v0.1.0` for the demo domain, note: license posture verified."

## Related CLI command

`kf review` (record), `kf review-status` (inspect quorum state without
recording), `kf approve-release` (consumes the recorded sign-offs).

## Review gates

This command *is* the recording half of the review gates: the quorum gate
(`evaluateReviewWorkflow`) only ever counts decisions recorded here. A
reviewer's latest decision wins, so a `rejected` can be superseded by a
later `approved` from the same reviewer once the issue is fixed.
