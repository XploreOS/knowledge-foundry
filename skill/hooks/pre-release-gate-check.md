# Hook: pre-release-gate-check

## Trigger

Runs immediately before a release's state may move from `blocked`/`draft`
toward `approved` — i.e. as the core of both `kf build-release` (at
assembly time) and `kf validate-release` (at approval time). Runs every
time either command is invoked; there is no "skip validation" flag.

## Check performed

The deterministic release gate blocks a release when any of the
following holds:

1. Any member source is Red.
2. Any Yellow/Orange member source lacks `review_state =
   approved_for_ingestion`.
3. Any member chunk carries an unresolved risk flag of severity `high`.
4. Any member chunk has an empty or missing citation.
5. The release's intended use is not permitted by every member source's
   `allowed_uses` (a license error).
6. The release intends `fine_tuning = true` but any member source lacks
   explicit training rights.

## Blocking behavior

- Assembling a release (`kf build-release`) that would otherwise include
  any of the above is refused; the manifest's `state` is set to `blocked`
  and the specific reason(s) are recorded.
- Approving a release (`kf validate-release`) re-runs the same checks, so
  a release cannot slip from `draft` to `approved` if a blocker has
  re-appeared since assembly (e.g. a risk flag was reopened, or a
  source's approval was revoked).
- This check does not evaluate retrieval quality or evaluation metrics —
  that is `kf eval-rag`'s responsibility, feeding release review as a
  separate, human-weighed input.
- Nothing in this skillset may set a release `state` to `approved` while
  any blocker is present.

## Remediation guidance

- **Red or unapproved Yellow/Orange source** — do not include it; if it
  must be part of the release, resolve licensing/approval first.
- **Unresolved high-severity risk flag** — route to the appropriate human
  reviewer for resolution before rebuilding the release.
- **Missing citation** — return to chunking/tagging to resolve the
  citation for the affected chunk.
- **License error or unsupported `fine_tuning`** — adjust the release's
  intended use, or exclude the member source that lacks the required
  right, and rebuild.

## Related skill artefacts

- Command: `skill/commands/build-release.md`.
- Agent: `skill/agents/release-manager-agent.md`.
