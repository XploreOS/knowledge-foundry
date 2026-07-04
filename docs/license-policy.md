# License Policy

License classification is the single hardest guardrail in Knowledge
Foundry: it decides whether a source may be ingested at all, and for
what. This document covers the four-class semantics, the seven
`allowed_uses` flags, the uncertain-case default, the fine-tuning rule,
how `classify-license` and human approval interact, and exactly what the
gates block. See [architecture.md](architecture.md) for why gates are
pure functions, [domain-config.md](domain-config.md) for
`source_policy.yaml`'s full schema, and
[release-model.md](release-model.md) for how these rules surface in a
release manifest.

## License classes

Every `SourceRecord` carries a `license_class`: `Green | Yellow | Orange
| Red | Unknown`. `Unknown` means not yet classified — it is not a
permissive default, it blocks ingestion exactly like Red does until
classification happens.

| Class | Meaning | Ingestion |
|-------|---------|-----------|
| **Green** | Public domain, or explicitly licensed for reuse. Safe to ingest and use broadly per its `default_allowed_uses`. | Allowed immediately. |
| **Yellow** | License terms are unclear, or reuse rights are uncertain. | Requires recorded human approval (`approval_status = "approved_for_ingestion"`) before ingestion. |
| **Orange** | Commercial or proprietary content requiring contract/licensing approval. | Requires recorded human approval before ingestion. |
| **Red** | Explicitly prohibited — paywalled without a license, scraped in violation of terms, contains personal data without a lawful basis, or otherwise off-limits. | **Never** ingested. No override exists. |
| **Unknown** | Not yet classified. | Blocked — classify first. |

Each class's defaults live in `domains/<domain_id>/source_policy.yaml`
under `license_classes.<Class>`: a `description`, a `default_allowed_uses`
map, and a `requires_review` boolean. See
[domain-config.md](domain-config.md) §3 for the full schema.

## The seven `allowed_uses` flags

Every source and every chunk carries an `AllowedUses` object with exactly
these seven boolean flags, all defaulting to `false`:

```
internal_search | rag | extraction | summarization | fine_tuning | customer_facing | commercial_distribution
```

A flag is `true` only when the source's actual terms grant that specific
use. There is no flag that is "on by default" except by explicit
`default_allowed_uses` configuration per license class — and even Green's
defaults leave `fine_tuning`, `customer_facing`, and
`commercial_distribution` `false` in every shipped template. Never set an
allowed-use flag to `true` without a specific clause supporting it; when
in doubt, `false`.

## Uncertain terms default to the more restrictive class

If a source's terms are silent, ambiguous, or contradictory, the license
classifier records the **more restrictive** of the plausible classes —
Yellow over Green, Orange over Yellow — and sets
`legal_review_required = true`. This is `source_policy.yaml`'s
`uncertain_defaults_to` field (default `Yellow`) and is a non-negotiable
rule, not a heuristic an agent can override:

> When license is uncertain, downgrade to the more restrictive class.
> Unknown or ambiguous terms are treated as Yellow or Orange, never as
> Green, until legal review says otherwise.
> — `../skill/SKILL.md`, Rule 8

Never round up to a more permissive class on incomplete evidence.

## The fine-tuning rule

`allowed_uses.fine_tuning` may be `true` **only** when the license terms
explicitly grant training/fine-tuning rights. Absence of a prohibition is
not a grant. `preReleaseGate` enforces this at release time: a release
that intends `fine_tuning = true` is blocked if any member source lacks
`allowed_uses.fine_tuning === true` — see
[release-model.md](release-model.md).

## `classify-license` and `--approve`

`kf classify-license` turns a discovery-time `likely_license` guess into
a confirmed `license_class`:

```bash
kf classify-license --domain <domain_id> --source <source_id> --class <Green|Yellow|Orange|Red>
```

This records a `LicenseClassification` (`source_id`, `license_class`,
`allowed_uses`, `legal_review_required`, `rationale?`, `classified_at`)
and writes `license_class` / `allowed_uses` / `legal_review_required`
back onto the `SourceRecord`. Classification alone does **not** set
`review_state = approved_for_ingestion` — that is a distinct, recorded
human decision. Passing `--approve` records that approval in the same
step, setting `approval_status = "approved_for_ingestion"` on the source.
For Green sources this is typically immediate; for Yellow/Orange it
represents the legal reviewer's actual signoff and must not be set
without one having happened.

Agents may propose a `license_class` and draft a rationale, but only a
human decision recorded through `kf classify-license --approve` (or the
equivalent review-workflow step) sets approval. No agent, prompt, or
skill instruction can set `approval_status` on its own authority
(`../skill/CLAUDE.md` Rule 7).

## What `preIngestGate` blocks

`packages/core/src/gates/index.ts`:

```ts
preIngestGate(source: SourceRecord): { allowed: boolean; reasons: string[] }
```

- `license_class` missing or `Unknown` → **blocked** ("classify first").
- `license_class === "Red"` → **blocked**, unconditionally, no override.
- `license_class` is `Yellow` or `Orange` and
  `approval_status !== "approved_for_ingestion"` → **blocked**.
- Otherwise (Green, or an approved Yellow/Orange) → **allowed**.

`kf ingest` calls this before any network or filesystem fetch. On a
block, nothing is written under `data/raw/<source_id>/` — no partial
fetch, no partial manifest (`skill/hooks/pre-ingest-license-check.md`).

## What `preReleaseGate` blocks (the six release blockers)

`packages/core/src/gates/index.ts`, `preReleaseGate` (backed by
`evaluateRelease`), checked at `kf build-release` and re-checked at `kf
validate-release`:

1. **Any member source is Red.**
2. **Any Yellow/Orange member source lacks
   `approval_status === "approved_for_ingestion"`.**
3. **Any unresolved `RiskRecord` with `severity === "high"`.**
4. **Any member chunk fails `citationGate`** (empty/whitespace citation).
5. **License errors** — the release's `intended_use` (or any use in a
   list of intended uses) is not permitted by every member source's
   `allowed_uses`.
6. **`fine_tuning` requested but any member source lacks explicit
   training rights** (`allowed_uses.fine_tuning !== true`).

Each blocking condition contributes a human-readable string to the
manifest's `blockers[]` and a structured entry in `gate_results[]`
(`{ gate, passed, details }`) — see [release-model.md](release-model.md)
for the manifest shape. A release with any blocker present has
`state: "blocked"`; the manifest records why, it is never silently
dropped.

## The audit trail

Every classification decision is recorded, not just applied silently:

- **`LicenseClassification` records** — `source_id`, `license_class`,
  `allowed_uses`, `legal_review_required`, optional `rationale`, and
  `classified_at` (ISO-8601 UTC), giving a timestamped history of why a
  source ended up in its class.
- **`SourceRecord.approval_status`** — `"approved_for_ingestion" |
  "rejected" | null`, the recorded human decision gating ingestion of
  non-Green sources.
- **`ReleaseManifest.license_class_counts`** — a per-release rollup
  (`Record<LicenseClass, number>`) of how many member sources fall into
  each class, giving reviewers and auditors an at-a-glance compliance
  summary for every shipped release.
- **`ReviewRecord`s** (`data/reviews/<domain_id>/reviews.jsonl`) — for
  `target_type: "source"`, capture `role`, `decision`
  (`approved|rejected|edited|needs_info`), `reviewer`, and `reviewed_at`,
  giving a durable record of who approved what and when, independent of
  the source record's current state.

Because the gates are pure functions with no side channel, the only way a
Yellow/Orange source ever reaches `data/raw/` is through this recorded
approval path — there is no ingestion route that bypasses it.
