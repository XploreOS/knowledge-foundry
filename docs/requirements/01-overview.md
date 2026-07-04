# Knowledge Foundry Skillset Overview

## Purpose

Knowledge Foundry is a generic Claude‑Code skillset for building **trusted, licensed and versioned domain corpora**. It addresses the problems that arise when people naïvely ingest random documents into vector databases: copyright compliance, lack of provenance, inconsistent chunking, and unsafe recommendations. By providing a governed workflow and domain‑agnostic primitives, Knowledge Foundry gives teams a repeatable way to assemble retrieval‑augmented corpora for any professional domain.

## Key capabilities

* **Source discovery** — find candidate documents, APIs and datasets using controlled searches and domain policies.
* **License and usage classification** — determine whether a source can be ingested for internal search, RAG, fine‑tuning or customer‑facing use.
* **Ingestion and normalization** — download approved sources, store them immutably, and convert them into clean Markdown/JSON while preserving citations, structure and metadata.
* **Semantic chunking** — break documents into retrieval‑friendly units based on clinical or legal meaning rather than arbitrary token windows.
* **Domain tagging** — enrich each chunk with domain‑specific concepts such as topics, pathways, interventions, citations, audiences, risk types and evidence levels.
* **Claim extraction** — identify explicit claims, populations, interventions and outcomes, and assign evidence grades.
* **Risk and safety screening** — flag contraindications, privacy hazards, unsupported recommendations or domain‑specific compliance violations.
* **Conflict detection** — detect contradictions across sources and create a queue for expert review.
* **Human review gates** — enforce legal and subject‑matter approvals at key points in the pipeline.
* **Release management** — bundle reviewed chunks into versioned corpus releases with manifests and evaluation metrics.
* **RAG evaluation** — run automated tests on each release to measure citation coverage, retrieval precision and unsafe output rate.

## Benefits

By following the Knowledge Foundry workflow teams can:

* **Reduce legal risk** by respecting licenses, copyrights and privacy restrictions.
* **Improve reliability** by ensuring that every answer links back to credible and up‑to‑date sources.
* **Accelerate development** by reusing the same pipeline across domains such as healthcare, legal, finance or internal corporate knowledge.
* **Separate concerns** — keep raw ingestion, transformation and RAG evaluation deterministic while letting Claude‑Code agents orchestrate complex workflows.
* **Build differentiated IP** by curating proprietary protocols, ontologies and expert judgement rather than mixing them into raw model weights.