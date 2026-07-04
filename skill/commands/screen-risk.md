# /screen-risk

## Purpose

Apply domain-specific risk rules to a source's chunks (and claims) to flag
content that may be unsafe, non-compliant, or otherwise risky —
contraindications, unsupported recommendations, privacy hazards, licensing
breaches — and route the flags for expert review.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `--source <source_id>` | Yes | Source whose chunks/claims should be screened. |
| `--domain <domain_id>` | Yes | Domain configuration supplying the risk rules. |
| `--root <path>` | No | Workspace root; defaults to current working directory. |

## Preconditions

- `data/chunks/<source_id>/chunks.jsonl` (and, if available,
  `data/claims/<source_id>/claims.jsonl`) exist and are tagged.
- `domains/<domain_id>/risk_rules.yaml` is present and validated.

## Steps

1. Load the domain's risk categories and rules from
   `domains/<domain_id>/risk_rules.yaml`.
2. Evaluate each chunk (and its associated claims) against every
   applicable rule — e.g. supplement/drug interaction checks, unauthorised
   legal or financial advice patterns, personal data exposure, licensing
   inconsistencies.
3. For each match, record a `RiskRecord`: `risk_type` (matching a
   `risk_rules.yaml` category), a plain-language `description` of what
   was found, `severity` (`low`, `medium`, or `high` — taken from the
   matched rule), and `action` (`flag`, `block`, or `downgrade` — also
   taken from the matched rule).
4. Run `kf screen-risk --source <source_id> --domain <domain_id>` to write
   `data/risk/<source_id>/risk.jsonl`. Each record starts with
   `resolved: false`.
5. Do not resolve a flag yourself (never set `resolved: true`) — that is
   a human decision (see Review gates below).

## Outputs

- `data/risk/<source_id>/risk.jsonl` — one `RiskRecord` per flag:
  `risk_id, source_id, chunk_id?, risk_type, severity, action,
  description, resolved, resolution_note?, reviewed_by?`.

## Failure modes

- **Rule produces a false positive** — record it anyway with a note; let
  the reviewer dismiss it via the review workflow rather than silently
  suppressing the flag.
- **No domain risk rules defined for a relevant hazard** — do not invent a
  rule ad hoc; note the gap and route it to the domain owner to add to
  `domains/<domain_id>/risk_rules.yaml`.
- **Severity misjudged** — when uncertain between two severities, record
  the higher one; a flag that turns out to be lower severity is corrected
  by the reviewer, whereas an under-flagged high-risk item can slip through
  release gating.

## Example invocation

"Run the CoreAevo risk rules on the chunks of `nih-ods-vitamin-d`. Flag any
supplements that could interact with medications or any recommendations
that exceed Tolerable Upper Intake Levels."

## Related CLI command

`kf screen-risk`.

## Review gates

Flags with `severity = "high"` route to the subject-matter expert (or
compliance/legal, depending on risk type) per
`domains/<domain_id>/review_workflow.yaml`. Only a human reviewer sets a
flag's `resolved` field to `true`, together with a `resolution_note` and
`reviewed_by`. Unresolved `severity = "high"` flags block release
(Rule 6 in `skill/CLAUDE.md`, enforced by `preReleaseGate`).
