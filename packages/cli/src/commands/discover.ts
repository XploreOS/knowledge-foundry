// kf discover — local-first ingest of agent-produced candidate SourceRecords
// from a user-supplied JSONL file. No web search: agents do discovery, this
// validates + imports their output, filling sensible defaults.

import { promises as fs } from 'node:fs';
import type { Command } from 'commander';
import { SourceRecord, createSource } from '@knowledge-foundry/core';
import { fail, kv, line } from '../lib/output.js';
import { ensureDomain, ws } from '../lib/context.js';

interface Options {
  domain: string;
  fromFile: string;
}

export function register(program: Command): void {
  program
    .command('discover')
    .description('Import candidate source records from a JSONL file')
    .requiredOption('--domain <id>', 'domain id')
    .requiredOption('--from-file <jsonl>', 'path to a JSONL file of candidate sources')
    .action(async (options: Options, command: Command) => {
      const opts = ws(command);
      await ensureDomain(options.domain, opts);

      let raw: string;
      try {
        raw = await fs.readFile(options.fromFile, 'utf8');
      } catch (err) {
        return fail(`could not read --from-file "${options.fromFile}"`, [(err as Error).message]);
      }

      const now = new Date().toISOString();
      const lines = raw.split(/\r?\n/);
      const errors: string[] = [];
      let imported = 0;

      for (let i = 0; i < lines.length; i += 1) {
        const text = lines[i]?.trim() ?? '';
        if (text === '') continue;
        const lineNo = i + 1;

        let obj: Record<string, unknown>;
        try {
          obj = JSON.parse(text) as Record<string, unknown>;
        } catch (err) {
          errors.push(`line ${lineNo}: invalid JSON — ${(err as Error).message}`);
          continue;
        }

        const withDefaults = {
          domain: options.domain,
          topics: [],
          likely_license: 'Unknown',
          ingestion_priority: 'P1',
          approval_status: null,
          ...obj,
          review_state: obj.review_state ?? 'candidate',
          created_at: obj.created_at ?? now,
          updated_at: obj.updated_at ?? now,
        };

        const parsed = SourceRecord.safeParse(withDefaults);
        if (!parsed.success) {
          const detail = parsed.error.issues
            .map((iss) => `${iss.path.join('.') || '(root)'}: ${iss.message}`)
            .join('; ');
          errors.push(`line ${lineNo}: ${detail}`);
          continue;
        }
        if (parsed.data.domain !== options.domain) {
          errors.push(
            `line ${lineNo}: record domain "${parsed.data.domain}" != --domain "${options.domain}"`,
          );
          continue;
        }

        await createSource(parsed.data, opts);
        imported += 1;
      }

      for (const e of errors) process.stderr.write(`  - ${e}\n`);
      line(`imported candidate sources into domain "${options.domain}"`);
      kv('imported', imported);
      kv('skipped', errors.length);

      if (imported === 0 && errors.length > 0) {
        fail('no candidate sources were imported', ['every non-empty line failed validation']);
      }
      if (errors.length > 0) {
        process.exitCode = 1;
      }
    });
}
