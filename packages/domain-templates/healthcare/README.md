# Healthcare Domain Template

A general-purpose clinical/health-information domain configuration: entity
types for conditions, biomarkers, lab tests, interventions, medications, and
contraindications; an evidence scale tuned to clinical literature; and risk
rules for contraindications, dosage risk, unsupported medical advice, and
PHI exposure.

This template is deliberately generic clinical content. It is **not** a
specialty protocol — a functional-medicine, oncology, or other specialty
domain should be built as its own separate `domains/<specialty>/`
configuration (or its own template), copying this one as a starting point
rather than extending it in place.

## What's in here

Eight files, each validated against the zod schemas in
`packages/core/src/schemas/domainConfig.ts`:
`domain.yaml`, `taxonomy.yaml`, `source_policy.yaml`, `evidence_model.yaml`,
`risk_rules.yaml`, `review_workflow.yaml`, `eval_questions.yaml`, and this
`README.md`.

## How to use it

1. Copy the directory into `domains/<your-domain>/`:

   ```sh
   cp -r packages/domain-templates/healthcare domains/<your-domain>
   ```

2. In `domain.yaml`, set a real `domain_id`, `display_name`, and
   `description`. Review `prohibited_use_cases` carefully — autonomous
   diagnosis and unsupervised treatment recommendations should stay
   prohibited unless your organization has an explicit, reviewed exception.

3. Adjust `taxonomy.yaml` entity types and chunk types to match your actual
   clinical scope (e.g. add `procedure` or `imaging_finding` entity types if
   relevant). Keep `evidence_level` as a required metadata field — the risk
   and evidence gates assume it's present.

4. Review `source_policy.yaml`. Keep the `contains-patient-identifiers`
   blocker — it's the primary defense against ingesting PHI. Add
   institution- or vendor-specific blockers as needed. `fine_tuning` must
   stay `false` in every license class unless you have confirmed, explicit
   training rights for a source.

5. Tune `evidence_model.yaml` to your clinical evidence hierarchy if the
   default A–X scale (guideline → systematic review → observational study →
   expert opinion → restricted) doesn't match your reviewers' vocabulary.

6. Extend `risk_rules.yaml` with keyword lists specific to your corpus
   (drug names, condition names, procedure names). The shipped keyword
   lists are illustrative starting points, not exhaustive — a clinical SME
   should review and expand them before go-live.

7. Keep `safety_review` in `review_workflow.yaml` requiring both
   `clinical_sme` and `legal` sign-off (`min_approvals: 2`) — this is the
   gate that catches unsafe clinical content before it reaches a release.

8. Replace the eval questions in `eval_questions.yaml` with ones that
   reflect your corpus's actual topics, and keep at least one question that
   probes for unsafe generalization (see `eval-006` for the pattern: a
   yes/no clinical question that should trigger a "consult a clinician"
   qualifier rather than a bare answer).

9. Validate before ingesting any real content (e.g.
   `kf validate-domain <your-domain>`).
