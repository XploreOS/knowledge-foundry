# /tag-chunks

## Purpose

Attach domain-specific metadata — topics, entities, chunk type, evidence
level, audience — to each chunk, using the domain's taxonomy and evidence
model, so retrieval and filtering can operate on domain-meaningful facets
rather than raw text alone.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `--source <source_id>` | Yes | Source whose chunks should be tagged. |
| `--domain <domain_id>` | Yes | Domain configuration supplying the taxonomy and evidence model. |
| `--root <path>` | No | Workspace root; defaults to current working directory. |

## Preconditions

- `data/chunks/<source_id>/chunks.jsonl` exists, every chunk has a
  citation.
- `domains/<domain_id>/taxonomy.yaml` and
  `domains/<domain_id>/evidence_model.yaml` are present and validated.

## Steps

1. Read the domain's taxonomy (entity types, chunk types, allowed metadata
   fields) and evidence model (grading scale).
2. For each chunk, identify topics/entities it relates to, classify its
   chunk type per the taxonomy, assign an evidence level per the evidence
   model, and identify its intended audience.
3. Confirm every assigned tag is a value the taxonomy actually defines —
   do not invent tags outside `domains/<domain_id>/taxonomy.yaml`.
4. Run `kf tag --source <source_id> --domain <domain_id>` to write the
   enriched chunk records back to `data/chunks/<source_id>/chunks.jsonl`.
5. Update the source record's `review_state` to `tagged` once complete.

## Outputs

- Updated `data/chunks/<source_id>/chunks.jsonl` with `topics`,
  `entities`, `chunk_type`, `evidence_level`, `audience` populated.

## Failure modes

- **Tag not defined in the domain taxonomy** — `kf tag` refuses or flags
  the record; add the tag to `domains/<domain_id>/taxonomy.yaml` first if
  it is genuinely missing from the domain model, rather than tagging with
  an undefined value.
- **Evidence level assigned without basis** — assign only what the
  chunk's own content and citation support; when uncertain, use the
  domain's lowest-confidence grade and flag for evidence review rather
  than guessing high.
- **Inconsistent allowed uses vs. license** — if a tag implies a use the
  source's `allowed_uses` doesn't permit (e.g. tagging a non-`rag`-licensed
  chunk for RAG retrieval), stop; this is a license consistency issue
  the release gate would catch anyway.

## Example invocation

"Tag the chunks of `nih-ods-vitamin-d` using the CoreAevo taxonomy.
Identify which biomarker, pathway and intervention each chunk relates to.
Assign an evidence level based on the domain's evidence model."

## Related CLI command

`kf tag`.

## Review gates

`kf tag` validates every tag against `domains/<domain_id>/taxonomy.yaml`
and every evidence level against `evidence_model.yaml`. Chunks with
inconsistent `allowed_uses` vs. source license are flagged as license
errors, which later block release (Rule 6 in `skill/CLAUDE.md`).
