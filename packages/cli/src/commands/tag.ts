// kf tag — apply the domain taxonomy/evidence model to a source's chunks.

import type { Command } from 'commander';
import { chunksFile, exists, resolveRoot, tagChunks, updateSource } from '@knowledge-foundry/core';
import { fail, kv, line } from '../lib/output.js';
import { requireConfig, requireSource, ws } from '../lib/context.js';

interface Options {
  domain: string;
  sourceId: string;
}

export function register(program: Command): void {
  program
    .command('tag')
    .description('Tag a source\'s chunks with domain topics/entities/evidence')
    .requiredOption('--domain <id>', 'domain id')
    .requiredOption('--source-id <slug>', 'source id')
    .action(async (options: Options, command: Command) => {
      const opts = ws(command);
      const config = await requireConfig(options.domain, opts);
      const source = await requireSource(options.domain, options.sourceId, opts);
      const root = resolveRoot(opts);

      if (!(await exists(chunksFile(root, source.source_id)))) {
        fail(`source "${source.source_id}" has no chunks`, [
          `run: kf chunk --domain ${options.domain} --source-id ${options.sourceId}`,
        ]);
      }

      const tagged = await tagChunks(source, config, opts);
      await updateSource(options.domain, options.sourceId, { review_state: 'tagged' }, opts);

      const topics = new Set<string>();
      const entityTypes = new Set<string>();
      const chunkTypes = new Set<string>();
      for (const c of tagged) {
        for (const t of c.topics ?? []) topics.add(t);
        for (const e of c.entities ?? []) entityTypes.add(e.type);
        if (c.chunk_type) chunkTypes.add(c.chunk_type);
      }

      line(`tagged source "${source.source_id}"`);
      kv('chunks_tagged', tagged.length);
      kv('distinct_topics', topics.size > 0 ? [...topics].sort().join(', ') : 'none');
      kv('distinct_entity_types', entityTypes.size > 0 ? [...entityTypes].sort().join(', ') : 'none');
      kv('chunk_types', chunkTypes.size > 0 ? [...chunkTypes].sort().join(', ') : 'none');
    });
}
