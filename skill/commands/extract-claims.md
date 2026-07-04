# /extract-claims

## Purpose

Identify explicit claims, recommendations, or facts stated in a source's
chunks, and capture them as structured records — population/scope,
intervention, outcome, evidence level, limitations — so claims can be
independently reviewed, graded, and checked for conflicts with other
sources.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `--source <source_id>` | Yes | Source (or its approved chunks) to analyse. |
| `--root <path>` | No | Workspace root; defaults to current working directory. |

## Preconditions

- `data/chunks/<source_id>/chunks.jsonl` exists and has been tagged.

## Steps

1. Read each tagged chunk and identify explicit claims: statements that
   recommend, caution, or summarise evidence — not implicit inference or
   paraphrase beyond what the text supports.
2. For each claim, record: `claim_text`, `population_or_scope`,
   `intervention`, `outcome`, `evidence_level`, `limitations`.
3. Base `evidence_level` on the chunk's own tagged evidence level and the
   claim's own wording — do not upgrade a claim's evidence level beyond
   what its source chunk supports.
4. Run `kf extract-claims --source <source_id>` to write
   `data/claims/<source_id>/claims.jsonl`.
5. Flag ambiguous or borderline claims for subject-matter expert review
   rather than silently resolving the ambiguity.

## Outputs

- `data/claims/<source_id>/claims.jsonl`.

## Failure modes

- **Claim not actually stated in the text** — if extraction infers
  something the source doesn't explicitly say, drop it or mark it as
  inferred with lower confidence; do not present inference as a direct
  claim.
- **Missing required field** — `kf extract-claims` refuses a record
  missing `population_or_scope`, `intervention`, `outcome`, or
  `evidence_level`; fill from the source chunk or flag for review, don't
  leave it blank.
- **Evidence level inflation** — assigning a claim a stronger evidence
  grade than its source chunk supports is a defect subject-matter review
  should catch; flag rather than assert if uncertain.

## Example invocation

"From each chunk in `nih-ods-vitamin-d`, extract claims that recommend,
caution or summarise evidence. Describe the population, intervention and
outcome in structured fields. Save to `claims.jsonl`."

## Related CLI command

`kf extract-claims`.

## Review gates

Claims are subject to evidence review by subject-matter experts, who may
adjust `evidence_level` or `limitations`. Agents draft claim records; only
a human review adjusts and confirms the final evidence level used in a
release.
