# Knowledge Foundry — Operating Contract

This file is the binding operating contract for any agent working within
the Knowledge Foundry skillset. It expands the non-negotiable rules stated
in `skill/SKILL.md`, defines which `kf` command and gate must run before a
pipeline stage may advance, sets escalation routes, and fixes the file
layout every agent must read from and write to.

Every rule below is enforced by a deterministic function in `kf`, not by
agent judgment. Where a rule says "blocked," it means the CLI refuses the
operation and returns a non-zero exit with a reason — no agent, prompt, or
instruction in this directory can talk it into proceeding anyway.

## 1. Non-negotiable rules

1. **Never ingest Red sources.**
   `kf classify-license` may assign `license_class = Red`. `kf ingest`
   checks `license_class` before fetching anything and refuses
   unconditionally if it is Red. There is no flag, override, or
   "ingest anyway" path.

2. **Never ingest Yellow or Orange sources without recorded approval.**
   Ingestion of a Yellow or Orange source requires
   `review_state = approved_for_ingestion` on the source record, which is
   only set after a human reviewer (legal counsel or domain expert, per
   `domains/<domain_id>/review_workflow.yaml`) records approval. `kf ingest`
   checks this state and refuses if it is anything else — `candidate` or
   `license_review` are not sufficient.

3. **`fine_tuning = true` only with explicit training rights.**
   A source's `allowed_uses.fine_tuning` flag may only be set to `true`
   when the license terms explicitly grant training/fine-tuning rights.
   Absence of a prohibition is not a grant. `kf build-release` refuses a
   release with `fine_tuning = true` if any member source lacks this flag.

4. **Raw artefacts are immutable.**
   Once `kf ingest` writes a raw artefact under `data/raw/<source_id>/`,
   it is write-once. Every raw artefact carries a SHA-256 checksum in its
   ingestion manifest, verified before normalization. A correction is a
   new ingestion (new version), never an in-place edit.

5. **Chunks must carry citations.**
   `kf chunk` must populate a citation on every chunk record. `kf
   build-release` and `kf validate-release` refuse to include, or to
   approve, any chunk missing a citation.

6. **Releases with unresolved high-severity risk flags or license errors
   are blocked.**
   `kf build-release` refuses to assemble a release, and `kf
   validate-release` refuses to approve one, while any member chunk has an
   open `RiskRecord` with `severity = "high"` and `resolved = false`, or
   while any member chunk's `allowed_uses` are inconsistent with its
   source's `license_class`. The release's state is set to `blocked`, not
   silently dropped — the manifest records why in `blockers`.

7. **Agents never override gates or human review.**
   Every gate above is a pure function in `kf`'s core, called identically
   by the CLI, the test suite, and this skill's hooks. An agent may draft
   a recommendation (a suggested `license_class`, a risk flag, a proposed
   evidence level) but never writes a `review_state`, a risk record's
   `resolved`/`resolution_note` fields, or a release `state` directly —
   those fields are only ever set by a human decision recorded through a
   `kf` command.

8. **When license is uncertain, downgrade to the more restrictive class.**
   If terms are ambiguous, silent, contradictory, or unavailable, the
   license classifier agent records the more restrictive of the plausible
   classes (Yellow over Green, Orange over Yellow) and sets
   `legal_review_required = true`. Never round up to a more permissive
   class on incomplete evidence.

## 2. Workflow stage gating

Advancing from one pipeline stage to the next always means: run the `kf`
command for the current stage, let its gate function evaluate, and only
proceed if it exits clean. The table below is the authoritative mapping.

| Stage | `kf` command | Gate checked before advancing |
|-------|--------------|-------------------------------|
| Domain setup | `kf init-domain`, then `kf validate-domain` | All 7 domain YAML files present and schema-valid |
| Source discovery | `kf discover` (or `kf create-source` for a single manual entry) | Candidate record schema-valid; no gate on license yet |
| License classification | `kf classify-license` | `license_class` and `allowed_uses` recorded; Yellow/Orange routed to `legal_review_required = true` |
| Registry approval | (human decision, recorded via the review workflow) | `review_state = approved_for_ingestion` before ingestion is permitted |
| Ingestion | `kf ingest` | Red blocked always; Yellow/Orange blocked unless `approved_for_ingestion`; checksum recorded |
| Normalization | `kf normalize` | Required fields present (title, sections, citations); checksum of source raw artefact verified |
| Chunking | `kf chunk` | Every chunk has section path + citation |
| Tagging | `kf tag` | Every chunk has domain-valid tags per `domains/<domain_id>/taxonomy.yaml` |
| Claim extraction | `kf extract-claims` | Every claim has population, intervention, outcome, evidence level |
| Risk screening | `kf screen-risk` | Rules from `domains/<domain_id>/risk_rules.yaml` applied; flags recorded with severity |
| Conflict detection | `kf detect-conflicts` | Contradictions across sources on shared topics recorded |
| Human review | (human decision, recorded via the review workflow) | `review_state` moves to `needs_review` → `approved` or `rejected` |
| Release build | `kf build-release`, then `kf validate-release` | All release-blocking conditions in Rule 6 clear before `state` may move past `blocked` |
| RAG evaluation | `kf eval-rag` | Evaluation results attached to the release manifest |

Do not skip a row. If a required upstream artefact is missing or fails
schema validation, stop and surface the failure — do not fabricate the
missing data to keep moving.

## 3. Escalation rules

| Situation | Route to | Why |
|-----------|----------|-----|
| Source license is Yellow or Orange | Legal review queue | Only legal counsel can set `approved_for_ingestion` on a non-Green source |
| Source license is ambiguous or terms are silent | Legal review queue, classified at the more restrictive plausible class | Rule 8 — never guess toward permissiveness |
| Risk flag severity is `high` | Subject-matter expert (or compliance/legal, depending on risk type) | Only a domain expert can judge whether flagged content is safe, and only a human sets `resolved = true` with a `resolution_note` |
| Conflict detected between sources on the same topic | Expert review queue (per `domains/<domain_id>/review_workflow.yaml`) | Contradictions require domain judgment to resolve, not automatic merging |
| Release fails a gate in `kf validate-release` | Whoever owns the failing gate (legal for license errors, SME for risk/evidence, product owner for scope) | Each gate failure has a distinct owner — route to the specific one, not a generic queue |
| Domain config is missing, incomplete, or fails `kf validate-domain` | Domain owner / whoever is standing up the domain | Do not proceed with partial domain rules; do not improvise missing YAML content |

## 4. File layout conventions

All artefacts live under a workspace directory (defaults to the current
working directory; override with `--workspace <path>`).

| Path | Contents |
|------|----------|
| `data/source_registry/` | JSONL source records — candidates and approved, including `license_class`, `allowed_uses`, `review_state` |
| `data/raw/<source_id>/` | Immutable raw artefacts (HTML, PDF, CSV, JSON, …) with ingestion manifest and checksum |
| `data/normalized/<source_id>/` | Clean Markdown/JSON (`document.md`) plus metadata sidecar |
| `data/chunks/<source_id>/` | `chunks.jsonl` — semantically chunked content, citations, domain tags |
| `data/claims/<source_id>/` | `claims.jsonl` — extracted claims with evidence level and limitations |
| `data/risk/<source_id>/` | `risk.jsonl` — risk flags with type, severity, action, resolved |
| `data/conflicts/<domain_id>/` | Conflict records (one file per topic) referencing conflicting chunk IDs |
| `releases/<domain_id>/<release_id>/` | `manifest.json`, `approved_chunks.jsonl` for a versioned release |
| `evals/<release_id>/results.json` | Canonical `EvaluationResult` for a release run by `kf eval-rag`; also embedded in the release manifest's `evaluation` field |

IDs are stable, human-readable slugs: `source_id`, `chunk_id =
<source_id>#<seq>`, `claim_id`, `risk_id`, `conflict_id`, `release_id =
<domain>-<tier>-v<semver>`. Never construct these paths or IDs by hand in
a way that diverges from what `kf` produces — read them from the
artefacts `kf` writes.
