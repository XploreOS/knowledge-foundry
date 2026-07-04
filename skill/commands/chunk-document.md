# /chunk-document

## Purpose

Split a normalized document into semantically meaningful retrieval units
— chunked by domain meaning (guideline recommendation, legal provision,
financial metric, data table row) rather than an arbitrary token window —
so each unit is independently retrievable and traceable to its source.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `--source <source_id>` | Yes | The normalized source to chunk. |
| `--root <path>` | No | Workspace root; defaults to current working directory. |

## Preconditions

- `data/normalized/<source_id>/document.md` exists and passed
  normalization schema validation.

## Steps

1. Inspect the source type and select a chunking strategy:
   - **Guidelines** — chunk by recommendation or section.
   - **Research articles** — chunk by abstract, methods, results,
     discussion.
   - **Statutes/regulations** — chunk by article or paragraph.
   - **Data tables** — treat each row as a chunk.
   - Otherwise, follow domain-specific guidance in
     `domains/<domain_id>/taxonomy.yaml` if it defines chunk types.
2. Split the normalized document accordingly, preserving section path and
   an exact citation (source, section, page/anchor as available) for
   every chunk.
3. Run `kf chunk --source <source_id>` to write
   `data/chunks/<source_id>/chunks.jsonl`, one record per chunk:
   `chunk_id, section_path, text, citation`, plus placeholder fields for
   domain metadata (populated by the tagging stage).
4. Confirm every chunk has a non-empty citation before moving on — a
   chunk without one is not eligible for tagging, claim extraction, or
   release (Rule 5 in `skill/CLAUDE.md`).

## Outputs

- `data/chunks/<source_id>/chunks.jsonl`.

## Failure modes

- **Chunk without a citation** — `kf chunk` refuses to write the record,
  or flags it for remediation depending on configuration; never emit a
  chunk with a blank or fabricated citation.
- **Wrong strategy for source type** — e.g. treating a statute as free
  prose instead of chunking by article; re-run with the correct strategy
  rather than tagging around a bad split.
- **Chunks too coarse or too fine for retrieval** — if a chunk spans
  multiple unrelated recommendations, or splits a single recommendation
  across chunks, redo the split; this is a quality defect that will show
  up later as poor retrieval precision in `kf eval-rag`.

## Example invocation

"Split `nih-ods-vitamin-d` into guideline-level chunks. For each chunk,
include the section path and citation details. Store in JSONL."

## Related CLI command

`kf chunk`.

## Review gates

`kf chunk` enforces citation presence on every chunk record. No release
may include a chunk missing a citation (Rule 5, Rule 6 in
`skill/CLAUDE.md`), so this check effectively gates everything downstream.
