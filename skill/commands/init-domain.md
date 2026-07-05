---
description: 'Scaffold a new domain: seven YAML config files from a starter template'
---

# /init-domain

## Purpose

Scaffold a new domain configuration under `domains/<domain_id>/` so that
every downstream stage (discovery, classification, chunking, tagging, risk
screening, conflict detection, release, evaluation) has the seven YAML
files it needs to run. No pipeline stage may operate on a domain that has
not been initialized and validated.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `--domain <domain_id>` | Yes | Slug identifier for the new domain (e.g. `legal-employment`, `functional-medicine`). |
| `--root <path>` | No | Workspace root; defaults to current working directory. |
| Domain description / scope | Yes (interactive or supplied) | High-level description, primary use cases, and prohibited use cases to seed `domain.yaml`. |
| Review roles | Yes (interactive or supplied) | Who must approve what (legal, SME, product owner) to seed `review_workflow.yaml`. |

## Preconditions

- `domains/<domain_id>/` does not already exist (use a new `domain_id` to
  avoid clobbering an existing domain).
- The requester can describe, at minimum, the domain's scope, its
  prohibited use cases, and who the required reviewers are — these are not
  guessable and must not be invented.

## Steps

1. Confirm the `domain_id` is new and follows the slug convention
   (lowercase, hyphenated).
2. Gather domain scope, primary/prohibited use cases, evidence grading
   scale, risk categories, review roles, and representative evaluation
   questions from the requester — do not fabricate domain-specific content.
3. Run `kf init-domain --domain <domain_id>` to scaffold the seven files:
   `domain.yaml`, `taxonomy.yaml`, `source_policy.yaml`,
   `evidence_model.yaml`, `risk_rules.yaml`, `review_workflow.yaml`,
   `eval_questions.yaml`.
4. Populate each file with the gathered content — leave no required field
   as a placeholder.
5. Run `kf validate-domain --domain <domain_id>` to confirm all seven files
   are present and schema-valid.

## Outputs

- `domains/<domain_id>/domain.yaml`
- `domains/<domain_id>/taxonomy.yaml`
- `domains/<domain_id>/source_policy.yaml`
- `domains/<domain_id>/evidence_model.yaml`
- `domains/<domain_id>/risk_rules.yaml`
- `domains/<domain_id>/review_workflow.yaml`
- `domains/<domain_id>/eval_questions.yaml`

## Failure modes

- **Domain already exists** — `kf init-domain` refuses to overwrite; choose
  a new `domain_id` or edit the existing files directly.
- **Missing required content** — `kf validate-domain` fails schema
  validation if any of the seven files is absent or missing required
  fields; fix the specific file named in the error, not the others.
- **Invented domain rules** — if the requester cannot supply real scope,
  risk categories, or review roles, stop and ask rather than filling in
  plausible-sounding placeholders. A domain config with fabricated risk
  rules is worse than no domain config.

## Example invocation

"Initialize a new domain called `financial-compliance`. Its primary use
case is internal search over regulatory filings; customer-facing use is
prohibited for v1. Legal must approve all Yellow/Orange sources; a
compliance officer approves risk flags."

## Related CLI command

`kf init-domain` (scaffold), `kf validate-domain` (schema check —
supporting command, run after every edit to a domain file).

## Review gates

None at this stage — domain configuration is infrastructure, not corpus
content. However, no other pipeline stage may run against
`domain_id` until `kf validate-domain` passes.
