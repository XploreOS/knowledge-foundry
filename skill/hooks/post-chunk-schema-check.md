# Hook: post-chunk-schema-check

## Trigger

Runs immediately after `kf chunk` writes
`data/chunks/<source_id>/chunks.jsonl`, before that source's chunks are
eligible for `kf tag`. Runs once per chunking pass, and again any time a
source is re-chunked.

## Check performed

Two checks in sequence:

1. **Schema validation** of every chunk record: `chunk_id` present and
   unique within the file, `section_path` nonempty, `text` nonempty,
   `citation` present as a field (may be empty pre-review),
   `license_class` and `allowed_uses` present and equal to the source
   record's values.
2. **Citation completeness check**, run per chunk as an early-warning
   pass: any chunk with an empty or whitespace-only citation is flagged
   as citation-incomplete. This is the same check `kf build-release` runs
   at release time, invoked here proactively so citation gaps are caught
   right after chunking instead of discovered late at release assembly.

## Blocking behavior

- **Schema failures always block.** A chunk missing `chunk_id`,
  `section_path`, or `text`, a duplicate `chunk_id`, or a
  `license_class`/`allowed_uses` mismatch against the source record fails
  the hook outright — `kf tag` may not run against this source's chunks
  until fixed.
- **Citation-incomplete chunks do not block schema validation** (an empty
  citation is a valid, if incomplete, chunk record), but any such chunk is
  reported and remains ineligible for release until a citation is
  supplied — `kf build-release` will exclude it, and a release containing
  it will be blocked, if it is force-included.

## Remediation guidance

- **Schema failure** — re-run `kf chunk` after fixing the underlying
  chunking defect (missing field, duplicate ID, inherited license
  mismatch); do not hand-edit `chunks.jsonl` to satisfy the schema.
- **Citation-incomplete chunk** — resolve the citation (through the
  chunking or tagging pass, or a human editor) before the chunk can be
  included in a release.

## Related skill artefacts

- Command: `skill/commands/chunk-document.md`.
- Agent: `skill/agents/chunking-agent.md`.
