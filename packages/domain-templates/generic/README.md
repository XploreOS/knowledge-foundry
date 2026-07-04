# Generic Domain Template

A neutral starting point for a Knowledge Foundry domain configuration. Use
this template when your subject matter doesn't fit the healthcare, legal,
finance, or enterprise-policy templates, or simply as the clearest reference
for what every domain configuration must contain.

## What's in here

Eight files, each validated against the zod schemas in
`packages/core/src/schemas/domainConfig.ts`:

- `domain.yaml` — identity, use cases, review roles, default release intent.
- `taxonomy.yaml` — entity types, chunk types, audiences, metadata fields.
- `source_policy.yaml` — license classes (Green/Yellow/Orange/Red), blockers,
  recognized source types.
- `evidence_model.yaml` — the evidence grading scale and its default level.
- `risk_rules.yaml` — risk categories and the rules that flag, block, or
  downgrade content.
- `review_workflow.yaml` — which roles must sign off at each pipeline stage.
- `eval_questions.yaml` — representative RAG evaluation questions and
  pass/fail thresholds.
- This `README.md`.

## How to use it

1. Copy the whole directory into `domains/<your-domain>/`:

   ```sh
   cp -r packages/domain-templates/generic domains/<your-domain>
   ```

2. Edit `domain.yaml` first: change `domain_id` to your domain's kebab-case
   id, rewrite `display_name`/`description`, and set `primary_use_cases`,
   `prohibited_use_cases`, `review_roles`, and `default_release_use` to match
   your actual policy. `version` starts at `"0.1.0"`.

3. Replace the placeholder entity types, chunk types, audiences, and
   metadata fields in `taxonomy.yaml` with the vocabulary your domain
   actually uses.

4. Review `source_policy.yaml`. The four license classes (`Green`, `Yellow`,
   `Orange`, `Red`) are required as written — you can change descriptions,
   `ingestable`/`requires_review` flags, and `default_allowed_uses`, but keep
   all four classes and all seven `default_allowed_uses` keys
   (`internal_search`, `rag`, `extraction`, `summarization`, `fine_tuning`,
   `customer_facing`, `commercial_distribution`) explicit on every class.
   Leave `fine_tuning` `false` unless your organization has confirmed
   explicit training rights for a source. Add domain-specific `blockers` and
   adjust `source_types` to match what you actually ingest.

5. Rework `evidence_model.yaml` so the levels (and `default_level`) reflect
   how your domain actually grades trustworthiness. Keys don't have to be
   single letters — pick whatever vocabulary your reviewers use, as long as
   `default_level` is one of the keys you define.

6. Rewrite `risk_rules.yaml` categories and rules for the failure modes that
   matter in your domain. Every rule's `category` must match a `risk_categories`
   id.

7. Update `review_workflow.yaml`. The four stages
   (`license_review`, `safety_review`, `evidence_review`, `release_review`)
   are required — you can add more stages, but don't remove these, and keep
   the roles consistent with `review_roles` in `domain.yaml`.

8. Replace the five example questions in `eval_questions.yaml` with at least
   five real questions that exercise your corpus's key topics, and tune the
   `thresholds` if your domain needs stricter (or looser) gates than the
   defaults.

9. Run whatever validation command the CLI provides (e.g. `kf init-domain
   --validate domains/<your-domain>`) before ingesting any real sources.
