// kf chunk — split a normalized document into cited ChunkRecords.

import type { Command } from 'commander';
import {
  chunkDocument,
  exists,
  normalizedDocFile,
  resolveRoot,
  updateSource,
} from '@knowledge-foundry/core';
import { fail, kv, line, note } from '../lib/output.js';
import { requireSource, ws } from '../lib/context.js';

interface Options {
  domain: string;
  sourceId: string;
  strategy?: string;
}

export function register(program: Command): void {
  program
    .command('chunk')
    .description('Chunk a normalized document into retrieval units')
    .requiredOption('--domain <id>', 'domain id')
    .requiredOption('--source-id <slug>', 'source id')
    .option('--strategy <s>', 'advisory chunking strategy (core derives it from source_type)')
    .action(async (options: Options, command: Command) => {
      const opts = ws(command);
      const source = await requireSource(options.domain, options.sourceId, opts);
      const root = resolveRoot(opts);

      if (!(await exists(normalizedDocFile(root, source.source_id)))) {
        fail(`source "${source.source_id}" has not been normalized`, [
          `run: kf normalize --domain ${options.domain} --source-id ${options.sourceId}`,
        ]);
      }
      if (options.strategy) {
        note(`--strategy is advisory; chunking strategy is derived from source_type "${source.source_type}"`);
      }

      const chunks = await chunkDocument(source, opts);
      await updateSource(options.domain, options.sourceId, { review_state: 'chunked' }, opts);

      line(`chunked source "${source.source_id}"`);
      kv('chunks', chunks.length);
    });
}
