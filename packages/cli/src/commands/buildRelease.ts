// kf build-release — assemble a versioned release, enforcing the pre-release gate.

import type { Command } from 'commander';
import { buildRelease, releaseManifestFile, resolveRoot } from '@knowledge-foundry/core';
import type { AllowedUseKey } from '@knowledge-foundry/core';
import { blocked, kv, line } from '../lib/output.js';
import { parseIntendedUse, requireConfig, ws } from '../lib/context.js';

interface Options {
  domain: string;
  releaseId: string;
  intendedUse?: string;
}

export function register(program: Command): void {
  program
    .command('build-release')
    .description('Build a release manifest + approved chunk set (pre-release gate enforced)')
    .requiredOption('--domain <id>', 'domain id')
    .requiredOption('--release-id <rid>', 'release id, e.g. demo-p0-v0.1.0')
    .option('--intended-use <use>', 'intended use(s), comma-separated (default: domain default)')
    .action(async (options: Options, command: Command) => {
      const opts = ws(command);
      const config = await requireConfig(options.domain, opts);

      const uses: AllowedUseKey[] = options.intendedUse
        ? parseIntendedUse(options.intendedUse)
        : [config.domain.default_release_use];
      const intendedUse: AllowedUseKey | AllowedUseKey[] = uses.length === 1 ? uses[0]! : uses;

      const result = await buildRelease({
        ...opts,
        domainId: options.domain,
        releaseId: options.releaseId,
        intendedUse,
      });

      const manifestPath = releaseManifestFile(resolveRoot(opts), options.domain, options.releaseId);

      if (result.blocked) {
        line(`blocked manifest written to: ${manifestPath}`);
        blocked('RELEASE BLOCKED', result.manifest.blockers);
      }

      const m = result.manifest;
      line(`built release "${m.release_id}"`);
      kv('state', m.state);
      kv('intended_use', Array.isArray(m.intended_use) ? m.intended_use.join(', ') : m.intended_use);
      kv('source_count', m.source_count);
      kv('chunk_count', m.chunk_count);
      kv(
        'license_class_counts',
        Object.entries(m.license_class_counts)
          .map(([k, v]) => `${k}=${v}`)
          .join(' '),
      );
      kv('manifest', manifestPath);
    });
}
