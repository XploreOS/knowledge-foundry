# /normalize-document

## Purpose

Convert a raw artefact into a clean, structured Markdown or JSON document
while preserving headings, tables, figure captions, and citations, and
stripping navigation, ads, and boilerplate — so the chunking stage has
clean, structurally faithful input.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `--source <source_id>` | Yes | The ingested source to normalize. |
| `--root <path>` | No | Workspace root; defaults to current working directory. |

## Preconditions

- Raw artefact exists under `data/raw/<source_id>/` with a recorded
  checksum.
- The raw artefact's checksum is re-verified before conversion begins —
  normalization never proceeds against a raw artefact that fails its
  integrity check.

## Steps

1. Verify the raw artefact's checksum against the ingestion manifest.
2. Strip navigation, ads, and boilerplate; do not strip headings, tables,
   figure captions, or citations.
3. Convert to clean Markdown (or structured JSON, for API/dataset
   sources), preserving the document's structure.
4. Write a metadata sidecar capturing headings, table of contents, page
   numbers, and any other structural metadata worth preserving for
   chunking.
5. Run `kf normalize --source <source_id>` to write the output under
   `data/normalized/<source_id>/` and to run schema validation on the
   result (required fields: title, sections, citations).
6. If schema validation fails, flag the source for review and
   remediation rather than forcing a partial normalization forward.

## Outputs

- `data/normalized/<source_id>/document.md`
- Metadata sidecar (JSON) alongside it, capturing headings/TOC/citations
  structure.

## Failure modes

- **Checksum mismatch on the raw artefact** — stop; do not normalize
  content that fails its integrity check. Re-ingest instead.
- **Missing required fields (title, sections, citations)** — schema
  validation fails; flag for review rather than fabricating placeholder
  citations or section headers.
- **Over-aggressive stripping** — if citations, tables, or figure
  captions are lost in cleanup, treat this as a normalization defect and
  redo the conversion rather than shipping incomplete structure forward.

## Example invocation

"Normalize the `nih-ods-vitamin-d` document. Remove navigation and ads,
preserve headings and tables, and output a Markdown file and metadata
JSON."

## Related CLI command

`kf normalize`.

## Review gates

Schema validation on the normalized output (title, sections, citations
present) is enforced by `kf normalize` before the source's `review_state`
advances to `normalized`. Failures route to review and remediation, not
forward into chunking.
