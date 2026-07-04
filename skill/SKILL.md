---
name: knowledge-foundry
description: Governed pipeline for building trusted, licensed, versioned, RAG-ready domain corpora — source discovery through license classification, ingestion, chunking, tagging, claim extraction, risk screening, conflict detection, human review, and versioned release, all gated by the deterministic `kf` CLI.
---

# Knowledge Foundry

## What this skill does

Knowledge Foundry turns a pile of candidate documents, APIs, and datasets into a
trusted, licensed, versioned, retrieval-ready corpus for a professional domain.
It orchestrates a 13-stage pipeline — Source Discovery, License Classification,
Source Registry, Ingestion, Normalization, Semantic Chunking, Domain Tagging,
Claim Extraction, Risk Screening, Conflict Detection, Human Review, Versioned
Release, and RAG Evaluation — using Claude Code agents for judgment-heavy work
(searching, reading, classifying, tagging, summarizing) and a deterministic
TypeScript CLI (`kf`) for every rule that must never be bent (license gates,
citation checks, release gates).

Agents propose. `kf` disposes. No agent, prompt, or skill instruction in this
directory can approve a source, resolve a risk flag, or ship a release —
those are human decisions recorded through `kf` and checked by `kf`'s gate
functions.

Use this skill any time the goal is to build or extend a domain corpus that
will feed a RAG system, an internal search index, or a fine-tuning dataset,
and where provenance, licensing, and safety review matter as much as content
quality.

## When to use this skill

- Standing up a new domain corpus from scratch (e.g. a knowledge base for
  clinical guidelines, employment law, financial regulations, or internal
  corporate documentation).
- Adding new sources to an existing domain corpus (discovery → ingestion →
  chunking → tagging → release).
- Re-running risk screening or conflict detection after a domain's rules
  change.
- Cutting a new versioned release of a corpus, or evaluating an existing
  release's retrieval quality.
- Auditing an existing corpus for license compliance, missing citations, or
  unresolved risk flags before it is indexed or shipped.

## When NOT to use this skill

- **Casual question-answering.** If the user just wants an answer to a
  question, answer it — do not stand up a pipeline to look up one fact.
- **Building the RAG application itself.** This skill produces the corpus
  (chunks, manifests, evaluation results). It does not build retrieval
  services, vector database integrations, or chat UIs that consume the
  corpus. Those are separate engineering tasks that may *consume* a
  Knowledge Foundry release, but are out of scope for this skill.
- **Ingesting content you already know is prohibited.** If a source is
  known to be Red (prohibited) — paywalled without a license, scraped in
  violation of terms of service, containing personal data without a lawful
  basis, or otherwise off-limits — do not run it through discovery or
  ingestion "to see what happens." Say no and stop.
- **Bypassing review because a deadline is tight.** This skill has no
  "skip review" mode. If the user asks to mark a source approved, clear a
  risk flag, or ship a release without the underlying human review having
  happened, decline and explain why (see Non-negotiable rules below).
- **General document conversion or summarization** unrelated to building a
  governed, licensed corpus. Use a lighter-weight tool for one-off
  conversions that don't need provenance, licensing, or review gates.

## The pipeline

| # | Stage | Produces |
|---|-------|----------|
| 1 | Source discovery | Candidate source registry entries |
| 2 | License classification | `license_class`, `allowed_uses`, `legal_review_required` on each source |
| 3 | Source registry approval | Sources marked `approved_for_ingestion` (human decision) |
| 4 | Ingestion | Immutable raw artefacts + ingestion manifest (checksum, retrieval date) |
| 5 | Normalization | Clean Markdown/JSON + metadata sidecar |
| 6 | Semantic chunking | `chunks.jsonl` with section path, text, citation |
| 7 | Domain tagging | Chunks enriched with topics, entities, chunk type, evidence level, audience |
| 8 | Claim extraction | `claims.jsonl` — claim text, population, intervention, outcome, evidence level, limitations |
| 9 | Risk screening | `risk.jsonl` — risk type, severity, action, resolved flag per chunk |
| 10 | Conflict detection | `conflicts/*.jsonl` — contradictions across sources on the same topic |
| 11 | Human review | Reviewers approve, edit, or reject flagged chunks, claims, conflicts, and sources |
| 12 | Versioned release | `manifest.json` + `approved_chunks.jsonl` under `releases/<domain_id>/<release_id>/` |
| 13 | RAG evaluation | Retrieval precision, citation coverage, unsafe output rate, license errors |

Each stage's output is the next stage's input. Before invoking a stage,
verify the required upstream artefact exists and is schema-valid — do not
guess at missing data.

## Universal safety and license rules (non-negotiable)

These rules hold for every domain, every source, every release, with no
exceptions granted by an agent or a skill instruction:

1. **Never ingest Red sources.** Red means prohibited. There is no override.
2. **Never ingest Yellow or Orange sources without recorded approval**
   (`review_state = approved_for_ingestion`, set only after legal/SME
   sign-off). Discovery and classification may run on Yellow/Orange
   candidates; ingestion may not.
3. **`fine_tuning = true` only with explicit training rights** recorded on
   the source. Absence of a restriction is not the same as a grant.
4. **Raw artefacts are immutable.** Once written under `data/raw/<source_id>/`,
   a raw artefact is never edited in place. Corrections mean re-ingesting a
   new version, not patching the old one.
5. **Chunks must carry citations.** A chunk with no traceable citation back
   to its source is not eligible for release.
6. **Releases with unresolved high-severity risk flags, missing
   citations, or license errors are blocked.** `kf build-release` /
   `kf validate-release` enforce this in code — not as a suggestion.
7. **Agents never override gates or human review states.** An agent may
   recommend a license class, flag a risk, or draft a review note. Only a
   human, acting through `kf`, changes `review_state`, resolves a risk, or
   approves a release.
8. **When license is uncertain, downgrade to the more restrictive class.**
   Unknown or ambiguous terms are treated as Yellow or Orange, never as
   Green, until legal review says otherwise.

See `skill/CLAUDE.md` for the full expansion of these rules, the gate that
enforces each one, and escalation paths.

## Domain configuration is required, not optional

Knowledge Foundry has zero domain-specific behavior baked into the engine.
Every domain must define exactly seven configuration files under
`domains/<domain_id>/`:

`domain.yaml`, `taxonomy.yaml`, `source_policy.yaml`, `evidence_model.yaml`,
`risk_rules.yaml`, `review_workflow.yaml`, `eval_questions.yaml`.

If a domain does not exist yet, run `kf init-domain` first (see
`skill/commands/init-domain.md`) and validate it with `kf validate-domain`
before touching any other stage. Do not invent domain rules inline in a
prompt or agent response — if the domain config doesn't say it, the
pipeline doesn't know it.

*Example (illustrative only, not a requirement of this skill): a
functional-medicine domain might define an evidence scale of A/B/C/D/X and
a risk rule for supplement–drug interactions. A legal domain would define
none of that and instead define jurisdiction taxonomy and conflict-of-law
rules. The engine does not care which — it only reads whatever
`domains/<domain_id>/*.yaml` says.*

## Human review requirements

Human review is a hard checkpoint, not a courtesy step, at four points:

- **License review** — legal counsel approves or rejects Yellow/Orange
  sources before ingestion.
- **Safety review** — a subject-matter expert (or compliance/legal, per the
  risk type) resolves risk flags raised during screening.
- **Evidence review** — subject-matter experts confirm or adjust claim
  evidence levels and resolve conflicts between sources.
- **Release review** — legal, domain experts, and the product owner jointly
  agree a release meets the bar for its intended use before it is marked
  `approved`.

Agents prepare the material for each of these reviews (drafts, flags,
summaries) but never record the review decision themselves.

## Release requirements

A release is a directory `releases/<domain_id>/<release_id>/` containing a
machine-readable `manifest.json` and `approved_chunks.jsonl`, plus an
`EvaluationResult` (`evals/<release_id>/results.json`, also embedded in
the manifest's `evaluation` field) once `kf eval-rag` has run. A release
only reaches `approved` when, and only when:

- every member source's license permits the release's intended
  `allowed_uses`;
- every member chunk carries a citation;
- no unresolved `RiskRecord` with `severity = "high"` remains among
  member chunks;
- `fine_tuning` is only set if every member source has explicit training
  rights;
- RAG evaluation has run and its results are attached to the manifest;
- the required human reviewers (per `domains/<domain_id>/review_workflow.yaml`)
  have signed off.

Releases move `draft → blocked | approved → indexed → deprecated` and are
treated as immutable once they leave `draft` — corrections mean a new
`release_id`, never an edit to a shipped release.

## Marketplace positioning

Knowledge Foundry is domain-agnostic infrastructure: the same skill,
the same agents, the same `kf` CLI work for healthcare, legal, financial,
or internal corporate knowledge corpora. What changes between domains is
only the seven YAML files under `domains/<domain_id>/`. Teams adopting this
skill get a reusable, auditable pipeline for building the kind of corpus
that a RAG or fine-tuning system can actually be trusted with — instead of
re-inventing licensing, chunking, and review logic per project.
