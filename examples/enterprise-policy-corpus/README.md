# Example: Enterprise — Internal Policy Corpus

Builds an internal policy/procedure corpus from the `enterprise` domain
template for an `internal_search` release. This example demonstrates the
**Yellow approval path**: a draft team-level procedure document is
classified Yellow (requires review), a human approval is recorded, and only
then can it be ingested — while a licensed vendor training course is Red
and blocked. All content is fictional ("ACME Corp").

| source_id | type | license | what it demonstrates |
|---|---|---|---|
| `employee-handbook` | policy | Green | company-authored approved policy |
| `it-security-procedures` | procedure | Yellow → approved | draft doc: `requires_review`, recorded approval unlocks ingestion; Yellow grants `internal_search` only |
| `vendor-compliance-training` | vendor_documentation | Red | licensed vendor content; never ingested |

Files: `sample-sources.jsonl`, `corpus/*.md`,
`reference-release/manifest.json` (committed reference output — note
`license_class_counts: Green=1 Yellow=1`).

## Walkthrough

```sh
# 1. Domain
kf init-domain corp-policies --template enterprise
kf validate-domain corp-policies

# 2. Sources
kf create-source --domain corp-policies --source-id employee-handbook \
  --title "ACME Corp Employee Handbook" \
  --publisher "ACME Corp People Operations" \
  --url "https://intranet.acme.example/handbook" \
  --source-type policy --topics hr_policies,onboarding,finance_operations \
  --likely-license Green --priority P0

kf create-source --domain corp-policies --source-id it-security-procedures \
  --title "IT & Security Procedures - Systems Access and Incident Basics (Draft)" \
  --publisher "ACME Corp Information Security" \
  --url "https://intranet.acme.example/it/security-procedures" \
  --source-type procedure --topics it_and_security,onboarding,finance_operations \
  --likely-license Yellow --priority P0

kf create-source --domain corp-policies --source-id vendor-compliance-training \
  --title "Annual Compliance Training Course (Licensed)" \
  --publisher "Licensed Training Vendor (illustrative)" \
  --url "https://training-vendor.invalid/compliance-course" \
  --source-type vendor_documentation --topics it_and_security \
  --likely-license Red --priority P2

# 3. Classify. The Yellow draft needs a recorded human approval before
#    ingestion — that's what --approve records. Without it, `kf ingest`
#    refuses with "lacks approval_status=approved_for_ingestion".
kf classify-license --domain corp-policies --source-id employee-handbook --class Green
kf classify-license --domain corp-policies --source-id it-security-procedures --class Yellow --approve
kf classify-license --domain corp-policies --source-id vendor-compliance-training --class Red

# 4. Pipeline for handbook and procedures (shown once; repeat per id)
kf ingest        --domain corp-policies --source-id employee-handbook \
  --file examples/enterprise-policy-corpus/corpus/employee-handbook.md
kf normalize     --domain corp-policies --source-id employee-handbook
kf chunk         --domain corp-policies --source-id employee-handbook
kf tag           --domain corp-policies --source-id employee-handbook
kf extract-claims --domain corp-policies --source-id employee-handbook
kf screen-risk   --domain corp-policies --source-id employee-handbook

# 5. Release + evaluation. The enterprise template's default release use is
#    internal_search — the only use the Yellow class grants, so the release
#    passes the intended-use license gate with the Yellow member aboard.
kf detect-conflicts --domain corp-policies
kf build-release --domain corp-policies --release-id corp-policies-search-v0.1.0
kf eval-rag      --domain corp-policies --release-id corp-policies-search-v0.1.0
# -> citation_coverage 1.0, retrieval_precision 1.0, thresholds: PASS

# 6. Sign-offs + enforced approval
kf review --domain corp-policies --target-type release --target-id corp-policies-search-v0.1.0 \
  --role legal --decision approved --reviewer a.counsel
kf review --domain corp-policies --target-type release --target-id corp-policies-search-v0.1.0 \
  --role information_security_sme --decision approved --reviewer s.infosec
kf approve-release --domain corp-policies --release-id corp-policies-search-v0.1.0
# -> state: approved; compare against reference-release/manifest.json
```

## Notes

- **Try it without `--approve`**: skip the flag in step 3 and `kf ingest`
  for `it-security-procedures` exits non-zero — the Yellow gate is code,
  not convention. Then run `classify-license ... --class Yellow --approve`
  and ingest again.
- **Risk keywords are live.** The enterprise template blocks the keyword
  "confidential" at high severity; an earlier draft of the handbook's
  disciplinary-privacy section tripped it and blocked the release until
  reworded. Content that legitimately needs such language would instead go
  through a human resolving the flag.
- **Topic-tag lines.** As in the other examples, sections carry
  `*Topic tags: ...*` lines because the deterministic tagger matches topic
  slugs (`hr_policies`, `it_and_security`, ...) literally in chunk text.
- If you build a rag-intended release instead (`--intended-use rag`), the
  Yellow member source blocks it — Yellow grants `internal_search` only.
