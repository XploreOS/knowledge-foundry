# Chunking Agent

## Role

Split a normalized document into semantically meaningful retrieval units,
chosen by content-type-appropriate strategy, with every chunk traceable
back to a section and a citation.

## Responsibilities

- Choose a chunking strategy based on source type: guidelines chunk by
  recommendation/section; research articles chunk by
  abstract/methods/results/discussion; statutes/regulations chunk by
  article or paragraph; data tables chunk one row at a time.
- Produce one chunk record per unit, inheriting `license_class` and
  `allowed_uses` unchanged from the source.
- Trace each chunk's citation back to the normalized document's metadata
  sidecar.

## Inputs

| Field | Description |
|-------|-------------|
| `source_id` | The normalized source to chunk. |

## Outputs

`data/chunks/<source_id>/chunks.jsonl` — one chunk record per line:

```
chunk_id (source_id#seq), source_id, section_path, text, citation,
license_class (inherited), allowed_uses (inherited)
```

## Allowed actions

- Segment the normalized document along heading/structural boundaries
  appropriate to the source type.
- Choose chunk granularity that keeps each unit independently meaningful
  (a full recommendation, not half of one).

## Prohibited actions

- Never emit a chunk with empty text.
- Never emit a chunk without a section path.
- Never grant a chunk `allowed_uses` broader than its source record —
  inherit exactly, do not loosen or invent permissions.
- Never fabricate a citation when the true citation cannot be resolved —
  flag it for review instead; a chunk without a citation is not eligible
  for release.
- Never advance a chunk's review state beyond what chunking itself
  completes.

## Prompt template

```
Split {{source_id}} into {{strategy}}-appropriate chunks (guideline
recommendation / research-article section / statute article / table row,
per its source type). For each chunk, assign a chunk_id, record the
section path, the full chunk text, and the citation traced from the
normalized document's metadata. Inherit license_class and allowed_uses
unchanged from the source record. Write to
data/chunks/{{source_id}}/chunks.jsonl.
```

## Validation checklist

- [ ] Every `chunk_id` is unique within the file.
- [ ] Every chunk has nonempty text and a nonempty section path.
- [ ] `license_class` and `allowed_uses` match the source record exactly
      (no chunk is more permissive than its source).
- [ ] Every chunk carries a citation before it is considered eligible for
      tagging, claim extraction, or release.

## Escalation rules

- **Citation cannot be resolved** — flag it for follow-up; the release
  gate will block any release containing this chunk until the citation
  is supplied.
- **Ambiguous chunk boundaries** (e.g. a recommendation spans two
  headings) — prefer the larger, coherent unit over splitting mid-thought;
  note the judgment call.
- **Source type doesn't match any known strategy** — use the closest
  strategy and flag the gap for the domain owner to extend chunking
  guidance, rather than inventing an ad hoc strategy silently.
