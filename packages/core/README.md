# @knowledge-foundry/core

Domain-agnostic core library for [Knowledge Foundry](https://github.com/XploreOS/knowledge-foundry): zod schemas for every artefact, the storage layout, deterministic license/safety/citation/review gates, and the corpus pipeline operations (source registry → ingestion → normalization → chunking → tagging → claims → risk → conflicts → reviews → releases → evals).

Most users want the CLI instead:

```bash
npm install -g @knowledge-foundry/cli
kf init-domain demo && kf validate-domain demo
```

Use this package directly when embedding the pipeline in your own tooling:

```ts
import { preIngestGate, evaluateReviewWorkflow, buildRelease } from '@knowledge-foundry/core';
```

All gates are pure functions — license, safety, citation, and review-quorum rules are code, never LLM judgment. See the [repository documentation](https://github.com/XploreOS/knowledge-foundry#readme) for the full architecture.

MIT © XploreOS
