// kf detect-conflicts — find contradictions across a domain's chunks by topic.

import type { Command } from 'commander';
import { conflictsFile, detectConflicts, resolveRoot } from '@knowledge-foundry/core';
import { kv, line } from '../lib/output.js';
import { ensureDomain, ws } from '../lib/context.js';

interface Options {
  domain: string;
  topic?: string;
}

export function register(program: Command): void {
  program
    .command('detect-conflicts')
    .description('Detect conflicts across a domain\'s chunks (optionally one topic)')
    .requiredOption('--domain <id>', 'domain id')
    .option('--topic <t>', 'restrict detection to a single topic')
    .action(async (options: Options, command: Command) => {
      const opts = ws(command);
      await ensureDomain(options.domain, opts);

      const conflicts = await detectConflicts(options.domain, {
        ...opts,
        ...(options.topic ? { topic: options.topic } : {}),
      });

      const fileName = options.topic ?? 'all';
      line(`detected conflicts in domain "${options.domain}"`);
      kv('topic', options.topic ?? '(all topics)');
      kv('conflicts', conflicts.length);
      kv('file', conflictsFile(resolveRoot(opts), options.domain, fileName));
    });
}
