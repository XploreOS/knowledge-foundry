# /build-release

## Purpose

Assemble reviewed, license-clean, citation-complete chunks into a
versioned corpus release — a machine-readable manifest plus the chunk
set it covers — and refuse to produce an approvable release while any
release-blocking condition is unresolved.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `--domain <domain_id>` | Yes | Domain the release belongs to. |
| `--release-id <id>` | Yes | Unique identifier, `<domain>-<tier>-v<semver>` (e.g. `coreaevo-p0-v0.1`). |
| `--root <path>` | No | Workspace root; defaults to current working directory. |

## Preconditions

- Candidate chunks across the domain have completed chunking, tagging,
  risk screening, and (where applicable) claim extraction and conflict
  detection.
- `release_id` is new — releases are immutable once out of `draft`.

## Steps

1. Identify every chunk in `domain_id` whose source and review state make
   it release-eligible: license permits the release's intended uses, has
   passed human review, and is not rejected.
2. Exclude any chunk that fails a release-blocking condition:
   - its source is `Red`;
   - its source is Yellow/Orange without `approved_for_ingestion`;
   - it carries an unresolved `RiskRecord` with `severity === "high"`;
   - it is missing a citation;
   - its `allowed_uses` are inconsistent with its source's `license_class`
     for the release's intended use;
   - the release intends `fine_tuning = true` but its source lacks
     explicit training rights.
3. Run `kf build-release --domain <domain_id> --release-id <release_id>`
   to write `manifest.json` and `approved_chunks.jsonl` under
   `releases/<domain_id>/<release_id>/`.
4. If any blocking condition applies to the release as a whole, the
   manifest's `state` is `blocked` and the manifest records why — do not
   attempt to force `state = approved` by editing the manifest directly.
5. If the gate is clean, `state` starts at `draft`, pending human release
   review and `kf validate-release`.

## Outputs

- `releases/<domain_id>/<release_id>/manifest.json` — summarises source
  counts, license class counts, evidence summary, gate results, and
  `state`.
- `releases/<domain_id>/<release_id>/approved_chunks.jsonl` — the member
  chunk set that passed review.

## Failure modes

- **Any release-blocking condition above** — `state = blocked`; fix the
  underlying issue (resolve the risk, get the license reviewed, add the
  missing citation, adjust the release's intended uses) and re-run rather
  than editing the manifest.
- **Duplicate `release_id`** — refused; releases are immutable, choose a
  new identifier.
- **Empty candidate set** — report plainly; do not relax review-state
  requirements just to produce a nonempty release.

## Example invocation

"Build release `coreaevo-p0-v0.1` for CoreAevo. Include all chunks that
are Green and have been approved by legal, CMO and product. Generate a
manifest summarising the release."

## Related CLI command

`kf build-release` (assembly), `kf validate-release` (moves a clean
`draft` toward `approved` once human release review has signed off).

## Review gates

Release review — legal, domain experts, and the product owner — must
jointly agree the release meets its intended-use bar before `state` moves
from `draft` to `approved`. The release gate is enforced in code inside
`kf build-release` / `kf validate-release`; no agent or prompt can bypass
a blocker by re-describing the release's intent.
