# Example: Functional & Longevity Medicine Reference Corpus

Walks the full `kf` pipeline (contract-spec.md section 6) end-to-end against
the `functional-medicine` domain configuration in `domains/functional-medicine/`.
Unlike the other examples under `examples/`, this domain is not adapted from
a template copy-paste -- it ships as its own reference domain because
functional medicine has a distinct taxonomy, risk profile, and evidence
model from the generic `healthcare` template.

Three illustrative sources are registered in `sample-sources.jsonl`:

| source_id | publisher | likely_license | what it demonstrates |
|---|---|---|---|
| `nih-ods-vitamin-d` | NIH Office of Dietary Supplements | Green | open-access federal fact sheet, flows straight through to a `rag` release |
| `nih-ods-omega-3` | NIH Office of Dietary Supplements | Green | second Green source, feeds the cardiometabolic/inflammation eval questions |
| `ifm-proprietary-cert-module-12` | Institute for Functional Medicine (illustrative) | Red | paywalled practitioner certification content; blocked before ingestion |

## Walkthrough

```sh
# 0. Validate the domain configuration itself -- checks all seven YAML
#    files against the DomainConfig schema (domain, taxonomy, source_policy,
#    evidence_model, risk_rules, review_workflow, eval_questions) and cross
#    -checks that taxonomy.metadata_fields.evidence_level lines up with the
#    keys declared in evidence_model.yaml.
kf validate-domain --domain functional-medicine

# 1. Register sources. Each call appends a SourceRecord (contract-spec.md
#    section 2) to data/source_registry/functional-medicine/*.jsonl with
#    review_state "candidate" and the discovery-time likely_license guess.
kf create-source --domain functional-medicine --source-id nih-ods-vitamin-d \
  --title "Vitamin D - Health Professional Fact Sheet" \
  --publisher "National Institutes of Health, Office of Dietary Supplements" \
  --canonical-url "https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/" \
  --type guideline --topics nutrition,hormones --likely-license Green --priority P0

kf create-source --domain functional-medicine --source-id nih-ods-omega-3 \
  --title "Omega-3 Fatty Acids - Health Professional Fact Sheet" \
  --publisher "National Institutes of Health, Office of Dietary Supplements" \
  --canonical-url "https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/" \
  --type guideline --topics cardiometabolic,inflammation --likely-license Green --priority P0

kf create-source --domain functional-medicine --source-id ifm-proprietary-cert-module-12 \
  --title "Advanced Hormone Optimization - Practitioner Certification Module 12" \
  --publisher "Institute for Functional Medicine (illustrative, paywalled)" \
  --canonical-url "https://example-paywalled-course.invalid/certification/module-12" \
  --type course_module --topics hormones,nutrition --likely-license Red --priority P2

# 2. Classify license. Produces/updates a LicenseClassification and writes
#    license_class + allowed_uses + legal_review_required back onto the
#    SourceRecord, per source_policy.yaml's per-class default_allowed_uses.
kf classify-license --source nih-ods-vitamin-d --class Green
kf classify-license --source nih-ods-omega-3 --class Green
kf classify-license --source ifm-proprietary-cert-module-12 --class Red
# preIngestGate blocks Red immediately -- ifm-proprietary-cert-module-12 stops
# here. It never reaches ingest, and no chunk/claim/risk records are ever
# produced for it. This is the intended outcome for the Red example.

# 3. Ingest each Green/approved source. Writes the write-once
#    RawArtifactManifest to data/raw/<source_id>/manifest.json (canonical_url,
#    checksum_sha256, byte_size, content_type, files[]).
kf ingest --source nih-ods-vitamin-d
kf ingest --source nih-ods-omega-3

# 4. Normalize. Converts the raw artifact to Markdown at
#    data/normalized/<source_id>/document.md plus a NormalizedDocument
#    sidecar (headings, toc, citations, source_checksum_sha256) at
#    data/normalized/<source_id>/metadata.json.
kf normalize --source nih-ods-vitamin-d
kf normalize --source nih-ods-omega-3

# 5. Chunk. Splits the normalized document into ChunkRecords at
#    data/chunks/<source_id>/chunks.jsonl, e.g. chunk_id
#    "nih-ods-vitamin-d#0007", each inheriting license_class and
#    allowed_uses from its source. citation starts empty until tagged/
#    reviewed -- citationGate blocks release on any chunk still empty.
kf chunk --source nih-ods-vitamin-d
kf chunk --source nih-ods-omega-3

# 6. Tag. Fills in each chunk's topics, entities (typed per
#    taxonomy.yaml's entity_types: pathway, biomarker, lab_test, supplement,
#    medication, clinic_service, contraindication, condition, intervention),
#    chunk_type (guideline_recommendation, biomarker_card, protocol,
#    research_finding, faq), evidence_level (A-X, from evidence_model.yaml),
#    and audience (clinician, patient, researcher).
kf tag --source nih-ods-vitamin-d
kf tag --source nih-ods-omega-3

# 7. Extract claims. Produces ClaimRecords at
#    data/claims/<source_id>/claims.jsonl -- claim_text, population_or_scope,
#    intervention, outcome, evidence_level, limitations -- e.g. a claim
#    scoped to "adults with 25(OH)D < 20 ng/mL" tying vitamin D repletion to
#    a bone-density outcome, at evidence level A.
kf extract-claims --source nih-ods-vitamin-d
kf extract-claims --source nih-ods-omega-3

# 8. Screen risk. Runs risk_rules.yaml's rules against chunks/claims and
#    writes RiskRecords to data/risk/<source_id>/risk.jsonl. On this corpus
#    expect e.g. nutrient-above-tolerable-upper-intake-level to flag (not
#    block) any chunk stating a numeric vitamin D dose without a UL
#    qualifier, and supplement-drug-interaction-warfarin to flag the
#    omega-3 fact sheet's anticoagulant-interaction language for review.
kf screen-risk --domain functional-medicine

# 9. Detect conflicts. Compares chunks across sources on shared topics and
#    writes ConflictRecords to data/conflicts/functional-medicine/<topic>.jsonl
#    (chunk_ids, nature, references) whenever two sources disagree, e.g. on
#    a recommended vitamin D dosing range.
kf detect-conflicts --domain functional-medicine

# 10. Build release. Runs preReleaseGate (blocks on any Red member source,
#     any Yellow/Orange source lacking approval_status
#     "approved_for_ingestion", any unresolved high-severity RiskRecord, any
#     chunk failing citationGate, or a license mismatch against
#     intended_use). Writes releases/functional-medicine/<release_id>/manifest.json
#     with source_count, license_class_counts, evidence_summary, chunk_count,
#     and gate_results.
kf build-release --domain functional-medicine --tier rag

# 11. Evaluate. Runs the 8 questions in eval_questions.yaml (covering
#     cardiometabolic, inflammation, sleep, nutrition, hormones, and
#     recovery) against the built release and writes an EvaluationResult to
#     evals/<release_id>/results.json -- citation_coverage,
#     retrieval_precision, unsafe_output_rate, license_errors, and a
#     per-question breakdown -- and embeds it back into the release manifest.
kf eval-rag --release functional-medicine-rag-v0.1.0

# 12. Validate release. Final structural check that the release manifest
#     and every member file still pass their schemas before it's marked
#     approved/indexed.
kf validate-release --release functional-medicine-rag-v0.1.0
```

## Notes

- `ifm-proprietary-cert-module-12` exists specifically to demonstrate the
  `Red` path: `classify-license --class Red` sets
  `allowed_uses` to all-false per `source_policy.yaml`, and
  `preIngestGate` refuses to let it proceed to `ingest` at all. It would
  also match the `proprietary functional-medicine certification course
  content` blocker in `source_policy.yaml` if discovered automatically via
  `kf discover`.
- Both NIH fact sheets are `Green` and default to
  `internal_search: true, rag: true, extraction: true, summarization: true,
  fine_tuning: false`, matching `domain.yaml`'s `default_release_use: rag`
  and the domain-wide rule that `fine_tuning` stays `false` for every
  license class.
- `review_workflow.yaml` requires `all` of `clinical_sme` and `cmo` to sign
  off at `safety_review`, and 2 of the 3 `release_review` roles
  (`legal`, `cmo`, `product_owner`) before a release can move past `draft`.
- See `domains/functional-medicine/*.yaml` for the full domain
  configuration and `docs/internal/contract-spec.md` for the authoritative
  shape of every record and gate referenced above.
