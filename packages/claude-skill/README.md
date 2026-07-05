# @knowledge-foundry/skill

npx installer for the [Knowledge Foundry](https://github.com/XploreOS/knowledge-foundry) Claude Code skill — a governed pipeline for building trusted, licensed, versioned, RAG-ready domain corpora, driven by the deterministic `kf` CLI.

```bash
# install into this project (./.claude/skills/knowledge-foundry)
npx @knowledge-foundry/skill

# or install for every project (~/.claude/skills/knowledge-foundry)
npx @knowledge-foundry/skill --user

# then install the CLI the skill drives
npm install -g @knowledge-foundry/cli
```

Prefer the Claude Code plugin system? The repository is also a plugin marketplace:

```
/plugin marketplace add XploreOS/knowledge-foundry
/plugin install knowledge-foundry@knowledge-foundry
```

MIT © XploreOS
