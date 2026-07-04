# Architecture and Components

Knowledge Foundry is organised as a set of orchestrated agents and deterministic tools. The system separates **what** to do (agent logic and workflows) from **how** to do it (deterministic ingestion, parsing and storage). The high‑level architecture is shown below.

## Pipeline overview

1. **Source discovery.** Search for candidate resources, compile a source registry entry for each candidate and ask legal/subject matter experts to approve or reject them.
2. **License and usage classification.** Classify each source into four classes (Green, Yellow, Orange, Red) and record allowed uses (internal search, RAG, fine‑tuning, customer‑facing, commercial distribution). Yellow and Orange sources require legal approval before ingestion.
3. **Ingestion.** Download approved sources (web pages, PDFs, APIs, datasets or internal documents) and store them immutably. Each raw artefact carries its source‑id, canonical URL, publisher, retrieval time and checksum.
4. **Normalization.** Convert raw artefacts into clean Markdown or structured JSON while preserving headings, tables, figure captions and citations. Remove navigation, ads and boilerplate. Record metadata in a sidecar file.
5. **Semantic chunking.** Break documents into retrieval‑friendly units based on domain semantics—guideline recommendations, biomarker cards, legal provisions, financial metrics, etc. Each chunk includes its source‑id, section path, text, citation, and domain metadata.
6. **Domain tagging.** Attach taxonomy tags, audiences and evidence levels to each chunk using the domain’s configuration. For example, a medical chunk might be tagged with pathway = “Metabolic Optimisation”, evidence grade = B, audience = clinician.
7. **Claim extraction.** Identify explicit claims and facts from chunks, capturing the claim text, population, intervention, outcome, evidence level and limitations.
8. **Risk and safety screening.** Run domain‑specific rules to flag risky content, unsupported recommendations, privacy issues or licensing breaches. Create safety records that require expert review.
9. **Conflict detection.** Detect contradictions between chunks (e.g., recommended vitamin D thresholds differ across guidelines) and generate conflict records for subject matter experts.
10. **Human review.** Present flagged chunks, claims and conflicts to legal counsel, clinicians or other domain experts for approval, editing or rejection.
11. **Release management.** Assemble approved chunks into a versioned corpus release with a manifest summarising sources, licences, evidence grades and evaluation metrics. Releases can be used for RAG, internal search, or training according to their allowed uses.
12. **RAG evaluation.** Run automated retrieval tests using representative questions to measure citation coverage, retrieval precision, unsafe output rate and other quality metrics. Evaluation results are stored with the release manifest.

## Agents and tool roles

The core pipeline stages are implemented by a set of deterministic tools, each of which can be orchestrated by Claude‑Code subagents. The recommended agents are:

* **Source discovery agent** — performs targeted searches, extracts candidate sources and writes provisional source records.
* **License classifier agent** — reads terms/conditions, classifies licences and sets allowed uses. Routes uncertain cases to legal review.
* **Ingestion agent** — downloads or fetches approved sources, computes checksums and stores raw artefacts.
* **Normalization agent** — converts raw artefacts into Markdown/JSON, preserving structure and citations.
* **Chunking agent** — splits documents into semantically meaningful retrieval units; chooses strategy based on source type.
* **Taxonomy tagger** — attaches domain tags, audiences, evidence levels and other metadata using the domain configuration.
* **Claim extractor** — parses chunks to identify claims, populations, interventions, outcomes and limitations.
* **Risk screener** — applies domain‑specific risk rules to flag unsafe or non‑compliant content.
* **Conflict detector** — detects contradictions across sources and flags them for expert resolution.
* **Release manager** — bundles approved chunks into a release, generates a manifest and triggers RAG evaluation.
* **RAG evaluator** — runs predefined question sets to test retrieval precision, citation coverage and safety for each release.

Each agent has a clearly defined input and output schema. Agents do **not** make final judgments on safety or correctness; they merely prepare data and raise flags for human review.

## Data stores and artefact layout

Knowledge Foundry uses a structured directory layout to keep artefacts organised:

* **data/source\_registry/** — JSONL files containing candidate and approved source records, including licence class and allowed uses.
* **data/raw/** — immutable copies of raw sources (HTML, PDF, CSV, JSON, etc.) named by source‑id and version.
* **data/normalized/** — normalised Markdown or JSON files with content and metadata preserved.
* **data/chunks/** — JSONL files containing semantically chunked content with domain tags and citation metadata.
* **data/claims/** — extracted claim records with evidence level and limitations.
* **data/risk/** — safety screening results for each chunk, indicating what type of risks were found.
* **data/conflicts/** — records of contradictions between sources along with references to the conflicting chunks.
* **releases/** — release packages containing approved chunks (approved\_chunks.jsonl), a manifest (manifest.json) and evaluation results.
* **evals/** — evaluation runs and metrics for each release.

## Domain configuration

All domain‑specific behaviour is captured in configuration files under domains/<domain\_id>/:

* **domain.yaml** — high‑level description, primary and prohibited use cases, review roles and default release policies.
* **taxonomy.yaml** — entity types, chunk types and allowed metadata fields for the domain.
* **source\_policy.yaml** — licence classes, allowed uses and blockers for certain source types or licences.
* **evidence\_model.yaml** — evidence grading scale (A/B/C/D/X or other domain‑appropriate levels).
* **risk\_rules.yaml** — risk categories and rules for flagging unsafe or non‑compliant content.
* **review\_workflow.yaml** — defines which roles must approve which artefacts (e.g., legal, domain expert, product owner).
* **eval\_questions.yaml** — representative questions to evaluate the retrieval quality of a release.

These configuration files allow the same pipeline and tools to be reused across domains; only the taxonomy, rules and evaluation criteria change.