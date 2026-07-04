// kf screen-risk — apply the domain risk rules to a source's chunks.

import type { Command } from 'commander';
import { chunksFile, exists, resolveRoot, screenRisk } from '@knowledge-foundry/core';
import { fail, kv, line, warn } from '../lib/output.js';
import { requireConfig, requireSource, ws } from '../lib/context.js';

interface Options {
  domain: string;
  sourceId: string;
}

export function register(program: Command): void {
  program
    .command('screen-risk')
    .description('Screen a source\'s chunks against the domain risk rules')
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

      const risks = await screenRisk(source, config, opts);
      const counts = { high: 0, medium: 0, low: 0 };
      for (const r of risks) counts[r.severity] += 1;

      line(`screened risk for source "${source.source_id}"`);
      kv('risks', risks.length);
      kv('high', counts.high);
      kv('medium', counts.medium);
      kv('low', counts.low);

      if (counts.high > 0) {
        warn(
          `${counts.high} high-severity risk(s) found — each must be resolved by a human before release`,
        );
      }
    });
}
