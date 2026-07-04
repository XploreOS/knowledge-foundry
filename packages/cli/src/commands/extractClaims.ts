// kf extract-claims — scaffold claim records from a source's chunks.

import type { Command } from 'commander';
import { chunksFile, exists, extractClaims, resolveRoot } from '@knowledge-foundry/core';
import { fail, kv, line } from '../lib/output.js';
import { requireSource, ws } from '../lib/context.js';

interface Options {
  domain: string;
  sourceId: string;
}

export function register(program: Command): void {
  program
    .command('extract-claims')
    .description('Extract scaffold claim records from a source\'s chunks')
    .requiredOption('--domain <id>', 'domain id')
    .requiredOption('--source-id <slug>', 'source id')
    .action(async (options: Options, command: Command) => {
      const opts = ws(command);
      const source = await requireSource(options.domain, options.sourceId, opts);
      const root = resolveRoot(opts);

      if (!(await exists(chunksFile(root, source.source_id)))) {
        fail(`source "${source.source_id}" has no chunks`, [
          `run: kf chunk --domain ${options.domain} --source-id ${options.sourceId}`,
        ]);
      }

      const claims = await extractClaims(source, opts);
      line(`extracted claims from source "${source.source_id}"`);
      kv('claims', claims.length);
    });
}
