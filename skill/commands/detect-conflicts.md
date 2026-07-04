# /detect-conflicts

## Purpose

Find contradictions across chunks from different sources on the same
topic within a domain — conflicting thresholds, recommendations, or
findings — and record them for expert review rather than letting
inconsistent guidance ship silently in the same corpus.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `--domain <domain_id>` | Yes | Domain configuration and scope for comparison. |
| `--topic <topic>` | No | Restrict comparison to a specific topic; omit to scan all tagged topics in the domain. |
| `--root <path>` | No | Workspace root; defaults to current working directory. |

## Preconditions

- Chunks across at least two sources in the domain have been tagged with
  overlapping topics (from `kf tag`).
- `domains/<domain_id>/taxonomy.yaml` defines the topic vocabulary being
  compared.

## Steps

1. Gather tagged chunks (and their claims, if extracted) across all
   approved sources in `domain_id` sharing the topic(s) in scope.
2. Compare statements, thresholds, and recommendations across those
   chunks for genuine contradictions — not just differences in phrasing,
   or differences fully explained by a different population, jurisdiction,
   or scope.
3. For each real contradiction, produce a conflict record: `conflict_id`,
   `domain_id`, `topic`, the two or more conflicting `chunk_ids`, a
   plain-language description of the nature of the conflict, and
   supporting citations for the reviewer to act on.
4. Run `kf detect-conflicts --domain <domain_id> [--topic <topic>]` to
   write `data/conflicts/<domain_id>/<topic>.jsonl`.

## Outputs

- `data/conflicts/<domain_id>/<topic>.jsonl` — one conflict record per
  line, always referencing at least two conflicting chunk IDs.

## Failure modes

- **Fewer than two conflicting chunks** — invalid; a conflict requires at
  least two conflicting chunks by definition.
- **False positive** — differences attributable to different populations,
  jurisdictions, or scopes are not conflicts; do not over-flag benign
  variation as contradiction.
- **Conflict without supporting citations** — insufficient for a reviewer
  to act on; always cite what each side of the conflict is based on.
- **Auto-resolving a conflict** — prohibited; this command only ever
  produces open conflict records for review, never a resolution.

## Example invocation

"Compare vitamin D upper limits across all approved CoreAevo sources.
Identify conflicting thresholds and output a conflict record for CMO
review."

## Related CLI command

`kf detect-conflicts`.

## Review gates

Conflicts are routed to the expert review queue defined in
`domains/<domain_id>/review_workflow.yaml`. Only a human reviewer resolves
a conflict record. Chunks that are part of an unresolved conflict should
be treated with caution during release assembly and are surfaced to
release reviewers, informing — but not automatically blocking — the
release decision.
