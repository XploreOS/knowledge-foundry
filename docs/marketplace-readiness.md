# Marketplace Readiness

How to package and distribute Knowledge Foundry, what v0.1 deliberately
leaves out, the versioning/breaking-change policy, and a checklist for
publishing. See [architecture.md](architecture.md) for the monorepo
layout referenced below and
[functional-medicine-reference-domain.md](functional-medicine-reference-domain.md)
for the one non-generic piece this package ships.

## Distribution shapes

Knowledge Foundry packages into three complementary artefacts, which can
ship together or separately:

### 1. Claude Code skill bundle — `skill/`

`skill/` is self-contained: `SKILL.md`, `CLAUDE.md`, `AGENTS.md`,
`commands/*.md` (12), `agents/*.md` (11), `hooks/*.md` (4). Every
instruction in this directory maps to a deterministic `kf` operation
(ADR-012) — nothing in it depends on repo layout outside of the
documented `data/`, `releases/`, `evals/`, `domains/` paths under a
workspace root. To distribute the skill alone, copy the `skill/`
directory into a Claude Code project; it references the `kf` CLI by name
(the CLI must be installed/linked separately) and never assumes a
specific host repo structure beyond the workspace-root convention.

### 2. npm CLI — `@knowledge-foundry/cli`

The `kf` command, published as `@knowledge-foundry/cli` (with its
`@knowledge-foundry/core` and `@knowledge-foundry/adapters`
dependencies). Installable via:

```bash
npm install -g @knowledge-foundry/cli
# or, from a workspace checkout:
npm install && npm run build && npm link -w @knowledge-foundry/cli
```

`packages/cli/package.json` declares `"bin": { "kf": "./dist/index.js" }`
— once linked or globally installed, `kf` resolves on `PATH`.

### 3. GitHub repo

The full monorepo — skill, CLI packages, domain templates, the
functional-medicine reference domain, examples, and docs — as a single
clone-and-go project. This is the richest distribution shape: a team gets
the skill, the CLI source, five domain-templates to start from, and a
worked reference domain to study, all in one `git clone`.

These three are not mutually exclusive — a marketplace listing can point
at the GitHub repo while also publishing the CLI to npm and describing
the skill bundle as importable on its own.

## What's deliberately NOT in v0.1

- **No database.** All artefacts are files under `data/`, `releases/`,
  `evals/` (ADR-004). No Postgres, no SQLite, no embedded KV store.
- **No vector store.** Knowledge Foundry produces the corpus
  (`approved_chunks.jsonl` + `manifest.json`); it does not integrate with
  Pinecone, Milvus, Azure AI Search, or any other vector database. A
  release is meant to be trivially indexable by whatever stack a
  consuming team already runs — that indexing step is out of scope here.
- **No paid APIs.** Discovery operates on user-supplied or manually
  curated candidate lists and direct web fetch; there is no dependency on
  a paid search API, and no dependency on a hosted LLM API beyond
  whatever the orchestrating Claude Code session already provides.
- **No review UI.** Human review (`license_review`, `safety_review`,
  `evidence_review`, `release_review`) is recorded through `kf` commands
  and `ReviewRecord`s, not a web interface. A reviewer's decision is data,
  not a UI feature.
- **PDF extraction is a stub.** `packages/adapters/src/pdf/index.ts`
  throws unconditionally: `"PDF ingestion is not supported in v0.1;
  supply pre-extracted markdown or text alongside the source."` Sources
  that are PDFs must be pre-extracted before `kf ingest`/`kf normalize`
  will handle them; there is no bundled PDF parser in this version.

None of this is accidental scope-creep avoidance — it is the stated v0.1
boundary. Extending any of these (a vector-store push command, a review
UI, a real PDF adapter, RAGAS/DeepEval integration for richer evaluation)
is a natural v0.2+ direction, not a v0.1 gap to work around.

## Versioning and breaking-change policy

- **The package itself**: `package.json` at the repo root and each
  `packages/*/package.json` carry independent semver versions, currently
  `0.1.0` across the board. A breaking change to any exported schema
  shape, CLI flag, or file-layout convention documented in
  `docs/internal/contract-spec.md` is a major-version-worthy change for
  every package that depends on it.
- **Schemas are the contract.** Because every artefact is validated
  against a zod schema in `packages/core/src/schemas/`, a "breaking
  change" is precisely defined: any change that would make previously
  valid JSONL/JSON/YAML fail validation, or any change to enum values
  (`LicenseClass`, `ReviewState`, `ReleaseState`, `RiskAction`,
  `RiskSeverity`) that existing data relies on.
- **Domain configs version independently.** Each `domains/<domain_id>/`
  carries its own `domain.yaml.version` (semver) — see
  [domain-config.md](domain-config.md)'s versioning guidance. Bumping a
  domain's config version does not require bumping the engine's version,
  and vice versa.
- **Releases are immutable, not versioned in place.** A correction to a
  shipped release is a new `release_id`, never a patch to an existing
  one (see [release-model.md](release-model.md)). This means release
  consumers never need to worry about a release's contents silently
  changing under them.
- **Document breaking changes plainly.** Until a formal CHANGELOG process
  exists, breaking changes should be called out in the commit/PR
  description and, for schema changes, cross-referenced against the
  specific section of `docs/internal/contract-spec.md` that changed.

## Publishing checklist

Before publishing (to npm, GitHub, or a future marketplace):

- [ ] `npm install && npm run build && npm test` all pass from a clean
      checkout.
- [ ] `kf init-domain demo && kf validate-domain --domain demo` succeeds
      end-to-end (see [getting-started.md](getting-started.md)).
- [ ] All seven `docs/*.md` files (this set) are present and cross-link
      correctly to `skill/` and to each other.
- [ ] `skill/SKILL.md`, `CLAUDE.md`, `AGENTS.md`, and every file under
      `skill/commands/`, `skill/agents/`, `skill/hooks/` are internally
      consistent with the CLI commands and schemas they describe (see
      "Known inconsistencies" below — resolve before a public release).
- [ ] No inaccessible/internal-only APIs are referenced anywhere in
      `skill/` or `packages/` (the skillset must work standalone for any
      adopter, per `docs/requirements/06-development-guide.md`).
- [ ] At least one non-reference domain template
      (`packages/domain-templates/{generic,healthcare,legal,finance,enterprise}`)
      has been exercised through the full pipeline, not just validated.
- [ ] `LICENSE` (MIT) is present and referenced from the root `README.md`.
- [ ] Example corpora under `examples/` reflect the actual CLI command
      names and flags in `docs/internal/contract-spec.md` — not stale
      names from an earlier draft.
- [ ] Version numbers across `package.json` files are consistent and the
      breaking-change policy above has been applied to anything changed
      since the last publish.

## A note on scope

Knowledge Foundry is domain-agnostic infrastructure: the same skill, the
same agents, the same `kf` CLI work for healthcare, legal, financial, or
internal corporate knowledge corpora. What changes between domains is
only the seven YAML files under `domains/<domain_id>/` (ADR-013). This is
the pitch for why it's marketplace-shaped in the first place — a team
adopting it gets a reusable, auditable pipeline instead of re-inventing
licensing, chunking, and review logic per project, and the functional
medicine reference domain is proof-of-concept, not a dependency (see
[functional-medicine-reference-domain.md](functional-medicine-reference-domain.md)).
