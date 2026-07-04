// kf init-domain — scaffold domains/<domainId>/ from a template.

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { Command } from 'commander';
import { initDomain, resolveRoot } from '@knowledge-foundry/core';
import type { WorkspaceOpts } from '@knowledge-foundry/core';
import { fail, kv, line } from '../lib/output.js';
import { ws } from '../lib/context.js';

interface Options {
  template: string;
  force?: boolean;
  templatesDir?: string;
}

/** Best-effort enumeration of available template names for error messages. */
async function availableTemplates(opts: WorkspaceOpts, explicit?: string): Promise<string[]> {
  const candidates = [
    ...(explicit ? [explicit] : []),
    path.join(resolveRoot(opts), 'packages', 'domain-templates'),
    path.join(process.cwd(), 'packages', 'domain-templates'),
  ];
  for (const dir of candidates) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const names = entries.filter((e) => e.isDirectory()).map((e) => e.name);
      if (names.length > 0) return names.sort();
    } catch {
      // try the next candidate
    }
  }
  return [];
}

export function register(program: Command): void {
  program
    .command('init-domain')
    .description('Scaffold a new domain config directory from a template')
    .argument('<domainId>', 'domain id (lowercase slug)')
    .option('--template <name>', 'template to copy', 'generic')
    .option('--force', 'overwrite an existing domain')
    .option('--templates-dir <dir>', 'explicit path to the domain-templates directory')
    .action(async (domainId: string, options: Options, command: Command) => {
      const opts = ws(command);
      try {
        const created = await initDomain(domainId, {
          ...opts,
          template: options.template,
          force: options.force ?? false,
          ...(options.templatesDir ? { templatesDir: options.templatesDir } : {}),
        });
        line(`created domain "${domainId}" from template "${options.template}"`);
        kv('path', created);
      } catch (err) {
        const message = (err as Error).message;
        const templates = await availableTemplates(opts, options.templatesDir);
        const details =
          templates.length > 0
            ? [`available templates: ${templates.join(', ')}`]
            : ['pass --templates-dir <dir> pointing at packages/domain-templates'];
        fail(message, details);
      }
    });
}
