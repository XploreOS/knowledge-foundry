# Example: Legal — Employment Law Corpus

Illustrates how you'd stand up a narrow employment-law research corpus by
adapting `packages/domain-templates/legal/` rather than building a domain
configuration from scratch.

## Sketch of the workflow

```sh
# 1. Copy the legal template and adapt it for employment law specifically
cp -r packages/domain-templates/legal domains/employment-law
kf init-domain --validate domains/employment-law

# 2. Register a handful of sources: a state labor code, a federal reg,
#    and an internal HR playbook
kf create-source --domain employment-law --type statute --title "State Labor Code Title 8"
kf create-source --domain employment-law --type regulation --title "Federal Wage & Hour Rules"
kf create-source --domain employment-law --type internal_document --title "HR Termination Playbook"

# 3. Classify each source's license before anything is ingested
kf classify-license --source <source_id> --class Green   # public statute
kf classify-license --source <source_id> --class Green   # public regulation
kf classify-license --source <source_id> --class Yellow  # internal doc, needs legal review

# 4. Ingest, normalize, chunk, and tag each approved source
kf ingest --source <source_id>
kf normalize --source <source_id>
kf chunk --source <source_id>
kf tag --source <source_id>

# 5. Screen for risk (unauthorized advice language, overruled precedent, etc.)
kf screen-risk --domain employment-law

# 6. Build a release once gates pass and reviewers have signed off
kf build-release --domain employment-law --tier rag

# 7. Evaluate against the domain's eval questions before shipping
kf eval-rag --release <release_id>
```

## Notes

- The internal HR playbook stays `Yellow` until `legal` completes review —
  it can't be used for `rag` until then (see the template's
  `source_policy.yaml`).
- Expect `screen-risk` to flag any chunk phrased as direct advice to an
  employee (e.g. "you should sue"); that's the `unauthorized_legal_advice`
  rule from the legal template doing its job.
- See `packages/domain-templates/legal/README.md` for the full adaptation
  checklist.
