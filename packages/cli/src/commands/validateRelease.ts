// kf validate-release — re-run the pre-release gate against the live corpus.

import type { Command } from 'commander';
import { exists, releaseManifestFile, resolveRoot, validateRelease } from '@knowledge-foundry/core';
import { fail, kv, line } from '../lib/output.js';
import { ensureDomain, ws } from '../lib/context.js';

interface Options {
  domain: string;
  releaseId: string;
}

export function register(program: Command): void {
  program
    .command('validate-release')
    .description('Validate an existing release against the current corpus')
    .requiredOption('--domain <id>', 'domain id')
    .requiredOption('--release-id <rid>', 'release id')
    .action(async (options: Options, command: Command) => {
      const opts = ws(command);
      await ensureDomain(options.domain, opts);
      const root = resolveRoot(opts);

      if (!(await exists(releaseManifestFile(root, options.domain, options.releaseId)))) {
        fail(`release "${options.releaseId}" not found in domain "${options.domain}"`, [
          `build it first: kf build-release --domain ${options.domain} --release-id ${options.releaseId}`,
        ]);
      }

      const result = await validateRelease({ ...opts, domainId: options.domain, releaseId: options.releaseId });

      if (!result.valid) {
        line(`release "${options.releaseId}" state: ${result.manifest.state}`);
        fail(`release "${options.releaseId}" is NOT valid`, result.blockers);
      }

      line(`release "${options.releaseId}" is VALID`);
      kv('state', result.manifest.state);
      kv('source_count', result.manifest.source_count);
      kv('chunk_count', result.manifest.chunk_count);
    });
}
