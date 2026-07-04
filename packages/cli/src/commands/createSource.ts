// kf create-source — record a single candidate source in the registry.

import type { Command } from 'commander';
import {
  INGESTION_PRIORITIES,
  LICENSE_CLASSES,
  SourceRecord,
  createSource,
} from '@knowledge-foundry/core';
import type { IngestionPriority, LicenseClass } from '@knowledge-foundry/core';
import { fail, kv, line } from '../lib/output.js';
import { ensureDomain, ws } from '../lib/context.js';

interface Options {
  domain: string;
  sourceId: string;
  title: string;
  publisher: string;
  url?: string;
  sourceType: string;
  topics?: string;
  likelyLicense: string;
  priority: string;
  notes?: string;
}

export function register(program: Command): void {
  program
    .command('create-source')
    .description('Create a candidate source registry record')
    .requiredOption('--domain <id>', 'domain id')
    .requiredOption('--source-id <slug>', 'stable source id (lowercase slug)')
    .requiredOption('--title <t>', 'source title')
    .requiredOption('--publisher <p>', 'publisher')
    .option('--url <u>', 'canonical url', '')
    .option('--source-type <t>', 'source type', 'webpage')
    .option('--topics <csv>', 'comma-separated topics')
    .option('--likely-license <class>', 'discovery-time license guess', 'Unknown')
    .option('--priority <P0|P1|P2>', 'ingestion priority', 'P1')
    .option('--notes <s>', 'free-text notes')
    .action(async (options: Options, command: Command) => {
      const opts = ws(command);
      await ensureDomain(options.domain, opts);

      if (!(LICENSE_CLASSES as readonly string[]).includes(options.likelyLicense)) {
        fail(`invalid --likely-license "${options.likelyLicense}"`, [
          `allowed: ${LICENSE_CLASSES.join(', ')}`,
        ]);
      }
      if (!(INGESTION_PRIORITIES as readonly string[]).includes(options.priority)) {
        fail(`invalid --priority "${options.priority}"`, [
          `allowed: ${INGESTION_PRIORITIES.join(', ')}`,
        ]);
      }

      const now = new Date().toISOString();
      const topics = (options.topics ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '');

      let record: SourceRecord;
      try {
        record = SourceRecord.parse({
          source_id: options.sourceId,
          title: options.title,
          publisher: options.publisher,
          canonical_url: options.url ?? '',
          source_type: options.sourceType,
          domain: options.domain,
          topics,
          likely_license: options.likelyLicense as LicenseClass,
          ingestion_priority: options.priority as IngestionPriority,
          review_state: 'candidate',
          approval_status: null,
          ...(options.notes ? { notes: options.notes } : {}),
          created_at: now,
          updated_at: now,
        });
      } catch (err) {
        return fail(`invalid source record: ${(err as Error).message}`);
      }

      const saved = await createSource(record, opts);
      line(`created source "${saved.source_id}" in domain "${saved.domain}"`);
      kv('title', saved.title);
      kv('review_state', saved.review_state);
      kv('likely_license', saved.likely_license);
      kv('ingestion_priority', saved.ingestion_priority);
    });
}
