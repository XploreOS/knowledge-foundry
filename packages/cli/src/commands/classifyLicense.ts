// kf classify-license — apply a domain's source policy to set license_class +
// allowed_uses on a source. --approve records the human ingestion approval.

import type { Command } from 'commander';
import { LICENSE_CLASSES, classifyLicense, createSource, updateSource } from '@knowledge-foundry/core';
import type { LicenseClass, SourceRecord } from '@knowledge-foundry/core';
import { fail, kv, line } from '../lib/output.js';
import { allowedUsesList, requireConfig, requireSource, ws } from '../lib/context.js';

interface Options {
  domain: string;
  sourceId: string;
  class: string;
  rationale?: string;
  approve?: boolean;
}

export function register(program: Command): void {
  program
    .command('classify-license')
    .description('Classify a source license and (optionally) record human approval')
    .requiredOption('--domain <id>', 'domain id')
    .requiredOption('--source-id <slug>', 'source id')
    .requiredOption('--class <Green|Yellow|Orange|Red|Unknown>', 'assigned license class')
    .option('--rationale <s>', 'classification rationale')
    .option('--approve', 'record human approval for ingestion (Yellow/Orange path)')
    .action(async (options: Options, command: Command) => {
      const opts = ws(command);
      if (!(LICENSE_CLASSES as readonly string[]).includes(options.class)) {
        fail(`invalid --class "${options.class}"`, [`allowed: ${LICENSE_CLASSES.join(', ')}`]);
      }

      const config = await requireConfig(options.domain, opts);
      const source = await requireSource(options.domain, options.sourceId, opts);

      const { source: classified } = classifyLicense(source, config, {
        licenseClass: options.class as LicenseClass,
        ...(options.rationale ? { rationale: options.rationale } : {}),
      });
      await createSource(classified, opts);

      let finalSource: SourceRecord = classified;
      if (options.approve) {
        finalSource = await updateSource(
          options.domain,
          options.sourceId,
          {
            approval_status: 'approved_for_ingestion',
            review_state: 'approved_for_ingestion',
          },
          opts,
        );
      }

      line(`classified source "${finalSource.source_id}"`);
      kv('license_class', finalSource.license_class);
      kv('allowed_uses', allowedUsesList(finalSource.allowed_uses));
      kv('legal_review_required', finalSource.legal_review_required ?? false);
      kv('review_state', finalSource.review_state);
      if (options.approve) {
        line('approval: recorded approval by human operator (approval_status=approved_for_ingestion)');
      }
    });
}
