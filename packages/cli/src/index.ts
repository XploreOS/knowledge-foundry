#!/usr/bin/env node
// kf — the Knowledge Foundry CLI. A thin, deterministic wrapper over the
// @knowledge-foundry/core public API and @knowledge-foundry/adapters. Every
// command validates its inputs, maps gate blocks to a non-zero exit, and prints
// stable, grep-able `key: value` output. All artefact IO and every gate live in
// core; this layer only parses flags and formats results.

import { Command } from 'commander';
import { CliError } from './lib/output.js';
import { register as initDomain } from './commands/initDomain.js';
import { register as validateDomain } from './commands/validateDomain.js';
import { register as createSource } from './commands/createSource.js';
import { register as discover } from './commands/discover.js';
import { register as classifyLicense } from './commands/classifyLicense.js';
import { register as ingest } from './commands/ingest.js';
import { register as normalize } from './commands/normalize.js';
import { register as chunk } from './commands/chunk.js';
import { register as tag } from './commands/tag.js';
import { register as extractClaims } from './commands/extractClaims.js';
import { register as screenRisk } from './commands/screenRisk.js';
import { register as detectConflicts } from './commands/detectConflicts.js';
import { register as review } from './commands/review.js';
import { register as reviewStatus } from './commands/reviewStatus.js';
import { register as buildRelease } from './commands/buildRelease.js';
import { register as validateRelease } from './commands/validateRelease.js';
import { register as approveRelease } from './commands/approveRelease.js';
import { register as evalRag } from './commands/evalRag.js';

const program = new Command();

program
  .name('kf')
  .description('Knowledge Foundry — build governed, licensed, versioned, RAG-ready domain corpora')
  .version('0.1.0')
  .option('--root <dir>', 'workspace root (falls back to KF_ROOT, then cwd)');

// Every command registers itself with actions wrapped so that a thrown error
// prints a clean `Error: <message>` (CliError is already reported) and exits 1.
const registrars = [
  initDomain,
  validateDomain,
  createSource,
  discover,
  classifyLicense,
  ingest,
  normalize,
  chunk,
  tag,
  extractClaims,
  screenRisk,
  detectConflicts,
  review,
  reviewStatus,
  buildRelease,
  validateRelease,
  approveRelease,
  evalRag,
];
for (const register of registrars) register(program);

// A rejected async action propagates out of parseAsync: turn any error that is
// not an already-reported CliError into a clean `Error: <message>` + exit 1.
try {
  await program.parseAsync(process.argv);
} catch (err) {
  if (!(err instanceof CliError)) {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    process.exitCode = 1;
  }
}
