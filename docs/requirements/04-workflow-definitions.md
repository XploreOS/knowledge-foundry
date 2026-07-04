# Workflow Definitions

This document describes the end‑to‑end workflows supported by the Knowledge Foundry skillset. Workflows define the order in which agents and tools are invoked, the gating conditions between stages, and the human review checkpoints.

## 1. New source intake

1. **Discover candidates**: use the source discovery agent to search for candidate resources for a given domain and topic. Write provisional records to data/source\_registry/candidates/<domain>/<date>-<topic>.jsonl.
2. **Classify licences**: for each candidate, run the licence classifier agent. Update the source record with license\_class and allowed\_uses fields. Yellow and Orange sources move into a legal review queue.
3. **Approve or reject**: human reviewers (legal counsel or domain experts) review Yellow/Orange source records and either approve them for ingestion, reject them, or request further information.
4. **Mark for ingestion**: update approved sources with approval\_status=approved\_for\_ingestion and assign an ingestion priority (e.g. P0 for immediate ingestion).

## 2. Source ingestion and normalisation

1. **Run ingestion**: call the ingestion agent on approved sources. The agent downloads or fetches the resource, stores it under data/raw/<source\_id> and records retrieval metadata and checksums.
2. **Normalise documents**: for each ingested source, call the normalisation agent to convert the raw artefact into a clean Markdown or structured JSON file. Remove extraneous navigation and keep headings, tables and citations intact. Store under data/normalized/<source\_id>/.
3. **Validate normalised output**: run schema checks on the normalised document to ensure required fields are present (e.g. title, sections, citations). If validation fails, flag for review and remediation.

## 3. Chunking and tagging

1. **Choose chunk strategy**: inspect the source type and select the appropriate chunking method: guideline sections, research article components, statute provisions, table rows, etc.
2. **Chunk the document**: run the chunking agent to create JSONL records for each chunk. Record the section path and citation for every piece of text.
3. **Tag chunks**: run the taxonomy tagger to attach domain‑specific metadata such as topics, entities, chunk types, evidence levels and audiences.
4. **Validate chunks**: ensure that every chunk has a citation, metadata and allowed uses consistent with the source’s licence. Flag missing or inconsistent fields for review.

## 4. Claim extraction

1. **Extract claims**: call the claim extractor on each source or on the domain’s approved chunks. Identify explicit statements of fact or recommendation.
2. **Structure claims**: for each claim, record the claim text, population, intervention, outcome, evidence level and limitations. Store these structured records under data/claims/<source\_id>/.
3. **Review claims**: subject matter experts verify the extraction and adjust evidence levels or limitations as needed.

## 5. Risk and conflict screening

1. **Risk screening**: run the risk screening agent using domain‑specific rules. Identify content that may be unsafe or non‑compliant (e.g. supplement/drug interactions, unauthorised legal advice, investment solicitation, personal data leaks).
2. **Conflict detection**: run the conflict detector to find contradictory statements across chunks or sources on the same topic. Create conflict records pointing to the offending chunks.
3. **Escalate for review**: send risk and conflict records to the appropriate reviewers (legal, compliance, CMO, etc.) for resolution. Update the status of chunks after review (accepted, edited, or rejected).

## 6. Release preparation

1. **Assemble approved chunks**: identify all chunks in the domain that have passed licence checks, safety screening and human review. Exclude rejected or high‑risk items.
2. **Create release ID**: choose a unique release\_id (e.g. coreaevo‑p0‑v0.1) to represent a snapshot of the corpus.
3. **Build the release**: call the release manager agent to compile approved chunks into approved\_chunks.jsonl, generate a manifest summarising sources, licences and evidence levels, and add placeholders for evaluation results.

## 7. Evaluation and promotion

1. **Run RAG evaluation**: call the RAG evaluator on the release. Use the domain’s evaluation question set to test retrieval precision, citation coverage, unsafe output rate and licence compliance.
2. **Review evaluation results**: determine whether the release meets quality thresholds. If not, identify issues (missing citations, poor retrieval, unsafe outputs) and iterate on the pipeline (e.g. improve chunking, refine risk rules).
3. **Approve release**: once legal, domain experts and product owners agree that the release meets quality standards, mark the release as approved and ready for indexing or training according to its allowed uses.
4. **Publish or index**: integrate the release into the target system (e.g. vector database for provider‑facing RAG, internal search index, training pipeline for SFT). Store evaluation results alongside the release manifest for audit purposes.

## Human‑in‑the‑loop checkpoints

Knowledge Foundry emphasises human supervision at every risky stage:

* **Licence review** — to ensure sources are legally ingestible.
* **Safety review** — to assess flagged content, supplement interactions, or unsupported legal or financial advice.
* **Evidence review** — to adjust claim evidence levels and resolve conflicts.
* **Release review** — to decide whether a release is good enough for the intended use (RAG, training, customer‑facing, commercial distribution).

Agents never override these checkpoints; they only prepare data and highlight concerns. This makes it possible to build trustworthy domain corpora that comply with legal and ethical requirements.