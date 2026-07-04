// kf validate-domain — verify the seven domain YAML files parse + validate.

import type { Command } from 'commander';
import { loadDomainConfig, validateDomain } from '@knowledge-foundry/core';
import { fail, kv, line } from '../lib/output.js';
import { ws } from '../lib/context.js';

export function register(program: Command): void {
  program
    .command('validate-domain')
    .description('Validate a domain configuration (all 7 YAML files)')
    .argument('<domainId>', 'domain id')
    .action(async (domainId: string, _options: unknown, command: Command) => {
      const opts = ws(command);
      const result = await validateDomain(domainId, opts);
      if (!result.valid) {
        fail(`domain "${domainId}" is INVALID`, result.issues);
      }
      const config = await loadDomainConfig(domainId, opts);
      line(`domain "${domainId}" is VALID`);
      kv('display_name', config.domain.display_name);
      kv('version', config.domain.version);
      kv('entity_types', config.taxonomy.entity_types.length);
      kv('chunk_types', config.taxonomy.chunk_types.length);
      kv('risk_rules', config.risk_rules.rules.length);
      kv('eval_questions', config.eval_questions.questions.length);
    });
}
