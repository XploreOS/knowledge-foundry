# Domain Configuration

Knowledge Foundry is deliberately domain‑agnostic. To specialise it for a particular field—such as functional medicine, legal compliance or corporate HR—you provide a **domain configuration**. A domain’s configuration defines the taxonomy, evidence model, risk rules, source policies and review workflows that tailor the generic pipeline to the domain’s requirements.

## Core configuration files

Within the repository, each domain lives in a subdirectory domains/<domain\_id>/. The following files define the behaviour of the pipeline:

### domain.yaml

Describes the domain at a high level:

* **domain\_id** — unique identifier (e.g. coreaevo, legal, finance).
* **display\_name** — human‑readable name.
* **description** — overview of what the corpus covers.
* **primary\_use\_cases** — allowed uses (e.g. provider‑facing RAG, internal research, compliance audit).
* **prohibited\_use\_cases** — uses that are explicitly disallowed (e.g. autonomous diagnosis, personalised investment advice without review).
* **review\_roles** — list of roles required to approve content (e.g. legal, clinical SME, compliance, product owner).
* **default\_release\_use** — how to treat a release if no explicit intended\_use is specified (e.g. rag\_only or internal\_search).

### taxonomy.yaml

Defines the domain’s entity types, chunk types and allowed metadata fields. For example, a healthcare domain might include pathway, biomarker, supplement, lab\_test, contraindication, whereas a legal domain might include jurisdiction, statute, case, legal\_issue.

You can also define allowed values for fields such as evidence\_level, audience and chunk\_type.

### source\_policy.yaml

Sets licence classes and allowed uses. Typical classes are:

* **Green:** public domain or explicitly licensed for reuse. Ingestion and RAG allowed by default.
* **Yellow:** licence unclear or reuse uncertain. Requires legal review.
* **Orange:** commercial or proprietary. Requires contract approval before ingestion.
* **Red:** prohibited. Cannot be ingested or used.

You can add domain‑specific blockers (e.g. functional medicine courses, premium market data, or overruled legal cases) and allowed use flags (internal search, RAG, summarisation, extraction, training, customer facing, commercial distribution).

### evidence\_model.yaml

Defines how to grade evidence quality. A simple example is:

evidence\_levels:
 A:
 name: authoritative
 description: major guideline, regulation or audited filing
 B:
 name: high\_quality\_secondary
 description: systematic review, consensus statement, audited analysis
 C:
 name: primary\_observational
 description: cohort study, case report, internal data
 D:
 name: expert\_opinion
 description: expert consensus, playbook, protocol
 X:
 name: restricted
 description: unsupported, unsafe or prohibited

This file allows you to customise the categories and their definitions for your domain (e.g. adding RCT in biomedical research or persuasive\_precedent in law).

### risk\_rules.yaml

Defines risk categories and rules that identify unsafe or non‑compliant content. Categories might include:

* **contraindication** — e.g. supplement–drug interactions, high‑dose nutrient risks.
* **privacy\_violation** — disclosure of personal data or protected health information.
* **licence\_violation** — reuse of content in a way that violates terms.
* **unsupported\_advice** — statements that overstep professional scope (e.g. medical diagnosis or legal advice without licence).
* **mnpi\_risk** — material non‑public information in finance.

Each rule specifies what patterns to look for (keywords, metadata, evidence levels) and what action to take (flag for review, block, or downgrade evidence level).

### review\_workflow.yaml

Describes which roles must sign off at each stage. For example:

stages:
 licence\_review: [legal]
 safety\_review: [clinical\_sme, legal]
 evidence\_review: [clinical\_sme]
 release\_review: [legal, clinical\_sme, product\_owner]

This file can also specify whether a stage is optional or mandatory and how many reviewers are required (e.g. any one clinical SME vs. unanimous consent).

### eval\_questions.yaml

Contains a set of representative questions for RAG evaluation. These questions should exercise the corpus across its key topics and ensure that retrieval returns accurate, well‑cited, and safe information. In a functional medicine domain, questions might include “What are the guidelines for HbA1c optimal ranges for insulin resistance?” or “Which supplements interact with warfarin?”.

## Creating a new domain configuration

To add support for a new domain:

1. Create a subdirectory domains/<your\_domain>/.
2. Write a domain.yaml describing your domain, use cases and prohibited uses.
3. Design a taxonomy in taxonomy.yaml that reflects your domain’s entities and chunk types.
4. Define licence classes, allowed uses and blockers in source\_policy.yaml.
5. Specify an evidence grading scheme in evidence\_model.yaml.
6. Write risk rules in risk\_rules.yaml that flag content requiring review.
7. Define a review workflow in review\_workflow.yaml listing roles for each stage.
8. Prepare an initial set of evaluation questions in eval\_questions.yaml.

Once these files are in place, the generic agents and workflows will operate according to your domain’s rules.

## Updating domain configuration

Domain configurations are versioned. When updating a taxonomy, evidence model or risk rules, create a new version of the domain configuration or annotate the changes in your review workflow. Always coordinate with legal and subject matter experts when modifying use cases or risk rules.

### Example: CoreAevo functional medicine domain

As a concrete example, the CoreAevo domain used in functional and longevity medicine might define:

* Entity types such as pathway, biomarker, lab\_test, supplement, clinic\_service.
* Evidence levels A–X with definitions aligned with medical guidelines and expert protocols.
* Risk rules that flag high‑dose vitamin recommendations, hormone therapy without physician supervision, or recommending drugs off‑label.
* Review roles including legal counsel, a chief medical officer, and product owners.
* Evaluation questions covering cardiometabolic, inflammation, sleep, nutrition, hormones and recovery topics.

By plugging in such a configuration, teams can reuse the Knowledge Foundry pipeline while ensuring the output is safe, compliant and clinically valid.