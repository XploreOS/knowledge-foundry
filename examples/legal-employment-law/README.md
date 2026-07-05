# Example: Legal — Employment Law Corpus

Builds a small employment-law research corpus from the `legal` domain
template, end to end: two public Green sources flow through the full
pipeline to an **approved** release, and a licensed legal-research database
is classified Red and blocked before ingestion. The corpus content is
fictional ("State of Exampleton") — see `corpus/`.

| source_id | type | license | what it demonstrates |
|---|---|---|---|
| `state-labor-code-title-8` | statute | Green | public statute; statutes chunk by paragraph |
| `agency-compliance-guidance` | regulation | Green | agency guidance; feeds the regulatory/IP/litigation eval questions |
| `vendor-annotated-commentary` | practitioner_commentary | Red | licensed database content; `preIngestGate` refuses it unconditionally |

Files: `sample-sources.jsonl` (candidate records), `corpus/*.md` (toy
inputs), `reference-release/manifest.json` (the manifest this walkthrough
produces, committed for comparison).

## Walkthrough

Run from an empty workspace directory (or pass `--root <dir>` to every
command).

```sh
# 1. Domain from the legal template
kf init-domain employment-law --template legal
kf validate-domain employment-law

# 2. Register the sources (fields mirror sample-sources.jsonl)
kf create-source --domain employment-law --source-id state-labor-code-title-8 \
  --title "State Labor Code, Title 8 - Employment Relations" \
  --publisher "State of Exampleton Legislature" \
  --url "https://law.exampleton.gov/labor-code/title-8" \
  --source-type statute --topics employment_law,contracts,litigation \
  --likely-license Green --priority P0

kf create-source --domain employment-law --source-id agency-compliance-guidance \
  --title "Agency Guidance: Product Launch Filings and Trade Secret Claims" \
  --publisher "Exampleton Office of Consumer Affairs" \
  --url "https://consumer.exampleton.gov/guidance/product-launch-filings" \
  --source-type regulation --topics regulatory_compliance,intellectual_property,litigation \
  --likely-license Green --priority P0

kf create-source --domain employment-law --source-id vendor-annotated-commentary \
  --title "Annotated Commentary on Labor Code Title 8 (Licensed Database)" \
  --publisher "Legal Research Vendor (illustrative, licensed)" \
  --url "https://legal-research-vendor.invalid/annotations/labor-title-8" \
  --source-type practitioner_commentary --topics employment_law \
  --likely-license Red --priority P2

# 3. Classify licenses. Red is terminally rejected here; any later
#    `kf ingest` of it exits non-zero with a BLOCKED banner.
kf classify-license --domain employment-law --source-id state-labor-code-title-8 --class Green
kf classify-license --domain employment-law --source-id agency-compliance-guidance --class Green
kf classify-license --domain employment-law --source-id vendor-annotated-commentary --class Red

# 4. Pipeline for each Green source (shown once; repeat for the second id)
kf ingest        --domain employment-law --source-id state-labor-code-title-8 \
  --file examples/legal-employment-law/corpus/state-labor-code-title-8.md
kf normalize     --domain employment-law --source-id state-labor-code-title-8
kf chunk         --domain employment-law --source-id state-labor-code-title-8
kf tag           --domain employment-law --source-id state-labor-code-title-8
kf extract-claims --domain employment-law --source-id state-labor-code-title-8
kf screen-risk   --domain employment-law --source-id state-labor-code-title-8

# 5. Cross-source checks + release
kf detect-conflicts --domain employment-law
kf build-release --domain employment-law --release-id employment-law-rag-v0.1.0
kf eval-rag      --domain employment-law --release-id employment-law-rag-v0.1.0
# -> citation_coverage 1.0, retrieval_precision 1.0, thresholds: PASS

# 6. Recorded sign-offs per review_workflow.yaml, then enforced approval.
#    safety_review needs quorum 2 across [supervising_attorney, legal].
kf review --domain employment-law --target-type release --target-id employment-law-rag-v0.1.0 \
  --role legal --decision approved --reviewer a.counsel
kf review --domain employment-law --target-type release --target-id employment-law-rag-v0.1.0 \
  --role supervising_attorney --decision approved --reviewer b.attorney
kf approve-release --domain employment-law --release-id employment-law-rag-v0.1.0
# -> state: approved; compare releases/employment-law/employment-law-rag-v0.1.0/manifest.json
#    with reference-release/manifest.json (timestamps will differ)
```

## Notes

- **Topic-tag lines.** `kf tag` is deterministic: a chunk gets a taxonomy
  topic only when the topic slug appears literally in the chunk text, so
  each corpus section carries a `*Topic tags: ...*` line. Real corpora
  either curate such tags editorially or use taxonomy topics that occur
  naturally in prose.
- **Risk keywords are live.** The legal template's
  `flag-cross-jurisdiction-citation` rule (severity high) matches the
  phrase "in this state" — an earlier draft of the statute document tripped
  it and blocked the release, which is exactly the intended behavior:
  unresolved high-severity flags stop shipment.
- **Chunking strategy** follows `source_type`: statutes and regulations
  chunk by paragraph; guidance pages and internal documents chunk by
  heading.
