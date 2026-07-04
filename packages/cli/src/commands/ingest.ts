// kf ingest — run the pre-ingest gate, then store the raw artefact write-once.

import type { Command } from 'commander';
import { createSource, ingest, rawManifestFile, resolveRoot } from '@knowledge-foundry/core';
import type { IngestContent } from '@knowledge-foundry/core';
import { fetchUrl, readLocalFile } from '@knowledge-foundry/adapters';
import { blocked, fail, kv, line } from '../lib/output.js';
import { requireSource, ws } from '../lib/context.js';

interface Options {
  domain: string;
  sourceId: string;
  file?: string;
  fetch?: boolean;
  force?: boolean;
}

export function register(program: Command): void {
  program
    .command('ingest')
    .description('Ingest a source (pre-ingest gate enforced) from a local file or its URL')
    .requiredOption('--domain <id>', 'domain id')
    .requiredOption('--source-id <slug>', 'source id')
    .option('--file <path>', 'read content from a local file')
    .option('--fetch', 'fetch content from the source canonical_url')
    .option('--force', 'overwrite an existing write-once raw artefact')
    .action(async (options: Options, command: Command) => {
      const opts = ws(command);
      const source = await requireSource(options.domain, options.sourceId, opts);

      if (!options.file && !options.fetch) {
        fail('no content source given', ['pass --file <path> or --fetch (explicit fetch required)']);
      }
      if (options.file && options.fetch) {
        fail('choose one of --file or --fetch, not both');
      }

      let content: IngestContent;
      if (options.file) {
        const local = await readLocalFile(options.file);
        content = { buffer: local.buffer, contentType: local.contentType, fileName: local.fileName };
      } else {
        if (source.canonical_url.trim() === '') {
          fail(`source "${source.source_id}" has no canonical_url to --fetch`, [
            'use --file <path> instead',
          ]);
        }
        const web = await fetchUrl(source.canonical_url);
        content = { buffer: web.buffer, contentType: web.contentType };
      }

      const result = await ingest(source, content, { ...opts, force: options.force ?? false });
      if (result.blocked) {
        blocked('BLOCKED BY PRE-INGEST GATE', result.reasons);
      }

      await createSource(result.source, opts);
      line(`ingested source "${result.source.source_id}"`);
      kv('review_state', result.source.review_state);
      kv('checksum_sha256', result.source.checksum_sha256);
      kv('manifest', rawManifestFile(resolveRoot(opts), result.source.source_id));
    });
}
