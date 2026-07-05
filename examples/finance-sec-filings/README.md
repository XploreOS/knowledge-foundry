# Example: Finance — SEC Filings Corpus

Builds a small public-filings research corpus from the `finance` domain
template: a fictional issuer 10-K and a central-bank primer (both Green)
reach an **approved** release, while a licensed sell-side research note is
classified Red and never ingested — redistribution-restricted research is
the classic license trap in finance corpora. All content is fictional
("ACME Industrial Holdings", "Central Bank of Exampleton").

| source_id | type | license | what it demonstrates |
|---|---|---|---|
| `acme-10k-fy2025` | filing | Green | public filing; answers the risk-factor/earnings/dividend eval questions |
| `market-regulatory-primer` | regulation | Green | rates/yields/capital-requirements coverage; paragraph-chunked |
| `vendor-analyst-research` | analyst_report | Red | licensed research; `preIngestGate` blocks it unconditionally |

Files: `sample-sources.jsonl`, `corpus/*.md`,
`reference-release/manifest.json` (committed reference output).

## Walkthrough

```sh
# 1. Domain
kf init-domain sec-filings --template finance
kf validate-domain sec-filings

# 2. Sources
kf create-source --domain sec-filings --source-id acme-10k-fy2025 \
  --title "ACME Industrial Holdings, Inc. - Form 10-K (FY2025)" \
  --publisher "ACME Industrial Holdings, Inc. (via public filings portal)" \
  --url "https://filings.exampleton.gov/acme/10-k-fy2025" \
  --source-type filing --topics regulatory_filings,earnings,equities \
  --likely-license Green --priority P0

kf create-source --domain sec-filings --source-id market-regulatory-primer \
  --title "Rates, Yields, and Capital Requirements: A Public Primer" \
  --publisher "Central Bank of Exampleton" \
  --url "https://centralbank.exampleton.gov/primers/rates-yields-capital" \
  --source-type regulation --topics macro_economics,fixed_income,regulatory_filings \
  --likely-license Green --priority P0

kf create-source --domain sec-filings --source-id vendor-analyst-research \
  --title "ACME Industrial: Initiation of Coverage (Licensed Research)" \
  --publisher "Sell-Side Research Vendor (illustrative, licensed)" \
  --url "https://research-vendor.invalid/acme/initiation" \
  --source-type analyst_report --topics equities,earnings \
  --likely-license Red --priority P2

# 3. Classify: the vendor note is Red and stops here for good
kf classify-license --domain sec-filings --source-id acme-10k-fy2025 --class Green
kf classify-license --domain sec-filings --source-id market-regulatory-primer --class Green
kf classify-license --domain sec-filings --source-id vendor-analyst-research --class Red

# 4. Pipeline for each Green source (shown once; repeat for the second id)
kf ingest        --domain sec-filings --source-id acme-10k-fy2025 \
  --file examples/finance-sec-filings/corpus/acme-10k-fy2025.md
kf normalize     --domain sec-filings --source-id acme-10k-fy2025
kf chunk         --domain sec-filings --source-id acme-10k-fy2025
kf tag           --domain sec-filings --source-id acme-10k-fy2025
kf extract-claims --domain sec-filings --source-id acme-10k-fy2025
kf screen-risk   --domain sec-filings --source-id acme-10k-fy2025

# 5. Release + evaluation
kf detect-conflicts --domain sec-filings
kf build-release --domain sec-filings --release-id sec-filings-rag-v0.1.0
kf eval-rag      --domain sec-filings --release-id sec-filings-rag-v0.1.0
# -> citation_coverage 1.0, retrieval_precision 1.0, thresholds: PASS
# eval-006 ("Should I buy this stock...") is the unsafe-question probe: the
# corpus deliberately answers it with a no-recommendation section.

# 6. Sign-offs (safety_review quorum 2 across [compliance_sme, legal]) + approval
kf review --domain sec-filings --target-type release --target-id sec-filings-rag-v0.1.0 \
  --role legal --decision approved --reviewer a.counsel
kf review --domain sec-filings --target-type release --target-id sec-filings-rag-v0.1.0 \
  --role compliance_sme --decision approved --reviewer c.compliance
kf approve-release --domain sec-filings --release-id sec-filings-rag-v0.1.0
# -> state: approved; compare against reference-release/manifest.json
```

## Notes

- **Topic-tag lines.** The deterministic tagger matches taxonomy topic
  slugs literally in chunk text, so sections carry `*Topic tags: ...*`
  lines (`regulatory_filings`, `macro_economics`, ... never occur in
  natural prose). See the legal example README for the same pattern.
- **Filings chunk by heading, regulations by paragraph** — the primer's
  tag lines sit attached to their paragraphs for that reason.
- The Red analyst note is registered on purpose: a real discovery pass
  will surface licensed research constantly, and the registry is where its
  prohibition is recorded and enforced, not a wiki page.
