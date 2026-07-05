# @knowledge-foundry/cli

`kf` — the [Knowledge Foundry](https://github.com/XploreOS/knowledge-foundry) CLI for building governed, licensed, versioned, RAG-ready domain knowledge corpora.

```bash
npm install -g @knowledge-foundry/cli

kf init-domain demo          # scaffold the 7 domain YAML files from a template
kf validate-domain demo      # zod-validate them
kf create-source --domain demo --source-id handbook --title "Handbook" --publisher "ACME"
kf classify-license --domain demo --source-id handbook --class Green
kf ingest --domain demo --source-id handbook --file ./handbook.md
kf normalize / chunk / tag / extract-claims / screen-risk / detect-conflicts ...
kf build-release --domain demo --release-id demo-rag-v0.1.0
kf eval-rag --domain demo --release-id demo-rag-v0.1.0
kf review / review-status / approve-release   # recorded sign-offs gate approval
```

18 commands, 1:1 with `@knowledge-foundry/core` operations. Every gate — license class, citation, unresolved risk, review quorum — is deterministic code that exits non-zero with the reasons; no agent or prompt can talk it into passing.

Full walkthrough: [getting-started](https://github.com/XploreOS/knowledge-foundry/blob/main/docs/getting-started.md). Pairs with the Knowledge Foundry Claude Code skill: `npx @knowledge-foundry/skill`.

MIT © XploreOS
