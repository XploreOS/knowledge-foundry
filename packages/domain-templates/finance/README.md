# Finance Domain Template

A generic financial-research domain configuration: entity types for
instruments, metrics, filings, regulations, market events, and issuers; an
evidence scale built around filing/regulatory rigor; and risk rules for
MNPI exposure, investment-advice risk, stale market data, and privacy
exposure.

This template supports analyst- and adviser-facing research. It is not
meant to deliver personalized investment advice directly to end clients —
`domain.yaml` prohibits that use case by default, and the risk rules
actively block language that reads as a direct buy/sell recommendation.

## What's in here

Eight files, each validated against the zod schemas in
`packages/core/src/schemas/domainConfig.ts`:
`domain.yaml`, `taxonomy.yaml`, `source_policy.yaml`, `evidence_model.yaml`,
`risk_rules.yaml`, `review_workflow.yaml`, `eval_questions.yaml`, and this
`README.md`.

## How to use it

1. Copy the directory into `domains/<your-domain>/`:

   ```sh
   cp -r packages/domain-templates/finance domains/<your-domain>
   ```

2. Set `domain_id`, `display_name`, and `description` in `domain.yaml`.
   Keep "personalized investment advice without adviser review" in
   `prohibited_use_cases` unless your organization has an explicit,
   separately reviewed exception (e.g. a licensed robo-adviser product).

3. Adjust `taxonomy.yaml` to your coverage — add entity types like
   `credit_rating` or `derivative_contract` if relevant. Keep `as_of_date`
   as a required metadata field; the `outdated_market_data` risk rule and
   the `stale-market-data` blocker both depend on knowing when a figure was
   accurate.

4. Review `source_policy.yaml`. Keep the `contains-mnpi` blocker — it's the
   primary defense against ingesting insider information. `fine_tuning`
   must stay `false` in every license class unless you have confirmed
   training rights.

5. `evidence_model.yaml` grades by source rigor
   (`audited_filing` → `regulatory_guidance` → `analyst_research` →
   `commentary` → `restricted`) rather than a generic A–X scale. Adjust the
   levels if your research process uses different tiers.

6. Extend `risk_rules.yaml` keyword lists with terms specific to your
   coverage universe. The `flag-undated-market-figures` rule has no
   keywords by design — pair it with a metadata check in your ingestion
   pipeline for whether `as_of_date` is present, rather than a keyword
   match.

7. Keep `safety_review` in `review_workflow.yaml` requiring both
   `compliance_sme` and `legal` sign-off — this is what catches MNPI and
   unauthorized advice language before release.

8. Replace the eval questions in `eval_questions.yaml` with ones from your
   actual coverage universe, keeping at least one question (see
   `eval-006`) that checks whether the system properly declines to give a
   direct buy/sell recommendation.

9. Validate before ingesting any real content (e.g.
   `kf validate-domain <your-domain>`).
