# Example: Finance — SEC Filings Corpus

Illustrates how you'd stand up a corpus of public company SEC filings by
adapting `packages/domain-templates/finance/` rather than building a
domain configuration from scratch.

## Sketch of the workflow

```sh
# 1. Copy the finance template and adapt it for filings research
cp -r packages/domain-templates/finance domains/sec-filings
kf validate-domain sec-filings

# 2. Register sources: a 10-K, a 10-Q, and an analyst research note
kf create-source --domain sec-filings --type filing --title "Acme Corp 10-K FY2025"
kf create-source --domain sec-filings --type filing --title "Acme Corp 10-Q Q2 2026"
kf create-source --domain sec-filings --type analyst_report --title "Acme Corp Equity Research Note"

# 3. Classify license before ingestion
kf classify-license --source <source_id> --class Green   # public EDGAR filing
kf classify-license --source <source_id> --class Green   # public EDGAR filing
kf classify-license --source <source_id> --class Orange  # paid analyst research, needs contract approval

# 4. Ingest, normalize, chunk, and tag each approved source
kf ingest --source <source_id>
kf normalize --source <source_id>
kf chunk --source <source_id>
kf tag --source <source_id>

# 5. Screen for risk (MNPI language, undated figures, license gaps)
kf screen-risk --domain sec-filings

# 6. Build a release once gates pass and reviewers have signed off
kf build-release --domain sec-filings --tier rag

# 7. Evaluate against the domain's eval questions before shipping
kf eval-rag --release <release_id>
```

## Notes

- The analyst note stays `Orange` — blocked from `rag` — until legal
  confirms the firm's contract permits this use (see the template's
  `source_policy.yaml`).
- Every filing chunk should carry `as_of_date` metadata; `screen-risk`
  flags chunks that state a figure without one, per the
  `flag-undated-market-figures` rule.
- See `packages/domain-templates/finance/README.md` for the full
  adaptation checklist.
