# Knowledge Foundry

**A standalone Claude Code skillset and TypeScript CLI for building governed, licensed, versioned, RAG-ready domain knowledge corpora.**

Knowledge Foundry solves the problems that appear when teams naïvely dump documents into vector databases: unknown copyright status, missing provenance, inconsistent chunking, and unsafe recommendations. It provides a governed, repeatable pipeline:

```
Source Discovery → License Classification → Source Registry → Ingestion
  → Normalization → Semantic Chunking → Domain Tagging → Claim Extraction
  → Risk Screening → Conflict Detection → Human Review
  → Versioned Corpus Release → RAG Evaluation
```

Claude Code agents orchestrate the workflow. Deterministic TypeScript tools enforce the rules — license, safety, citation, and release gates are code, never LLM judgment.

## What's in the box

| Path | Contents |
|---|---|
| `skill/` | Claude Code skillset: `SKILL.md`, `CLAUDE.md`, `AGENTS.md`, slash commands, agent definitions, hooks |
| `packages/core` | Domain-agnostic library: zod schemas, storage layout, pipeline operations, deterministic gates |
| `packages/cli` | The `kf` CLI (`kf init-domain`, `kf ingest`, `kf build-release`, …) |
| `packages/adapters` | Format/source adapters: local files, web, markdown, JSON, CSV, PDF |
| `packages/domain-templates` | Starter domain configs: generic, healthcare, legal, finance, enterprise |
| `domains/functional-medicine` | Reference domain implementation (functional & longevity medicine) |
| `examples/` | Example corpus walkthroughs |
| `docs/` | Requirements, architecture, ADRs, guides |

## Quick start

```bash
npm install
npm run build
npm test

# Link the CLI
npm link -w @knowledge-foundry/cli

# Create and validate a domain
kf init-domain demo
kf validate-domain demo
```

See [docs/getting-started.md](docs/getting-started.md) for the full walkthrough, and [docs/architecture.md](docs/architecture.md) for how the pieces fit together.

## Key guarantees

- **License classes** — every source is Green / Yellow / Orange / Red with explicit allowed uses; Red is never ingested, Yellow/Orange require recorded approval first.
- **Immutable raw artefacts** — SHA-256 checksummed, write-once.
- **Citations required** — chunks without citations cannot enter a release.
- **Human review gates** — legal, SME, and release sign-offs are recorded states, enforced by code.
- **Machine-readable releases** — every release ships a `manifest.json` with sources, licenses, evidence summary, gate results, and evaluation metrics.
- **Domain-agnostic engine** — all domain behavior lives in YAML config under `domains/<domain_id>/`; functional medicine is just the first reference domain.

## License

MIT — see [LICENSE](LICENSE).
