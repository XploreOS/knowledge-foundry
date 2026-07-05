# Contributing to Knowledge Foundry

Thanks for considering a contribution! This document covers the practical
rules; the architecture itself is documented under [docs/](docs/).

## Ground rules

- Be respectful — see the [Code of Conduct](CODE_OF_CONDUCT.md).
- Security issues go through [SECURITY.md](SECURITY.md), never public issues.
- Substantial changes deserve an issue first so the approach can be discussed
  before you invest in an implementation.

## Development setup

```bash
git clone https://github.com/XploreOS/knowledge-foundry.git
cd knowledge-foundry
npm install
npm test          # builds all packages, then runs the vitest suite
```

Node >= 20 and npm (workspaces) are the only requirements.

## Commit messages: Conventional Commits (required)

Releases and versioning are fully automated by
[release-please](https://github.com/googleapis/release-please) from commit
messages, so commits on `main` **must** follow
[Conventional Commits](https://www.conventionalcommits.org/):

- `feat(scope): ...` — new functionality (minor version bump)
- `fix(scope): ...` — bug fix (patch bump)
- `feat!:` / `BREAKING CHANGE:` footer — breaking change (major bump)
- `docs:`, `test:`, `chore:`, `refactor:`, `ci:` — no release

PRs are squash-merged, so the PR title must itself be a valid conventional
commit message.

## What the code must uphold

Knowledge Foundry's value is that its gates are deterministic:

1. **Gates are pure functions in `packages/core/src/gates/`** — no IO, no
   LLM judgment, no hidden state. The CLI, tests, and skill hooks call the
   exact same functions.
2. **Schemas are the contract** — every artefact is validated with zod on
   read and write. See `docs/internal/contract-spec.md` before changing any
   schema; the on-disk formats are versioned data other people's corpora
   depend on.
3. **Paths are built in one place** — `packages/core/src/storage/paths.ts`.
   Never construct an artefact path by hand elsewhere.
4. **Deterministic output** — JSONL sorted by id, stable blocker ordering.
   Tests assert on exact strings deliberately.

## Pull requests

1. Fork/branch from `main`.
2. Add or update tests — `tests/unit/` for pure logic, `tests/integration/`
   for CLI-level behavior through the real binary.
3. `npm test` must pass on your machine (CI runs Ubuntu + Windows, Node 20
   and 22).
4. Update the docs that your change makes stale (`docs/`, `skill/`, package
   READMEs).
5. Open the PR with a conventional-commit title and a short description of
   the why, not just the what.

## Releases (maintainers)

Merging to `main` updates the release-please PR; merging **that** PR tags
the release and publishes every `@knowledge-foundry/*` package to npm with
provenance. There is no manual version editing — versions live in
`.release-please-manifest.json` and flow from commit types.
