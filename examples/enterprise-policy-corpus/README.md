# Example: Enterprise — Internal Policy Corpus

Illustrates how you'd stand up an internal employee-facing policy search
corpus by adapting `packages/domain-templates/enterprise/` rather than
building a domain configuration from scratch.

## Sketch of the workflow

```sh
# 1. Copy the enterprise template and adapt it for company policies
cp -r packages/domain-templates/enterprise domains/company-policies
kf validate-domain company-policies

# 2. Register sources: an HR policy, an IT security procedure, and a
#    vendor-provided tool guide
kf create-source --domain company-policies --type policy --title "Remote Work Policy v3"
kf create-source --domain company-policies --type procedure --title "Lost Device Reporting Procedure"
kf create-source --domain company-policies --type vendor_documentation --title "VPN Client Admin Guide"

# 3. Classify license before ingestion
kf classify-license --source <source_id> --class Green   # approved internal policy
kf classify-license --source <source_id> --class Green   # approved internal procedure
kf classify-license --source <source_id> --class Orange  # vendor doc, needs procurement approval

# 4. Ingest, normalize, chunk, and tag each approved source
kf ingest --source <source_id>
kf normalize --source <source_id>
kf chunk --source <source_id>
kf tag --source <source_id>

# 5. Screen for risk (confidentiality level, PII, stale policies)
kf screen-risk --domain company-policies

# 6. Build a release once gates pass and reviewers have signed off
kf build-release --domain company-policies --tier internal_search

# 7. Evaluate against the domain's eval questions before shipping
kf eval-rag --release <release_id>
```

## Notes

- `confidentiality_level` metadata is required on every source; anything
  above the corpus's approved level is blocked outright, not just flagged
  (see the template's `restricted-confidentiality-level` blocker).
- The release tier here is `internal_search`, matching the enterprise
  template's `default_release_use` — upgrade to `rag` only after
  validating the corpus with `kf eval-rag`.
- See `packages/domain-templates/enterprise/README.md` for the full
  adaptation checklist.
