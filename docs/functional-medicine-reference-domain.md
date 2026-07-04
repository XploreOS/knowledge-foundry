# Functional Medicine Reference Domain

`domains/functional-medicine/` is the one domain configuration this
project ships pre-written, covering root-cause, systems-based clinical
practice: cardiometabolic health, inflammation, sleep, nutrition, hormone
optimization, and recovery. It exists to prove the pipeline works end to
end against a real, opinionated domain — **it is a deletable reference,
not a dependency.** The engine (`packages/core`, `packages/cli`,
`packages/adapters`) has zero functional-medicine awareness (ADR-013); if
you `rm -rf domains/functional-medicine examples/functional-medicine`,
every other domain still works exactly the same way. See
[domain-config.md](domain-config.md) for the general schema this domain
instantiates, and [getting-started.md](getting-started.md) for the
generic walkthrough this domain mirrors with real clinical content.

## `domain.yaml`

```yaml
domain_id: functional-medicine
display_name: Functional & Longevity Medicine
version: "0.1.0"
primary_use_cases:
  - provider-facing retrieval-augmented reference search for functional and
    longevity medicine practitioners
  - internal clinical research support (protocol design, biomarker panel
    review, literature synthesis)
prohibited_use_cases:
  - autonomous diagnosis of a patient
  - personalized treatment recommendations delivered without clinician review
  - dosing or supplementation advice given directly to consumers
review_roles: [legal, clinical_sme, cmo, product_owner]
default_release_use: rag
```

Note what's explicitly *prohibited*: this domain is built for
provider-facing reference retrieval and internal research, never
autonomous diagnosis or unsupervised consumer-facing dosing advice. That
boundary is enforced by human review and by `prohibited_use_cases` being
part of the reviewable record, not by any code-level restriction — a
release's `intended_use` is still just checked against `allowed_uses` by
`preReleaseGate` (see [license-policy.md](license-policy.md)).

## Taxonomy highlights

`taxonomy.yaml` defines nine entity types tailored to clinical content:
`pathway`, `biomarker`, `lab_test`, `supplement`, `medication`,
`clinic_service`, `contraindication`, `condition`, `intervention` — each
a self-documenting `{id, name, description}` record. Five chunk types:
`guideline_recommendation`, `biomarker_card`, `protocol`,
`research_finding`, `faq`. Three audiences: `clinician`, `patient`,
`researcher`. Six topics: `cardiometabolic`, `inflammation`, `sleep`,
`nutrition`, `hormones`, `recovery`.

Two metadata fields are marked `required: true` — `evidence_level` and
`audience` — meaning every tagged chunk in this domain must carry both,
not just optionally.

## Evidence model: A–X

`evidence_model.yaml` grades clinical evidence on a five-level scale:

| Level | Name | Meaning |
|-------|------|---------|
| **A** | authoritative | Major clinical practice guideline, regulatory/agency fact sheet (e.g. NIH, NAM), or audited registry data. |
| **B** | systematic_review_or_consensus | Systematic review, meta-analysis, or formal consensus statement. |
| **C** | primary_observational | Cohort study, case-control study, RCT, or other primary research not yet incorporated into a formal guideline. |
| **D** | expert_protocol_or_opinion | Expert consensus, clinical playbook, or informal functional-medicine protocol without formal evidence review. |
| **X** | restricted | Unsupported, unsafe, withdrawn, or otherwise prohibited for use as clinical evidence. |

Unlike the generic template, this domain sets no `default_level` — every
chunk's evidence level must be explicitly assigned during tagging, not
defaulted.

## Risk rules

`risk_rules.yaml` declares five categories —
`contraindication`, `privacy_violation`, `license_violation`,
`unsupported_advice`, `high_dose_nutrient` — and six rules. The three
most safety-critical:

- **`supplement-drug-interaction-warfarin`** (category
  `contraindication`, severity `high`, action `flag`) — flags content
  recommending vitamin K-rich supplements, fish oil, or other agents with
  a known interaction risk alongside warfarin or other anticoagulants,
  matching keywords like `warfarin`, `vitamin k`, `fish oil`,
  `anticoagulant`, `omega-3`, without an accompanying interaction
  warning.
- **`nutrient-above-tolerable-upper-intake-level`** (category
  `high_dose_nutrient`, severity `high`, action `flag`) — flags a
  specific nutrient dose that exceeds, or isn't checked against, the
  Tolerable Upper Intake Level (UL) for the stated population; matches
  `upper intake level`, `mg/day`, `mcg/day`, `iu/day`, `megadose`.
- **`hormone-therapy-without-supervision`** (category
  `unsupported_advice`, severity `high`, action `block`) — **blocks**
  (not merely flags) content that recommends initiating or adjusting
  hormone therapy (thyroid, testosterone, estrogen/progesterone) without
  explicit physician supervision.

Two more round out the set: `off-label-drug-recommendation` (medium
severity, flag) and `phi-disclosure` (high severity, block — identifiable
patient information such as names, medical record numbers, or dates of
birth). A sixth, `missing-license-review-flag`, catches chunks whose
source hasn't completed legal review.

Because `severity: "high"` is what `preReleaseGate` checks
(`unresolved_high_risk`), every rule above marked `high` is a real release
blocker until a human reviewer resolves it — the warfarin, UL, and PHI
rules are not cosmetic warnings.

## Review workflow

`review_workflow.yaml` is noticeably stricter than the generic template's
single-approver defaults:

```yaml
stages:
  license_review:  { roles: [legal], required: true, quorum: all }
  safety_review:   { roles: [clinical_sme, cmo], required: true, quorum: all }
  evidence_review: { roles: [clinical_sme], required: true, quorum: any }
  release_review:  { roles: [legal, cmo, product_owner], required: true, quorum: 2 }
```

`safety_review` requires **all** of `clinical_sme` and `cmo` to sign
off — a single clinical SME approving alone is not sufficient for safety
review in this domain. `release_review` requires 2 of the 3 listed roles
(`legal`, `cmo`, `product_owner`) before a release can move past `draft`.

## Eval questions

`eval_questions.yaml` ships eight questions spanning every topic in the
taxonomy — `eval-fm-001` through `eval-fm-008` — each with
`expects_citation: true`. Representative examples:

- *"What HbA1c range indicates optimal insulin sensitivity versus early
  insulin resistance?"* (`cardiometabolic`)
- *"Which common supplements or foods carry a documented interaction risk
  with warfarin?"* (`nutrition`, `cardiometabolic`)
- *"What is the Tolerable Upper Intake Level for vitamin D in healthy
  adults, and what are the risks of exceeding it?"* (`nutrition`)
- *"What lab tests are used to evaluate thyroid function, and how should
  results be interpreted in the context of hormone optimization?"*
  (`hormones`)

No `thresholds` are set in this domain's `eval_questions.yaml` — pass/fail
bars for citation coverage, retrieval precision, and unsafe output rate
are left to release reviewers' judgment rather than an automated cutoff.

## `source_policy.yaml`

Follows the standard four-class shape (see
[license-policy.md](license-policy.md)) with domain-specific
descriptions and blockers:

- Green: federal health agency fact sheets, open-access systematic
  reviews — `internal_search`, `rag`, `extraction`, `summarization` all
  `true`; `fine_tuning`, `customer_facing`, `commercial_distribution`
  stay `false`.
- Yellow: a journal article without confirmed open-access status, or a
  conference abstract.
- Orange: paid practitioner courses, vendor lab-interpretation guides.
- Red: proprietary certification course material used without a license,
  paywalled practitioner training programs, or any source containing
  identifiable patient data.

Four domain-specific blockers: proprietary certification content used
without a license, paywalled practitioner training materials, sources
containing identifiable patient information (PHI), and withdrawn or
retracted clinical guidance.

## Walkthrough: `examples/functional-medicine/`

`examples/functional-medicine/sample-sources.jsonl` registers three
illustrative sources:

| `source_id` | Publisher | `likely_license` | What it demonstrates |
|---|---|---|---|
| `nih-ods-vitamin-d` | NIH Office of Dietary Supplements | Green | open-access federal fact sheet, flows straight through to a `rag` release |
| `nih-ods-omega-3` | NIH Office of Dietary Supplements | Green | second Green source, feeds the cardiometabolic/inflammation eval questions |
| `ifm-proprietary-cert-module-12` | Institute for Functional Medicine (illustrative) | Red | paywalled practitioner certification content; blocked before ingestion |

`ifm-proprietary-cert-module-12` exists specifically to demonstrate the
Red path: classifying it `Red` sets every `allowed_uses` flag `false`,
and `preIngestGate` refuses to let it proceed to `kf ingest` at all — no
chunk, claim, or risk record is ever produced for it. It would also match
the "proprietary functional-medicine certification course content"
blocker in `source_policy.yaml` if discovered automatically.

The two Green fact sheets carry the full pipeline through
`kf build-release --domain functional-medicine` and
`kf eval-rag --release-id functional-medicine-rag-v0.1.0` — see
`examples/functional-medicine/README.md` for the exact command sequence
(register, classify, ingest, normalize, chunk, tag, extract claims,
screen risk, detect conflicts, build release, evaluate, validate), and
[getting-started.md](getting-started.md) for the same shape of walkthrough
generalized to any domain.

## Why this is deletable

Every field above is expressed in YAML validated by the same
`DomainConfig` zod schema (`packages/core/src/schemas/domainConfig.ts`)
that validates every other domain, including the five starter templates
in `packages/domain-templates/`. Nothing in `packages/core`,
`packages/cli`, or `packages/adapters` contains the string
`"functional-medicine"`, `"warfarin"`, `"HbA1c"`, or any other
domain-specific term. This domain is included to give adopters something
concrete to study — a real taxonomy, a real risk profile with actual
clinical stakes, a real multi-role review workflow — not because the
pipeline requires it. Building a legal, financial, or internal-policy
corpus means writing your own seven files per
[domain-config.md](domain-config.md), not modifying this one.
