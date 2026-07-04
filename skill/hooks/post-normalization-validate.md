# Hook: post-normalization-validate

## Trigger

Runs immediately after `kf normalize` writes `document.md` and its
metadata sidecar for a source, before that source is eligible for
`kf chunk`. Runs once per normalization, and again any time a document is
re-normalized.

## Check performed

Schema validation of the normalized document and its metadata sidecar,
confirming required fields are present: title, sections/headings, and
citations. In addition, the hook re-verifies the normalized document's
recorded source checksum against the checksum in the raw artefact's
ingestion manifest, to confirm normalization ran against the actual
immutable raw artefact and not a stale or substituted copy.

## Blocking behavior

- Blocks progression to `kf chunk` for a source whose metadata sidecar
  fails schema validation (missing required field, empty title, no
  sections).
- Blocks progression to `kf chunk` when the recorded source checksum does
  not match the raw artefact's checksum — this indicates normalization
  ran against a different or corrupted raw artefact.
- Does not evaluate content quality (e.g. how well-organized the
  Markdown is) — only schema conformance and checksum integrity.

## Remediation guidance

- **Missing required field** — re-run normalization, ensuring headings,
  citations, and title are preserved from the source; do not hand-edit
  the metadata sidecar to satisfy the schema without fixing the
  underlying normalization.
- **Checksum mismatch** — do not proceed; re-verify the raw artefact under
  `data/raw/<source_id>/`, and if it is genuinely different, re-ingest as
  a new version before normalizing again.

## Related skill artefacts

- Command: `skill/commands/normalize-document.md`.
- Agent: `skill/agents/normalization-agent.md`.
