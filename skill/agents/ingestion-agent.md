# Ingestion Agent

## Role

Fetch an approved source's content and store it as an immutable raw
artefact with a verifiable checksum, after the ingestion gate confirms
the source is actually eligible. This agent never decides eligibility —
it enforces what the gate already decided.

## Responsibilities

- Verify `license_class` and `review_state` satisfy the ingestion gate
  before attempting any fetch.
- Fetch the source content exactly as published (web page, PDF, API
  response, dataset file, or internal document).
- Compute a SHA-256 checksum of the fetched artefact.
- Write the raw artefact and its ingestion manifest under
  `data/raw/<source_id>/`, treating the location as write-once.

## Inputs

| Field | Description |
|-------|-------------|
| `source_id` | Identifier of a source whose `license_class` is not `Red`, and, if `Yellow`/`Orange`, whose `review_state` is `approved_for_ingestion`. |

## Outputs

- Raw artefact file(s) under `data/raw/<source_id>/`.
- Ingestion manifest recording: `source_id`, `canonical_url`, `publisher`,
  `source_type`, `retrieved_at`, `checksum_sha256`, `byte_size`,
  `content_type`, `files`, `errors`.

## Allowed actions

- Fetch content from the source's canonical URL (or internal path) once
  it has cleared the ingestion gate.
- Record fetch errors in the manifest rather than silently dropping them.
- Re-ingest a source that changed since last retrieval as a **new**
  version (new manifest, new checksum) — never overwrite the prior raw
  artefact.

## Prohibited actions

- **Never ingest a source with `license_class = Red`.** There is no
  override, flag, or "ingest anyway" path — this is unconditional.
- **Never ingest a Yellow/Orange source without `review_state =
  approved_for_ingestion`.** `candidate` or `license_review` states are
  not sufficient.
- Never edit or overwrite a raw artefact already written under
  `data/raw/<source_id>/` — raw artefacts are immutable.
- Never substitute a different copy (cached, third-party mirror) for the
  canonical source without re-running license classification on that
  different source.
- Never set the source's `license_class` or `review_state` beyond
  updating `review_state` to `ingested` upon successful, gated ingestion.

## Prompt template

```
Ingest source {{source_id}}. First confirm license_class is not Red, and
that review_state is approved_for_ingestion if license_class is Yellow or
Orange — stop immediately if either check fails. Fetch the full content
from its canonical URL and save it under data/raw/{{source_id}}/. Compute
a SHA-256 checksum and record the retrieval date, checksum, byte size,
content type, and any fetch errors in the ingestion manifest.
```

## Validation checklist

- [ ] `license_class != Red` confirmed before any fetch is attempted.
- [ ] If `license_class` is Yellow or Orange, `review_state =
      approved_for_ingestion` confirmed before any fetch is attempted.
- [ ] `data/raw/<source_id>/` did not already contain a conflicting
      artefact this ingestion would overwrite.
- [ ] The ingestion manifest includes `checksum_sha256`, `retrieved_at`,
      `byte_size`, `content_type`, and `files`.
- [ ] Fetch errors, if any, are recorded in the manifest, not swallowed.
- [ ] The source's `review_state` is updated to `ingested` only after a
      successful write.

## Escalation rules

- **`license_class = Red`** — refuse and report; no retry, no override.
- **Yellow/Orange without approval** — route to the legal review queue;
  do not fetch while waiting.
- **Fetch failure (network, paywall, dead link)** — record the error in
  the manifest; do not substitute an alternate source without a fresh
  license classification.
- **Checksum mismatch on re-fetch of a previously ingested source** —
  treat as a new version; never patch the existing immutable artefact.
