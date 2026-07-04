// kf eval-rag — deterministic retrieval evaluation of a release, checked
// against the domain's optional eval thresholds.

import type { Command } from 'commander';
import { evalRag, exists, releaseChunksFile, resolveRoot } from '@knowledge-foundry/core';
import { fail, kv, line } from '../lib/output.js';
import { requireConfig, ws } from '../lib/context.js';

interface Options {
  domain: string;
  releaseId: string;
}

function fmt(n: number): string {
  return n.toFixed(4);
}

export function register(program: Command): void {
  program
    .command('eval-rag')
    .description('Evaluate a release\'s retrieval against the domain eval questions')
    .requiredOption('--domain <id>', 'domain id')
    .requiredOption('--release-id <rid>', 'release id')
    .action(async (options: Options, command: Command) => {
      const opts = ws(command);
      const config = await requireConfig(options.domain, opts);
      const root = resolveRoot(opts);

      if (!(await exists(releaseChunksFile(root, options.domain, options.releaseId)))) {
        fail(`release "${options.releaseId}" has no approved chunk set to evaluate`, [
          'the release may be blocked or not yet built',
          `run: kf build-release --domain ${options.domain} --release-id ${options.releaseId}`,
        ]);
      }

      const result = await evalRag(
        { ...opts, domainId: options.domain, releaseId: options.releaseId },
        config,
      );

      line(`evaluated release "${options.releaseId}"`);
      kv('question_count', result.question_count);
      kv('citation_coverage', fmt(result.citation_coverage));
      kv('retrieval_precision', fmt(result.retrieval_precision));
      kv('unsafe_output_rate', fmt(result.unsafe_output_rate));
      kv('license_errors', result.license_errors);

      const thresholds = config.eval_questions.thresholds;
      if (!thresholds) return;

      const failures: string[] = [];
      if (
        thresholds.citation_coverage !== undefined &&
        result.citation_coverage < thresholds.citation_coverage
      ) {
        failures.push(
          `citation_coverage ${fmt(result.citation_coverage)} < threshold ${fmt(thresholds.citation_coverage)}`,
        );
      }
      if (
        thresholds.retrieval_precision !== undefined &&
        result.retrieval_precision < thresholds.retrieval_precision
      ) {
        failures.push(
          `retrieval_precision ${fmt(result.retrieval_precision)} < threshold ${fmt(thresholds.retrieval_precision)}`,
        );
      }
      if (
        thresholds.unsafe_output_rate !== undefined &&
        result.unsafe_output_rate > thresholds.unsafe_output_rate
      ) {
        failures.push(
          `unsafe_output_rate ${fmt(result.unsafe_output_rate)} > threshold ${fmt(thresholds.unsafe_output_rate)}`,
        );
      }

      if (failures.length > 0) {
        fail(`release "${options.releaseId}" FAILED eval thresholds`, failures);
      }
      line('thresholds: PASS');
    });
}
