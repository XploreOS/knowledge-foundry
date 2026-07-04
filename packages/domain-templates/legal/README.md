# Legal Domain Template

A generic legal-research domain configuration: entity types for
jurisdictions, statutes, regulations, case law, legal issues, and
provisions; an evidence scale built around authority weight rather than
scientific evidence quality; and risk rules for unauthorized legal advice,
overruled precedent, jurisdiction mismatch, and privacy exposure.

This template supports attorney- and paralegal-facing research. It is not
meant to deliver legal advice directly to end clients — `domain.yaml`
prohibits that use case by default, and the risk rules actively block
language that reads as direct advice.

## What's in here

Eight files, each validated against the zod schemas in
`packages/core/src/schemas/domainConfig.ts`:
`domain.yaml`, `taxonomy.yaml`, `source_policy.yaml`, `evidence_model.yaml`,
`risk_rules.yaml`, `review_workflow.yaml`, `eval_questions.yaml`, and this
`README.md`.

## How to use it

1. Copy the directory into `domains/<your-domain>/`:

   ```sh
   cp -r packages/domain-templates/legal domains/<your-domain>
   ```

2. Set `domain_id`, `display_name`, and `description` in `domain.yaml`.
   Adjust `primary_use_cases` and `prohibited_use_cases` to your practice
   area, but keep "legal advice to end clients without attorney review" in
   `prohibited_use_cases` unless your organization has an explicit,
   separately reviewed exception (e.g. a bar-approved client-facing tool).

3. Adjust `taxonomy.yaml` for your practice area — add entity types like
   `regulatory_filing` or `contract_clause` if relevant. Keep
   `jurisdiction_scope` as a required metadata field; almost every legal
   risk rule here depends on knowing what jurisdiction a piece of content
   applies to.

4. Review `source_policy.yaml`. Keep the `overruled-precedent` and
   `privileged-or-sealed-material` blockers — they're the primary defenses
   against citing bad law or ingesting protected material. `fine_tuning`
   must stay `false` in every license class unless you have confirmed
   training rights.

5. `evidence_model.yaml` uses authority-weight vocabulary
   (`binding_authority` → `persuasive_authority` → `secondary_commentary` →
   `practitioner_note` → `restricted`) instead of the scientific A–X scale
   used elsewhere. Rename or add levels to match how your practice group
   actually grades authority.

6. Extend `risk_rules.yaml` keyword lists with practice-area-specific terms.
   The `flag-unverified-case-status` rule has no keywords by design — it's
   meant to be paired with a citator-check step in your ingestion pipeline
   rather than a keyword match.

7. Keep `safety_review` in `review_workflow.yaml` requiring both
   `supervising_attorney` and `legal` sign-off — this is what catches
   unauthorized-advice language and stale authority before release.

8. Replace the eval questions in `eval_questions.yaml` with ones from your
   actual practice area, keeping at least one question (see `eval-006`)
   that checks whether the system properly declines to give a bare
   yes/no answer to a jurisdiction-dependent legal question.

9. Validate before ingesting any real content (e.g.
   `kf init-domain --validate domains/<your-domain>`).
