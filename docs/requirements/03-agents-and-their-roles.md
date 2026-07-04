# Agents and Their Roles

A Knowledge Foundry skillset is made up of multiple specialised agents. Each agent is responsible for a single stage in the corpus pipeline and is designed to be deterministic and auditable. This document summarises the agents and sketches example prompts for Claude‑Code orchestration.

## 1. Source discovery agent

**Role:** search for candidate resources in a given domain and topic. Output provisional source records containing a title, canonical URL, publisher, source type, domain tags, likely licence class and ingestion priority.

**Inputs:**

* domain — the domain identifier (e.g. coreaevo or legal).
* topic — subject area to search for (e.g. “insulin resistance guideline”, “employment law jurisdiction conflicts”).
* source\_type — type of content (guideline, regulation, research article, dataset, API, internal document).
* max\_candidates — limit on the number of records to produce.

**Outputs:** candidate source registry entries (one per line in a JSONL file). Each entry should include:

{
 "source\_id": "string",
 "title": "string",
 "publisher": "string",
 "canonical\_url": "string",
 "source\_type": "string",
 "domain": "string",
 "topics": ["string"],
 "likely\_license": "Green|Yellow|Orange|Red|Unknown",
 "ingestion\_priority": "P0|P1|P2",
 "notes": "string"
}

**Example prompt for Claude‑Code:**

"Search for open‑access guidelines on cardiometabolic risk. For each candidate you find, record its title, URL, publisher and licence hints. Limit to 20 results. Save the candidates to data/source\_registry/candidates/coreaevo/2026‑07‑04‑cardiometabolic.jsonl."

## 2. Licence classifier agent

**Role:** determine the licence class and allowed uses of a source based on its terms and conditions.

**Inputs:**

* source\_id — the identifier of the source to classify.

**Outputs:** an updated source record with:

* license\_class: one of Green, Yellow, Orange, Red.
* allowed\_uses: boolean flags for internal\_search, rag, extraction, fine\_tuning, customer\_facing and commercial\_distribution.
* legal\_review\_required: whether the source needs legal sign‑off.

**Example prompt:**

"Review the terms of service for nih‑ods‑vitamin‑d. Based on the ODS site policy, classify the licence class and whether the content can be used for RAG and internal search. Update the source record accordingly."

## 3. Ingestion agent

**Role:** download or fetch an approved source and store it immutably.

**Inputs:**

* source\_id — the identifier of an approved source.

**Outputs:**

* Raw artefact (HTML, PDF, JSON, etc.) stored in data/raw/<source\_id>/.
* Ingestion manifest with retrieval date, checksum and any errors.

**Example prompt:**

"Ingest source nih‑ods‑vitamin‑d. Download the full article and save it under data/raw/nih‑ods‑vitamin‑d/. Record the retrieval date and checksum."

## 4. Normalisation agent

**Role:** convert a raw artefact into a clean and structured format (Markdown/JSON) while retaining citations and structure.

**Inputs:**

* source\_id — the identifier of the source to normalise.

**Outputs:**

* Clean Markdown file stored in data/normalized/<source\_id>/document.md.
* Metadata sidecar with headings, table of contents, page numbers, etc.

**Example prompt:**

"Normalize the nih‑ods‑vitamin‑d document. Remove navigation and ads, preserve headings and tables, and output a Markdown file and metadata JSON."

## 5. Chunking agent

**Role:** split normalised documents into semantically meaningful retrieval units.

**Inputs:**

* source\_id — the identifier of the source to chunk.

**Outputs:**

* JSONL file of chunks stored under data/chunks/<source\_id>/chunks.jsonl. Each record includes chunk\_id, section\_path, text, citation and metadata.

**Strategy hints:** Choose a chunking strategy based on the content type:

* **Guidelines:** chunk by recommendation or section.
* **Research articles:** chunk by abstract, methods, results, discussion.
* **Statutes/regulations:** chunk by article or paragraph.
* **Data tables:** treat each row as a chunk.

**Example prompt:**

"Split nih‑ods‑vitamin‑d into guideline‑level chunks. For each chunk, include the section path and citation details. Store in JSONL."

## 6. Taxonomy tagger

**Role:** attach domain‑specific metadata to each chunk.

**Inputs:**

* source\_id — the identifier of the source whose chunks should be tagged.
* domain\_id — the domain configuration to use.

**Outputs:**

* Updated chunk records with fields such as topics, entities, chunk\_type, evidence\_level and audience.

**Example prompt:**

"Tag the chunks of nih‑ods‑vitamin‑d using the CoreAevo taxonomy. Identify which biomarker, pathway and intervention each chunk relates to. Assign an evidence level based on the domain's evidence model."

## 7. Claim extractor

**Role:** identify explicit claims in each chunk and capture their structure.

**Inputs:**

* source\_id — the identifier of the source to analyse.

**Outputs:**

* JSONL file stored in data/claims/<source\_id>/claims.jsonl containing claim records with fields:
* claim\_text
* population\_or\_scope
* intervention
* outcome
* evidence\_level
* limitations

**Example prompt:**

"From each chunk in nih‑ods‑vitamin‑d, extract claims that recommend, caution or summarise evidence. Describe the population, intervention and outcome in structured fields. Save to claims.jsonl."

## 8. Risk screening agent

**Role:** flag chunks or claims that might pose legal, safety or compliance risks.

**Inputs:**

* source\_id — the identifier of the source to screen.
* domain\_id — the domain configuration.

**Outputs:**

* JSONL file of risk flags stored in data/risk/<source\_id>/risk.jsonl. Each record includes the risk type (e.g., contraindication, privacy violation, licensing risk) and a description.

**Example prompt:**

"Run the CoreAevo risk rules on the chunks of nih‑ods‑vitamin‑d. Flag any supplements that could interact with medications or any recommendations that exceed Tolerable Upper Intake Levels."

## 9. Conflict detection agent

**Role:** detect contradictions across chunks and sources.

**Inputs:**

* domain\_id — the domain configuration.
* topic — optional filter for topics to compare.

**Outputs:**

* JSONL file stored in data/conflicts/<domain\_id>/<topic>.jsonl where each record lists conflicting chunk ids, the nature of the conflict and references for review.

**Example prompt:**

"Compare vitamin D upper limits across all approved CoreAevo sources. Identify conflicting thresholds and output a conflict record for CMO review."

## 10. Release manager

**Role:** assemble approved chunks into a versioned corpus release and generate a manifest.

**Inputs:**

* domain\_id — the domain configuration.
* release\_id — unique identifier for the release.

**Outputs:**

* releases/<domain\_id>/<release\_id>/manifest.json summarising source counts, licence classes, evidence summary and evaluation metrics.
* releases/<domain\_id>/<release\_id>/approved\_chunks.jsonl containing chunks that passed review.

**Example prompt:**

"Build release coreaevo‑p0‑v0.1 for CoreAevo. Include all chunks that are Green and have been approved by legal, CMO and product. Generate a manifest summarising the release."

## 11. RAG evaluator

**Role:** test retrieval quality and safety of a release using a set of representative questions.

**Inputs:**

* release\_id — identifier of the release to evaluate.
* domain\_id — the domain configuration.

**Outputs:**

* evals/<release\_id>/results.json containing metrics such as citation coverage, retrieval precision, unsafe output rate and license errors.

**Example prompt:**

"Evaluate release coreaevo‑p0‑v0.1 using the CoreAevo evaluation questions. Report citation coverage and highlight any unsafe responses."

## Orchestration tips

* Each agent’s output becomes the input for the next. Claude‑Code should check that required files exist and pass schema validation before proceeding.
* Write reusable slash commands (e.g. /discover-source, /classify-license) that accept domain and topic arguments. This makes the skillset easier to use in different contexts.
* Always route high‑risk or ambiguous cases to human reviewers. Agents should never override licensing restrictions or safety rules.