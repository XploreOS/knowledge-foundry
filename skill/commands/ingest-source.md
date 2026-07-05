---
description: Ingest an approved source raw artefact write-once (pre-ingest license gate enforced)
---

# /ingest-source

## Purpose

Download or fetch an approved source and store it as an immutable raw
artefact, with a verifiable checksum and retrieval metadata, so that
every later transformation traces back to an unaltered original.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `--source <source_id>` | Yes | The approved source to ingest. |
| `--root <path>` | No | Workspace root; defaults to current working directory. |

## Preconditions

- Source record exists and `license_class` is not `Red`.
- If `license_class` is `Yellow` or `Orange`, `review_state =
  approved_for_ingestion` is recorded on the source.
- `data/raw/<source_id>/` does not already contain a version this
  ingestion would collide with (immutability — see Rule 4).

## Steps

1. Verify the source's `license_class` and `review_state` satisfy the
   ingestion gate (Rules 1–2 in `skill/CLAUDE.md`). If not, stop — do not
   attempt the fetch.
2. Fetch the source content (web page, PDF, API response, dataset file,
   or internal document) exactly as published.
3. Compute a SHA-256 checksum of the fetched artefact.
4. Run `kf ingest --source <source_id>` to write the raw artefact under
   `data/raw/<source_id>/` and record an ingestion manifest with retrieval
   date, checksum, and any fetch errors.
5. Update the source record's `review_state` to `ingested`.

## Outputs

- Raw artefact(s) under `data/raw/<source_id>/` (HTML, PDF, JSON, CSV, …).
- Ingestion manifest recording retrieval date, checksum, and errors.

## Failure modes

- **`license_class = Red`** — `kf ingest` refuses unconditionally. Do not
  retry, do not ask for an override; there isn't one.
- **`license_class` is Yellow/Orange without `approved_for_ingestion`** —
  `kf ingest` refuses. Route to the legal review queue (see
  `skill/CLAUDE.md` §3) and wait for approval.
- **Fetch failure (network, paywall, dead link)** — record the error in
  the ingestion manifest; do not substitute a cached or third-party copy
  without re-running license classification on that different source.
- **Checksum mismatch on re-fetch** — treat as a new version, not a
  correction to the existing immutable artefact.

## Example invocation

"Ingest source `nih-ods-vitamin-d`. Download the full article and save it
under `data/raw/nih-ods-vitamin-d/`. Record the retrieval date and
checksum."

## Related CLI command

`kf ingest`.

## Review gates

Enforced automatically by `kf ingest`: Red is always blocked; Yellow/Orange
requires `approved_for_ingestion`. No agent-side override exists for
either condition.
