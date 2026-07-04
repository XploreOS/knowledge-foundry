# /discover-source

## Purpose

Search for candidate sources (documents, APIs, datasets) relevant to a
domain and topic, and record provisional source registry entries for human
and downstream review. This is the entry point of the pipeline — nothing
downstream exists until a candidate is on record.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `--domain <domain_id>` | Yes | Domain the candidates belong to. |
| `--topic <topic>` | Yes | Subject area to search for (e.g. "insulin resistance guideline", "employment law jurisdiction conflicts"). |
| `--source-type <type>` | No | Restrict to a content type (guideline, regulation, research article, dataset, API, internal document). |
| `--max-candidates <n>` | No | Cap on number of candidate records produced. Defaults to a conservative value to avoid flooding the registry. |
| `--root <path>` | No | Workspace root; defaults to current working directory. |

## Preconditions

- `domains/<domain_id>/` exists and passes `kf validate-domain`.
- The topic is specific enough to yield a bounded, reviewable set of
  candidates — an overly broad topic produces noise that wastes reviewer
  time downstream.

## Steps

1. Confirm the domain is initialized and validated.
2. Search for candidate resources matching `domain` + `topic` (+
   `source_type` if given), using controlled searches consistent with
   `domains/<domain_id>/source_policy.yaml`.
3. For each candidate, record title, publisher, canonical URL, source
   type, domain tags, a *likely* license class (`Green|Yellow|Orange|Red|Unknown`
   — a hint, not a confirmed classification), and an ingestion priority
   (`P0|P1|P2`).
4. Write the candidates as one JSONL record per line to
   `data/source_registry/candidates/<domain_id>/<date>-<topic>.jsonl`.
5. Stop at `--max-candidates`; do not keep expanding the search
   unprompted.

## Outputs

- `data/source_registry/candidates/<domain_id>/<date>-<topic>.jsonl` —
  one record per candidate:
  `source_id, title, publisher, canonical_url, source_type, domain, topics, likely_license, ingestion_priority, notes`.

## Failure modes

- **Zero candidates found** — report this plainly; do not lower the bar
  on relevance just to produce output.
- **Ambiguous or unreachable source** — record it with `likely_license =
  Unknown` and a note; do not guess a specific class from insufficient
  evidence (see Rule 8 in `skill/CLAUDE.md`).
- **Duplicate candidate** — check existing registry entries for the same
  `canonical_url` before writing a new record; update `notes` on the
  existing entry instead of duplicating.

## Example invocation

"Search for open-access guidelines on cardiometabolic risk for the
`coreaevo` domain. For each candidate, record title, URL, publisher and
licence hints. Limit to 20 results. Save to
`data/source_registry/candidates/coreaevo/2026-07-04-cardiometabolic.jsonl`."

## Related CLI command

`kf discover`. For a single, manually-identified source, use
`kf create-source` (supporting command) instead of a full search.

## Review gates

None yet — candidates are provisional. `likely_license` is a hint for the
license classifier agent, not a gate input. No ingestion may occur from
this stage's output directly.
