# Hook: pre-ingest-license-check

## Trigger

Runs immediately before `kf ingest` fetches any content for a source —
the first step of ingestion, before any network or filesystem call to
retrieve the source's content. It runs for every ingestion attempt; there
is no bypass flag.

## Check performed

The deterministic license gate inside `kf ingest` reads the source
record's `license_class` and `review_state` and evaluates:

- Is `license_class = Red`? If so, blocked, unconditionally.
- Is `license_class` Yellow or Orange, and is `review_state` anything
  other than `approved_for_ingestion`? If so, blocked.
- Is `license_class` missing or not yet classified? If so, blocked —
  `kf classify-license` must run first.
- Otherwise (Green, or Yellow/Orange with `approved_for_ingestion`
  recorded), allowed.

## Blocking behavior

- Ingestion of any Red source is refused outright, with no override path.
- Ingestion of any Yellow/Orange source without
  `review_state = approved_for_ingestion` is refused.
- Ingestion of any source whose license has not yet been classified is
  refused.
- On failure, `kf ingest` exits non-zero and writes nothing to
  `data/raw/<source_id>/` — no partial fetch, no partial manifest.
- The check does not evaluate content quality, only license/approval
  eligibility.

## Remediation guidance

- **Red source** — there is no remediation; the source is permanently
  ineligible for ingestion. Do not attempt to re-classify around it.
- **Yellow/Orange without approval** — route the source to the legal
  review queue; ingestion becomes possible only after a human reviewer
  records `review_state = approved_for_ingestion`.
- **License not yet classified** — run `kf classify-license` on the
  source first, then retry `kf ingest`.

## Related skill artefacts

- Command: `skill/commands/ingest-source.md`.
- Agent: `skill/agents/ingestion-agent.md`.
