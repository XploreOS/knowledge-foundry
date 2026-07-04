# Development Guide

This guide explains how to develop, extend and deploy the Knowledge Foundry skillset. It covers the typical development workflow, recommended stack, and guidelines for publishing your own domain‑corpus skill.

## Repository structure

A typical Knowledge Foundry project has the following layout:

knowledge-foundry/
 SKILL.md ← top‑level skill description for Claude‑Code
 CLAUDE.md ← operating contract and rules
 AGENTS.md ← descriptions of subagents and prompts
 commands/ ← slash‑command templates used by Claude‑Code
 agents/ ← individual agent definitions and documentation
 hooks/ ← shell scripts or checks executed before/after key stages
 packages/
 cli/ ← TypeScript CLI for local use (`kf` commands)
 core/ ← domain‑agnostic library functions (parsers, storage, evaluation)
 adapters/ ← optional connectors (web, pdf, JSON, S3, Azure)
 domain-templates/ ← example domain configurations
 domains/
 your\_domain/ ← your custom taxonomy, evidence model, risk rules, etc.
 data/ ← generated artefacts (sources, raw, chunks, claims, risks, conflicts)
 releases/ ← corpus releases ready for RAG or training
 evals/ ← evaluation results per release

The **skill files** (SKILL.md, CLAUDE.md, AGENTS.md) define how Claude‑Code should behave. The **CLI and core library** implement the deterministic operations (ingestion, normalisation, chunking, etc.), and domain configurations drive domain‑specific behaviour.

## Recommended stack

Knowledge Foundry is designed to be technology‑agnostic, but the reference implementation uses:

* **TypeScript** for the CLI and core libraries, ensuring type safety and ease of maintenance.
* **Node.js** for cross‑platform execution and an ecosystem of parsers (HTML, PDF, YAML, JSON).
* **Zod** for schema validation of source records, chunks, claims and manifests.
* **YAML/JSON** for configuration files; domain policies are easy to read and edit.
* **JSONL** for streaming large sets of chunks and claims; each line is a self‑contained record.
* **Git** for version control and change tracking of domain configurations.

You can adapt this to other languages or frameworks as long as you preserve the core contract: deterministic tools produce artefacts that Claude‑Code orchestrates.

## Building the CLI

The CLI (kf) wraps the core library and exposes high‑level commands for each pipeline stage. To develop it:

1. Install dependencies with npm install.
2. Build the library with npm run build (compiles TypeScript to JavaScript).
3. Link the package locally with npm link so you can run kf from the command line.
4. Implement new commands under packages/cli/src/commands/ following the pattern of existing ones.
5. Write tests in tests/ to ensure your command handles happy and failure paths.

Example usage:

# Initialise a new domain configuration
kf init-domain coreaevo

# Discover candidate guidelines on insulin resistance
kf discover --domain coreaevo --topic "insulin resistance guidelines" --source-type guideline --max 10

# Classify licences for all candidates
kf classify-license --domain coreaevo

# Ingest approved sources
kf ingest --domain coreaevo

# Normalise and chunk sources
kf normalize --domain coreaevo
kf chunk --domain coreaevo

# Tag, extract claims and screen risk
kf tag --domain coreaevo
kf extract-claims --domain coreaevo
kf screen-risk --domain coreaevo

# Build and evaluate a release
kf build-release --domain coreaevo --release-id coreaevo-p0-v0.1
kf eval-rag --release-id coreaevo-p0-v0.1

## Claude‑Code skill development

Claude‑Code orchestrates the pipeline by invoking slash commands and managing the state of the project. To develop the skill:

1. Write clear instructions in SKILL.md describing what the skill does and when to use it.
2. Define an operating contract in CLAUDE.md enumerating non‑negotiable rules (e.g. licence checks, human review, no overrides).
3. Document each agent in AGENTS.md with the role, inputs, outputs and example prompts. Claude‑Code will use these as heuristics when deciding which agent to call.
4. Create commands/ to define user‑facing slash commands that map to CLI commands. For example, /discover-source can wrap kf discover.
5. Build agents/ files to describe how to call the CLI tools programmatically. For example, the discovery agent reads domain\_id and topic and runs kf discover with those arguments.
6. Implement hooks/ to enforce validations (e.g. pre‑ingest licence check, post‑chunk schema validation). Claude‑Code will automatically run these hooks when present.

## Publishing to a marketplace

Although an official Claude‑Code marketplace has not been announced, designing your skillset as a self‑contained package makes it easier to publish later. To prepare for publishing:

* Ensure your skillset does not rely on inaccessible APIs or internal tools.
* Provide comprehensive documentation in the skill files and a README.md explaining installation and usage.
* Include example domains and test data to help users understand how to adapt the pipeline to their needs.
* Maintain versioned releases of your skillset and document breaking changes.

Until an official marketplace exists, you can distribute Knowledge Foundry via GitHub, NPM or as a compressed archive. Users can import the skillset into Claude‑Code by loading the skill folder.

## Extending the pipeline

The pipeline is modular. You can extend it by:

* **Adding new agents**: for example, a **quality scorer** that rates the readability of chunks, or a **translation agent** that produces multiple language versions.
* **Custom connectors**: write new ingestion adapters to fetch data from systems like Google Drive, Dropbox or proprietary databases.
* **Advanced evaluation**: integrate tools like RAGAS or DeepEval to test nuanced aspects of retrieval (e.g. summarisation quality, reasoning correctness).
* **UI for review**: build a simple web interface to browse sources, claims, risk flags and release manifests so reviewers can approve or edit content without using CLI.
* **Integration with vector stores**: add commands to push approved chunks into a specific vector database (e.g. Pinecone, Milvus, Azure AI Search).

## Best practices

* **Start small**: focus on one domain and a narrow set of use cases (e.g. P0 guidelines for a pilot). Grow the corpus as you refine the pipeline.
* **Automate checks**: use hooks and schema validation to catch problems early. Do not rely on manual inspection alone.
* **Version everything**: treat domain configuration files and releases like code. Use Git for change history and rollbacks.
* **Separate public and proprietary content**: never mix paid or proprietary sources into a corpus intended for distribution without explicit licensing.
* **Keep humans in the loop**: the pipeline supports automation, but final judgement on evidence, safety and release readiness must come from subject matter experts.

By following this guide, you can develop and maintain a high‑quality Knowledge Foundry skillset that scales across domains and teams.