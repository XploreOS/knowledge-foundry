# Knowledge Foundry — Agent Index

Knowledge Foundry's pipeline is implemented by eleven specialised agents,
each responsible for exactly one stage. Every agent is deterministic and
auditable in scope: it prepares data and raises flags, and it never
records a gate decision or human review state. Full agent definitions live
in `skill/agents/*.md`; this file is the index and the orchestration
contract between them.

## Agent index

| Agent | Stage | Input | Output | Gate interaction |
|-------|-------|-------|--------|-------------------|
| [Source discovery agent](agents/source-discovery-agent.md) | Source discovery | `domain`, `topic`, `source_type`, `max_candidates` | Candidate source registry entries (JSONL) | None — writes `likely_license`, not a confirmed gate value |
| [License classifier agent](agents/license-classifier-agent.md) | License classification | `source_id` | Updated source record: `license_class`, `allowed_uses`, `legal_review_required` | Feeds `kf classify-license`; Yellow/Orange routes to legal review queue |
| [Ingestion agent](agents/ingestion-agent.md) | Ingestion | `source_id` (must be `approved_for_ingestion`) | Raw artefact + ingestion manifest (checksum, retrieval date) | `kf ingest` refuses Red always, Yellow/Orange without approval |
| [Normalization agent](agents/normalization-agent.md) | Normalization | `source_id` | `document.md` + metadata sidecar | `kf normalize` verifies raw checksum before conversion |
| [Chunking agent](agents/chunking-agent.md) | Semantic chunking | `source_id` | `chunks.jsonl` (section path, text, citation) | `kf chunk` enforces citation presence |
| [Taxonomy tagger](agents/taxonomy-tagger-agent.md) | Domain tagging | `source_id`, `domain_id` | Chunk records enriched with topics, entities, chunk type, evidence level, audience | `kf tag` validates tags against `domains/<domain_id>/taxonomy.yaml` |
| [Claim extractor](agents/claim-extractor-agent.md) | Claim extraction | `source_id` | `claims.jsonl` (claim text, population, intervention, outcome, evidence level, limitations) | `kf extract-claims` validates required fields |
| [Risk screener](agents/risk-screening-agent.md) | Risk and safety screening | `source_id`, `domain_id` | `risk.jsonl` (risk type, severity, action, resolved) | `kf screen-risk` applies `domains/<domain_id>/risk_rules.yaml`; `severity = high` routes to SME review |
| [Conflict detector](agents/conflict-detection-agent.md) | Conflict detection | `domain_id`, optional `topic` | Conflict records referencing contradicting chunk IDs | `kf detect-conflicts` writes for expert review; never auto-resolves |
| [Release manager](agents/release-manager-agent.md) | Release assembly | `domain_id`, `release_id` | `manifest.json`, `approved_chunks.jsonl` under `releases/<domain_id>/<release_id>/` | `kf build-release` / `kf validate-release` enforce all release gates |
| [RAG evaluator](agents/rag-evaluator-agent.md) | RAG evaluation | `release_id`, `domain_id` | `evals/<release_id>/results.json` (citation coverage, retrieval precision, unsafe output rate, license errors) | `kf eval-rag`; results attach to the release manifest's `evaluation` field |

## Orchestration tips

- **Each agent's output is the next agent's input.** Discovery feeds
  classification, classification feeds ingestion, ingestion feeds
  normalization, normalization feeds chunking, chunking feeds tagging and
  claim extraction, tagging/claims feed risk screening and conflict
  detection, and reviewed chunks feed release assembly, which feeds
  evaluation. Do not invoke an agent whose required upstream artefact does
  not yet exist.

- **Validate before proceeding, every time.** Before running an agent,
  confirm the file(s) it depends on exist under the paths in
  `skill/CLAUDE.md` and pass schema validation. If validation fails, stop
  and surface the failure rather than improvising missing fields.

- **Never override gates.** No agent in this index sets `review_state`,
  sets a risk record's `resolved` field, or changes a release `state`. Those values are
  written only by a human decision recorded through the corresponding `kf`
  command. An agent's job ends at "flag it, recommend it, draft it" — a
  human or a deterministic gate function decides.

- **Route by severity and type, not by convenience.** License questions go
  to legal, risk flags go to the relevant SME (or compliance/legal for
  privacy or regulatory risk types), conflicts go to the domain expert
  queue defined in `domains/<domain_id>/review_workflow.yaml`. See
  `skill/CLAUDE.md` §3 for the full escalation table.

- **Reuse slash commands across domains.** Every agent is invoked through
  the corresponding command in `skill/commands/*.md`, parameterised by
  `--domain` and other flags — never hard-code domain-specific behavior
  into an agent prompt. Domain behavior comes only from
  `domains/<domain_id>/*.yaml`.
