# Enterprise Policy Domain Template

A generic internal-knowledge domain configuration: entity types for
policies, procedures, systems, teams, and glossary terms; an evidence scale
built around internal approval status rather than external evidence
quality; and risk rules for confidential leaks, PII exposure, stale
policies, and license violations on vendor material.

This template defaults to `internal_search` as its release use (see
`domain.yaml`) rather than `rag`, since most enterprise-policy corpora
start as internal-only search before any broader retrieval-augmented
use is approved. It is not meant to expose confidential content
externally — that's an explicit prohibited use case and the risk rules
actively block content above the corpus's approved confidentiality level.

## What's in here

Eight files, each validated against the zod schemas in
`packages/core/src/schemas/domainConfig.ts`:
`domain.yaml`, `taxonomy.yaml`, `source_policy.yaml`, `evidence_model.yaml`,
`risk_rules.yaml`, `review_workflow.yaml`, `eval_questions.yaml`, and this
`README.md`.

## How to use it

1. Copy the directory into `domains/<your-domain>/`:

   ```sh
   cp -r packages/domain-templates/enterprise domains/<your-domain>
   ```

2. Set `domain_id`, `display_name`, and `description` in `domain.yaml`.
   Change `default_release_use` to `rag` once you've validated the corpus
   is safe for retrieval-augmented use beyond plain search.

3. Adjust `taxonomy.yaml` for your organization — add entity types like
   `benefit_plan` or `office_location` if relevant. Keep
   `confidentiality_level` as a required metadata field; the
   `restricted-confidentiality-level` blocker and the `confidential_leak`
   risk rule both depend on it being set correctly at ingestion time.

4. Review `source_policy.yaml` and decide what confidentiality level this
   particular corpus is approved to hold — content above that level should
   be blocked, not merely flagged. `fine_tuning` must stay `false` in every
   license class unless you have confirmed training rights, which is
   especially relevant for vendor documentation under a restrictive
   license.

5. `evidence_model.yaml` grades by internal approval status
   (`official_policy` → `approved_guideline` → `team_doc` →
   `informal_note` → `restricted`) rather than external evidence quality.
   Adjust if your organization has a more formal documentation review
   process.

6. Extend `risk_rules.yaml` keyword lists with terms specific to your
   organization's classification labels and confidential-marking
   conventions.

7. Keep all four `review_workflow.yaml` stages — `information_security_sme`
   in `safety_review` is what catches confidentiality and PII risk before
   release.

8. Replace the eval questions in `eval_questions.yaml` with ones from your
   actual policy corpus, keeping at least one question (see `eval-006`)
   that checks whether the system properly refuses to disclose
   confidential content.

9. Validate before ingesting any real content (e.g.
   `kf init-domain --validate domains/<your-domain>`).
