---
description: Classify a source license (Green/Yellow/Orange/Red) and record allowed uses and approval
---

# /classify-license

## Purpose

Determine the confirmed license class and allowed uses of a candidate
source, based on its actual terms of service, license text, or contract —
turning a provisional `likely_license` hint into a `license_class` the
rest of the pipeline can trust.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `--source <source_id>` | Yes | The candidate source to classify. |
| `--domain <domain_id>` | Yes | Domain, for `source_policy.yaml` rules on blocked source types/licenses. |
| `--root <path>` | No | Workspace root; defaults to current working directory. |

## Preconditions

- The source record exists in `data/source_registry/` (from discovery or
  `kf create-source`).
- `domains/<domain_id>/source_policy.yaml` is present and validated.

## Steps

1. Locate and read the source's actual terms of service, license text, or
   contract — not a guess based on the publisher's reputation.
2. Cross-reference `domains/<domain_id>/source_policy.yaml` for any domain
   rule that blocks this source type or license outright.
3. Determine `license_class` (`Green|Yellow|Orange|Red`) from the terms.
   If terms are silent, ambiguous, or contradictory, choose the more
   restrictive plausible class (Rule 8 in `skill/CLAUDE.md`) and set
   `legal_review_required = true`.
4. Determine `allowed_uses` — boolean flags for `internal_search`, `rag`,
   `extraction`, `summarization`, `fine_tuning`, `customer_facing`,
   `commercial_distribution` — strictly from what the terms grant.
   `fine_tuning = true` requires an explicit grant, never an absence of
   prohibition.
5. Run `kf classify-license --source <source_id>` to record the
   classification. Yellow/Orange sources are automatically routed to the
   legal review queue.
6. Do not set `review_state = approved_for_ingestion` — that is a human
   decision recorded separately, never part of classification.

## Outputs

- Updated source record in `data/source_registry/` with `license_class`,
  `allowed_uses`, `legal_review_required`.

## Failure modes

- **Terms unavailable** — classify as the most restrictive plausible class
  (typically Orange or Red depending on source type) and flag for legal
  review; do not default to Green.
- **Domain policy blocks this source type/license outright** — `kf
  classify-license` will reflect the block; do not attempt to reclassify
  around it.
- **Evidence contradicts a previous `likely_license` hint** — the
  confirmed classification always wins over the discovery-stage hint.
- **Fabricated allowed_uses** — never set an allowed-use flag to `true`
  without a specific clause supporting it; when in doubt, `false`.

## Example invocation

"Review the terms of service for `nih-ods-vitamin-d`. Based on the ODS
site policy, classify the licence class and whether the content can be
used for RAG and internal search. Update the source record accordingly."

## Related CLI command

`kf classify-license`.

## Review gates

Yellow and Orange classifications route to the legal review queue and
require `review_state = approved_for_ingestion` (set by a human) before
`kf ingest` will proceed. Red classifications block ingestion permanently
— no review can override a Red classification; only a re-classification
based on new evidence can change it.
