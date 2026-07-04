// kf normalize — turn an ingested raw artefact into Markdown + metadata.

import type { Command } from 'commander';
import {
  exists,
  normalize,
  normalizedDocFile,
  rawManifestFile,
  resolveRoot,
  updateSource,
} from '@knowledge-foundry/core';
import { fail, kv, line } from '../lib/output.js';
import { requireSource, ws } from '../lib/context.js';

interface Options {
  domain: string;
  sourceId: string;
}

export function register(program: Command): void {
  program
    .command('normalize')
    .description('Normalize an ingested source into document.md + metadata.json')
    .requiredOption('--domain <id>', 'domain id')
    .requiredOption('--source-id <slug>', 'source id')
    .action(async (options: Options, command: Command) => {
      const opts = ws(command);
      const source = await requireSource(options.domain, options.sourceId, opts);
      const root = resolveRoot(opts);

      if (!(await exists(rawManifestFile(root, source.source_id)))) {
        fail(`source "${source.source_id}" has not been ingested`, [
          `run: kf ingest --domain ${options.domain} --source-id ${options.sourceId} --file <path>`,
        ]);
      }

      const meta = await normalize(source, opts);
      await updateSource(options.domain, options.sourceId, { review_state: 'normalized' }, opts);

      line(`normalized source "${source.source_id}"`);
      kv('headings', meta.headings.length);
      kv('citations', meta.citations.length);
      kv('document', normalizedDocFile(root, source.source_id));
    });
}
